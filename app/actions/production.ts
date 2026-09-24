"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { flashMessagePath, messageForError, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { PRODUCTION_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { firstValidationMessage } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addProductionNoteSchema,
  assignProductionStepSchema,
  moveProductionSchema,
  reopenProductionSchema,
} from "@/lib/production/validation";
import { designAnnotationsSchema } from "@/lib/production/design-annotations";
import { isStageRole, nextProductionStage } from "@/lib/production/workflow";

function value(formData: FormData, key: string) {
  return formData.get(key);
}

function detailPath(id: string) {
  return `/produksi/${id}`;
}

const DESIGN_BUCKET = "crm-po-designs";
const MAX_DESIGN_BYTES = 5 * 1024 * 1024;

function isPng(bytes: Uint8Array) {
  return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
}

const designVersionSchema = z.object({ workOrderId: z.string().trim().min(10).max(40), attachmentId: z.string().trim().min(10).max(40) });

export async function saveProductionDesignAction(formData: FormData) {
  const fallback = `/detail-desain/${String(value(formData, "workOrderId") ?? "")}`;
  return runRedirectingAction(fallback, async () => {
    const actor = await requireActor(PRODUCTION_ROLES);
    const parsed = designVersionSchema.safeParse({ workOrderId: value(formData, "workOrderId"), attachmentId: value(formData, "attachmentId") });
    const file = formData.get("design");
    let rawAnnotations: unknown;
    try { rawAnnotations = JSON.parse(String(value(formData, "annotations") ?? "null")); } catch { throw new UserFacingError("Keterangan desain tidak valid."); }
    const annotations = designAnnotationsSchema.safeParse(rawAnnotations);
    if (!parsed.success || !annotations.success || !(file instanceof File)) throw new UserFacingError("Desain atau keterangannya tidak valid.");
    if (!file.size || file.size > MAX_DESIGN_BYTES || file.type !== "image/png") throw new UserFacingError("Hasil desain harus berupa PNG maksimal 5 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isPng(bytes)) throw new UserFacingError("Isi file desain tidak valid.");

    const target = await getPrismaClient().productionWorkOrder.findFirst({
      where: { id: parsed.data.workOrderId, status: "ACTIVE" },
      select: {
        id: true,
        designCompletedAt: true,
        salesOrder: {
          select: {
            purchaseOrder: {
              select: {
                designTask: {
                  select: {
                    revisions: {
                      where: { status: "APPROVED" }, orderBy: { revision: "desc" }, take: 1,
                      select: { attachments: { where: { id: parsed.data.attachmentId }, select: { id: true, path: true, originalPath: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const attachment = target?.salesOrder.purchaseOrder.designTask?.revisions[0]?.attachments[0];
    if (!target || !attachment) throw new UserFacingError("File desain yang disetujui tidak ditemukan.");
    if (target.designCompletedAt) throw new UserFacingError("Desain sudah masuk Produksi dan tidak dapat diubah.");
    const storage = createAdminClient().storage.from(DESIGN_BUCKET);
    const originalPath = attachment.originalPath ?? `production-design-original/${attachment.id}.png`;
    if (!attachment.originalPath) {
      const snapshot = await storage.exists(originalPath);
      if (snapshot.error && ![400, 404].includes(snapshot.error.status ?? 0)) {
        console.error("Gagal memeriksa salinan desain awal.", { status: snapshot.error.status, statusCode: snapshot.error.statusCode });
        throw new UserFacingError("Salinan desain awal belum dapat disimpan.");
      }
      if (!snapshot.data) {
        const { data: original, error: originalError } = await storage.download(attachment.path);
        if (originalError || !original) throw new UserFacingError("Desain awal tidak dapat dibuka.");
        const { error: copyError } = await storage.upload(originalPath, new Uint8Array(await original.arrayBuffer()), { contentType: "image/png", upsert: false });
        if (copyError && !(await storage.exists(originalPath)).data) {
          console.error("Gagal menyimpan salinan desain awal.", { status: copyError.status, statusCode: copyError.statusCode });
          throw new UserFacingError("Salinan desain awal belum dapat disimpan.");
        }
      }
    }
    const { error } = await storage.upload(attachment.path, bytes, { contentType: "image/png", upsert: true });
    if (error) throw new UserFacingError("Gambar desain belum dapat disimpan.");
    await getPrismaClient().$transaction(async (tx) => {
      await tx.designAttachment.update({ where: { id: attachment.id }, data: { contentType: "image/png", sizeBytes: bytes.length, originalPath, annotations: annotations.data } });
      await productionAudit(tx, actor.id, target.id, "PRODUCTION_DESIGN_VERSION_SAVED", ["annotations"], { attachmentId: attachment.id });
    });
    revalidatePath("/detail-desain");
    revalidatePath(`/crm/purchase-orders`);
    return flashMessagePath(fallback, "notice", "Versi desain disimpan. Konfirmasikan untuk memasukkannya ke Produksi.");
  });
}

export async function resetProductionDesignAction(formData: FormData) {
  const fallback = `/detail-desain/${String(value(formData, "workOrderId") ?? "")}`;
  return runRedirectingAction(fallback, async () => {
    const actor = await requireActor(PRODUCTION_ROLES);
    const parsed = designVersionSchema.safeParse({ workOrderId: value(formData, "workOrderId"), attachmentId: value(formData, "attachmentId") });
    if (!parsed.success) throw new UserFacingError("Work Order tidak valid.");
    const target = await getPrismaClient().productionWorkOrder.findFirst({
      where: { id: parsed.data.workOrderId, status: "ACTIVE" },
      select: {
        id: true,
        designCompletedAt: true,
        salesOrder: {
          select: {
            purchaseOrder: {
              select: {
                designTask: {
                  select: {
                    revisions: {
                      where: { status: "APPROVED" }, orderBy: { revision: "desc" }, take: 1,
                      select: { attachments: { where: { id: parsed.data.attachmentId }, select: { id: true, path: true, originalPath: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const attachment = target?.salesOrder.purchaseOrder.designTask?.revisions[0]?.attachments[0];
    if (!target || !attachment) throw new UserFacingError("File desain yang disetujui tidak ditemukan.");
    if (target.designCompletedAt) throw new UserFacingError("Desain sudah masuk Produksi dan tidak dapat diubah.");
    let originalSize: number | undefined;
    if (attachment.originalPath) {
      const storage = createAdminClient().storage.from(DESIGN_BUCKET);
      const { data: original, error: downloadError } = await storage.download(attachment.originalPath);
      if (downloadError || !original) throw new UserFacingError("Desain awal tidak dapat dibuka.");
      const originalBytes = new Uint8Array(await original.arrayBuffer());
      const { error: uploadError } = await storage.upload(attachment.path, originalBytes, { contentType: "image/png", upsert: true });
      if (uploadError) throw new UserFacingError("Desain awal belum dapat dipulihkan.");
      originalSize = originalBytes.length;
    }
    await getPrismaClient().$transaction(async (tx) => {
      await tx.designAttachment.update({ where: { id: attachment.id }, data: { annotations: Prisma.JsonNull, ...(originalSize === undefined ? {} : { contentType: "image/png", sizeBytes: originalSize }) } });
      await productionAudit(tx, actor.id, target.id, "PRODUCTION_DESIGN_RESET", ["annotations"], { attachmentId: attachment.id });
    });
    revalidatePath("/detail-desain");
    revalidatePath("/crm/purchase-orders");
    return flashMessagePath(fallback, "notice", "Perubahan desain dikembalikan ke desain awal.");
  });
}

export async function sendProductionDesignAction(formData: FormData) {
  const fallback = `/detail-desain/${String(value(formData, "workOrderId") ?? "")}`;
  return runRedirectingAction(fallback, async () => {
    const actor = await requireActor(PRODUCTION_ROLES);
    const parsed = designVersionSchema.safeParse({ workOrderId: value(formData, "workOrderId"), attachmentId: value(formData, "attachmentId") });
    if (!parsed.success) throw new UserFacingError("Work Order tidak valid.");
    const order = await getPrismaClient().productionWorkOrder.findUnique({
      where: { id: parsed.data.workOrderId },
      select: {
        id: true,
        designCompletedAt: true,
        status: true,
        salesOrder: { select: {
          purchaseOrder: { select: {
            designTask: { select: {
              revisions: {
                where: { status: "APPROVED" },
                orderBy: { revision: "desc" },
                take: 1,
                select: { attachments: { where: { id: parsed.data.attachmentId }, select: { id: true, annotations: true, originalPath: true } } },
              },
            } },
          } },
        } },
      },
    });
    const attachment = order?.salesOrder.purchaseOrder.designTask?.revisions[0]?.attachments[0];
    if (!order || !attachment || order.status !== "ACTIVE" || order.designCompletedAt || !designAnnotationsSchema.safeParse(attachment.annotations).success) throw new UserFacingError("Simpan versi desain dengan minimal satu keterangan sebelum memasukkannya ke Produksi.");
    await getPrismaClient().$transaction(async (tx) => {
      await tx.productionWorkOrder.update({ where: { id: order.id }, data: { designCompletedAt: new Date() } });
      await productionAudit(tx, actor.id, order.id, "PRODUCTION_DESIGN_SENT", ["designCompletedAt"], { attachmentId: parsed.data.attachmentId });
    });
    if (attachment.originalPath) {
      try {
        const { error } = await createAdminClient().storage.from(DESIGN_BUCKET).remove([attachment.originalPath]);
        if (error) console.error("Gagal menghapus gambar asli desain setelah masuk Produksi.");
        else {
          try { await getPrismaClient().designAttachment.update({ where: { id: attachment.id }, data: { originalPath: null } }); }
          catch { console.error("Gambar asli desain sudah dihapus, tetapi status penyimpanannya belum diperbarui."); }
        }
      } catch { console.error("Gagal menghapus gambar asli desain setelah masuk Produksi."); }
    }
    revalidatePath("/detail-desain");
    revalidatePath("/produksi");
    return flashMessagePath("/detail-desain", "notice", "Work Order masuk ke kanban Produksi.");
  });
}

async function productionAudit(
  tx: Prisma.TransactionClient,
  actorId: string,
  workOrderId: string,
  action: string,
  changedFields: string[],
  metadata?: Prisma.InputJsonValue,
) {
  await tx.auditEvent.create({ data: { actorId, entityType: "ProductionWorkOrder", entityId: workOrderId, action, changedFields, metadata } });
}

async function moveProduction(formData: FormData) {
  const actor = await requireActor(PRODUCTION_ROLES);
  const parsed = moveProductionSchema.safeParse({
    workOrderId: value(formData, "workOrderId"),
    version: value(formData, "version"),
    targetStage: value(formData, "targetStage"),
    decision: value(formData, "decision") || "ADVANCE",
    note: value(formData, "note") || undefined,
  });
  if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

  return getPrismaClient().$transaction(async (tx) => {
    const order = await tx.productionWorkOrder.findUnique({
      where: { id: parsed.data.workOrderId },
      select: {
        id: true,
        status: true,
        route: true,
        version: true,
        currentStage: true,
        stageSequence: true,
        steps: { select: { id: true, stage: true, position: true, status: true, assigneeId: true } },
      },
    });
    if (!order || order.status !== "ACTIVE") throw new UserFacingError("Work Order tidak aktif atau tidak ditemukan.");
    if (order.version !== parsed.data.version) throw new UserFacingError("Work Order sudah berubah. Muat ulang halaman.");

    const currentStep = order.steps.find((step) => step.stage === order.currentStage && step.status === "ACTIVE");
    if (!currentStep) throw new UserFacingError("Tahap aktif tidak valid. Muat ulang halaman.");
    const manager = actor.role === "DEVELOPER" || actor.role === "OWNER" || actor.role === "ADMIN_PRODUCTION";
    if (!isStageRole(actor.role)) throw new UserFacingError("Role Anda tidak dapat memproses tahap ini.");
    if (!manager && currentStep.assigneeId !== actor.id) throw new UserFacingError("Ambil penugasan PIC tahap ini sebelum memperbarui progres.");

    const targetStep = order.steps.find((step) => step.stage === parsed.data.targetStage);
    if (!targetStep) throw new UserFacingError("Tahap tujuan tidak termasuk alur Work Order.");
    const now = new Date();
    let activityType: "STAGE_MOVED" | "STAGE_SKIPPED" | "SAMPLE_REJECTED" | "QC_REJECTED" = "STAGE_MOVED";
    let completed = false;
    let needsRepair: boolean | undefined;
    let repairReason: string | null | undefined;
    let repairRequestedAt: Date | null | undefined;
    let sampleRevisionIncrement = 0;

    if (parsed.data.decision === "SKIP") {
      const currentIndex = order.stageSequence.indexOf(order.currentStage);
      const targetIndex = order.stageSequence.indexOf(parsed.data.targetStage);
      if (order.route !== "NON_JERSEY" || targetIndex <= currentIndex + 1) throw new UserFacingError("Lewati tahap hanya tersedia untuk alur Non-Jersey dan harus menuju tahap setelah tahap berikutnya.");
      activityType = "STAGE_SKIPPED";
      await tx.productionStep.update({ where: { id: currentStep.id }, data: { status: "COMPLETED", completedAt: now } });
      await tx.productionStep.updateMany({
        where: { workOrderId: order.id, position: { gt: currentStep.position, lt: targetStep.position } },
        data: { status: "SKIPPED", startedAt: null, completedAt: now },
      });
      completed = parsed.data.targetStage === "SELESAI";
      await tx.productionStep.update({
        where: { id: targetStep.id },
        data: { status: completed ? "COMPLETED" : "ACTIVE", startedAt: now, completedAt: completed ? now : null, attemptCount: { increment: 1 } },
      });
    } else if (parsed.data.decision === "SAMPLE_REJECT") {
      if (order.currentStage !== "PERSETUJUAN_SAMPEL" || parsed.data.targetStage !== "TEST_PRINT") throw new UserFacingError("Penolakan sampel hanya dapat kembali ke Test Print.");
      activityType = "SAMPLE_REJECTED";
      sampleRevisionIncrement = 1;
      await tx.productionStep.update({ where: { id: currentStep.id }, data: { status: "PENDING", startedAt: null, completedAt: null } });
      await tx.productionStep.update({ where: { id: targetStep.id }, data: { status: "ACTIVE", startedAt: now, completedAt: null, attemptCount: { increment: 1 } } });
    } else if (parsed.data.decision === "QC_REJECT") {
      if (order.currentStage !== "QC" || targetStep.position >= currentStep.position) throw new UserFacingError("QC hanya dapat mengembalikan ke tahap sebelumnya.");
      activityType = "QC_REJECTED";
      needsRepair = true;
      repairReason = parsed.data.note!;
      repairRequestedAt = now;
      await tx.productionStep.updateMany({
        where: { workOrderId: order.id, position: { gte: targetStep.position } },
        data: { status: "PENDING", startedAt: null, completedAt: null },
      });
      await tx.productionStep.update({ where: { id: targetStep.id }, data: { status: "ACTIVE", startedAt: now, attemptCount: { increment: 1 } } });
    } else {
      const nextStage = nextProductionStage(order.stageSequence, order.currentStage);
      if (nextStage !== parsed.data.targetStage) throw new UserFacingError("Work Order hanya dapat maju ke tahap berikutnya.");
      await tx.productionStep.update({ where: { id: currentStep.id }, data: { status: "COMPLETED", completedAt: now } });
      completed = parsed.data.targetStage === "SELESAI";
      await tx.productionStep.update({
        where: { id: targetStep.id },
        data: { status: "COMPLETED", startedAt: now, completedAt: now, attemptCount: { increment: 1 }, ...(completed ? {} : { status: "ACTIVE", completedAt: null }) },
      });
      if (order.currentStage === "QC") {
        needsRepair = false;
        repairReason = null;
        repairRequestedAt = null;
      }
    }

    const updated = await tx.productionWorkOrder.updateMany({
      where: { id: order.id, version: order.version, status: "ACTIVE", currentStage: order.currentStage },
      data: {
        currentStage: parsed.data.targetStage,
        status: completed ? "COMPLETED" : "ACTIVE",
        completedAt: completed ? now : null,
        ...(sampleRevisionIncrement ? { sampleRevision: { increment: sampleRevisionIncrement } } : {}),
        ...(needsRepair !== undefined ? { needsRepair, repairReason, repairRequestedAt } : {}),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new UserFacingError("Work Order sudah berubah. Muat ulang halaman.");

    await tx.productionActivity.create({
      data: { workOrderId: order.id, actorId: actor.id, type: activityType, fromStage: order.currentStage, toStage: parsed.data.targetStage, note: parsed.data.note },
    });
    await productionAudit(tx, actor.id, order.id, activityType, ["currentStage", "status", "version"], { from: order.currentStage, to: parsed.data.targetStage });
    return { id: order.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function moveProductionOptimisticAction(formData: FormData) {
  try {
    const moved = await moveProduction(formData);
    revalidatePath("/produksi");
    revalidatePath(detailPath(moved.id));
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: messageForError(error) };
  }
}

export async function assignProductionStepAction(formData: FormData) {
  const fallback = detailPath(String(value(formData, "workOrderId") ?? ""));
  return runRedirectingAction(fallback, async () => {
    const actor = await requireActor(PRODUCTION_ROLES);
    const parsed = assignProductionStepSchema.safeParse({ workOrderId: value(formData, "workOrderId"), stepId: value(formData, "stepId"), assigneeId: value(formData, "assigneeId") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    await getPrismaClient().$transaction(async (tx) => {
      const step = await tx.productionStep.findFirst({
        where: { id: parsed.data.stepId, workOrderId: parsed.data.workOrderId },
        select: { id: true, stage: true, assigneeId: true, workOrder: { select: { status: true } } },
      });
      if (!step || step.workOrder.status !== "ACTIVE") throw new UserFacingError("Tahap produksi tidak aktif atau tidak ditemukan.");
      const manager = actor.role === "DEVELOPER" || actor.role === "OWNER" || actor.role === "ADMIN_PRODUCTION";
      if (!manager && (parsed.data.assigneeId !== actor.id || step.assigneeId)) throw new UserFacingError("Anda hanya dapat mengambil tahap yang belum memiliki PIC.");

      const assignee = await tx.appUser.findFirst({ where: { id: parsed.data.assigneeId, isActive: true }, select: { id: true, role: true, name: true } });
      if (!assignee || !isStageRole(assignee.role) || assignee.role === "OWNER") throw new UserFacingError("PIC tidak aktif atau rolenya tidak sesuai tahap.");
      if (!isStageRole(actor.role)) throw new UserFacingError("Role Anda tidak dapat mengatur PIC tahap ini.");

      await tx.productionStep.update({ where: { id: step.id }, data: { assigneeId: assignee.id } });
      await tx.productionActivity.create({ data: { workOrderId: parsed.data.workOrderId, actorId: actor.id, type: "PIC_ASSIGNED", toStage: step.stage, metadata: { assigneeId: assignee.id, assigneeName: assignee.name } } });
      await productionAudit(tx, actor.id, parsed.data.workOrderId, "PRODUCTION_PIC_ASSIGNED", ["assigneeId"], { stepId: step.id, stage: step.stage, assigneeId: assignee.id });
    });

    revalidatePath("/produksi");
    revalidatePath(fallback);
    return flashMessagePath(fallback, "notice", "PIC tahap diperbarui.");
  });
}

export async function addProductionNoteAction(formData: FormData) {
  const fallback = detailPath(String(value(formData, "workOrderId") ?? ""));
  return runRedirectingAction(fallback, async () => {
    const actor = await requireActor(PRODUCTION_ROLES);
    const parsed = addProductionNoteSchema.safeParse({ workOrderId: value(formData, "workOrderId"), note: value(formData, "note") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const order = await getPrismaClient().productionWorkOrder.findUnique({ where: { id: parsed.data.workOrderId }, select: { id: true, currentStage: true, status: true } });
    if (!order) throw new UserFacingError("Work Order tidak ditemukan.");
    if (order.status === "CANCELLED") throw new UserFacingError("Work Order yang dibatalkan tidak dapat menerima catatan baru.");
    await getPrismaClient().$transaction(async (tx) => {
      await tx.productionActivity.create({ data: { workOrderId: order.id, actorId: actor.id, type: "NOTE_ADDED", toStage: order.currentStage, note: parsed.data.note } });
      await productionAudit(tx, actor.id, order.id, "PRODUCTION_NOTE_ADDED", ["activity"], { stage: order.currentStage });
    });
    revalidatePath(fallback);
    return flashMessagePath(fallback, "notice", "Catatan produksi ditambahkan.");
  });
}

export async function reopenProductionAction(formData: FormData) {
  const fallback = detailPath(String(value(formData, "workOrderId") ?? ""));
  return runRedirectingAction(fallback, async () => {
    const actor = await requireActor(PRODUCTION_ROLES);
    const parsed = reopenProductionSchema.safeParse({ workOrderId: value(formData, "workOrderId"), version: value(formData, "version"), targetStage: value(formData, "targetStage"), note: value(formData, "note") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    await getPrismaClient().$transaction(async (tx) => {
      const order = await tx.productionWorkOrder.findUnique({ where: { id: parsed.data.workOrderId }, select: { id: true, version: true, status: true, currentStage: true, stageSequence: true, steps: { select: { id: true, stage: true, position: true } } } });
      if (!order || order.status !== "COMPLETED" || order.version !== parsed.data.version) throw new UserFacingError("Work Order selesai tidak ditemukan atau sudah berubah.");
      const target = order.steps.find((step) => step.stage === parsed.data.targetStage);
      const done = order.steps.find((step) => step.stage === "SELESAI");
      if (!target || !done || target.position >= done.position) throw new UserFacingError("Pilih tahap sebelum Selesai.");
      const now = new Date();
      await tx.productionStep.updateMany({ where: { workOrderId: order.id, position: { gte: target.position } }, data: { status: "PENDING", startedAt: null, completedAt: null } });
      await tx.productionStep.update({ where: { id: target.id }, data: { status: "ACTIVE", startedAt: now, attemptCount: { increment: 1 } } });
      const updated = await tx.productionWorkOrder.updateMany({ where: { id: order.id, version: order.version, status: "COMPLETED" }, data: { status: "ACTIVE", currentStage: target.stage, completedAt: null, version: { increment: 1 } } });
      if (updated.count !== 1) throw new UserFacingError("Work Order sudah berubah.");
      await tx.productionActivity.create({ data: { workOrderId: order.id, actorId: actor.id, type: "REOPENED", fromStage: "SELESAI", toStage: target.stage, note: parsed.data.note } });
      await productionAudit(tx, actor.id, order.id, "PRODUCTION_REOPENED", ["status", "currentStage", "completedAt"], { to: target.stage });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/produksi");
    revalidatePath(fallback);
    return flashMessagePath(fallback, "notice", "Work Order dibuka kembali.");
  });
}
