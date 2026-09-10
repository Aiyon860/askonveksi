import "server-only";

import { type AppRole, Prisma, type ProductionRoute, type ProductionStage } from "@prisma/client";

import { nextWorkOrderNo } from "@/lib/crm/numbers";
import { productionStages } from "@/lib/production/workflow";

type Tx = Prisma.TransactionClient;

export async function createProductionWorkOrder(
  tx: Tx,
  actor: { id: string },
  input: {
    salesOrderId: string;
    route: ProductionRoute;
    productName: string;
    quantity: number;
    deadline: Date;
  },
) {
  const sequence = productionStages(input.route);
  const currentStage = sequence[0];
  const created = await tx.productionWorkOrder.create({
    data: {
      workOrderNo: await nextWorkOrderNo(tx),
      salesOrderId: input.salesOrderId,
      route: input.route,
      productName: input.productName,
      quantity: input.quantity,
      deadline: input.deadline,
      stageSequence: sequence,
      currentStage,
      steps: {
        create: sequence.map((stage, position) => ({
          stage,
          position,
          status: position === 0 ? "ACTIVE" : "PENDING",
          attemptCount: position === 0 ? 1 : 0,
          startedAt: position === 0 ? new Date() : null,
        })),
      },
    },
    select: { id: true, workOrderNo: true },
  });

  await tx.productionActivity.create({
    data: { workOrderId: created.id, actorId: actor.id, type: "CREATED", toStage: currentStage },
  });
  await tx.auditEvent.create({
    data: {
      actorId: actor.id,
      entityType: "ProductionWorkOrder",
      entityId: created.id,
      action: "PRODUCTION_WORK_ORDER_CREATED",
      changedFields: ["route", "productName", "quantity", "deadline", "stageSequence", "currentStage"],
      metadata: { salesOrderId: input.salesOrderId, workOrderNo: created.workOrderNo },
    },
  });
  return created;
}

export async function ensureProductionWorkOrder(tx: Tx, actor: { id: string }, salesOrderId: string) {
  const order = await tx.salesOrder.findUnique({
    where: { id: salesOrderId },
    select: {
      id: true,
      status: true,
      productionWorkOrder: { select: { id: true, workOrderNo: true } },
      purchaseOrder: {
        select: {
          status: true,
          garmentType: true,
          productName: true,
          deadline: true,
          sizes: { select: { quantity: true } },
        },
      },
      invoice: { select: { status: true } },
      payment: { select: { transactions: { where: { status: "ACTIVE", amount: { gt: 0 } }, select: { id: true }, take: 1 } } },
    },
  });
  if (!order || order.status !== "ACTIVE" || !order.payment?.transactions.length) return null;
  if (order.productionWorkOrder) return order.productionWorkOrder;
  if (order.purchaseOrder.status !== "AGREED" || order.invoice.status !== "ISSUED" || !order.purchaseOrder.garmentType || !order.purchaseOrder.deadline) {
    throw new Error("PO atau invoice belum memenuhi syarat Work Order otomatis.");
  }

  return createProductionWorkOrder(tx, actor, {
    salesOrderId: order.id,
    route: order.purchaseOrder.garmentType,
    productName: order.purchaseOrder.productName,
    quantity: order.purchaseOrder.sizes.reduce((sum, item) => sum + item.quantity, 0),
    deadline: order.purchaseOrder.deadline,
  });
}

export function canClaimProductionStep(role: AppRole, stage: ProductionStage) {
  return role === "OWNER" || role === "ADMIN" || role === "ADMIN_PRODUCTION" || (stage === "QC" ? role === "QC" : role === "PRODUCTION");
}
