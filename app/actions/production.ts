"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { flashMessagePath, messageForError, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { PRODUCTION_MANAGEMENT_ROLES, PRODUCTION_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { firstValidationMessage } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createProductionWorkOrder } from "@/lib/production/service";
import {
  addProductionNoteSchema,
  assignProductionStepSchema,
  configureLegacyProductionSchema,
  moveProductionSchema,
  reopenProductionSchema,
} from "@/lib/production/validation";
import { isStageRole, nextProductionStage } from "@/lib/production/workflow";

function value(formData: FormData, key: string) {
  return formData.get(key);
}

function detailPath(id: string) {
  return `/produksi/${id}`;
}

function parseDeadline(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new UserFacingError("Deadline produksi tidak valid.");
  return date;
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
    const manager = PRODUCTION_MANAGEMENT_ROLES.includes(actor.role as "OWNER" | "ADMIN");
    if (!isStageRole(actor.role, order.currentStage)) throw new UserFacingError("Role Anda tidak dapat memproses tahap ini.");
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
      const manager = PRODUCTION_MANAGEMENT_ROLES.includes(actor.role as "OWNER" | "ADMIN");
      if (!manager && (parsed.data.assigneeId !== actor.id || step.assigneeId)) throw new UserFacingError("Anda hanya dapat mengambil tahap yang belum memiliki PIC.");

      const assignee = await tx.appUser.findFirst({ where: { id: parsed.data.assigneeId, isActive: true }, select: { id: true, role: true, name: true } });
      if (!assignee || !isStageRole(assignee.role, step.stage) || assignee.role === "OWNER" || assignee.role === "ADMIN") throw new UserFacingError("PIC tidak aktif atau rolenya tidak sesuai tahap.");
      if (!isStageRole(actor.role, step.stage)) throw new UserFacingError("Role Anda tidak dapat mengatur PIC tahap ini.");

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
    const actor = await requireActor(PRODUCTION_MANAGEMENT_ROLES);
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

export async function configureLegacyProductionAction(formData: FormData) {
  return runRedirectingAction("/produksi", async () => {
    const actor = await requireActor(PRODUCTION_MANAGEMENT_ROLES);
    const parsed = configureLegacyProductionSchema.safeParse({
      salesOrderId: value(formData, "salesOrderId"),
      productionRoute: value(formData, "productionRoute"),
      productionProductName: value(formData, "productionProductName"),
      productionDeadline: value(formData, "productionDeadline"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const created = await getPrismaClient().$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({ where: { id: parsed.data.salesOrderId }, select: { id: true, status: true, productionWorkOrder: { select: { id: true } }, items: { select: { quantity: true } } } });
      if (!order || order.status !== "ACTIVE" || order.productionWorkOrder) throw new UserFacingError("Sales Order tidak aktif atau sudah memiliki Work Order.");
      return createProductionWorkOrder(tx, actor, { salesOrderId: order.id, route: parsed.data.productionRoute, productName: parsed.data.productionProductName, quantity: order.items.reduce((sum, item) => sum + item.quantity, 0), deadline: parseDeadline(parsed.data.productionDeadline) });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/produksi");
    return flashMessagePath(detailPath(created.id), "notice", "Work Order berhasil disiapkan.");
  });
}
