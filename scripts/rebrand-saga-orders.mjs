#!/usr/bin/env node
/**
 * Pindahkan order (dan rantai dokumen + expense) yang namanya mengandung "SAGA"
 * dari brand ASKONVEKSI ke SAGA. Tidak mengubah tanggal atau nomor dokumen.
 *
 *   node scripts/rebrand-saga-orders.mjs           dry-run
 *   node scripts/rebrand-saga-orders.mjs --apply   tulis satu transaksi
 */

import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const APPLY = process.argv.includes("--apply");

/** Whitelist SO yang harus tepat match hasil seleksi nama "saga". */
const EXPECTED_SO_NOS = [
  "SO-2026-00180",
  "SO-2026-00190",
  "SO-2026-00191",
  "SO-2026-00192",
  "SO-2026-00193",
  "SO-2026-00194",
  "SO-2026-00195",
  "SO-2026-00045",
  "SO-2026-00206",
  "SO-2026-00251",
  "SO-2026-00207",
  "SO-2026-00208",
  "SO-2026-00247",
  "SO-2026-00248",
  "SO-2026-00249",
];

const EXPECTED_UNLINKED_EXPENSE = 10;

const sagaNameFilter = {
  OR: [
    { snapshotCustomerName: { contains: "saga", mode: "insensitive" } },
    { snapshotCompanyName: { contains: "saga", mode: "insensitive" } },
    { opportunity: { customer: { name: { contains: "saga", mode: "insensitive" } } } },
  ],
};

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function sortNos(nos) {
  return [...nos].sort();
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL belum dikonfigurasi.");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const orders = await prisma.salesOrder.findMany({
      where: sagaNameFilter,
      select: {
        id: true,
        brand: true,
        salesOrderNo: true,
        acceptedAt: true,
        total: true,
        snapshotCustomerName: true,
        opportunityId: true,
        purchaseOrderId: true,
        invoiceId: true,
        opportunity: {
          select: {
            brand: true,
            customerId: true,
            customer: { select: { id: true, name: true, brandScope: true, customerNo: true } },
          },
        },
        purchaseOrder: {
          select: {
            brand: true,
            productCategoryId: true,
            productCategory: { select: { id: true, name: true, brand: true } },
          },
        },
        invoice: { select: { brand: true, issuedAt: true } },
        productionWorkOrders: { select: { id: true, brand: true } },
      },
      orderBy: { salesOrderNo: "asc" },
    });

    const foundNos = sortNos(orders.map((o) => o.salesOrderNo));
    const expectedNos = sortNos(EXPECTED_SO_NOS);
    if (foundNos.length !== expectedNos.length || foundNos.some((n, i) => n !== expectedNos[i])) {
      fail(
        `Seleksi SO tidak cocok whitelist.\n  found (${foundNos.length}): ${foundNos.join(", ")}\n  expected (${expectedNos.length}): ${expectedNos.join(", ")}`,
      );
    }

    const soIds = orders.map((o) => o.id);
    const oppIds = orders.map((o) => o.opportunityId);
    const poIds = orders.map((o) => o.purchaseOrderId);
    const invIds = orders.map((o) => o.invoiceId);
    const pwoIds = orders.flatMap((o) => o.productionWorkOrders.map((p) => p.id));
    const customerIds = [...new Set(orders.map((o) => o.opportunity.customerId))];

    const acceptedBefore = Object.fromEntries(
      orders.map((o) => [o.salesOrderNo, o.acceptedAt.toISOString()]),
    );

    const asCategories = await prisma.productCategory.findMany({
      where: { brand: "ASKONVEKSI" },
      select: { id: true, name: true },
    });
    const sgCategories = await prisma.productCategory.findMany({
      where: { brand: "SAGA" },
      select: { id: true, name: true },
    });
    const sagaCatByName = new Map(sgCategories.map((c) => [c.name, c.id]));
    const asCatById = new Map(asCategories.map((c) => [c.id, c.name]));

    const poCategoryUpdates = [];
    for (const order of orders) {
      const catId = order.purchaseOrder.productCategoryId;
      if (!catId) {
        poCategoryUpdates.push({ poId: order.purchaseOrderId, nextCategoryId: null, name: null });
        continue;
      }
      const name = order.purchaseOrder.productCategory?.name ?? asCatById.get(catId);
      if (!name) fail(`PO ${order.salesOrderNo}: kategori ${catId} tidak punya nama.`);
      const twin = sagaCatByName.get(name);
      if (!twin) fail(`Tidak ada ProductCategory SAGA untuk nama "${name}" (SO ${order.salesOrderNo}).`);
      poCategoryUpdates.push({ poId: order.purchaseOrderId, nextCategoryId: twin, name });
    }

    const linkedExpenses = await prisma.expense.findMany({
      where: { salesOrderId: { in: soIds } },
      select: { id: true, brand: true, spentAt: true, purpose: true },
    });
    const unlinkedExpenses = await prisma.expense.findMany({
      where: {
        salesOrderId: null,
        OR: [
          { purpose: { contains: "saga", mode: "insensitive" } },
          { description: { contains: "saga", mode: "insensitive" } },
          { customerName: { contains: "saga", mode: "insensitive" } },
        ],
      },
      select: { id: true, brand: true, spentAt: true, purpose: true, amount: true },
      orderBy: { spentAt: "asc" },
    });

    if (unlinkedExpenses.length !== EXPECTED_UNLINKED_EXPENSE) {
      fail(
        `Expense unlinked saga diharapkan ${EXPECTED_UNLINKED_EXPENSE}, ketemu ${unlinkedExpenses.length}: ${unlinkedExpenses.map((e) => e.purpose).join(" | ")}`,
      );
    }

    const entityIds = [
      ...soIds,
      ...oppIds,
      ...poIds,
      ...invIds,
      ...pwoIds,
      ...customerIds,
      ...linkedExpenses.map((e) => e.id),
      ...unlinkedExpenses.map((e) => e.id),
    ];
    const auditEvents = await prisma.auditEvent.findMany({
      where: { entityId: { in: entityIds } },
      select: { id: true, brand: true, entityType: true, entityId: true },
    });

    const alreadySaga = orders.filter((o) => o.brand === "SAGA").length;
    console.log("=== rebrand-saga-orders ===");
    console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
    console.log(`SO: ${orders.length} (sudah SAGA: ${alreadySaga})`);
    console.log(`Customer: ${customerIds.length}`);
    console.log(`Opp/PO/INV/PWO: ${oppIds.length}/${poIds.length}/${invIds.length}/${pwoIds.length}`);
    console.log(`Expense linked: ${linkedExpenses.length}; unlinked saga: ${unlinkedExpenses.length}`);
    console.log(`AuditEvent terkait: ${auditEvents.length}`);
    console.log("");
    for (const order of orders) {
      const twin = poCategoryUpdates.find((u) => u.poId === order.purchaseOrderId);
      console.log(
        `${order.salesOrderNo}  ${order.brand.padEnd(11)}  ${order.snapshotCustomerName}  · cat ${order.purchaseOrder.productCategory?.name ?? "-"} → ${twin?.name ?? "-"}  · accepted ${order.acceptedAt.toISOString()}`,
      );
    }
    console.log("");
    for (const exp of unlinkedExpenses) {
      console.log(`expense unlinked  ${exp.brand.padEnd(11)}  ${exp.spentAt.toISOString().slice(0, 10)}  ${exp.purpose}  ${Number(exp.amount)}`);
    }

    if (!APPLY) {
      console.log("\nDry-run selesai. Jalankan ulang dengan --apply untuk menulis.");
      return;
    }

    await prisma.$transaction(
      async (tx) => {
      // Batch PO by target SAGA category id.
      const byCat = new Map();
      const noCat = [];
      for (const update of poCategoryUpdates) {
        if (!update.nextCategoryId) {
          noCat.push(update.poId);
          continue;
        }
        const list = byCat.get(update.nextCategoryId) ?? [];
        list.push(update.poId);
        byCat.set(update.nextCategoryId, list);
      }
      for (const [categoryId, ids] of byCat) {
        await tx.purchaseOrder.updateMany({
          where: { id: { in: ids } },
          data: { brand: "SAGA", productCategoryId: categoryId },
        });
      }
      if (noCat.length) {
        await tx.purchaseOrder.updateMany({
          where: { id: { in: noCat } },
          data: { brand: "SAGA" },
        });
      }

      await tx.opportunity.updateMany({
        where: { id: { in: oppIds } },
        data: { brand: "SAGA" },
      });
      await tx.invoice.updateMany({
        where: { id: { in: invIds } },
        data: { brand: "SAGA" },
      });
      await tx.salesOrder.updateMany({
        where: { id: { in: soIds } },
        data: { brand: "SAGA" },
      });
      if (pwoIds.length) {
        await tx.productionWorkOrder.updateMany({
          where: { id: { in: pwoIds } },
          data: { brand: "SAGA" },
        });
      }
      await tx.customer.updateMany({
        where: { id: { in: customerIds } },
        data: { brandScope: "SAGA" },
      });

      const expenseIds = [
        ...linkedExpenses.map((e) => e.id),
        ...unlinkedExpenses.map((e) => e.id),
      ];
      if (expenseIds.length) {
        await tx.expense.updateMany({
          where: { id: { in: expenseIds } },
          data: { brand: "SAGA" },
        });
      }

      if (auditEvents.length) {
        await tx.auditEvent.updateMany({
          where: { id: { in: auditEvents.map((e) => e.id) } },
          data: { brand: "SAGA" },
        });
      }

      // --- assert 1: counts by brand ---
      const sagaSo = await tx.salesOrder.count({
        where: { ...sagaNameFilter, brand: "SAGA" },
      });
      const asSo = await tx.salesOrder.count({
        where: { ...sagaNameFilter, brand: "ASKONVEKSI" },
      });
      if (sagaSo !== EXPECTED_SO_NOS.length || asSo !== 0) {
        throw new Error(`Assert SO brand gagal: SAGA=${sagaSo} ASKONVEKSI=${asSo}`);
      }

      // --- assert 2: chain + category brand ---
      const after = await tx.salesOrder.findMany({
        where: { id: { in: soIds } },
        select: {
          salesOrderNo: true,
          brand: true,
          acceptedAt: true,
          opportunity: { select: { brand: true } },
          purchaseOrder: {
            select: {
              brand: true,
              productCategory: { select: { brand: true, name: true } },
            },
          },
          invoice: { select: { brand: true } },
          productionWorkOrders: { select: { brand: true } },
        },
      });
      for (const row of after) {
        if (row.brand !== "SAGA") throw new Error(`${row.salesOrderNo}: SO brand ${row.brand}`);
        if (row.opportunity.brand !== "SAGA") throw new Error(`${row.salesOrderNo}: Opp brand`);
        if (row.purchaseOrder.brand !== "SAGA") throw new Error(`${row.salesOrderNo}: PO brand`);
        if (row.invoice.brand !== "SAGA") throw new Error(`${row.salesOrderNo}: INV brand`);
        for (const pwo of row.productionWorkOrders) {
          if (pwo.brand !== "SAGA") throw new Error(`${row.salesOrderNo}: PWO brand`);
        }
        const cat = row.purchaseOrder.productCategory;
        if (cat && cat.brand !== "SAGA") {
          throw new Error(`${row.salesOrderNo}: kategori ${cat.name} masih ${cat.brand}`);
        }
        const beforeIso = acceptedBefore[row.salesOrderNo];
        if (row.acceptedAt.toISOString() !== beforeIso) {
          throw new Error(`${row.salesOrderNo}: acceptedAt berubah ${beforeIso} → ${row.acceptedAt.toISOString()}`);
        }
      }

      // --- assert 3: customers + expenses ---
      const custWrong = await tx.customer.count({
        where: { id: { in: customerIds }, brandScope: { not: "SAGA" } },
      });
      if (custWrong !== 0) throw new Error(`Customer brandScope belum SAGA: ${custWrong}`);

      const expWrong = await tx.expense.count({
        where: { id: { in: expenseIds }, brand: { not: "SAGA" } },
      });
      if (expWrong !== 0) throw new Error(`Expense belum SAGA: ${expWrong}`);

      const unlinkedStillAs = await tx.expense.count({
        where: {
          salesOrderId: null,
          brand: "ASKONVEKSI",
          OR: [
            { purpose: { contains: "saga", mode: "insensitive" } },
            { description: { contains: "saga", mode: "insensitive" } },
            { customerName: { contains: "saga", mode: "insensitive" } },
          ],
        },
      });
      if (unlinkedStillAs !== 0) {
        throw new Error(`Masih ada expense unlinked saga di ASKONVEKSI: ${unlinkedStillAs}`);
      }

      console.log("\n=== verifikasi (dalam transaksi) ===");
      console.log(`1/3 SO SAGA=${sagaSo} ASKONVEKSI=${asSo}`);
      console.log(`2/3 chain+kategori OK; acceptedAt unchanged untuk ${after.length} SO`);
      console.log(`3/3 customer SAGA=${customerIds.length}; expense dipindah=${expenseIds.length}`);
      },
      { maxWait: 20_000, timeout: 60_000 },
    );

    // Verifikasi ulang di luar transaksi
    const v1 = await prisma.salesOrder.groupBy({
      by: ["brand"],
      where: sagaNameFilter,
      _count: true,
    });
    const v2 = await prisma.customer.count({
      where: { id: { in: customerIds }, brandScope: "SAGA" },
    });
    const v3dates = await prisma.salesOrder.findMany({
      where: { id: { in: soIds } },
      select: { salesOrderNo: true, acceptedAt: true },
    });
    const dateDrift = v3dates.filter(
      (r) => r.acceptedAt.toISOString() !== acceptedBefore[r.salesOrderNo],
    );

    console.log("\n=== verifikasi ulang (post-commit) ===");
    console.log("SO by brand:", v1);
    console.log(`Customer SAGA scope: ${v2}/${customerIds.length}`);
    console.log(`acceptedAt drift: ${dateDrift.length}`);
    if (dateDrift.length) fail(`Tanggal berubah: ${dateDrift.map((d) => d.salesOrderNo).join(", ")}`);

    console.log("\nAPPLY selesai.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
