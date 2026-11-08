#!/usr/bin/env node
/**
 * Sisipkan kode brand AS/SG ke nomor SO, INV, PO lama supaya nama file unduhan
 * langsung menunjukkan brand. Tidak mengubah tanggal.
 *
 *   node scripts/brand-prefix-document-numbers.mjs           dry-run
 *   node scripts/brand-prefix-document-numbers.mjs --apply
 */

import "dotenv/config";

import pg from "pg";

const APPLY = process.argv.includes("--apply");
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL / DIRECT_URL belum dikonfigurasi.");
  process.exit(1);
}

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 30_000 });
await client.connect();

try {
  const { rows: counts } = await client.query(`
    select
      brand::text,
      count(*)::int as n,
      count(*) filter (where "salesOrderNo" ~ '^(SO)-(AS|SG)-')::int as so_branded,
      count(*) filter (where "invoiceNo" ~ '^(INV)-(AS|SG)-')::int as inv_branded,
      count(*) filter (where "purchaseOrderNo" ~ '^(PO)-(AS|SG)-')::int as po_branded
    from "SalesOrder"
    group by brand
    order by brand
  `);

  const { rows: samples } = await client.query(`
    select brand::text, "salesOrderNo", "purchaseOrderNo", "invoiceNo"
    from "SalesOrder"
    where "salesOrderNo" !~ '^(SO)-(AS|SG)-'
    order by "salesOrderNo"
    limit 5
  `);

  const { rows: expCounts } = await client.query(`
    select brand::text, count(*)::int as n
    from "Expense"
    where purpose ~ 'INV-[0-9]{4}-'
    group by brand
  `);

  console.log("=== brand-prefix-document-numbers ===");
  console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
  console.log("SalesOrder by brand:", counts);
  console.log("Expense purpose dengan INV-YYYY-:", expCounts);
  console.log("Sampel legacy:", samples);

  const needWork = counts.some((row) => row.so_branded < row.n || row.inv_branded < row.n || row.po_branded < row.n);
  if (!needWork && !expCounts.length) {
    console.log("Semua nomor sudah ber-prefix brand. Tidak ada yang diubah.");
    process.exit(0);
  }

  if (!APPLY) {
    console.log("\nAkan mengubah:");
    console.log("  SO-YYYY-…   → SO-AS/SG-YYYY-…");
    console.log("  INV-YYYY-…  → INV-AS/SG-YYYY-…");
    console.log("  PO-…        → PO-AS/SG-…");
    console.log("  purpose HPP yang memuat INV lama");
    console.log("Dry-run selesai. Jalankan ulang dengan --apply untuk menulis.");
    process.exit(0);
  }

  await client.query("begin");
  try {
    // Askonveksi
    const asSo = await client.query(`
      update "SalesOrder"
      set
        "salesOrderNo" = regexp_replace("salesOrderNo", '^SO-', 'SO-AS-'),
        "purchaseOrderNo" = regexp_replace("purchaseOrderNo", '^PO-', 'PO-AS-'),
        "invoiceNo" = regexp_replace("invoiceNo", '^INV-', 'INV-AS-')
      where brand = 'ASKONVEKSI'
        and "salesOrderNo" !~ '^SO-(AS|SG)-'
    `);
    const asPo = await client.query(`
      update "PurchaseOrder"
      set
        "purchaseOrderNo" = regexp_replace("purchaseOrderNo", '^PO-', 'PO-AS-')
      where brand = 'ASKONVEKSI'
        and "purchaseOrderNo" !~ '^PO-(AS|SG)-'
    `);
    const asInv = await client.query(`
      update "Invoice"
      set
        "invoiceNo" = regexp_replace("invoiceNo", '^INV-', 'INV-AS-')
      where brand = 'ASKONVEKSI'
        and "invoiceNo" !~ '^INV-(AS|SG)-'
    `);
    const asExp = await client.query(`
      update "Expense"
      set
        purpose = regexp_replace(purpose, 'INV-([0-9]{4}-)', 'INV-AS-\\1', 'g')
      where brand = 'ASKONVEKSI'
        and purpose ~ 'INV-[0-9]{4}-'
    `);

    // SAGA
    const sgSo = await client.query(`
      update "SalesOrder"
      set
        "salesOrderNo" = regexp_replace("salesOrderNo", '^SO-', 'SO-SG-'),
        "purchaseOrderNo" = regexp_replace("purchaseOrderNo", '^PO-', 'PO-SG-'),
        "invoiceNo" = regexp_replace("invoiceNo", '^INV-', 'INV-SG-')
      where brand = 'SAGA'
        and "salesOrderNo" !~ '^SO-(AS|SG)-'
    `);
    const sgPo = await client.query(`
      update "PurchaseOrder"
      set
        "purchaseOrderNo" = regexp_replace("purchaseOrderNo", '^PO-', 'PO-SG-')
      where brand = 'SAGA'
        and "purchaseOrderNo" !~ '^PO-(AS|SG)-'
    `);
    const sgInv = await client.query(`
      update "Invoice"
      set
        "invoiceNo" = regexp_replace("invoiceNo", '^INV-', 'INV-SG-')
      where brand = 'SAGA'
        and "invoiceNo" !~ '^INV-(AS|SG)-'
    `);
    const sgExp = await client.query(`
      update "Expense"
      set
        purpose = regexp_replace(purpose, 'INV-([0-9]{4}-)', 'INV-SG-\\1', 'g')
      where brand = 'SAGA'
        and purpose ~ 'INV-[0-9]{4}-'
    `);

    // WO legacy (kalau ada)
    await client.query(`
      update "ProductionWorkOrder"
      set "workOrderNo" = regexp_replace("workOrderNo", '^WO-', 'WO-AS-')
      where brand = 'ASKONVEKSI' and "workOrderNo" !~ '^WO-(AS|SG)-'
    `);
    await client.query(`
      update "ProductionWorkOrder"
      set "workOrderNo" = regexp_replace("workOrderNo", '^WO-', 'WO-SG-')
      where brand = 'SAGA' and "workOrderNo" !~ '^WO-(AS|SG)-'
    `);

    const { rows: leftover } = await client.query(`
      select
        (select count(*)::int from "SalesOrder" where "salesOrderNo" !~ '^SO-(AS|SG)-') as so,
        (select count(*)::int from "Invoice" where "invoiceNo" !~ '^INV-(AS|SG)-') as inv,
        (select count(*)::int from "PurchaseOrder" where "purchaseOrderNo" !~ '^PO-(AS|SG)-') as po,
        (select count(*)::int from "Expense" where purpose ~ 'INV-[0-9]{4}-') as exp,
        (select count(*)::int from "SalesOrder" where brand = 'SAGA' and "salesOrderNo" !~ '^SO-SG-') as saga_wrong,
        (select count(*)::int from "SalesOrder" where brand = 'ASKONVEKSI' and "salesOrderNo" !~ '^SO-AS-') as as_wrong
    `);

    const check = leftover[0];
    if (check.so || check.inv || check.po || check.exp || check.saga_wrong || check.as_wrong) {
      throw new Error(`Verifikasi gagal: ${JSON.stringify(check)}`);
    }

    await client.query("commit");

    console.log("\n=== hasil ===");
    console.log(`ASKONVEKSI SO=${asSo.rowCount} PO=${asPo.rowCount} INV=${asInv.rowCount} expense=${asExp.rowCount}`);
    console.log(`SAGA        SO=${sgSo.rowCount} PO=${sgPo.rowCount} INV=${sgInv.rowCount} expense=${sgExp.rowCount}`);
    console.log("Verifikasi leftover: 0");
    console.log("\nAPPLY selesai.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
} finally {
  await client.end();
}
