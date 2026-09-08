import "dotenv/config";

import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum dikonfigurasi.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const stages = {
  JERSEY: ["TEST_PRINT", "PERSETUJUAN_SAMPEL", "LAYOUT_PRODUKSI", "PRINT", "CUTTING", "QC", "SELESAI"],
  NON_JERSEY: ["POTONG", "BORDIR", "SABLON", "PRINTING", "JAHIT", "QC", "PACKING", "PENGIRIMAN", "SELESAI"],
};

async function nextWorkOrderNo(tx) {
  const year = new Date().getUTCFullYear();
  const counter = await tx.sequenceCounter.upsert({
    where: { key: `work-order:${year}` },
    create: { key: `work-order:${year}`, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  return `WO-${year}-${String(counter.value).padStart(5, "0")}`;
}

try {
  const candidates = await prisma.salesOrder.findMany({
    where: {
      status: "ACTIVE",
      productionWorkOrder: null,
      payment: { is: { transactions: { some: { status: "ACTIVE", amount: { gt: 0 } } } } },
    },
    select: { id: true, salesOrderNo: true },
  });
  const created = [];
  const skipped = [];

  for (const candidate of candidates) {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: candidate.id },
        select: {
          id: true,
          productionWorkOrder: { select: { id: true } },
          purchaseOrder: { select: { status: true, garmentType: true, productName: true, deadline: true, sizes: { select: { quantity: true } } } },
          payment: { select: { transactions: { where: { status: "ACTIVE", amount: { gt: 0 } }, select: { createdById: true }, orderBy: { paidAt: "asc" }, take: 1 } } },
        },
      });
      const payment = order?.payment?.transactions[0];
      const po = order?.purchaseOrder;
      if (!order || order.productionWorkOrder || !payment || !po || po.status !== "AGREED" || !po.garmentType || !po.deadline) return null;
      const sequence = stages[po.garmentType];
      const quantity = po.sizes.reduce((sum, item) => sum + item.quantity, 0);
      if (!sequence || quantity <= 0) return null;
      const workOrderNo = await nextWorkOrderNo(tx);
      const workOrder = await tx.productionWorkOrder.create({
        data: {
          workOrderNo,
          salesOrderId: order.id,
          route: po.garmentType,
          productName: po.productName,
          quantity,
          deadline: po.deadline,
          stageSequence: sequence,
          currentStage: sequence[0],
          steps: { create: sequence.map((stage, position) => ({ stage, position, status: position === 0 ? "ACTIVE" : "PENDING", attemptCount: position === 0 ? 1 : 0, startedAt: position === 0 ? new Date() : null })) },
          activities: { create: { actorId: payment.createdById, type: "CREATED", toStage: sequence[0], note: "Dibuat otomatis dari pembayaran pertama." } },
        },
        select: { id: true, workOrderNo: true },
      });
      await tx.auditEvent.create({
        data: {
          actorId: payment.createdById,
          entityType: "ProductionWorkOrder",
          entityId: workOrder.id,
          action: "PRODUCTION_WORK_ORDER_CREATED",
          changedFields: ["route", "productName", "quantity", "deadline", "stageSequence", "currentStage"],
          metadata: { backfill: true, salesOrderId: order.id, workOrderNo },
        },
      });
      return workOrder.workOrderNo;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 30_000, timeout: 30_000 });

    if (result) created.push(result);
    else skipped.push(candidate.salesOrderNo);
  }

  console.log(`Backfill Produksi selesai. Dibuat: ${created.length}; dilewati: ${skipped.length}.`);
  for (const number of created) console.log(`+ ${number}`);
  for (const number of skipped) console.log(`! ${number} (data PO belum lengkap atau Work Order sudah ada)`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Backfill Produksi gagal.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
