#!/usr/bin/env node
/**
 * Backfill HPP per produk (SalesOrderProductCost) untuk order lama/impor yang
 * hanya punya agregat di SalesOrderCost. Tanpa baris ini tabel Project tidak
 * menampilkan Edit HPP per produk.
 *
 * Statement SQL-nya dibaca langsung dari migrasi
 * prisma/migrations/20261029150000_backfill_sales_order_product_cost/migration.sql
 * supaya script dan migrasi tidak pernah berbeda.
 *
 *   node scripts/backfill-project-product-costs.mjs            # dry-run (default)
 *   node scripts/backfill-project-product-costs.mjs --apply    # tulis satu transaksi
 *
 * Idempoten: aman dijalankan berulang. Tidak menghapus data dan tidak mengubah
 * nilai agregat SalesOrderCost.
 */

import "dotenv/config";

import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const MIGRATION_FILE = "prisma/migrations/20261029150000_backfill_sales_order_product_cost/migration.sql";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum dikonfigurasi.");
  process.exit(1);
}

const apply = process.argv.includes("--apply");

function statementsOf(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
    // Script sudah membungkus semuanya dalam satu transaksi Prisma.
    .filter((statement) => !/^(BEGIN|COMMIT|ROLLBACK)$/i.test(statement));
}

const MISSING_ORDERS = `
  SELECT count(*) FROM "SalesOrder" so
  WHERE NOT EXISTS (SELECT 1 FROM "SalesOrderProductCost" pc WHERE pc."salesOrderId" = so.id)
`;

const MISSING_ROWS = `
  SELECT count(*) FROM (
    SELECT so.id, COALESCE(NULLIF(BTRIM(ii."productName"), ''), NULLIF(BTRIM(po."productName"), ''), 'Produk') AS name
    FROM "SalesOrder" so
    JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
    LEFT JOIN "InvoiceItem" ii ON ii."invoiceId" = so."invoiceId"
    GROUP BY 1, 2
  ) wanted
  WHERE NOT EXISTS (
    SELECT 1 FROM "SalesOrderProductCost" pc
    WHERE pc."salesOrderId" = wanted.id AND pc."productName" = wanted.name
  )
`;

const ORPHAN_EXPENSES = `
  SELECT count(*) FROM "Expense" e
  WHERE e.category = 'PROJECT'
    AND e."salesOrderProductCostId" IS NULL
    AND e."salesOrderId" IN (
      SELECT so.id FROM "SalesOrder" so
      WHERE NOT EXISTS (SELECT 1 FROM "SalesOrderProductCost" pc WHERE pc."salesOrderId" = so.id)
    )
`;

const ORDERS_WITH_HPP = `
  SELECT count(*) FROM "SalesOrder" so
  JOIN "SalesOrderCost" c ON c."salesOrderId" = so.id
  WHERE NOT EXISTS (SELECT 1 FROM "SalesOrderProductCost" pc WHERE pc."salesOrderId" = so.id)
    AND (coalesce(c."kain", 0) + coalesce(c."zipper", 0) + coalesce(c."jahit", 0) + coalesce(c."pres", 0)
       + coalesce(c."dtfPlastisol", 0) + coalesce(c."bordir", 0) + coalesce(c."lainnya", 0)) > 0
`;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function count(sql) {
  const [row] = await prisma.$queryRawUnsafe(sql);
  return Number(Object.values(row ?? {})[0] ?? 0);
}

async function report(label) {
  console.log(`${label}`);
  console.log(`  order tanpa baris HPP per produk : ${await count(MISSING_ORDERS)}`);
  console.log(`  baris HPP yang perlu dibuat      : ${await count(MISSING_ROWS)}`);
  console.log(`  order yang HPP-nya masih agregat : ${await count(ORDERS_WITH_HPP)}`);
  console.log(`  expense PROJECT belum ditautkan  : ${await count(ORPHAN_EXPENSES)}`);
}

try {
  const sql = readFileSync(path.join(root, MIGRATION_FILE), "utf8");
  const statements = statementsOf(sql);
  console.log(`Statement: ${statements.length} (${MIGRATION_FILE})`);
  await report("Sebelum:");

  if (!apply) {
    console.log("\nDry-run. Jalankan dengan --apply untuk menulis.");
    process.exit(0);
  }

  await prisma.$transaction(
    async (tx) => {
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
    },
    { maxWait: 10_000, timeout: 120_000 },
  );

  await report("\nSesudah:");
  console.log("\nBackfill selesai.");
} catch (error) {
  console.error("Backfill gagal:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
