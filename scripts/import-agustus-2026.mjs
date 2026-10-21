#!/usr/bin/env node
/**
 * IMPORT DATA PROYEK AGUSTUS 2026 — AS Konveksi
 * ============================================================================
 * Sumber: "PROJECT AS BULAN AGUSTUS 2026.xlsx" (sheet PROJECT, DP, PNGELUARAN MURNI)
 *         + "Data CRM AS Konveksi.xlsx" (tanggal order & pemetaan customer).
 *
 * Rantai yang dibentuk per order (mengikuti alur aplikasi):
 *   Opportunity (DEAL) -> PurchaseOrder (AGREED) -> Invoice (ISSUED)
 *   -> SalesOrder (ACTIVE) + DealPayment + PaymentTerm + PaymentTransaction
 *   -> SalesOrderCost (7 bucket HPP) + Expense kategori PROJECT per bucket
 *   -> ProductionWorkOrder (COMPLETED) + ProductionStep
 * Order tanpa pembayaran sama sekali (ORADO & SAGA Kak Edwin) memakai alur resmi:
 *   Opportunity (NEGOSIASI) -> PO (AGREED) -> Invoice (ISSUED) -> PendingDealPayment
 *   (jadwal LUNAS menunggu) tanpa SalesOrder/WorkOrder; HPP-nya tetap Expense PROJECT
 *   (tanpa SalesOrder). SO + WO terbentuk otomatis saat pembayaran dicatat lewat
 *   tombol "Catat pembayaran LUNAS" di detail invoice.
 * Ditambah 69 pengeluaran operasional (sheet PNGELUARAN MURNI) apa adanya.
 *
 * Pakai:
 *   node scripts/import-agustus-2026.mjs            -> DRY RUN (tanpa tulis)
 *   node scripts/import-agustus-2026.mjs --apply    -> tulis ke DB (satu transaksi)
 *
 * Penjaga (berhenti sebelum menulis bila gagal):
 *  - total invoice PROYEK = 122.461.000 ; total HPP (DP) = 62.205.440
 *  - total uang masuk (DP) = 95.191.855 ; jadwal bayar per order cocok dgn DP
 *  - beban operasional = 10.871.167 ; total per kategori cocok 17/17
 *  - customer cocok (nomor + telepon), DB transaksional kosong (hasil cleanup)
 *  - net = 95.191.855 - 62.205.440 - 10.871.167 = 22.115.248 (= "Bersih" CATATAN)
 *  - outstanding = 122.461.000 - 95.191.855 = 27.269.145 (21 SO: 24.970.145 + 2 jadwal menunggu: 2.299.000)
 */

import "dotenv/config";

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const APPLY = process.argv.includes("--apply");
const ALLOW_REMOTE = process.argv.includes("--allow-remote");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_XLSX = "PROJECT AS BULAN AGUSTUS 2026.xlsx";

const HPP_KEYS = ["kain", "zipper", "jahit", "pres", "dtfPlastisol", "bordir", "lainnya"];
const HPP_LABEL = { kain: "Kain", zipper: "Zipper", jahit: "Jahit", pres: "Pres", dtfPlastisol: "DTF/Plastisol", bordir: "Bordir", lainnya: "Lain-lain" };

const JERSEY_STAGES = ["TEST_PRINT", "PERSETUJUAN_SAMPEL", "LAYOUT_PRODUKSI", "PRINT", "CUTTING", "QC", "SELESAI"];
const NON_JERSEY_STAGES = ["POTONG", "BORDIR", "SABLON", "PRINTING", "JAHIT", "QC", "PACKING", "PENGIRIMAN", "SELESAI"];
const AKSESORI_STAGES = ["JAHIT", "QC", "PACKING", "PENGIRIMAN", "SELESAI"];

const OWNER_NAME = "Mas Gandrik";
const TRANSFER_METHOD_ID = "payment-method-transfer";

const EXPECTED = {
  invoice: 122_461_000,
  hpp: 62_205_440,
  paid: 95_191_855,
  overhead: 10_871_167,
  outstanding: 27_269_145, // sisa tagihan total = 21 SO aktif + 2 jadwal menunggu
  pending: 2_299_000, // ORADO 819.000 + Edwin 1.480.000 (jadwal LUNAS menunggu)
  outstandingActive: 24_970_145, // outstanding DealPayment dari 21 SO aktif
  soValue: 120_162_000, // nilai Sales Order aktif (21 order)
  costSum: 61_781_315, // SalesOrderCost 7 bucket (HPP ORADO 424.125 ada di Expense tanpa SO)
  net: 22_115_248,
};

const EXPECTED_OVERHEAD_BY_CATEGORY = {
  WIFI: 233_100,
  LINGKUNGAN: 127_500,
  ADS: 1_817_500,
  CICILAN_LAPTOP: 752_000,
  FREE_PICK: 65_000,
  ONGKIR_CUST: 409_500,
  ONGKIR_ADMIN_PRODUKSI: 1_100_000,
  LISTRIK_DEPAN: 53_500,
  LISTRIK_BELAKANG: 664_000,
  PERALATAN_KANTOR: 1_354_437,
  SAMPEL: 496_080,
  KONTEN: 1_352_500,
  MEETING: 651_500,
  EVENT_IFANA_SAGA: 975_550,
  GOSEND_MOBIL_PRODUKSI: 171_000,
  LEMBUR: 448_000,
  LOKER: 200_000,
};

/**
 * 23 order Agustus 2026 (urutan = urutan sheet PROJECT/DP).
 * - date        : tanggal order dari "Data CRM AS Konveksi.xlsx"
 * - payments    : jadwal uang masuk (tanggal, nominal) dari sheet SALDO AKHIR,
 *                 dicocokkan dengan kolom DEPOSIT + DP sheet DP (penjaga di bawah)
 * - customerNo  : hasil verifikasi customer DB (nomor + nomor HP)
 */
const ORDERS = [
  { key: "gibran", sheetName: "Gibran", customerNo: "CRM-0029", phone: "", date: "2026-08-01", payments: [["2026-08-11", 21_400_000]] },
  { key: "respa", sheetName: "Respa", customerNo: "CRM-0025", phone: "085959065418", date: "2026-08-05", payments: [["2026-08-13", 1_765_000]] },
  { key: "reza", sheetName: "Kak Reza", customerNo: "CRM-0026", phone: "082283733197", date: "2026-08-05", payments: [["2026-08-01", 100_000], ["2026-08-06", 1_155_000]], kind: "DEPOSIT" },
  { key: "irgy", sheetName: "Kak irgy", customerNo: "CRM-0024", phone: "081138224033", date: "2026-08-06", payments: [["2026-08-07", 1_772_000]] },
  { key: "orado", sheetName: "Orado", customerNo: "CRM-0012", phone: "081384444855", date: "2026-08-05", payments: [["2026-08-05", 3_733_000], ["2026-08-11", 1_132_000]] },
  { key: "hana", sheetName: "Kak Hana", customerNo: "CRM-0028", phone: "0895392207048", date: "2026-08-04", payments: [["2026-08-01", 250_000]] },
  { key: "ripal", sheetName: "Mas ripal", customerNo: "CRM-0021", phone: "085885611180", date: "2026-08-11", payments: [["2026-08-11", 2_500_000]] },
  { key: "indi", sheetName: "Kak Indi", customerNo: "CRM-0023", phone: "088232374672", date: "2026-08-07", payments: [["2026-08-07", 3_020_000]] },
  { key: "rafi", sheetName: "Kak Rafi Himpera", customerNo: "CRM-0022", phone: "081229924568", date: "2026-08-11", payments: [["2026-08-12", 4_105_000]] },
  { key: "lutfi", sheetName: "Kak Lutfi", customerNo: "CRM-0020", phone: "082313723115", date: "2026-08-13", payments: [["2026-08-19", 3_700_000]] },
  { key: "pasha", sheetName: "Kak Pasha", customerNo: "CRM-0013", phone: "087825318982", date: "2026-08-20", payments: [["2026-08-20", 2_000_000]] },
  { key: "celine", sheetName: "Kak Celine", customerNo: "CRM-0016", phone: "081215384499", date: "2026-08-19", payments: [["2026-08-03", 100_000], ["2026-08-19", 2_055_000]], kind: "DEPOSIT" },
  { key: "ridwan", sheetName: "Kak Ridwan", customerNo: "CRM-0011", phone: "089619344831", date: "2026-08-21", payments: [["2026-08-21", 2_480_000]] },
  { key: "dika", sheetName: "Kak dika (eve)", customerNo: "CRM-0009", phone: "088216492934", date: "2026-08-21", payments: [["2026-08-21", 750_000]] },
  { key: "cassyfa", sheetName: "Kak Cassyfa", customerNo: "CRM-0014", phone: "082130686076", date: "2026-08-20", payments: [["2026-08-20", 2_110_000]] },
  { key: "libels", sheetName: "Libels", customerNo: "CRM-0001", phone: "081392617723", date: "2026-08-20", payments: [["2026-08-20", 3_755_000]] },
  { key: "sara", sheetName: "Kak Sara BRI", customerNo: "CRM-0015", phone: "08817680458", date: "2026-08-20", payments: [["2026-08-20", 1_385_855]] },
  { key: "abraham", sheetName: "Abraham", customerNo: "CRM-0010", phone: "081229600044", date: "2026-08-21", payments: [["2026-08-22", 13_936_000]] },
  { key: "fdabel", sheetName: "Kak fdabel", customerNo: "CRM-0018", phone: "082134080947", date: "2026-08-15", payments: [["2026-08-15", 2_500_000], ["2026-08-19", 3_075_000]] },
  { key: "orado2", sheetName: "ORADO", customerNo: "CRM-0012", phone: "081384444855", date: "2026-08-20", payments: [] },
  { key: "iko", sheetName: "Kak Iko", customerNo: "CRM-0019", phone: "085640659849", date: "2026-08-14", payments: [["2026-08-14", 4_035_000]] },
  { key: "edwin", sheetName: "SAGA Kak Edwin", customerNo: "CRM-0003", phone: "089613913468", date: "2026-08-28", payments: [] },
  { key: "ifana", sheetName: "SAGA Kak Ifana", customerNo: "CRM-0027", phone: "08182774349", date: "2026-08-05", payments: [["2026-08-01", 5_499_000], ["2026-08-10", 690_000], ["2026-08-11", 5_499_000], ["2026-08-13", 690_000]] },
];

/** Override produk untuk order yang jenis-nya kosong/gabungan di sheet PROJECT. */
const PRODUCT_OVERRIDES = {
  abraham: {
    productName: "Tshirt, Topi, Polo & Celana",
    categoryName: null,
    garmentType: "NON_JERSEY",
    items: [
      { name: "Tshirt", qty: 72, garmentType: "NON_JERSEY", categoryName: "Kaos Sablon" },
      { name: "Kemeja chef", qty: 16, garmentType: "NON_JERSEY", categoryName: "Kemeja" },
      { name: "Celana chef", qty: 12, garmentType: "NON_JERSEY", categoryName: null },
      { name: "Polo", qty: 36, garmentType: "NON_JERSEY", categoryName: "Polo Shirt" },
      { name: "Topi", qty: 24, garmentType: "AKSESORI", categoryName: "Topi" },
    ],
  },
};

const GARMENT_BY_JENIS = {
  Jersey: "JERSEY",
  Tshirt: "NON_JERSEY",
  Kemeja: "NON_JERSEY",
  Sampel: "NON_JERSEY",
  Workjaket: "NON_JERSEY",
  Jaket: "NON_JERSEY",
  Baseball: "NON_JERSEY",
  Polo: "NON_JERSEY",
};

const CATEGORY_BY_JENIS = {
  Jersey: "Jersey",
  Tshirt: "Kaos Sablon",
  Kemeja: "Kemeja",
  Sampel: null,
  Workjaket: "Jaket",
  Jaket: "Jaket",
  Baseball: "Kaos Raglan",
  Polo: "Polo Shirt",
};

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function fail(message) {
  console.error(`\n  GAGAL: ${message}\n`);
  process.exit(1);
}

function rupiah(value) {
  return Number(value).toLocaleString("id-ID");
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

/** Harga satuan dibulatkan ke BAWAH 2 desimal agar quantity * unitPrice <= total (constraint DB). */
function floor2(value) {
  return Math.floor(value * 100) / 100;
}

function normName(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function digits(value) {
  return String(value ?? "").replace(/\D+/g, "");
}

/** Tanggal @db.Date: tengah malam UTC. */
function dUTC(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Timestamp @db.Timestamptz: jam `wibHour` WIB pada tanggal iso. */
function atWib(iso, wibHour) {
  return new Date(`${iso}T${String(wibHour - 7).padStart(2, "0")}:00:00.000Z`);
}

const MONTHS_ID = { januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12 };

function parseIndonesianDate(text) {
  const match = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(String(text ?? ""));
  if (!match) return null;
  const month = MONTHS_ID[match[2].toLowerCase()];
  if (!month) return null;
  return new Date(Date.UTC(Number(match[3]), month - 1, Number(match[1])));
}

// ---------------------------------------------------------------------------
// Baca xlsx
// ---------------------------------------------------------------------------

function cellText(cell) {
  const value = cell?.value;
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("").trim();
    if (typeof value.text === "string") return value.text.trim();
    if (value.result != null) return cellText({ value: value.result });
  }
  return String(value).trim();
}

function cellNumber(cell) {
  const value = cell?.value;
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && typeof value.result === "number") return value.result;
  return null;
}

function readProjectRows(worksheet) {
  const rows = [];
  for (let r = 4; r <= 40; r += 1) {
    const name = cellText(worksheet.getCell(r, 2));
    const invoice = cellNumber(worksheet.getCell(r, 13));
    if (!name || invoice == null) continue;
    rows.push({
      row: r,
      name,
      jenis: cellText(worksheet.getCell(r, 3)),
      qty: cellNumber(worksheet.getCell(r, 4)) ?? 0,
      totalHpp: cellNumber(worksheet.getCell(r, 12)) ?? 0,
      invoice,
    });
  }
  return rows;
}

function readDpRows(worksheet) {
  const rows = [];
  for (let r = 4; r <= 40; r += 1) {
    const name = cellText(worksheet.getCell(r, 2));
    const qty = cellNumber(worksheet.getCell(r, 4));
    if (!name || qty == null) continue;
    const buckets = {};
    HPP_KEYS.forEach((key, index) => {
      buckets[key] = cellNumber(worksheet.getCell(r, 5 + index)) ?? 0;
    });
    rows.push({
      row: r,
      name,
      jenis: cellText(worksheet.getCell(r, 3)),
      qty,
      buckets,
      totalHpp: cellNumber(worksheet.getCell(r, 12)) ?? 0,
      deposit: cellNumber(worksheet.getCell(r, 13)) ?? 0,
      dp: cellNumber(worksheet.getCell(r, 14)) ?? 0,
    });
  }
  return rows;
}

function readOverheadRows(worksheet) {
  const rows = [];
  let currentDate = null;
  for (let r = 3; r <= 75; r += 1) {
    const dateText = cellText(worksheet.getCell(r, 1));
    if (dateText) {
      const parsed = parseIndonesianDate(dateText);
      if (parsed) currentDate = parsed;
    }
    const label = cellText(worksheet.getCell(r, 2));
    const amount = cellNumber(worksheet.getCell(r, 3));
    if (!label || amount == null) continue;
    rows.push({ date: currentDate, label, amount });
  }
  return rows;
}

/** Peta kategori beban operasional — divalidasi total per kategori 17/17. */
function overheadCategory(label) {
  const s = label.trim();
  if (/^ads\b/i.test(s) || /^centang biru as$/i.test(s)) return "ADS";
  if (/^cicilan laptop$/i.test(s)) return "CICILAN_LAPTOP";
  if (/^ongkir admin produksi$/i.test(s)) return "ONGKIR_ADMIN_PRODUKSI";
  if (/^ongkir cust$/i.test(s)) return "ONGKIR_CUST";
  if (/sampel/i.test(s)) return "SAMPEL";
  if (/^listrik belakang$/i.test(s)) return "LISTRIK_BELAKANG";
  if (/^listrik depan$/i.test(s)) return "LISTRIK_DEPAN";
  if (/^iuran lingkungan$/i.test(s)) return "LINGKUNGAN";
  if (/^free pick$/i.test(s)) return "FREE_PICK";
  if (/^dp konten/i.test(s)) return "KONTEN";
  if (/^wifi$/i.test(s)) return "WIFI";
  if (/^loker$/i.test(s)) return "LOKER";
  if (/meeting/i.test(s)) return "MEETING";
  if (/event/i.test(s)) return "EVENT_IFANA_SAGA";
  if (/^makan siang$/i.test(s)) return "EVENT_IFANA_SAGA";
  if (/lembur/i.test(s)) return "LEMBUR";
  if (/^gopay knitto/i.test(s)) return "GOSEND_MOBIL_PRODUKSI";
  if (/^(karung|lakban|stabilo|meja|kepala cas & casing tasya|reimburse kak fawaz|sablon plastik saga|plastik opp & ziplock saga|plastik & mineral 2 dus)$/i.test(s)) return "PERALATAN_KANTOR";
  fail(`Kategori beban tidak dikenali untuk "${label}".`);
}

// ---------------------------------------------------------------------------
// Penomoran (replika lib/crm/numbers.ts)
// ---------------------------------------------------------------------------

async function nextValue(tx, key) {
  const counter = await tx.sequenceCounter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  return counter.value;
}

async function nextOpportunityNo(tx) {
  return `OPP-${String(await nextValue(tx, "opportunity")).padStart(6, "0")}`;
}

async function nextInvoiceNo(tx, date) {
  const year = date.getUTCFullYear();
  return `INV-${year}-${String(await nextValue(tx, `invoice:${year}`)).padStart(5, "0")}`;
}

async function nextSalesOrderNo(tx, date) {
  const year = date.getUTCFullYear();
  return `SALES-ORDER-${year}-${String(await nextValue(tx, `sales-order:${year}`)).padStart(5, "0")}`;
}

async function nextWorkOrderNo(tx, date) {
  const year = date.getUTCFullYear();
  return `WO-${year}-${String(await nextValue(tx, `work-order:${year}`)).padStart(5, "0")}`;
}

function jakartaDateCode(date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "2-digit" }).formatToParts(date);
  return ["day", "month", "year"].map((type) => parts.find((part) => part.type === type)?.value).join("");
}

function purchaseOrderCustomerCodeBase(name) {
  const words = (name.match(/[\p{L}\p{N}]+/gu) ?? []).map((word) => word.toLocaleUpperCase("id-ID"));
  while (["PT", "CV", "UD", "TOKO", "BAPAK", "IBU"].includes(words[0] ?? "")) words.shift();
  if (words.length === 1) return words[0].slice(0, 3) || "CUS";
  if (words.length === 2) return `${words[0].slice(0, 2)}${words[1].slice(0, 1)}` || "CUS";
  if (words.length >= 3) return words.slice(0, 3).map((word) => word[0]).join("") || "CUS";
  return "CUS";
}

async function nextPurchaseOrderNo(tx, customer, date) {
  let code = customer.poCustomerCode;
  if (!code) {
    const base = purchaseOrderCustomerCodeBase(customer.name);
    for (let suffix = 0; ; suffix += 1) {
      const candidate = `${base}${suffix || ""}`;
      const used = await tx.customer.findUnique({ where: { poCustomerCode: candidate }, select: { id: true } });
      if (!used || used.id === customer.id) {
        await tx.customer.update({ where: { id: customer.id }, data: { poCustomerCode: candidate } });
        code = candidate;
        break;
      }
    }
  }
  const key = `purchase-order:${customer.id}`;
  const existingOrderCount = await tx.purchaseOrder.count({ where: { opportunity: { customerId: customer.id }, revision: 1 } });
  const counter = await tx.sequenceCounter.upsert({
    where: { key },
    create: { key, value: existingOrderCount + 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  return `PO-${code}${jakartaDateCode(date)}-${counter.value}`;
}

// ---------------------------------------------------------------------------
// Program utama
// ---------------------------------------------------------------------------

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL belum dikonfigurasi.");
  const hostname = new URL(databaseUrl).hostname;
  const remote = !["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(hostname.toLowerCase());
  console.log(`Database: ${hostname} ${remote ? "(REMOTE)" : "(lokal)"} | mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  if (remote && !ALLOW_REMOTE) fail("Database bukan lokal. Tambahkan --allow-remote bila memang yakin.");

  // --- Baca & validasi file sumber -----------------------------------------
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(ROOT, PROJECT_XLSX));
  const projectRows = readProjectRows(workbook.getWorksheet("PROJECT"));
  const dpRows = readDpRows(workbook.getWorksheet("DP"));
  const overheadRows = readOverheadRows(workbook.getWorksheet("PNGELUARAN MURNI"));

  const checks = [];
  const check = (ok, label, detail = "") => checks.push({ ok, label, detail });

  check(projectRows.length === 23, `Sheet PROJECT: 23 baris order`, `dapat ${projectRows.length}`);
  check(dpRows.length === 23, `Sheet DP: 23 baris order`, `dapat ${dpRows.length}`);
  check(overheadRows.length === 69, `Sheet PNGELUARAN MURNI: 69 baris`, `dapat ${overheadRows.length}`);
  if (!checks.every((item) => item.ok)) {
    report(checks);
    fail("Jumlah baris sumber tidak sesuai.");
  }

  const invoiceTotal = sum(projectRows.map((row) => row.invoice));
  const hppTotal = sum(dpRows.map((row) => row.totalHpp));
  const paidTotal = sum(dpRows.map((row) => row.deposit + row.dp));
  const overheadTotal = sum(overheadRows.map((row) => row.amount));
  const netTotal = paidTotal - hppTotal - overheadTotal;
  const outstandingTotal = invoiceTotal - paidTotal;

  check(invoiceTotal === EXPECTED.invoice, `Total invoice PROYEK = ${rupiah(EXPECTED.invoice)}`, `dapat ${rupiah(invoiceTotal)}`);
  check(hppTotal === EXPECTED.hpp, `Total HPP (DP) = ${rupiah(EXPECTED.hpp)}`, `dapat ${rupiah(hppTotal)}`);
  check(paidTotal === EXPECTED.paid, `Total uang masuk (DP) = ${rupiah(EXPECTED.paid)}`, `dapat ${rupiah(paidTotal)}`);
  check(overheadTotal === EXPECTED.overhead, `Total beban operasional = ${rupiah(EXPECTED.overhead)}`, `dapat ${rupiah(overheadTotal)}`);
  check(outstandingTotal === EXPECTED.outstanding, `Outstanding = ${rupiah(EXPECTED.outstanding)}`, `dapat ${rupiah(outstandingTotal)}`);
  check(netTotal === EXPECTED.net, `Net (masuk - HPP - beban) = ${rupiah(EXPECTED.net)}`, `dapat ${rupiah(netTotal)}`);

  const overheadByCategory = {};
  for (const row of overheadRows) {
    const category = overheadCategory(row.label);
    overheadByCategory[category] = (overheadByCategory[category] ?? 0) + row.amount;
  }
  const categoryOk = Object.entries(EXPECTED_OVERHEAD_BY_CATEGORY).every(([category, expected]) => overheadByCategory[category] === expected);
  check(categoryOk, `Beban per kategori cocok 17/17`, JSON.stringify(overheadByCategory));

  if (!checks.every((item) => item.ok)) {
    report(checks);
    fail("Total sumber tidak cocok dengan angka kunci. Import dibatalkan.");
  }

  // --- Database: prasyarat --------------------------------------------------
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const counts = {
      opportunity: await prisma.opportunity.count(),
      purchaseOrder: await prisma.purchaseOrder.count(),
      invoice: await prisma.invoice.count(),
      salesOrder: await prisma.salesOrder.count(),
      expense: await prisma.expense.count(),
      dealPayment: await prisma.dealPayment.count(),
      productionWorkOrder: await prisma.productionWorkOrder.count(),
    };
    const dbEmpty = Object.values(counts).every((count) => count === 0);
    check(dbEmpty, "DB transaksional kosong (sudah cleanup)", JSON.stringify(counts));
    if (!dbEmpty) fail("Masih ada data transaksional. Jalankan scripts/cleanup-transactional-data.sql dulu.");

    const owner = await prisma.appUser.findFirst({ where: { role: "OWNER", name: OWNER_NAME }, select: { id: true, name: true } });
    check(Boolean(owner), `User OWNER "${OWNER_NAME}" ditemukan`, owner ? owner.id : "tidak ada");
    if (!owner) fail(`User OWNER "${OWNER_NAME}" tidak ditemukan.`);

    const profile = await prisma.businessProfile.findFirst();
    check(Boolean(profile), "BusinessProfile ditemukan", profile ? profile.name : "tidak ada");
    if (!profile) fail("BusinessProfile tidak ditemukan.");

    const customerNos = [...new Set(ORDERS.map((order) => order.customerNo))];
    const customers = await prisma.customer.findMany({ where: { customerNo: { in: customerNos } } });
    const customerByNo = new Map(customers.map((customer) => [customer.customerNo, customer]));
    check(customers.length === customerNos.length, `Customer DB lengkap (${customerNos.length} nomor)`, `dapat ${customers.length}`);
    if (customers.length !== customerNos.length) {
      const missing = customerNos.filter((no) => !customerByNo.has(no));
      fail(`Customer tidak ditemukan: ${missing.join(", ")}`);
    }

    const categories = await prisma.productCategory.findMany({ select: { id: true, name: true } });
    const categoryByName = new Map(categories.map((category) => [category.name, category]));

    // --- Susun rencana per order -------------------------------------------
    const plan = ORDERS.map((order, index) => {
      const project = projectRows[index];
      const dp = dpRows[index];
      if (normName(project.name) !== normName(order.sheetName) || normName(dp.name) !== normName(order.sheetName)) {
        fail(`Baris ke-${index + 1} tidak cocok: PROJECT "${project.name}" / DP "${dp.name}" / target "${order.sheetName}".`);
      }
      const customer = customerByNo.get(order.customerNo);
      const dbDigits = digits(customer.whatsapp);
      const expectedDigits = digits(order.phone);
      if (expectedDigits && !dbDigits.includes(expectedDigits) && !expectedDigits.includes(dbDigits)) {
        fail(`Nomor HP customer ${order.customerNo} tidak cocok: DB "${customer.whatsapp}" vs sheet "${order.phone}".`);
      }

      const buckets = dp.buckets;
      const bucketSum = sum(HPP_KEYS.map((key) => buckets[key]));
      if (bucketSum !== dp.totalHpp) fail(`Bucket HPP ${order.sheetName} tidak menjumlah ke ${rupiah(dp.totalHpp)}.`);

      const paid = sum(order.payments.map(([, amount]) => amount));
      if (paid !== dp.deposit + dp.dp) fail(`Jadwal bayar ${order.sheetName} (${rupiah(paid)}) != DP sheet (${rupiah(dp.deposit + dp.dp)}).`);

      const override = PRODUCT_OVERRIDES[order.key];
      const jenis = override ? override.productName : project.jenis;
      const qty = override ? 160 : project.qty;
      const garmentType = override ? override.garmentType : GARMENT_BY_JENIS[jenis];
      if (!garmentType) fail(`Jenis "${jenis}" (${order.sheetName}) tidak dikenali.`);
      const categoryName = override ? override.categoryName : CATEGORY_BY_JENIS[jenis];
      const category = categoryName ? categoryByName.get(categoryName) : null;
      if (categoryName && !category) fail(`Kategori produk "${categoryName}" tidak ada di master.`);

      const items = override
        ? override.items.map((item) => ({ ...item, categoryId: item.categoryName ? categoryByName.get(item.categoryName)?.id ?? null : null }))
        : [{ name: jenis, qty, garmentType, categoryId: category?.id ?? null }];
      const itemQtySum = sum(items.map((item) => item.qty));
      if (itemQtySum !== qty) fail(`Jumlah item ${order.sheetName} (${itemQtySum}) != qty order (${qty}).`);

      const deferred = order.payments.length === 0;
      const outstanding = project.invoice - paid;
      const kind = deferred ? "MENUNGGU" : order.kind ?? (outstanding === 0 && order.payments.length === 1 ? "LUNAS" : "DP");

      return {
        order,
        index,
        customer,
        invoiceTotal: project.invoice,
        qty,
        jenis,
        garmentType,
        categoryId: category?.id ?? null,
        items,
        buckets,
        hppTotal: dp.totalHpp,
        payments: order.payments,
        paid,
        outstanding,
        kind,
        deferred,
      };
    });

    const planInvoice = sum(plan.map((item) => item.invoiceTotal));
    const planHpp = sum(plan.map((item) => item.hppTotal));
    const planPaid = sum(plan.map((item) => item.paid));
    const planOutstanding = sum(plan.map((item) => item.outstanding));
    check(planInvoice === EXPECTED.invoice && planHpp === EXPECTED.hpp && planPaid === EXPECTED.paid && planOutstanding === EXPECTED.outstanding, "Rencana per order konsisten dengan angka kunci");
    const planPending = sum(plan.filter((entry) => entry.deferred).map((entry) => entry.invoiceTotal));
    check(planPending === EXPECTED.pending, "Order tanpa pembayaran (ORADO + Edwin) = 2.299.000 (jadwal LUNAS menunggu)");

    // --- Laporan rencana -----------------------------------------------------
    console.log(`\n=== RENCANA IMPORT — 23 ORDER ===`);
    const header = ["#", "ORDER", "CUSTOMER", "TGL", "PRODUK", "INVOICE", "HPP", "DIBAYAR", "SISA", "JENIS", "WO"];
    console.log(header.map((value, i) => value.padEnd([3, 18, 11, 10, 24, 13, 13, 13, 11, 9, 3][i])).join(" "));
    plan.forEach((item, i) => {
      const cells = [
        String(i + 1),
        item.order.sheetName,
        item.customer.customerNo,
        item.order.date.slice(8, 10) + "/" + item.order.date.slice(5, 7),
        `${item.jenis} ${item.qty}pcs`.slice(0, 24),
        rupiah(item.invoiceTotal),
        rupiah(item.hppTotal),
        rupiah(item.paid),
        rupiah(item.outstanding),
        item.kind,
        String(item.deferred ? 0 : item.items.length),
      ];
      console.log(cells.map((value, j) => value.padEnd([3, 18, 11, 10, 24, 13, 13, 13, 11, 9, 3][j])).join(" "));
    });
    console.log(`\nHPP expense: ${HPP_KEYS.length ? plan.reduce((count, item) => count + HPP_KEYS.filter((key) => item.buckets[key] > 0).length, 0) : 0} baris / ${rupiah(planHpp)}`);
    console.log(`Tanpa pembayaran (jadwal LUNAS menunggu, tanpa SO/WO): ${plan.filter((entry) => entry.deferred).map((entry) => entry.order.sheetName).join(", ")}`);
    console.log(`Beban operasional: 69 baris / ${rupiah(overheadTotal)} (17 kategori cocok)`);
    console.log(`Net: ${rupiah(planPaid)} - ${rupiah(planHpp)} - ${rupiah(overheadTotal)} = ${rupiah(netTotal)} (= "Bersih" CATATAN)`);

    // Perkiraan nomor dokumen dari counter saat ini.
    const counterRows = await prisma.sequenceCounter.findMany({ where: { key: { in: ["invoice:2026", "opportunity", "sales-order:2026", "work-order:2026"] } } });
    const counterByKey = new Map(counterRows.map((row) => [row.key, row.value]));
    const previewRange = (key, count, prefix, pad) => {
      const start = (counterByKey.get(key) ?? 0) + 1;
      return `${prefix}${String(start).padStart(pad, "0")}..${prefix}${String(start + count - 1).padStart(pad, "0")}`;
    };
    console.log(`Nomor dokumen: ${previewRange("invoice:2026", 23, "INV-2026-", 5)} | ${previewRange("opportunity", 23, "OPP-", 6)} | ${previewRange("sales-order:2026", 21, "SALES-ORDER-2026-", 5)} | ${previewRange("work-order:2026", 25, "WO-2026-", 5)}`);

    report(checks);
    if (!checks.every((item) => item.ok)) fail("Ada penjaga yang gagal.");

    if (!APPLY) {
      console.log(`\nDRY RUN selesai — tidak ada yang ditulis. Jalankan ulang dengan --apply untuk menulis.\n`);
      return;
    }

    // --- Tulis (satu transaksi) ---------------------------------------------
    console.log(`\nMenulis ke database...`);
    const transferExists = await prisma.paymentMethod.findUnique({ where: { name: "Transfer" }, select: { id: true } });
    const result = await prisma.$transaction(
      async (tx) => {
        let transfer = transferExists ? await tx.paymentMethod.findUniqueOrThrow({ where: { name: "Transfer" } }) : null;
        if (!transfer) {
          const maxPosition = (await tx.paymentMethod.aggregate({ _max: { position: true } }))._max.position ?? 0;
          transfer = await tx.paymentMethod.create({ data: { id: TRANSFER_METHOD_ID, name: "Transfer", position: maxPosition + 1 } });
        }

        const created = [];
        for (const item of plan) {
          const orderDate = dUTC(item.order.date);
          const invoiceDate = atWib(item.order.date, 9);
          const opportunity = await tx.opportunity.create({
            data: {
              opportunityNo: await nextOpportunityNo(tx),
              customerId: item.customer.id,
              title: `${item.jenis} ${item.qty} pcs`,
              stage: item.deferred ? "NEGOSIASI" : "DEAL",
              origin: "MANUAL",
              productName: item.jenis,
              garmentType: item.garmentType,
              productCategoryId: item.categoryId,
              version: 1,
              createdAt: atWib(item.order.date, 8),
            },
            select: { id: true, opportunityNo: true },
          });

          const purchaseOrderNo = await nextPurchaseOrderNo(tx, item.customer, orderDate);
          const purchaseOrder = await tx.purchaseOrder.create({
            data: {
              purchaseOrderNo,
              opportunityId: opportunity.id,
              revision: 1,
              status: "AGREED",
              productName: item.jenis,
              garmentType: item.garmentType,
              productCategoryId: item.categoryId,
              material: "Standard",
              orderDate,
              deadline: addDays(orderDate, 14),
              depositRequired: false,
              agreedAt: invoiceDate,
              snapshotBusinessName: profile.name,
              snapshotBusinessPhone: profile.phone,
              snapshotBusinessEmail: profile.email,
              snapshotBusinessAddress: profile.address,
              snapshotBusinessLogoPath: profile.logoPath,
              version: 1,
              createdById: owner.id,
              createdAt: invoiceDate,
              items: { create: item.items.map((entry, position) => ({ position, name: entry.name, productCategoryId: entry.categoryId, garmentType: entry.garmentType })) },
            },
            include: { items: { orderBy: { position: "asc" } } },
          });
          await tx.purchaseOrderSize.createMany({
            data: purchaseOrder.items.map((entry, position) => ({
              purchaseOrderId: purchaseOrder.id,
              position,
              itemId: entry.id,
              size: "All Size",
              sleeveLength: "PANJANG",
              quantity: item.items[position].qty,
            })),
          });

          const invoiceNo = await nextInvoiceNo(tx, invoiceDate);
          const unitPrice = floor2(item.invoiceTotal / item.qty);
          const invoice = await tx.invoice.create({
            data: {
              invoiceNo,
              opportunityId: opportunity.id,
              purchaseOrderId: purchaseOrder.id,
              revision: 1,
              status: "ISSUED",
              snapshotCustomerName: item.customer.name,
              snapshotCompanyName: item.customer.companyName,
              snapshotWhatsapp: item.customer.whatsapp,
              snapshotEmail: item.customer.email,
              snapshotInstagram: item.customer.instagram,
              snapshotAddress: item.customer.address,
              snapshotBusinessName: profile.name,
              snapshotBusinessPhone: profile.phone,
              snapshotBusinessEmail: profile.email,
              snapshotBusinessAddress: profile.address,
              snapshotBusinessLogoPath: profile.logoPath,
              snapshotSignatureName: profile.signatureName,
              snapshotSignatureTitle: profile.signatureTitle,
              snapshotSignaturePath: profile.signaturePath,
              discountType: "NONE",
              subtotal: item.invoiceTotal,
              total: item.invoiceTotal,
              totalProfit: item.invoiceTotal - item.hppTotal,
              issuedAt: invoiceDate,
              dueAt: addDays(orderDate, 7),
              version: 1,
              createdById: owner.id,
              createdAt: invoiceDate,
              items: {
                create: [
                  {
                    position: 0,
                    productName: item.jenis,
                    size: "All Size",
                    description: item.jenis,
                    quantity: item.qty,
                    unitPrice,
                    grossAmount: item.invoiceTotal,
                    total: item.invoiceTotal,
                    subtotal: item.invoiceTotal,
                  },
                ],
              },
            },
            select: { id: true },
          });

          let salesOrder = null;
          if (item.deferred) {
            // Belum ada pembayaran sama sekali: alur resmi aplikasi = jadwal LUNAS menunggu.
            // Sales Order + Work Order terbentuk otomatis saat pembayaran dicatat.
            await tx.pendingDealPayment.create({
              data: {
                invoiceId: invoice.id,
                kind: "LUNAS",
                initialValueType: "PERCENTAGE",
                initialValue: 100,
                initialAmount: item.invoiceTotal,
                initialDueAt: addDays(orderDate, 7),
                createdById: owner.id,
                createdAt: invoiceDate,
              },
            });
          } else {
            const initialEvent = item.payments[0] ?? null;
            const laterEvents = item.payments.slice(1);
            const initialAmount = initialEvent ? initialEvent[1] : 0;
            const paidAt = initialEvent ? atWib(initialEvent[0], 10) : atWib(item.order.date, 10);
            const terms = laterEvents.map(([date, amount], position) => ({
              position,
              valueType: "NOMINAL",
              value: amount,
              amount,
              dueAt: dUTC(date),
            }));
            if (item.outstanding > 0) {
              terms.push({
                position: terms.length,
                valueType: "NOMINAL",
                value: item.outstanding,
                amount: item.outstanding,
                dueAt: addDays(orderDate, 30),
              });
            }

            salesOrder = await tx.salesOrder.create({
              data: {
                salesOrderNo: await nextSalesOrderNo(tx, paidAt),
                opportunityId: opportunity.id,
                purchaseOrderId: purchaseOrder.id,
                invoiceId: invoice.id,
                purchaseOrderNo,
                invoiceNo,
                status: "ACTIVE",
                snapshotCustomerName: item.customer.name,
                snapshotCompanyName: item.customer.companyName,
                snapshotWhatsapp: item.customer.whatsapp,
                snapshotEmail: item.customer.email,
                snapshotInstagram: item.customer.instagram,
                snapshotAddress: item.customer.address,
                discountType: "NONE",
                discountValue: 0,
                subtotal: item.invoiceTotal,
                totalDiscount: 0,
                taxPercent: 0,
                taxAmount: 0,
                total: item.invoiceTotal,
                acceptedAt: paidAt,
                createdById: owner.id,
                createdAt: paidAt,
                items: {
                  create: [
                    {
                      position: 0,
                      productName: item.jenis,
                      size: "All Size",
                      description: item.jenis,
                      quantity: item.qty,
                      unitPrice,
                      grossAmount: item.invoiceTotal,
                      total: item.invoiceTotal,
                      subtotal: item.invoiceTotal,
                    },
                  ],
                },
                cost: {
                  create: Object.fromEntries(HPP_KEYS.map((key) => [key, new Prisma.Decimal(item.buckets[key])])),
                },
                payment: {
                  create: {
                    kind: item.kind,
                    paidAt,
                    initialValueType: item.kind === "LUNAS" ? "PERCENTAGE" : "NOMINAL",
                    initialValue: item.kind === "LUNAS" ? 100 : initialAmount,
                    initialAmount,
                    outstandingAmount: item.outstanding,
                    createdById: owner.id,
                    terms: {
                      create: terms.map(({ position, valueType, value, amount, dueAt }) => ({ position, valueType, value, amount, dueAt })),
                    },
                    ...(initialAmount > 0
                      ? {
                          transactions: {
                            create: {
                              amount: initialAmount,
                              paidAt,
                              paymentMethodId: transfer.id,
                              createdById: owner.id,
                              createdAt: paidAt,
                            },
                          },
                        }
                      : {}),
                  },
                },
              },
              include: { payment: { include: { terms: { orderBy: { position: "asc" } } } } },
            });

            for (let termIndex = 0; termIndex < laterEvents.length; termIndex += 1) {
              const [date, amount] = laterEvents[termIndex];
              await tx.paymentTransaction.create({
                data: {
                  paymentId: salesOrder.payment.id,
                  paymentTermId: salesOrder.payment.terms[termIndex].id,
                  paymentMethodId: transfer.id,
                  amount,
                  paidAt: atWib(date, 10),
                  status: "ACTIVE",
                  createdById: owner.id,
                  createdAt: atWib(date, 10),
                },
              });
            }
          }

          const customerName = item.customer.companyName ?? item.customer.name;
          for (const key of HPP_KEYS) {
            if (item.buckets[key] <= 0) continue;
            await tx.expense.create({
              data: {
                purpose: `HPP ${HPP_LABEL[key]} · ${customerName} · ${item.jenis} · ${invoiceNo}`,
                spentAt: orderDate,
                amount: new Prisma.Decimal(item.buckets[key]),
                category: "PROJECT",
                paymentMethodId: transfer.id,
                isReimbursable: false,
                customerName,
                salesOrderId: salesOrder ? salesOrder.id : null,
                hppKey: key,
                createdById: owner.id,
                createdAt: invoiceDate,
              },
            });
          }

          const workOrderNos = [];
          if (salesOrder) {
            const startAt = atWib(item.order.date, 8);
            const endAt = addDays(startAt, 11);
            const span = endAt.getTime() - startAt.getTime();
            for (const [itemIndex, entry] of item.items.entries()) {
              const stages = entry.garmentType === "AKSESORI" ? AKSESORI_STAGES : entry.garmentType === "JERSEY" ? JERSEY_STAGES : NON_JERSEY_STAGES;
              const route = entry.garmentType === "JERSEY" ? "JERSEY" : "NON_JERSEY";
              const workOrderNo = await nextWorkOrderNo(tx, orderDate);
              workOrderNos.push(workOrderNo);
              const workOrder = await tx.productionWorkOrder.create({
                data: {
                  workOrderNo,
                  salesOrderId: salesOrder.id,
                  purchaseOrderItemId: purchaseOrder.items[itemIndex].id,
                  itemName: entry.name,
                  route,
                  productName: entry.name,
                  quantity: entry.qty,
                  deadline: addDays(orderDate, 14),
                  stageSequence: stages,
                  currentStage: "SELESAI",
                  status: "COMPLETED",
                  completedAt: endAt,
                  stageEnteredAt: endAt,
                  designCompletedAt: startAt,
                  version: 1,
                  createdAt: startAt,
                  steps: {
                    create: stages.map((stage, position) => ({
                      stage,
                      position,
                      status: "COMPLETED",
                      attemptCount: 1,
                      startedAt: new Date(startAt.getTime() + (span * position) / stages.length),
                      completedAt: new Date(startAt.getTime() + (span * (position + 1)) / stages.length),
                    })),
                  },
                },
                select: { id: true },
              });
              await tx.productionActivity.create({
                data: { workOrderId: workOrder.id, actorId: owner.id, type: "CREATED", toStage: stages[0], createdAt: startAt },
              });
            }
          }

          created.push({
            name: item.order.sheetName,
            opportunityNo: opportunity.opportunityNo,
            purchaseOrderNo,
            invoiceNo,
            salesOrderNo: salesOrder ? salesOrder.salesOrderNo : null,
            workOrderNos,
          });
        }

        // Beban operasional (69 baris, apa adanya).
        let overheadCount = 0;
        for (const row of overheadRows) {
          await tx.expense.create({
            data: {
              purpose: row.label,
              spentAt: row.date,
              amount: new Prisma.Decimal(row.amount),
              category: overheadCategory(row.label),
              paymentMethodId: transfer.id,
              createdById: owner.id,
              createdAt: new Date(row.date.getTime() + 2 * 3_600_000),
            },
          });
          overheadCount += 1;
        }

        return { created, overheadCount, transferCreated: !transferExists };
      },
      { timeout: 300_000, maxWait: 60_000 },
    );

    console.log(`\n=== HASIL ===`);
    console.log(`Metode pembayaran Transfer: ${result.transferCreated ? "dibuat baru" : "sudah ada"}`);
    for (const row of result.created) {
      console.log(`${row.name.padEnd(18)} ${row.opportunityNo} ${row.purchaseOrderNo.padEnd(22)} ${row.invoiceNo} ${row.salesOrderNo ?? "— jadwal menunggu —"} WO:${row.workOrderNos.length}`);
    }
    console.log(`Beban operasional tertulis: ${result.overheadCount} baris`);

    // --- Verifikasi dari DB --------------------------------------------------
    const verification = await verifyImport(prisma);
    console.log(`\n=== VERIFIKASI DB ===`);
    for (const line of verification) console.log(line);
    const allOk = verification.every((line) => !line.includes("[GAGAL]"));
    console.log(allOk ? `\nIMPORT SELESAI & TERVERIFIKASI.\n` : `\nIMPORT SELESAI TAPI ADA VERIFIKASI GAGAL — periksa di atas!\n`);
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyImport(prisma) {
  const lines = [];
  const line = (ok, label, detail) => lines.push(`${ok ? "[OK ]" : "[GAGAL]"} ${label}${detail ? ` — ${detail}` : ""}`);
  const decimal = (value) => Number(value?.toString() ?? "0");

  const counts = {
    opportunity: await prisma.opportunity.count(),
    purchaseOrder: await prisma.purchaseOrder.count(),
    purchaseOrderSize: await prisma.purchaseOrderSize.count(),
    invoice: await prisma.invoice.count(),
    invoiceItem: await prisma.invoiceItem.count(),
    salesOrder: await prisma.salesOrder.count(),
    salesOrderCost: await prisma.salesOrderCost.count(),
    productionWorkOrder: await prisma.productionWorkOrder.count(),
    productionStep: await prisma.productionStep.count(),
    dealPayment: await prisma.dealPayment.count(),
    pendingDealPayment: await prisma.pendingDealPayment.count(),
    paymentTerm: await prisma.paymentTerm.count(),
    paymentTransaction: await prisma.paymentTransaction.count(),
    expense: await prisma.expense.count(),
  };
  line(counts.opportunity === 23 && counts.purchaseOrder === 23 && counts.invoice === 23, "23 opportunity/PO/invoice", JSON.stringify(counts));
  line(counts.salesOrder === 21 && counts.dealPayment === 21, "21 sales order + deal payment (2 order menunggu)", `SO ${counts.salesOrder} / payment ${counts.dealPayment}`);
  line(counts.pendingDealPayment === 2, "2 jadwal pembayaran menunggu (ORADO & Edwin)", String(counts.pendingDealPayment));
  line(counts.productionWorkOrder === 25, "25 work order (21 order + 4 item tambahan Abraham)", String(counts.productionWorkOrder));

  const invoiceSum = decimal((await prisma.invoice.aggregate({ _sum: { total: true } }))._sum.total);
  line(invoiceSum === EXPECTED.invoice, `Total invoice = ${rupiah(EXPECTED.invoice)}`, rupiah(invoiceSum));

  const hppExpenseSum = decimal((await prisma.expense.aggregate({ where: { category: "PROJECT" }, _sum: { amount: true } }))._sum.amount);
  line(hppExpenseSum === EXPECTED.hpp, `Expense kategori PROJECT = ${rupiah(EXPECTED.hpp)}`, rupiah(hppExpenseSum));

  const overheadByCategory = await prisma.expense.groupBy({ by: ["category"], where: { category: { not: "PROJECT" } }, _sum: { amount: true } });
  const overheadSum = sum(overheadByCategory.map((row) => decimal(row._sum.amount)));
  line(overheadSum === EXPECTED.overhead, `Expense operasional = ${rupiah(EXPECTED.overhead)}`, rupiah(overheadSum));

  const paidSum = decimal((await prisma.paymentTransaction.aggregate({ where: { status: "ACTIVE" }, _sum: { amount: true } }))._sum.amount);
  line(paidSum === EXPECTED.paid, `Uang masuk (PaymentTransaction) = ${rupiah(EXPECTED.paid)}`, rupiah(paidSum));

  const outstandingSum = decimal((await prisma.dealPayment.aggregate({ where: { salesOrder: { status: "ACTIVE" } }, _sum: { outstandingAmount: true } }))._sum.outstandingAmount);
  line(outstandingSum === EXPECTED.outstandingActive, `Outstanding DealPayment (21 SO) = ${rupiah(EXPECTED.outstandingActive)}`, rupiah(outstandingSum));

  const pendingSum = decimal((await prisma.pendingDealPayment.aggregate({ _sum: { initialAmount: true } }))._sum.initialAmount);
  line(pendingSum === EXPECTED.pending, `Jadwal menunggu (ORADO + Edwin) = ${rupiah(EXPECTED.pending)}`, rupiah(pendingSum));

  const soSum = decimal((await prisma.salesOrder.aggregate({ where: { status: "ACTIVE" }, _sum: { total: true } }))._sum.total);
  line(soSum === EXPECTED.soValue, `Nilai Sales Order (21 order) = ${rupiah(EXPECTED.soValue)}`, rupiah(soSum));

  const costs = await prisma.salesOrderCost.findMany();
  const costSum = sum(costs.map((row) => HPP_KEYS.reduce((total, key) => total + decimal(row[key]), 0)));
  line(costSum === EXPECTED.costSum, `SalesOrderCost 7 bucket = ${rupiah(EXPECTED.costSum)} (HPP ORADO tanpa SO)`, rupiah(costSum));

  const net = paidSum - hppExpenseSum - overheadSum;
  line(net === EXPECTED.net, `Net Agustus = ${rupiah(EXPECTED.net)} (uang masuk - HPP - beban)`, rupiah(net));

  return lines;
}

function report(checks) {
  console.log(`\n=== PENJAGA ===`);
  for (const item of checks) console.log(`${item.ok ? "[OK ]" : "[GAGAL]"} ${item.label}${item.detail ? ` — ${item.detail}` : ""}`);
}

main().catch((error) => {
  console.error("GAGAL:", error);
  process.exit(1);
});