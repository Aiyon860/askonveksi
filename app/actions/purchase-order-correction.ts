"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { flashMessagePath, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { auditFieldLabel, type AuditDiffEntry } from "@/lib/audit/labels";
import { CRM_OPERATOR_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { firstValidationMessage, purchaseOrderCorrectionSchema, purchaseOrderIdSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";

// Pooler Supabase bisa lambat; koreksi roster bisa menyentuh ribuan baris.
const CORRECTION_TRANSACTION_OPTIONS = {
  maxWait: 20_000,
  timeout: 60_000,
} as const;

// Riwayat revisi dokumen menampilkan metadata diff; roster besar cukup dirangkum.
const MAX_AUDIT_DIFFS = 100;

function dateText(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function dateValue(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new UserFacingError("Tanggal tidak valid.");
  return date;
}

/**
 * Koreksi data PO disepakati tanpa membatalkan invoice. Ukuran, jumlah, dan harga
 * tetap terkunci karena invoice memakai angka tersebut; field di sini hanya identitas
 * dokumen, deadline, pola, dan identitas roster. Deadline produksi ikut disalin ke
 * Work Order produksi yang masih aktif agar jadwal produksi tidak tertinggal.
 *
 * DEVELOPER/OWNER tetap bisa mengakses lewat `requireActor` (AGENTS.md).
 */
export async function correctPurchaseOrderAction(formData: FormData) {
  return runRedirectingAction("/crm/purchase-orders", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const identity = purchaseOrderIdSchema.safeParse({
      purchaseOrderId: formData.get("purchaseOrderId"),
      version: formData.get("version"),
    });
    if (!identity.success) throw new UserFacingError("Purchase order tidak valid.");

    const prisma = getPrismaClient();
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: identity.data.purchaseOrderId },
      select: {
        id: true,
        purchaseOrderNo: true,
        status: true,
        version: true,
        opportunityId: true,
        instansi: true,
        customerReference: true,
        deadline: true,
        items: { orderBy: { position: "asc" }, select: { id: true, name: true, pola: true } },
        designTask: { select: { id: true, deadline: true } },
        rosterEntries: {
          orderBy: { position: "asc" },
          select: { id: true, itemId: true, memberId: true, name: true, jabatan: true },
        },
      },
    });
    if (!purchaseOrder) throw new UserFacingError("Purchase order tidak ditemukan.");
    // Draft memakai form revisi biasa; PO batal/superseded adalah dokumen arsip.
    if (purchaseOrder.status !== "AGREED") {
      throw new UserFacingError("Koreksi data hanya dapat dilakukan pada PO yang sudah disepakati.");
    }
    if (purchaseOrder.version !== identity.data.version) {
      throw new UserFacingError("PO sudah berubah di tab lain. Muat ulang halaman lalu coba lagi.");
    }

    const parsed = purchaseOrderCorrectionSchema.safeParse({
      purchaseOrderId: identity.data.purchaseOrderId,
      version: identity.data.version,
      instansi: formData.get("instansi"),
      customerReference: formData.get("customerReference"),
      deadline: formData.get("deadline"),
      designDeadline: formData.get("designDeadline"),
      reason: formData.get("reason"),
      items: purchaseOrder.items.map((item) => ({
        id: item.id,
        pola: formData.get(`itemPola-${item.id}`),
      })),
      roster: purchaseOrder.rosterEntries.map((entry) => ({
        id: entry.id,
        memberId: formData.get(`rosterMemberId-${entry.id}`),
        name: formData.get(`rosterName-${entry.id}`),
        jabatan: formData.get(`rosterJabatan-${entry.id}`),
      })),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    // Tugas desain mewajibkan deadline; PO tanpa tugas desain mengabaikan field ini.
    if (purchaseOrder.designTask && !parsed.data.designDeadline) {
      throw new UserFacingError("Deadline desain wajib diisi.");
    }

    const rosterById = new Map(parsed.data.roster.map((entry) => [entry.id, entry]));
    // ID roster harus unik per produk (aturan yang sama dengan form PO).
    const seenMembers = new Set<string>();
    const finalRoster = purchaseOrder.rosterEntries.map((entry) => {
      const submitted = rosterById.get(entry.id);
      const memberId = submitted?.memberId ?? entry.memberId;
      const key = `${entry.itemId}:${memberId.toLocaleLowerCase("id-ID")}`;
      if (seenMembers.has(key)) {
        throw new UserFacingError(`ID roster "${memberId}" tidak boleh duplikat dalam satu produk.`);
      }
      seenMembers.add(key);
      return {
        id: entry.id,
        itemId: entry.itemId,
        memberId,
        name: submitted?.name ?? entry.name,
        jabatan: submitted?.jabatan ?? entry.jabatan ?? undefined,
      };
    });

    const diffs: AuditDiffEntry[] = [];
    const addDiff = (field: string, label: string, from: string | null, to: string | null) => {
      if ((from ?? "") !== (to ?? "")) diffs.push({ field, label, from: from || null, to: to || null });
    };

    addDiff("instansi", auditFieldLabel("instansi"), purchaseOrder.instansi, parsed.data.instansi);
    addDiff("customerReference", auditFieldLabel("customerReference"), purchaseOrder.customerReference, parsed.data.customerReference ?? null);
    addDiff("deadline", auditFieldLabel("deadline"), dateText(purchaseOrder.deadline), parsed.data.deadline);
    addDiff(
      "designDeadline",
      auditFieldLabel("designDeadline"),
      purchaseOrder.designTask ? dateText(purchaseOrder.designTask.deadline) : null,
      purchaseOrder.designTask ? parsed.data.designDeadline ?? null : null,
    );

    const itemById = new Map(purchaseOrder.items.map((item) => [item.id, item]));
    for (const item of parsed.data.items) {
      const current = itemById.get(item.id);
      if (!current) throw new UserFacingError("Produk PO tidak ditemukan.");
      addDiff("pola", `Pola ${current.name}`, current.pola, item.pola ?? null);
    }

    const currentRosterById = new Map(purchaseOrder.rosterEntries.map((entry) => [entry.id, entry]));
    for (const entry of finalRoster) {
      const current = currentRosterById.get(entry.id);
      if (!current) continue;
      const label = `Roster ${current.memberId}`;
      addDiff("roster", `${label} — ID`, current.memberId, entry.memberId);
      addDiff("roster", `${label} — nama`, current.name, entry.name);
      addDiff("roster", `${label} — jabatan`, current.jabatan, entry.jabatan ?? null);
    }

    if (!diffs.length) throw new UserFacingError("Tidak ada perubahan untuk disimpan.");

    const deadlineChanged = dateText(purchaseOrder.deadline) !== parsed.data.deadline;
    const opportunityId = await prisma.$transaction(async (tx) => {
      const guarded = await tx.purchaseOrder.updateMany({
        where: { id: purchaseOrder.id, version: parsed.data.version, status: "AGREED" },
        data: {
          version: { increment: 1 },
          instansi: parsed.data.instansi,
          customerReference: parsed.data.customerReference ?? null,
          deadline: dateValue(parsed.data.deadline),
        },
      });
      if (guarded.count !== 1) {
        throw new UserFacingError("PO sudah berubah di tab lain. Muat ulang halaman lalu coba lagi.");
      }

      if (purchaseOrder.designTask && parsed.data.designDeadline) {
        await tx.designTask.update({
          where: { id: purchaseOrder.designTask.id },
          data: { deadline: dateValue(parsed.data.designDeadline) },
        });
      }

      for (const item of parsed.data.items) {
        await tx.purchaseOrderItem.updateMany({
          where: { id: item.id, purchaseOrderId: purchaseOrder.id },
          data: { pola: item.pola ?? null },
        });
      }

      for (const entry of finalRoster) {
        await tx.purchaseOrderRosterEntry.updateMany({
          where: { id: entry.id, purchaseOrderId: purchaseOrder.id },
          data: { memberId: entry.memberId, name: entry.name, jabatan: entry.jabatan ?? null },
        });
      }

      // Work Order sudah terlanjur dibuat dengan deadline lama; samakan agar jadwal
      // produksi mengikuti koreksi PO. WO selesai/batal tidak diubah (arsip).
      let syncedWorkOrders: string[] = [];
      if (deadlineChanged) {
        const workOrders = await tx.productionWorkOrder.findMany({
          where: { status: "ACTIVE", salesOrder: { purchaseOrderId: purchaseOrder.id } },
          select: { id: true, workOrderNo: true },
        });
        if (workOrders.length) {
          const deadline = dateValue(parsed.data.deadline);
          await Promise.all(
            workOrders.map((workOrder) => tx.productionWorkOrder.update({ where: { id: workOrder.id }, data: { deadline } })),
          );
          syncedWorkOrders = workOrders.map((workOrder) => workOrder.workOrderNo);
        }
      }

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "PurchaseOrder",
          entityId: purchaseOrder.id,
          action: "PURCHASE_ORDER_CORRECTED",
          changedFields: [...new Set(diffs.map((diff) => diff.field))],
          metadata: {
            purchaseOrderNo: purchaseOrder.purchaseOrderNo,
            ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
            diffCount: diffs.length,
            // Metadata audit tidak perlu memuat ribuan baris roster.
            ...(diffs.length ? { diff: diffs.slice(0, MAX_AUDIT_DIFFS) } : {}),
            ...(syncedWorkOrders.length ? { syncedWorkOrders } : {}),
          },
        },
      });

      return purchaseOrder.opportunityId;
    }, CORRECTION_TRANSACTION_OPTIONS);

    revalidatePath("/crm");
    revalidatePath("/crm/purchase-orders");
    revalidateTag("purchase-orders", { expire: 0 });
    revalidatePath(`/crm/peluang/${opportunityId}`);
    if (deadlineChanged) {
      revalidatePath("/produksi");
      revalidateTag("production-board", { expire: 0 });
    }

    return flashMessagePath(`/crm/peluang/${opportunityId}?tab=po`, "notice", "Koreksi data PO tersimpan. Nilai invoice tidak berubah.");
  });
}
