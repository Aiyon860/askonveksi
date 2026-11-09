#!/usr/bin/env node
/**
 * Sinkronkan `SequenceCounter` nomor dokumen ke nomor tertinggi yang sudah terpakai.
 *
 * Masalah: setelah penomoran diberi prefix brand, counter baru (`ASKONVEKSI:work-order:2026`)
 * mulai dari kecil sementara dokumen lama sudah memakai nomor tinggi. Nomor berikutnya bisa
 * menabrak `@unique` (P2002) — mis. WO-AS-2026-00015 sudah ada.
 *
 * Script ini hanya MENAIKKAN counter (tidak pernah menurunkan), per brand + tahun:
 *   invoice      INV-<kode>-<tahun>-<nomor>
 *   sales-order  SO-<kode>-<tahun>-<nomor>
 *   work-order   WO-<kode>-<tahun>-<nomor>
 *
 *   node scripts/sync-document-counters.mjs                      dry-run
 *   node scripts/sync-document-counters.mjs --apply              tulis
 *   node scripts/sync-document-counters.mjs --apply --allow-remote  izinkan database remote
 */

import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const APPLY = process.argv.includes("--apply");
const ALLOW_REMOTE = process.argv.includes("--allow-remote");

const BRAND_CODES = { ASKONVEKSI: "AS", SAGA: "SG" };

const SOURCES = [
  {
    kind: "invoice",
    table: "Invoice",
    column: "invoiceNo",
    prefix: "INV",
    pad: 5,
    read: (prisma) => prisma.$queryRawUnsafe(`
      SELECT brand::text AS brand,
             (regexp_match("invoiceNo", '^INV-(AS|SG)-(\\d{4})-(\\d+)$'))[2]::int AS year,
             max((regexp_match("invoiceNo", '^INV-(AS|SG)-(\\d{4})-(\\d+)$'))[3]::int) AS max_no
      FROM "Invoice"
      WHERE "invoiceNo" ~ '^INV-(AS|SG)-\\d{4}-\\d+$'
      GROUP BY brand, year`),
  },
  {
    kind: "sales-order",
    table: "SalesOrder",
    column: "salesOrderNo",
    prefix: "SO",
    pad: 5,
    read: (prisma) => prisma.$queryRawUnsafe(`
      SELECT brand::text AS brand,
             (regexp_match("salesOrderNo", '^SO-(AS|SG)-(\\d{4})-(\\d+)$'))[2]::int AS year,
             max((regexp_match("salesOrderNo", '^SO-(AS|SG)-(\\d{4})-(\\d+)$'))[3]::int) AS max_no
      FROM "SalesOrder"
      WHERE "salesOrderNo" ~ '^SO-(AS|SG)-\\d{4}-\\d+$'
      GROUP BY brand, year`),
  },
  {
    kind: "work-order",
    table: "ProductionWorkOrder",
    column: "workOrderNo",
    prefix: "WO",
    pad: 5,
    read: (prisma) => prisma.$queryRawUnsafe(`
      SELECT brand::text AS brand,
             (regexp_match("workOrderNo", '^WO-(AS|SG)-(\\d{4})-(\\d+)$'))[2]::int AS year,
             max((regexp_match("workOrderNo", '^WO-(AS|SG)-(\\d{4})-(\\d+)$'))[3]::int) AS max_no
      FROM "ProductionWorkOrder"
      WHERE "workOrderNo" ~ '^WO-(AS|SG)-\\d{4}-\\d+$'
      GROUP BY brand, year`),
  },
];

function formatNo(prefix, code, year, value, pad) {
  return `${prefix}-${code}-${year}-${String(value).padStart(pad, "0")}`;
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!databaseUrl) fail("DIRECT_URL / DATABASE_URL belum dikonfigurasi.");

const hostname = new URL(databaseUrl).hostname;
const remote = !["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(hostname.toLowerCase());
console.log(`Database: ${hostname} ${remote ? "(REMOTE)" : "(lokal)"} | mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
if (remote && APPLY && !ALLOW_REMOTE) fail("Database remote. Tambahkan --allow-remote bila memang yakin.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

try {
  const plans = [];
  for (const source of SOURCES) {
    const rows = await source.read(prisma);
    for (const row of rows) {
      if (!row.max_no || !row.year) continue;
      const brand = row.brand;
      const code = BRAND_CODES[brand];
      if (!code) fail(`Brand ${brand} tidak dikenal.`);
      const key = `${brand}:${source.kind}:${row.year}`;
      const current = await prisma.sequenceCounter.findUnique({ where: { key } });
      const maxNo = Number(row.max_no);
      const next = Math.max(current?.value ?? 0, maxNo);
      const nextDocument = formatNo(source.prefix, code, row.year, next + 1, source.pad);
      plans.push({
        source,
        brand,
        code,
        year: Number(row.year),
        key,
        current: current?.value ?? null,
        maxNo,
        next,
        nextDocument,
      });
    }
  }

  plans.sort((a, b) => a.key.localeCompare(b.key));
  console.log("\nRencana counter (hanya menaikkan):");
  for (const plan of plans) {
    const change = plan.current === plan.next ? "tetap" : `${plan.current ?? "-"} → ${plan.next}`;
    console.log(`  ${plan.key.padEnd(30)} ${change.padEnd(14)} (max terpakai ${plan.maxNo}) · berikutnya ${plan.nextDocument}`);
  }

  // Penjaga: nomor berikutnya tidak boleh sudah ada di tabelnya.
  for (const plan of plans) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM "${plan.source.table}" WHERE "${plan.source.column}" = $1 LIMIT 1`,
      plan.nextDocument,
    );
    if (rows.length) fail(`${plan.nextDocument} sudah terpakai di ${plan.source.table}; rencana counter salah.`);
  }
  console.log("\nPenjaga OK: semua nomor berikutnya belum terpakai.");

  if (!APPLY) {
    console.log("\nDry-run selesai — tidak ada yang ditulis. Jalankan ulang dengan --apply untuk menulis.");
    process.exit(0);
  }

  await prisma.$transaction(
    plans
      .filter((plan) => plan.current !== plan.next)
      .map((plan) =>
        prisma.sequenceCounter.upsert({
          where: { key: plan.key },
          create: { key: plan.key, value: plan.next },
          update: { value: plan.next },
        }),
      ),
  );

  console.log(`\nAPPLY selesai: ${plans.filter((plan) => plan.current !== plan.next).length} counter diperbarui.`);

  // Verifikasi ulang setelah commit.
  let failed = 0;
  for (const plan of plans) {
    const counter = await prisma.sequenceCounter.findUnique({ where: { key: plan.key } });
    const nextDocument = formatNo(plan.source.prefix, plan.code, plan.year, (counter?.value ?? 0) + 1, plan.source.pad);
    const rows = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM "${plan.source.table}" WHERE "${plan.source.column}" = $1 LIMIT 1`,
      nextDocument,
    );
    const ok = counter?.value === plan.next && rows.length === 0;
    if (!ok) failed += 1;
    console.log(`  ${ok ? "OK  " : "GAGAL"} ${plan.key}=${counter?.value ?? "-"} · berikutnya ${nextDocument}${rows.length ? " (bentrok!)" : ""}`);
  }
  if (failed) fail(`${failed} counter masih tidak valid.`);
  console.log("Verifikasi akhir OK.");
} finally {
  await prisma.$disconnect();
}
