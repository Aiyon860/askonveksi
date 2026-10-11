import "server-only";

import { type AppRole, Prisma, type ProductionRoute } from "@prisma/client";

import { nextWorkOrderNo } from "@/lib/crm/numbers";
import { productionStages } from "@/lib/production/workflow";

type Tx = Prisma.TransactionClient;

export async function createProductionWorkOrder(
  tx: Tx,
  actor: { id: string },
  input: {
    salesOrderId: string;
    purchaseOrderItemId?: string | null;
    itemName?: string | null;
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
      purchaseOrderItemId: input.purchaseOrderItemId ?? null,
      itemName: input.itemName ?? null,
      route: input.route,
      productName: input.productName,
      quantity: input.quantity,
      deadline: input.deadline,
      stageSequence: sequence,
      currentStage,
      stageEnteredAt: new Date(),
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
      productionWorkOrders: { select: { id: true, workOrderNo: true, purchaseOrderItemId: true } },
      purchaseOrder: {
        select: {
          status: true,
          garmentType: true,
          productName: true,
          deadline: true,
          items: { select: { id: true, name: true, garmentType: true }, orderBy: { position: "asc" } },
          sizes: { select: { itemId: true, quantity: true } },
        },
      },
      invoice: { select: { status: true } },
      payment: { select: { transactions: { where: { status: "ACTIVE", amount: { gt: 0 } }, select: { id: true }, take: 1 } } },
    },
  });
  if (!order || order.status !== "ACTIVE" || !order.payment?.transactions.length) return null;
  if (order.purchaseOrder.status !== "AGREED" || order.invoice.status !== "ISSUED" || !order.purchaseOrder.garmentType || !order.purchaseOrder.deadline) {
    throw new Error("PO atau invoice belum memenuhi syarat Work Order otomatis.");
  }

  // Satu WO per item PO (itemId "" = PO lawas satu produk). Rute ikut jenis tiap item.
  const poGarmentType = order.purchaseOrder.garmentType;
  const items = order.purchaseOrder.items.length
    ? order.purchaseOrder.items.map((item) => ({ id: item.id, name: item.name, garmentType: item.garmentType ?? poGarmentType }))
    : [{ id: "", name: order.purchaseOrder.productName, garmentType: poGarmentType }];
  const existingByItem = new Map(order.productionWorkOrders.map((wo) => [wo.purchaseOrderItemId ?? "", wo]));
  const created: Array<{ id: string; workOrderNo: string }> = [];
  for (const item of items) {
    const key = item.id || "";
    const existing = existingByItem.get(key);
    if (existing) {
      created.push(existing);
      continue;
    }
    const quantity = order.purchaseOrder.sizes
      .filter((size) => (size.itemId || "") === key)
      .reduce((sum, size) => sum + size.quantity, 0);
    if (quantity <= 0) continue;
    created.push(await createProductionWorkOrder(tx, actor, {
      salesOrderId: order.id,
      purchaseOrderItemId: item.id || null,
      itemName: order.purchaseOrder.items.length ? item.name : null,
      route: item.garmentType === "JERSEY" ? "JERSEY" : "NON_JERSEY",
      productName: item.name,
      quantity,
      deadline: order.purchaseOrder.deadline,
    }));
  }
  return created;
}

export function canClaimProductionStep(role: AppRole) {
  return role === "DEVELOPER" || role === "OWNER" || role === "ADMIN_PRODUCTION";
}
