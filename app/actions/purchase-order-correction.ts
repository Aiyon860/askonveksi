"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";

import { flashMessagePath, runFormAction, runRedirectingAction, UserFacingError, type FormActionState } from "@/lib/actions/response";
import { auditFieldLabel, type AuditDiffEntry } from "@/lib/audit/labels";
import { CRM_OPERATOR_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { firstValidationMessage, purchaseOrderCorrectionSchema, purchaseOrderIdSchema, purchaseOrderInPlaceEditSchema } from "@/lib/crm/validation";
import { designImageContentType, designImageExtensionFor, designImageRejection, type DesignImageMime } from "@/lib/design/image";
import { getPrismaClient } from "@/lib/prisma";
import { erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";

// Pooler Supabase bisa lambat; koreksi roster bisa menyentuh ribuan baris.
const CORRECTION_TRANSACTION_OPTIONS = {
  maxWait: 20_000,
  timeout: 60_000,
} as const;

// Riwayat revisi dokumen menampilkan metadata diff; roster besar cukup dirangkum.
const MAX_AUDIT_DIFFS = 100;
// Batas unggah desain customer, sama dengan alur unggah desain biasa.
const MAX_DESIGN_FILES = 5;
const MAX_DESIGN_BYTES = 5 * 1024 * 1024;

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

/**
 * Simpan form Edit PO langsung ke PO yang sama (tanpa versi revisi baru) saat masih ada
 * invoice aktif. Ukuran/jumlah tidak dibaca dari form: data invoice tetap memakai baris
 * yang sudah ada. Bila invoice sudah tidak aktif, alur edit memakai revisi PO biasa.
 */
export async function updatePurchaseOrderInPlaceAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  return runFormAction("update-po-in-place", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const identity = purchaseOrderIdSchema.safeParse({
      purchaseOrderId: formData.get("purchaseOrderId"),
      version: formData.get("version"),
    });
    if (!identity.success) throw new UserFacingError("Purchase order tidak valid.");

    // Form PO mengirim produk per posisi (`item-0-*`, `item-1-*`, ...).
    const itemCount = formData.getAll("itemKey").length;
    const items = Array.from({ length: itemCount }, (_, index) => {
      const prefix = `item-${index}-`;
      const rosterMemberIds = formData.getAll(`${prefix}rosterMemberId`);
      const rosterNames = formData.getAll(`${prefix}rosterName`);
      const rosterJabatans = formData.getAll(`${prefix}rosterJabatan`);
      const text = (field: string) => {
        const value = formData.get(field);
        return typeof value === "string" ? value : "";
      };
      return {
        name: text(`${prefix}name`),
        pola: text(`${prefix}pola`),
        material: text(`${prefix}material`),
        baseColor: text(`${prefix}baseColor`),
        variationColor: text(`${prefix}variationColor`),
        designNotes: text(`${prefix}designNotes`),
        roster: Array.from({ length: Math.max(rosterMemberIds.length, rosterNames.length, rosterJabatans.length) }, (_, row) => ({
          memberId: rosterMemberIds[row],
          name: rosterNames[row],
          jabatan: rosterJabatans[row],
        })).filter((row) => row.memberId || row.name || row.jabatan),
      };
    });

    const parsed = purchaseOrderInPlaceEditSchema.safeParse({
      purchaseOrderId: identity.data.purchaseOrderId,
      version: identity.data.version,
      instansi: formData.get("instansi"),
      orderDate: formData.get("orderDate"),
      deadline: formData.get("deadline"),
      designDeadline: formData.get("designDeadline"),
      sampleSize: formData.get("sampleSize"),
      notes: formData.get("notes"),
      depositRequired: formData.get("depositRequired") === "on",
      items,
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const prisma = getPrismaClient();
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: parsed.data.purchaseOrderId },
      select: {
        id: true,
        purchaseOrderNo: true,
        status: true,
        version: true,
        opportunityId: true,
        garmentType: true,
        productName: true,
        instansi: true,
        material: true,
        baseColor: true,
        color: true,
        variationColor: true,
        orderDate: true,
        sampleSize: true,
        designNotes: true,
        notes: true,
        deadline: true,
        depositRequired: true,
        designTask: { select: { id: true, deadline: true } },
        items: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            name: true,
            pola: true,
            material: true,
            baseColor: true,
            variationColor: true,
            designNotes: true,
          },
        },
        rosterEntries: {
          orderBy: { position: "asc" },
          select: { id: true, itemId: true, memberId: true, name: true, jabatan: true },
        },
      },
    });
    if (!purchaseOrder) throw new UserFacingError("Purchase order tidak ditemukan.");
    if (purchaseOrder.status !== "AGREED") {
      throw new UserFacingError("PO berstatus ini tidak dapat diedit. Gunakan revisi PO untuk dokumen draft.");
    }
    if (purchaseOrder.version !== parsed.data.version) {
      throw new UserFacingError("PO sudah berubah di tab lain. Muat ulang halaman lalu coba lagi.");
    }
    if (!purchaseOrder.items.length) {
      throw new UserFacingError("PO ini belum punya rincian produk. Batalkan invoice lalu gunakan revisi PO.");
    }
    if (parsed.data.items.length !== purchaseOrder.items.length) {
      throw new UserFacingError("Jumlah produk PO tidak boleh berubah selama invoice masih aktif.");
    }

    // Desain customer boleh diganti walau invoice aktif: gambar tidak dipakai untuk
    // menghitung qty/harga, jadi versi baru ditambahkan tanpa mengubah nilai invoice.
    type DesignUpload = { itemId: string; itemName: string; bytes: Uint8Array; contentType: DesignImageMime; originalName: string; sizeBytes: number; path: string };
    const designUploads: Array<{ itemId: string; itemName: string; attachments: DesignUpload[] }> = [];
    const designTaskId = purchaseOrder.designTask?.id;
    for (const item of purchaseOrder.items) {
      const files = formData.getAll(`designFiles-${item.id}`).filter((value): value is File => value instanceof File && value.size > 0);
      if (!files.length) continue;
      if (!designTaskId) throw new UserFacingError("PO ini belum punya tugas desain, jadi gambar desain customer belum bisa diunggah.");
      if (files.length > MAX_DESIGN_FILES) throw new UserFacingError(`Maksimal ${MAX_DESIGN_FILES} gambar desain customer untuk ${item.name}.`);
      const attachments: DesignUpload[] = [];
      for (const file of files) {
        if (file.size > MAX_DESIGN_BYTES) throw new UserFacingError(`Setiap gambar desain maksimal 5 MB (${file.name}).`);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const contentType = designImageContentType(file.name, bytes);
        if (!contentType) throw new UserFacingError(designImageRejection(file.name));
        attachments.push({
          itemId: item.id,
          itemName: item.name,
          bytes,
          contentType,
          originalName: file.name.slice(0, 255),
          sizeBytes: file.size,
          path: `design/${designTaskId}/${randomUUID()}.${designImageExtensionFor(contentType)}`,
        });
      }
      designUploads.push({ itemId: item.id, itemName: item.name, attachments });
    }

    const diffs: AuditDiffEntry[] = [];
    const addDiff = (field: string, label: string, from: string | null, to: string | null) => {
      if ((from ?? "") !== (to ?? "")) diffs.push({ field, label, from: from || null, to: to || null });
    };

    addDiff("instansi", auditFieldLabel("instansi"), purchaseOrder.instansi, parsed.data.instansi);
    addDiff("orderDate", auditFieldLabel("orderDate"), dateText(purchaseOrder.orderDate), parsed.data.orderDate ?? null);
    addDiff("deadline", auditFieldLabel("deadline"), dateText(purchaseOrder.deadline), parsed.data.deadline);
    addDiff("designDeadline", auditFieldLabel("designDeadline"), dateText(purchaseOrder.designTask?.deadline ?? null), purchaseOrder.designTask ? parsed.data.designDeadline ?? null : null);
    addDiff("sampleSize", auditFieldLabel("sampleSize"), purchaseOrder.sampleSize, parsed.data.sampleSize ?? null);
    addDiff("notes", auditFieldLabel("notes"), purchaseOrder.notes, parsed.data.notes ?? null);
    addDiff("depositRequired", "Perlu deposit", purchaseOrder.depositRequired ? "Ya" : "Tidak", parsed.data.depositRequired ? "Ya" : "Tidak");

    // Roster per produk dicocokkan menurut urutan baris yang ada; ukuran tiap baris tidak diubah.
    const rosterByItem = new Map<string, typeof purchaseOrder.rosterEntries>();
    for (const entry of purchaseOrder.rosterEntries) {
      const list = rosterByItem.get(entry.itemId);
      if (list) list.push(entry);
      else rosterByItem.set(entry.itemId, [entry]);
    }
    const rosterUpdates: Array<{ id: string; itemName: string; from: { memberId: string; name: string; jabatan: string | null }; memberId: string; name: string; jabatan: string | null }> = [];
    parsed.data.items.forEach((item, position) => {
      const current = purchaseOrder.items[position];
      if (!current) return;
      addDiff("productName", `Nama produk ${position + 1}`, current.name, item.name);
      addDiff("pola", `Pola ${current.name}`, current.pola, item.pola);
      addDiff("material", `Bahan ${current.name}`, current.material, item.material);
      addDiff("baseColor", `Warna dasar ${current.name}`, current.baseColor, item.baseColor);
      addDiff("variationColor", `Warna variasi ${current.name}`, current.variationColor, item.variationColor || null);
      addDiff("designNotes", `Catatan desain ${current.name}`, current.designNotes, item.designNotes || null);
      item.roster.forEach((row, rowIndex) => {
        const existing = (rosterByItem.get(current.id) ?? [])[rowIndex];
        if (!existing) throw new UserFacingError("Baris roster PO berubah. Muat ulang halaman lalu coba lagi.");
        const jabatan = row.jabatan?.trim() || null;
        rosterUpdates.push({ id: existing.id, itemName: current.name, from: existing, memberId: row.memberId, name: row.name, jabatan });
        addDiff("roster", `Roster ${current.name} — ID`, existing.memberId, row.memberId);
        addDiff("roster", `Roster ${current.name} — nama`, existing.name, row.name);
        addDiff("roster", `Roster ${current.name} — jabatan`, existing.jabatan, jabatan);
      });
    });

    if (!diffs.length && !designUploads.length) throw new UserFacingError("Tidak ada perubahan untuk disimpan.");

    const deadline = dateValue(parsed.data.deadline);
    const deadlineChanged = dateText(purchaseOrder.deadline) !== parsed.data.deadline;
    const firstItem = parsed.data.items[0];
    const storage = erpStorage(PO_DESIGNS_BUCKET);
    const uploadedPaths: string[] = [];
    if (designUploads.length) {
      for (const upload of designUploads.flatMap((entry) => entry.attachments)) {
        const { error } = await storage.upload(upload.path, upload.bytes, { contentType: upload.contentType, upsert: false });
        if (error) {
          console.error("Gagal mengunggah desain customer dari Edit PO.", { path: upload.path, sizeBytes: upload.bytes.length, status: error.status, statusCode: error.statusCode, message: error.message });
          if (uploadedPaths.length) await storage.remove(uploadedPaths);
          throw new UserFacingError("File desain belum dapat disimpan.");
        }
        uploadedPaths.push(upload.path);
      }
    }
    let opportunityId: string;
    try {
      opportunityId = await prisma.$transaction(async (tx) => {
      const guarded = await tx.purchaseOrder.updateMany({
        where: { id: purchaseOrder.id, version: parsed.data.version, status: "AGREED" },
        data: {
          version: { increment: 1 },
          productName: firstItem.name,
          instansi: parsed.data.instansi,
          material: firstItem.material,
          // Kolom header = warna produk pertama (legacy); warna asli per item.
          color: firstItem.baseColor,
          baseColor: firstItem.baseColor,
          variationColor: firstItem.variationColor || null,
          orderDate: parsed.data.orderDate ? dateValue(parsed.data.orderDate) : null,
          sampleSize: purchaseOrder.garmentType === "JERSEY" ? parsed.data.sampleSize || null : null,
          notes: parsed.data.notes ?? null,
          deadline,
          depositRequired: parsed.data.depositRequired,
        },
      });
      if (guarded.count !== 1) {
        throw new UserFacingError("PO sudah berubah di tab lain. Muat ulang halaman lalu coba lagi.");
      }

      if (purchaseOrder.designTask && parsed.data.designDeadline) {
        await tx.designTask.update({ where: { id: purchaseOrder.designTask.id }, data: { deadline: dateValue(parsed.data.designDeadline) } });
      }

      for (const [position, item] of parsed.data.items.entries()) {
        const current = purchaseOrder.items[position];
        if (!current) continue;
        await tx.purchaseOrderItem.updateMany({
          where: { id: current.id, purchaseOrderId: purchaseOrder.id },
          data: {
            name: item.name,
            pola: item.pola,
            material: item.material,
            baseColor: item.baseColor,
            variationColor: item.variationColor || null,
            designNotes: item.designNotes ?? null,
          },
        });
      }

      for (const entry of rosterUpdates) {
        await tx.purchaseOrderRosterEntry.updateMany({
          where: { id: entry.id, purchaseOrderId: purchaseOrder.id },
          data: { memberId: entry.memberId, name: entry.name, jabatan: entry.jabatan },
        });
      }

      // Gambar desain baru menjadi revisi berikutnya per produk; riwayat versi lama tetap utuh.
      if (designUploads.length && designTaskId) {
        const latest = new Map<string, number>();
        const existing = await tx.designRevision.findMany({
          where: { designTaskId, itemId: { in: designUploads.map((upload) => upload.itemId) } },
          select: { itemId: true, revision: true },
        });
        for (const revision of existing) latest.set(revision.itemId, Math.max(latest.get(revision.itemId) ?? 0, revision.revision));
        for (const upload of designUploads) {
          const revision = (latest.get(upload.itemId) ?? 0) + 1;
          const created = await tx.designRevision.create({
            data: {
              designTaskId,
              itemId: upload.itemId,
              revision,
              createdById: actor.id,
              attachments: {
                create: upload.attachments.map(({ path, originalName, contentType, sizeBytes }) => ({ path, originalName, contentType, sizeBytes })),
              },
            },
          });
          await tx.auditEvent.create({
            data: {
              actorId: actor.id,
              entityType: "DesignRevision",
              entityId: created.id,
              action: "DESIGN_REVISION_UPLOADED",
              changedFields: ["revision", "attachments"],
              metadata: { designTaskId, itemId: upload.itemId, itemName: upload.itemName, revision, fileCount: upload.attachments.length, afterAgreement: true, viaPurchaseOrderEdit: true },
            },
          });
        }
      }

      // Work Order sudah memakai deadline lama; samakan agar jadwal produksi mengikuti PO.
      let syncedWorkOrders: string[] = [];
      if (deadlineChanged) {
        const workOrders = await tx.productionWorkOrder.findMany({
          where: { status: "ACTIVE", salesOrder: { purchaseOrderId: purchaseOrder.id } },
          select: { id: true, workOrderNo: true },
        });
        if (workOrders.length) {
          await Promise.all(workOrders.map((workOrder) => tx.productionWorkOrder.update({ where: { id: workOrder.id }, data: { deadline } })));
          syncedWorkOrders = workOrders.map((workOrder) => workOrder.workOrderNo);
        }
      }

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "PurchaseOrder",
          entityId: purchaseOrder.id,
          action: "PURCHASE_ORDER_CORRECTED",
          changedFields: [...new Set([...diffs.map((diff) => diff.field), ...(designUploads.length ? ["designFiles"] : [])])],
          metadata: {
            purchaseOrderNo: purchaseOrder.purchaseOrderNo,
            diffCount: diffs.length,
            ...(diffs.length ? { diff: diffs.slice(0, MAX_AUDIT_DIFFS) } : {}),
            ...(designUploads.length ? { uploadCount: designUploads.reduce((sum, upload) => sum + upload.attachments.length, 0) } : {}),
            ...(syncedWorkOrders.length ? { syncedWorkOrders } : {}),
            quantityLocked: true,
          },
        },
      });

      return purchaseOrder.opportunityId;
      }, CORRECTION_TRANSACTION_OPTIONS);
    } catch (error) {
      // Transaksi batal: berkas baru tidak boleh tertinggal di storage.
      if (uploadedPaths.length) await storage.remove(uploadedPaths);
      throw error;
    }

    revalidatePath("/crm");
    revalidatePath("/crm/purchase-orders");
    revalidateTag("purchase-orders", { expire: 0 });
    revalidatePath(`/crm/peluang/${opportunityId}`);
    if (deadlineChanged) {
      revalidatePath("/produksi");
      revalidateTag("production-board", { expire: 0 });
    }

    return flashMessagePath(`/crm/peluang/${opportunityId}?tab=po`, "notice", designUploads.length ? "Data PO dan desain customer tersimpan. Qty dan nilai invoice tidak berubah." : "Data PO tersimpan. Qty dan nilai invoice tidak berubah.");
  });
}
