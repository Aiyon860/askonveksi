import "server-only";

import { type AppRole, Prisma, type ProductionRoute, type ProductionStage } from "@prisma/client";

import { nextWorkOrderNo } from "@/lib/crm/numbers";
import { productionStages } from "@/lib/production/workflow";

type Tx = Prisma.TransactionClient;

export function productionDeadline(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Deadline produksi tidak valid.");
  return date;
}

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

export function canClaimProductionStep(role: AppRole, stage: ProductionStage) {
  return role === "OWNER" || role === "ADMIN" || (stage === "QC" ? role === "QC" : role === "PRODUCTION");
}
