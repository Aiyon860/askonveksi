"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";

import { flashMessagePath, UserFacingError, runRedirectingAction } from "@/lib/actions/response";
import { DESIGN_UPLOADER_ROLES, GATE_OVERRIDE_ROLES, hasRole } from "@/lib/auth/permissions";
import { requireActor, type Actor } from "@/lib/auth/session";
import { DESIGN_REVISION_LIMIT } from "@/lib/crm/constants";
import { entityIdSchema } from "@/lib/crm/validation";
import { designImageContentType, designImageExtensionFor, designImageRejection } from "@/lib/design/image";
import { getPrismaClient } from "@/lib/prisma";
import { erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";

const BUCKET = PO_DESIGNS_BUCKET;
const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REVISIONS = DESIGN_REVISION_LIMIT;

// Pooler Supabase bisa lambat (ratusan ms per query). Default Prisma
// (maxWait 2s / timeout 5s) sering berakhir P2028 "melewati batas waktu"
// saat mengunggah desain multi-produk, jadi anggaran transaksi dinaikkan
// mengikuti pola `DEAL_TRANSACTION_OPTIONS` di crm.ts.
const DESIGN_TRANSACTION_OPTIONS = {
  maxWait: 15_000,
  timeout: 30_000,
} as const;

/** Nomor versi berikutnya untuk setiap produk, dihitung terpisah per produk. */
function latestRevisionByItem(revisions: Array<{ itemId: string; revision: number }>) {
  const latest = new Map<string, number>();
  for (const revision of revisions) latest.set(revision.itemId, Math.max(latest.get(revision.itemId) ?? 0, revision.revision));
  return latest;
}

function uploadedFiles(formData: FormData, itemId: string) {
  return formData.getAll(`designFiles-${itemId}`).filter((value): value is File => value instanceof File && value.size > 0);
}

/**
 * Deposit hanya mengunci Upload Desain bila PO mencentang "Perlu deposit".
 * PO tanpa deposit sudah boleh diunggah kapan saja.
 */
function assertDepositSettled(purchaseOrder: { depositRequired: boolean; deposit: { id: string } | null }, role: Actor["role"]) {
  if (!purchaseOrder.depositRequired || purchaseOrder.deposit || hasRole(role, GATE_OVERRIDE_ROLES)) return;
  throw new UserFacingError("Deposit desain belum dibayar. Isi Deposit pada tab PO terlebih dahulu.");
}

function revisionNotes(formData: FormData, itemId: string) {
  const value = formData.get(`notes-${itemId}`);
  return typeof value === "string" ? value.trim().slice(0, 4000) || null : null;
}

async function prepareAttachments(files: File[], designTaskId: string) {
  return Promise.all(files.map(async (file) => {
    if (file.size > MAX_BYTES) throw new UserFacingError(`Setiap file desain maksimal 5 MB (${file.name}).`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    // D2: ekstensi dan isi file divalidasi terpusat — hanya PNG/JPG/JPEG (PDF ditolak).
    const contentType = designImageContentType(file.name, bytes);
    if (!contentType) throw new UserFacingError(designImageRejection(file.name));
    return {
      bytes,
      originalName: file.name.slice(0, 255),
      sizeBytes: file.size,
      contentType,
      path: `design/${designTaskId}/${randomUUID()}.${designImageExtensionFor(contentType)}`,
    };
  }));
}

/**
 * Satu PO dapat memuat beberapa produk, jadi setiap produk punya form unggah sendiri
 * (`designFiles-<itemId>` + `notes-<itemId>`) dan riwayat versi terpisah (maksimal 4 versi per produk).
 * Tanpa tahap persetujuan, versi terbaru tiap produk langsung menjadi acuan produksi.
 */
export async function uploadDesignRevisionAction(formData: FormData) {
  return runRedirectingAction("/crm/purchase-orders", async () => {
    const actor = await requireActor(DESIGN_UPLOADER_ROLES);
    const taskId = entityIdSchema.safeParse(formData.get("designTaskId"));
    if (!taskId.success) throw new UserFacingError("Tugas desain tidak valid.");

    const prisma = getPrismaClient();
    const task = await prisma.designTask.findUnique({
      where: { id: taskId.data },
      select: {
        id: true,
        revisions: { select: { itemId: true, revision: true } },
        purchaseOrder: {
          select: {
            status: true,
            opportunityId: true,
            productName: true,
            // PO yang checkbox Deposit-nya dicentang baru boleh diunggah setelah depositnya dibayar.
            depositRequired: true,
            deposit: { select: { id: true } },
            items: { orderBy: { position: "asc" }, select: { id: true, name: true } },
          },
        },
      },
    });
    if (!task) throw new UserFacingError("Tugas desain tidak ditemukan.");
    if (task.purchaseOrder.status !== "DRAFT") throw new UserFacingError("Desain PO yang sudah disepakati tidak dapat diubah.");
    // DEVELOPER/OWNER tetap bisa mengunggah walau deposit belum dibayar (AGENTS.md).
    assertDepositSettled(task.purchaseOrder, actor.role);
    // PO lama tanpa baris produk memakai satu produk implisit dengan itemId kosong.
    const designItems = task.purchaseOrder.items.length
      ? task.purchaseOrder.items
      : [{ id: "", name: task.purchaseOrder.productName }];
    const latest = latestRevisionByItem(task.revisions);

    const uploads: Array<{ itemId: string; itemName: string; notes: string | null; attachments: Awaited<ReturnType<typeof prepareAttachments>> }> = [];
    for (const item of designItems) {
      const files = uploadedFiles(formData, item.id);
      if (!files.length) continue;
      if (files.length > MAX_FILES) throw new UserFacingError(`Maksimal lima file setiap versi desain ${item.name}.`);
      if ((latest.get(item.id) ?? 0) + 1 > MAX_REVISIONS) throw new UserFacingError(`Batas 4 versi desain ${item.name} sudah tercapai.`);
      uploads.push({ itemId: item.id, itemName: item.name, notes: revisionNotes(formData, item.id), attachments: await prepareAttachments(files, task.id) });
    }
    if (!uploads.length) throw new UserFacingError("Pilih minimal satu file desain.");

    const storage = erpStorage(BUCKET);
    const uploaded: string[] = [];
    let opportunityId: string;
    try {
      await Promise.all(uploads.flatMap((upload) => upload.attachments).map(async (attachment) => {
        const { error } = await storage.upload(attachment.path, attachment.bytes, { contentType: attachment.contentType, upsert: false });
        if (error) {
          console.error("Gagal mengunggah file desain PO.", { path: attachment.path, sizeBytes: attachment.bytes.length, status: error.status, statusCode: error.statusCode, message: error.message });
          throw new UserFacingError("File desain belum dapat disimpan.");
        }
        uploaded.push(attachment.path);
      }));

      opportunityId = await prisma.$transaction(async (tx) => {
        const current = await tx.designTask.findUnique({
          where: { id: task.id },
          select: {
            id: true,
            revisions: { select: { itemId: true, revision: true } },
            purchaseOrder: { select: { status: true, opportunityId: true, depositRequired: true, deposit: { select: { id: true } } } },
          },
        });
        if (!current) throw new UserFacingError("Tugas desain tidak ditemukan.");
        if (current.purchaseOrder.status !== "DRAFT") throw new UserFacingError("Desain PO yang sudah disepakati tidak dapat diubah.");
        assertDepositSettled(current.purchaseOrder, actor.role);
        const currentLatest = latestRevisionByItem(current.revisions);
        for (const upload of uploads) {
          const revision = (currentLatest.get(upload.itemId) ?? 0) + 1;
          if (revision > MAX_REVISIONS) throw new UserFacingError(`Batas 4 versi desain ${upload.itemName} sudah tercapai.`);
          const created = await tx.designRevision.create({
            data: {
              designTaskId: current.id,
              itemId: upload.itemId,
              revision,
              notes: upload.notes,
              createdById: actor.id,
              attachments: { create: upload.attachments.map(({ path, originalName, contentType, sizeBytes }) => ({ path, originalName, contentType, sizeBytes })) },
            },
          });
          await tx.auditEvent.create({
            data: {
              actorId: actor.id,
              entityType: "DesignRevision",
              entityId: created.id,
              action: "DESIGN_REVISION_UPLOADED",
              changedFields: ["revision", "notes", "attachments"],
              metadata: { designTaskId: current.id, itemId: upload.itemId, itemName: upload.itemName, revision, fileCount: upload.attachments.length },
            },
          });
        }
        return current.purchaseOrder.opportunityId;
      }, DESIGN_TRANSACTION_OPTIONS);

      revalidatePath("/crm");
      revalidatePath("/crm/purchase-orders");
      revalidateTag("purchase-orders", { expire: 0 });
      revalidatePath(`/crm/peluang/${opportunityId}`);
    } catch (error) {
      if (uploaded.length) await storage.remove(uploaded);
      throw error;
    }

    return flashMessagePath(`/crm/peluang/${opportunityId}?tab=po`, "notice", `Versi desain ${uploads.map((upload) => upload.itemName).join(", ")} berhasil diunggah.`);
  });
}
