import "dotenv/config";

import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEMO_DATA !== "true") {
  console.error("Seed dibatalkan. Jalankan di development dengan ALLOW_DEMO_DATA=true.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum dikonfigurasi.");
  process.exit(1);
}

const demos = [
  {
    key: "JERSEY",
    workOrderNo: "DEMO-WO-JERSEY",
    title: "[DEMO] Jersey Futsal Custom",
    quantity: 24,
    unitPrice: 125_000,
    deadlineDays: 14,
    route: "JERSEY",
    stages: ["TEST_PRINT", "PERSETUJUAN_SAMPEL", "LAYOUT_PRODUKSI", "PRINT", "CUTTING", "QC", "SELESAI"],
  },
  {
    key: "NON-JERSEY",
    workOrderNo: "DEMO-WO-NON-JERSEY",
    title: "[DEMO] Kaos Event Sablon",
    quantity: 40,
    unitPrice: 85_000,
    deadlineDays: 21,
    route: "NON_JERSEY",
    stages: ["POTONG", "BORDIR", "SABLON", "PRINTING", "JAHIT", "QC", "PACKING", "PENGIRIMAN", "SELESAI"],
  },
];

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function deadlineAfter(days) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

try {
  const result = await prisma.$transaction(
    async (tx) => {
      const actor = await tx.appUser.findFirst({
        where: { isActive: true, role: { in: ["OWNER", "ADMIN"] } },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      if (!actor) throw new Error("Owner/Admin aktif tidak ditemukan. Jalankan bootstrap Owner terlebih dahulu.");

      const [customerType, leadSource] = await Promise.all([
        tx.customerType.findUnique({ where: { id: "master-ct-komunitas" }, select: { id: true } }),
        tx.leadSource.findUnique({ where: { id: "master-ls-other" }, select: { id: true } }),
      ]);
      if (!customerType || !leadSource) throw new Error("Master data CRM belum tersedia. Terapkan seluruh migration terlebih dahulu.");

      const customer = await tx.customer.upsert({
        where: { id: "DEMO-CUS-PRODUCTION" },
        update: {},
        create: {
          id: "DEMO-CUS-PRODUCTION",
          customerNo: "DEMO-CUS-PRODUCTION",
          name: "[DEMO] Pelanggan Produksi",
          companyName: "[DEMO] Komunitas Olahraga",
          email: "production-demo@example.invalid",
          notes: "Data demonstrasi Kanban Produksi.",
          customerTypeId: customerType.id,
          leadSourceId: leadSource.id,
          salesPicId: actor.id,
        },
        select: { id: true, name: true, companyName: true },
      });

      const created = [];
      const skipped = [];

      for (const demo of demos) {
        const ids = {
          opportunity: `DEMO-OPP-${demo.key}`,
          purchaseOrder: `DEMO-PO-${demo.key}`,
          purchaseOrderSize: `DEMO-POS-${demo.key}`,
          invoice: `DEMO-INV-${demo.key}`,
          invoiceItem: `DEMO-INVI-${demo.key}`,
          salesOrder: `DEMO-SO-${demo.key}`,
          salesOrderItem: `DEMO-SOI-${demo.key}`,
          workOrder: demo.workOrderNo,
        };

        const existing = await tx.productionWorkOrder.findUnique({ where: { id: ids.workOrder }, select: { workOrderNo: true } });
        if (existing) {
          skipped.push(existing.workOrderNo);
          continue;
        }

        const subtotal = demo.quantity * demo.unitPrice;
        const opportunity = await tx.opportunity.upsert({
          where: { id: ids.opportunity },
          update: {},
          create: {
            id: ids.opportunity,
            opportunityNo: ids.opportunity,
            customerId: customer.id,
            title: demo.title,
            stage: "DEAL",
            leadSourceId: leadSource.id,
            salesPicId: actor.id,
            productName: demo.title,
            designStatus: "SUDAH_ADA",
            estimatedQuantity: demo.quantity,
            estimatedValue: subtotal,
            deadline: deadlineAfter(demo.deadlineDays),
          },
          select: { id: true },
        });

        const purchaseOrder = await tx.purchaseOrder.upsert({
          where: { id: ids.purchaseOrder },
          update: {},
          create: {
            id: ids.purchaseOrder,
            purchaseOrderNo: ids.purchaseOrder,
            opportunityId: opportunity.id,
            revision: 1,
            status: "AGREED",
            productName: demo.title,
            material: "[DEMO] Dry-fit",
            deadline: deadlineAfter(demo.deadlineDays),
            agreedAt: new Date(),
            createdById: actor.id,
          },
          select: { id: true, purchaseOrderNo: true },
        });
        await tx.purchaseOrderSize.upsert({
          where: { id: ids.purchaseOrderSize },
          update: {},
          create: {
            id: ids.purchaseOrderSize,
            purchaseOrderId: purchaseOrder.id,
            position: 0,
            size: "All Size",
            quantity: demo.quantity,
          },
        });

        const invoice = await tx.invoice.upsert({
          where: { id: ids.invoice },
          update: {},
          create: {
            id: ids.invoice,
            invoiceNo: ids.invoice,
            opportunityId: opportunity.id,
            purchaseOrderId: purchaseOrder.id,
            revision: 1,
            status: "ISSUED",
            snapshotCustomerName: customer.name,
            snapshotCompanyName: customer.companyName,
            snapshotEmail: "production-demo@example.invalid",
            subtotal,
            total: subtotal,
            issuedAt: new Date(),
            createdById: actor.id,
          },
          select: { id: true, invoiceNo: true },
        });
        await tx.invoiceItem.upsert({
          where: { id: ids.invoiceItem },
          update: {},
          create: {
            id: ids.invoiceItem,
            invoiceId: invoice.id,
            position: 0,
            size: "All Size",
            description: demo.title,
            quantity: demo.quantity,
            unitPrice: demo.unitPrice,
            subtotal,
          },
        });

        const salesOrder = await tx.salesOrder.upsert({
          where: { id: ids.salesOrder },
          update: {},
          create: {
            id: ids.salesOrder,
            salesOrderNo: ids.salesOrder,
            opportunityId: opportunity.id,
            purchaseOrderId: purchaseOrder.id,
            invoiceId: invoice.id,
            purchaseOrderNo: purchaseOrder.purchaseOrderNo,
            invoiceNo: invoice.invoiceNo,
            snapshotCustomerName: customer.name,
            snapshotCompanyName: customer.companyName,
            snapshotEmail: "production-demo@example.invalid",
            discountType: "NONE",
            discountValue: 0,
            subtotal,
            total: subtotal,
            acceptedAt: new Date(),
            createdById: actor.id,
          },
          select: { id: true },
        });
        await tx.salesOrderItem.upsert({
          where: { id: ids.salesOrderItem },
          update: {},
          create: {
            id: ids.salesOrderItem,
            salesOrderId: salesOrder.id,
            position: 0,
            size: "All Size",
            description: demo.title,
            quantity: demo.quantity,
            unitPrice: demo.unitPrice,
            subtotal,
          },
        });

        await tx.productionWorkOrder.create({
          data: {
            id: ids.workOrder,
            workOrderNo: ids.workOrder,
            salesOrderId: salesOrder.id,
            route: demo.route,
            productName: demo.title,
            quantity: demo.quantity,
            deadline: deadlineAfter(demo.deadlineDays),
            stageSequence: demo.stages,
            currentStage: demo.stages[0],
            steps: {
              create: demo.stages.map((stage, position) => ({
                stage,
                position,
                status: position === 0 ? "ACTIVE" : "PENDING",
                attemptCount: position === 0 ? 1 : 0,
                startedAt: position === 0 ? new Date() : null,
              })),
            },
            activities: { create: { actorId: actor.id, type: "CREATED", toStage: demo.stages[0], note: "Data demonstrasi." } },
          },
        });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            entityType: "ProductionWorkOrder",
            entityId: ids.workOrder,
            action: "PRODUCTION_WORK_ORDER_CREATED",
            changedFields: ["route", "productName", "quantity", "deadline", "stageSequence", "currentStage"],
            metadata: { demo: true, salesOrderId: salesOrder.id, workOrderNo: ids.workOrder },
          },
        });
        created.push(ids.workOrder);
      }

      return { created, skipped };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 30_000, timeout: 30_000 },
  );

  console.log(`Seed Produksi selesai. Dibuat: ${result.created.length}; sudah ada: ${result.skipped.length}.`);
  for (const number of result.created) console.log(`+ ${number}`);
  for (const number of result.skipped) console.log(`= ${number} (dilewati)`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Seed Produksi gagal.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
