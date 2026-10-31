#!/usr/bin/env node
/**
 * Impor arsip laporan April 2025–September 2026 yang sudah dikonfirmasi.
 * Empat pertanyaan client yang belum dijawab tidak ditulis.
 *
 *   node scripts/import-keuangan-arsip.mjs            dry-run
 *   node scripts/import-keuangan-arsip.mjs --apply    tulis satu transaksi, database lokal
 */

import "dotenv/config";

import path from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import {
  AGUSTUS_2026,
  MAS_BAH_INVOICE,
  MAS_BAH_LABA,
  applyConfirmedAdjustments,
  decidePayment,
  decideSkip,
  monthGuards,
  partitionArchive,
  normName,
  phoneAllowed,
  SEPTEMBER_MURNI,
  sumBuckets,
} from "./keuangan-arsip-rules.mjs";
import { hppValues, productCostSeedRows } from "./lib/project-product-costs.mjs";

const APPLY = process.argv.includes("--apply");
const ALLOW_REMOTE = process.argv.includes("--allow-remote");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data-keuangan");
const CRM_XLSX = path.join(ROOT, "Data CRM AS Konveksi.xlsx");
const HPP_KEYS = ["kain", "zipper", "jahit", "pres", "dtfPlastisol", "bordir", "lainnya"];
const HPP_LABEL = { kain: "Kain", zipper: "Zipper", jahit: "Jahit", pres: "Pres", dtfPlastisol: "DTF/Plastisol", bordir: "Bordir", lainnya: "Lain-lain" };
const JERSEY_STAGES = ["TEST_PRINT", "PERSETUJUAN_SAMPEL", "LAYOUT_PRODUKSI", "PRINT", "CUTTING", "QC", "SELESAI"];
const NON_JERSEY_STAGES = ["POTONG", "BORDIR", "SABLON", "PRINTING", "JAHIT", "QC", "PACKING", "PENGIRIMAN", "SELESAI"];
const AKSESORI_STAGES = ["JAHIT", "QC", "PACKING", "PENGIRIMAN", "SELESAI"];
const AKSESORI = new Set(["lanyard", "landyard", "totebag", "topi", "ganci"]);
const CATEGORY_BY_TOKEN = {
  jersey: "Jersey",
  tshirt: "Kaos Sablon",
  kaos: "Kaos Sablon",
  kemeja: "Kemeja",
  pdh: "PDH/PDL",
  pdl: "PDH/PDL",
  workshirt: "Workshirt",
  wearpack: "Wearpack",
  polo: "Polo Shirt",
  vneck: "Kaos Vneck",
  raglan: "Kaos Raglan",
  baseball: "Kaos Raglan",
  jaket: "Jaket",
  workjaket: "Jaket",
  varsity: "Jaket",
  rompi: "Rompi/Apron",
  apron: "Rompi/Apron",
  vest: "Rompi/Apron",
  lanyard: "Lanyard",
  landyard: "Lanyard",
  totebag: "Totebag",
  topi: "Topi",
  ganci: "Ganci",
};
const FILES = [
  ["PROJECT AS APRIL 2025.xlsx", "PROJECT AS APRIL", "2025-04"],
  ["PROJECT AS MEI 2025.xlsx", "PROJECT AS MEI", "2025-05"],
  ["PROJECT AS JUNI 2025.xlsx", "PROJECT ASKONVEKSI", "2025-06"],
  ["PROJECT AS JULI 2025.xlsx", "PROJECT", "2025-07"],
  ["PROJECT AS BULAN AGUSTUS 2025.xlsx", "PROJECT", "2025-08"],
  ["PROJECT AS OKTOBER 2025.xlsx", "PROJECT OKTOBER", "2025-10"],
  ["PROJECT AS BULAN NOVEMBER 2025.xlsx", "PPROJECT", "2025-11"],
  ["PROJECT AS BULAN DESEMBER 2025.xlsx", "PROJECT", "2025-12"],
  ["PROJECT AS BULAN JANUARI 2026.xlsx", "PROJECT", "2026-01"],
  ["PROJECT AS BULAN FEBRUARI 2026.xlsx", "PROJECT", "2026-02"],
  ["PROJECT AS BULAN MARET 2026.xlsx", "PROJECT MARET", "2026-03"],
  ["PROJECT AS APRIL 2026.xlsx", "PROJECT", "2026-04"],
  ["PROJECT AS MEI 2026.xlsx", "PROJECT", "2026-05"],
  ["PROJECT AS BULAN JUNI 2026.xlsx", "PROJECT PRODUKSI", "2026-06"],
  ["PROJECT AS BULAN JULI 2026.xlsx", "PROJECT JULI", "2026-07"],
  ["PROJECT AS BULAN AGUSTUS 2026.xlsx", "PRODUKSI", "2026-08"],
  ["PROJECT AS BULAN SEPTEMBER 2026.xlsx", "PROJECT SEP", "2026-09"],
];
const PLACEHOLDER = "Tidak ada di arsip";
const CUSTOMER_NOTE = "Dari laporan keuangan, identitas belum dicek";

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

function floor2(value) {
  return Math.floor(value * 100) / 100;
}

function dUTC(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

function atWib(iso, wibHour) {
  return new Date(`${iso}T${String(wibHour - 7).padStart(2, "0")}:00:00.000Z`);
}

function jakartaMonth(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(date).slice(0, 7);
}

function cellText(cell) {
  const value = cell?.value;
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("").trim();
    if (typeof value.text === "string") return value.text.trim();
    if (value.result != null && typeof value.result !== "object") return String(value.result).trim();
  }
  return "";
}

function cellNumber(cell) {
  const value = cell?.value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && typeof value.result === "number" && Number.isFinite(value.result)) return value.result;
  return null;
}

function emptyBuckets() {
  return { kain: 0, zipper: 0, jahit: 0, pres: 0, dtfPlastisol: 0, bordir: 0, lainnya: 0 };
}

function headerMap(worksheet) {
  const columns = { zipper: [], dtf: [], lainnya: [] };
  for (let row = 1; row <= 8; row += 1) {
    for (let column = 1; column <= 22; column += 1) {
      const text = cellText(worksheet.getCell(row, column)).toLocaleLowerCase("id-ID");
      if (!text) continue;
      if (text.includes("total hpp")) columns.hpp = column;
      else if (text.includes("total inv")) columns.invoice = column;
      else if (text.startsWith("laba")) columns.laba = column;
      else if (text === "nama order") columns.name = column;
      else if (text === "jenis") columns.jenis = column;
      else if (text === "jml") columns.qty = column;
      else if (text === "dp") columns.dp = column;
      else if (text === "sisa") columns.sisa = column;
      else if (text === "lunas") columns.lunas = column;
      else if (text === "kain") columns.kain = column;
      else if (text === "rib" || text === "zipper" || text === "variasi") columns.zipper.push(column);
      else if (text === "jahit") columns.jahit = column;
      else if (text.includes("pres")) columns.pres = column;
      else if (text.includes("sablon") || text.includes("dtf") || text.includes("plastisol")) columns.dtf.push(column);
      else if (text === "bordir") columns.bordir = column;
      else if (text.includes("lain") || text === "layout" || text === "ongkir") columns.lainnya.push(column);
    }
  }
  columns.name ??= 2;
  return columns;
}

function readBuckets(worksheet, row, columns) {
  const buckets = emptyBuckets();
  const take = (column, key) => {
    if (!column) return;
    buckets[key] += Math.round(cellNumber(worksheet.getCell(row, column)) ?? 0);
  };
  take(columns.kain, "kain");
  for (const column of columns.zipper) take(column, "zipper");
  take(columns.jahit, "jahit");
  take(columns.pres, "pres");
  for (const column of columns.dtf) take(column, "dtfPlastisol");
  take(columns.bordir, "bordir");
  for (const column of columns.lainnya) take(column, "lainnya");
  return buckets;
}

function addBuckets(target, extra) {
  for (const key of HPP_KEYS) target[key] += extra[key] ?? 0;
}

function classify(jenis) {
  const token = (normName(jenis).split(/[^a-z0-9]+/).find(Boolean)) ?? "";
  return {
    name: (jenis || "Order").slice(0, 120),
    categoryName: CATEGORY_BY_TOKEN[token] ?? "Lainnya",
    garmentType: token === "jersey" ? "JERSEY" : AKSESORI.has(token) ? "AKSESORI" : "NON_JERSEY",
  };
}

function readSheetOrders(worksheet, month) {
  const columns = headerMap(worksheet);
  if (!columns.invoice) fail(`Kolom invoice tidak ketemu pada bulan ${month}.`);
  const orders = [];
  let current = null;
  let blankRun = 0;
  const flush = () => {
    if (!current) return;
    const baseHpp = current.hppCell > 0 ? Math.round(current.hppCell) : sumBuckets(current.buckets) - current.extraHpp;
    current.hpp = baseHpp + current.extraHpp;
    current.buckets.lainnya += current.hpp - sumBuckets(current.buckets);
    if (!current.lines.length) current.lines.push({ ...classify(current.jenis), qty: Math.max(1, Math.round(current.qty || 1)) });
    orders.push(applyConfirmedAdjustments({
      month,
      name: current.name,
      invoice: Math.round(current.invoice),
      hpp: current.hpp,
      buckets: current.buckets,
      lines: current.lines,
      dp: current.dp,
      sisa: current.sisa,
      lunas: current.lunas,
      date: `${month}-01`,
    }));
    current = null;
  };

  for (let row = 5; row <= Math.min(worksheet.rowCount || 80, 120); row += 1) {
    const number = cellNumber(worksheet.getCell(row, 1));
    const numbered = number != null && number === Math.round(number) && number > 0 && number < 500;
    const name = cellText(worksheet.getCell(row, columns.name));
    const invoice = columns.invoice ? cellNumber(worksheet.getCell(row, columns.invoice)) : null;
    const qty = columns.qty ? cellNumber(worksheet.getCell(row, columns.qty)) : null;
    if (!name && invoice != null && invoice >= 20_000_000) break;
    if (!name && !numbered && invoice == null && (qty == null || qty === 0)) {
      blankRun += current ? 1 : 0;
      if (blankRun >= 12) break;
      continue;
    }
    blankRun = 0;
    if (current && name && invoice != null && invoice === current.invoice && normName(name) === normName(current.name)) {
      const jenis = columns.jenis ? cellText(worksheet.getCell(row, columns.jenis)) : "";
      const extraQty = Math.round(qty ?? 0);
      const line = classify(jenis);
      const echoed = current.lines.length === 1 && current.lines[0].qty === extraQty && current.lines[0].name === line.name;
      if (jenis && extraQty > 0 && !echoed) current.lines.push({ ...line, qty: extraQty });
      continue;
    }
    if (name && numbered && current && current.no === number && (invoice == null || invoice === current.invoice)) {
      const jenis = columns.jenis ? cellText(worksheet.getCell(row, columns.jenis)) : "";
      const extraQty = Math.round(qty ?? 0);
      if (jenis && extraQty > 0) current.lines.push({ ...classify(jenis), qty: extraQty });
      continue;
    }
    if (name) {
      flush();
      current = {
        no: numbered ? number : null,
        name,
        jenis: columns.jenis ? cellText(worksheet.getCell(row, columns.jenis)) : "",
        qty: qty ?? 0,
        invoice: invoice ?? 0,
        hppCell: columns.hpp ? (cellNumber(worksheet.getCell(row, columns.hpp)) ?? 0) : 0,
        buckets: readBuckets(worksheet, row, columns),
        extraHpp: 0,
        lines: [],
        dp: columns.dp ? cellNumber(worksheet.getCell(row, columns.dp)) : null,
        sisa: columns.sisa ? cellNumber(worksheet.getCell(row, columns.sisa)) : null,
        lunas: columns.lunas ? cellNumber(worksheet.getCell(row, columns.lunas)) : null,
      };
      const lineQty = Math.round(current.qty || 0);
      if (current.jenis || lineQty > 0) current.lines.push({ ...classify(current.jenis), qty: Math.max(lineQty, 1) });
      continue;
    }
    if (!current) continue;
    if (numbered && (invoice == null || invoice <= 0)) continue;
    if (invoice != null && invoice > 0 && invoice !== current.invoice) {
      current.invoice += invoice;
      const extra = readBuckets(worksheet, row, columns);
      const extraCell = columns.hpp ? (cellNumber(worksheet.getCell(row, columns.hpp)) ?? 0) : 0;
      addBuckets(current.buckets, extra);
      current.extraHpp += extraCell > 0 ? Math.round(extraCell) : sumBuckets(extra);
    }
    const jenis = columns.jenis ? cellText(worksheet.getCell(row, columns.jenis)) : "";
    const extraQty = Math.round(qty ?? 0);
    if (jenis && extraQty > 0) current.lines.push({ ...classify(jenis), qty: extraQty });
    else if (extraQty > 0 && current.lines[0]) current.lines[0].qty += extraQty;
  }
  flush();
  return orders.map((order) => ({ ...order, skip: decideSkip(order) }));
}

function overheadCategory(label) {
  const text = label.toLocaleLowerCase("id-ID");
  if (text.includes("wifi")) return "WIFI";
  if (text.includes("lingkungan")) return "LINGKUNGAN";
  if (text.includes("cicilan")) return "CICILAN_LAPTOP";
  if (text.includes("free pick")) return "FREE_PICK";
  if (text.includes("ongkir admin")) return "ONGKIR_ADMIN_PRODUKSI";
  if (text.includes("ongkir cust")) return "ONGKIR_CUST";
  if (text.includes("listrik depan")) return "LISTRIK_DEPAN";
  if (text.includes("listrik belakang")) return "LISTRIK_BELAKANG";
  if (text.includes("peralatan")) return "PERALATAN_KANTOR";
  if (text.includes("sampel")) return "SAMPEL";
  if (text.includes("konten")) return "KONTEN";
  if (text.includes("meeting")) return "MEETING";
  if (text.includes("lembur")) return "LEMBUR";
  if (text.includes("loker")) return "LOKER";
  if (text.includes("ads")) return "ADS";
  if (text.includes("gosend") || text.includes("mobil produksi")) return "GOSEND_MOBIL_PRODUKSI";
  return "DLL";
}

function readSeptemberOverhead(worksheet) {
  const rows = [];
  for (let row = 4; row <= 30; row += 1) {
    const label = cellText(worksheet.getCell(row, 5));
    const amount = cellNumber(worksheet.getCell(row, 6));
    if (!label || amount == null || amount <= 0) continue;
    if (/total|rincian|subtotal/i.test(label)) continue;
    rows.push({ label, amount: Math.round(amount), category: overheadCategory(label), date: dUTC("2026-09-01") });
  }
  return rows;
}

const CRM_MONTHS = { januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12 };

function crmDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return date.toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  const full = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(text);
  if (full && CRM_MONTHS[full[2].toLocaleLowerCase("id-ID")]) {
    return `${full[3]}-${String(CRM_MONTHS[full[2].toLocaleLowerCase("id-ID")]).padStart(2, "0")}-${String(full[1]).padStart(2, "0")}`;
  }
  return null;
}

function crmPhone(value) {
  if (value == null || value === "") return "";
  const raw = typeof value === "number" ? String(Math.round(value)) : String(value);
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("62")) digits = `0${digits.slice(2)}`;
  if (digits && !digits.startsWith("0") && digits.length >= 9 && digits.length <= 12) digits = `0${digits}`;
  return digits;
}

async function readCrmHints() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(CRM_XLSX);
  const worksheet = workbook.worksheets[0];
  const byName = new Map();
  let current = null;
  for (let row = 3; row <= (worksheet.rowCount || 626); row += 1) {
    const name = cellText(worksheet.getCell(row, 2));
    if (!name) continue;
    current = { name, date: crmDate(worksheet.getCell(row, 3).value), phone: crmPhone(worksheet.getCell(row, 5).value) };
    const key = normName(name);
    const list = byName.get(key) ?? [];
    list.push(current);
    byName.set(key, list);
  }
  return byName;
}

function orderDate(order, hints) {
  const matches = (hints.get(normName(order.name)) ?? []).map((hint) => hint.date).filter((date) => date && date.startsWith(order.month));
  return matches[0] ?? `${order.month}-01`;
}

function orderPhone(order, hints) {
  const phones = [...new Set((hints.get(normName(order.name)) ?? []).map((hint) => hint.phone).filter(Boolean))];
  if (phones.length !== 1 || !phoneAllowed(phones[0])) return null;
  return phones[0];
}

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
  return `SO-${year}-${String(await nextValue(tx, `sales-order:${year}`)).padStart(5, "0")}`;
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
        customer.poCustomerCode = candidate;
        break;
      }
    }
  }
  const existingOrderCount = await tx.purchaseOrder.count({ where: { opportunity: { customerId: customer.id }, revision: 1 } });
  const counter = await tx.sequenceCounter.upsert({
    where: { key: `purchase-order:${customer.id}` },
    create: { key: `purchase-order:${customer.id}`, value: existingOrderCount + 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  return `PO-${code}${jakartaDateCode(date)}-${counter.value}`;
}

async function reviseClosedInvoice(tx, revision) {
  const total = revision.order.invoice;
  const invoice = await tx.invoice.findUnique({
    where: { id: revision.invoiceId },
    include: {
      items: true,
      salesOrder: { include: { items: true, cost: true, payment: { include: { terms: true, transactions: true } } } },
      pendingPayment: true,
    },
  });
  if (!invoice || invoice.items.length !== 1) throw new Error(`Invoice ${revision.order.name} tidak bisa disesuaikan.`);
  const hpp = invoice.salesOrder?.cost ? sum(HPP_KEYS.map((key) => Math.round(Number(invoice.salesOrder.cost[key] ?? 0)))) : 0;
  const qty = invoice.items[0].quantity;
  const unitPrice = floor2(total / qty);
  const amounts = { unitPrice, grossAmount: total, total, subtotal: total };
  await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      total,
      subtotal: total,
      totalProfit: total - hpp,
      notes: [invoice.notes, `Nominal disesuaikan ke laporan tertutup, dari ${rupiah(revision.previousTotal)} menjadi ${rupiah(total)}.`].filter(Boolean).join(" "),
    },
  });
  await tx.invoiceItem.update({ where: { id: invoice.items[0].id }, data: amounts });
  const salesOrder = invoice.salesOrder;
  if (salesOrder) {
    if (salesOrder.items.length !== 1) throw new Error(`Sales order ${revision.order.name} tidak bisa disesuaikan.`);
    await tx.salesOrder.update({ where: { id: salesOrder.id }, data: { total, subtotal: total } });
    await tx.salesOrderItem.update({ where: { id: salesOrder.items[0].id }, data: amounts });
    const payment = salesOrder.payment;
    if (payment) {
      const paid = sum(payment.transactions.map((entry) => Math.round(Number(entry.amount))));
      const outstanding = total - paid;
      if (outstanding < 0) throw new Error(`Pembayaran ${revision.order.name} lebih besar dari invoice tertutup.`);
      await tx.dealPayment.update({
        where: { id: payment.id },
        data: {
          kind: outstanding === 0 ? "LUNAS" : "DP",
          initialValueType: outstanding === 0 ? "PERCENTAGE" : "NOMINAL",
          initialValue: outstanding === 0 ? 100 : paid,
          initialAmount: paid,
          outstandingAmount: outstanding,
        },
      });
      if (outstanding === 0) await tx.paymentTerm.deleteMany({ where: { paymentId: payment.id } });
      else if (payment.terms.length === 1) await tx.paymentTerm.update({ where: { id: payment.terms[0].id }, data: { amount: outstanding, value: outstanding } });
      else throw new Error(`Termin ${revision.order.name} tidak bisa disesuaikan.`);
    }
  }
  if (invoice.pendingPayment) {
    await tx.pendingDealPayment.update({ where: { id: invoice.pendingPayment.id }, data: { initialAmount: total } });
  }
}

function invoiceNotes(order, payment) {
  const notes = [];
  if (payment.note) notes.push(payment.note);
  if (order.month === "2026-08" && normName(order.name).includes("mas bah")) {
    notes.push("Laba di laporan tertulis sama dengan invoice. Dipakai 65.500 sesuai konfirmasi.");
  }
  if (order.month === "2026-09" && normName(order.name) === "gibran") {
    notes.push("Fee Mas Tebe dipakai 1.280.000. Sheet hanya memotong 980.000, jadi HPP ditambah 300.000.");
  }
  return notes.join(" ") || null;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL belum dikonfigurasi.");
  const hostname = new URL(databaseUrl).hostname;
  const remote = !["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(hostname.toLowerCase());
  console.log(`Database: ${hostname} ${remote ? "(REMOTE)" : "(lokal)"} | mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  if (remote && !ALLOW_REMOTE) fail("Database bukan lokal. Tambahkan --allow-remote bila memang yakin.");

  const orders = [];
  for (const [file, sheet, month] of FILES) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(DATA_DIR, file));
    const worksheet = workbook.getWorksheet(sheet);
    if (!worksheet) fail(`Sheet ${sheet} tidak ada di ${file}.`);
    const rows = readSheetOrders(worksheet, month);
    console.log(`${month} ${rows.length} baris, masuk ${rows.filter((order) => !order.skip).length}, invoice masuk ${rupiah(sum(rows.filter((order) => !order.skip).map((order) => order.invoice)))}`);
    orders.push(...rows);
  }

  const overheadBook = new ExcelJS.Workbook();
  await overheadBook.xlsx.readFile(path.join(DATA_DIR, "PROJECT AS BULAN SEPTEMBER 2026.xlsx"));
  const overheadRows = readSeptemberOverhead(overheadBook.getWorksheet("PENGELUARAN MURNI"));
  const overheadSum = sum(overheadRows.map((row) => row.amount));
  console.log(`Beban September ${overheadRows.length} baris ${rupiah(overheadSum)}`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const owner = await prisma.appUser.findFirst({ where: { role: "OWNER", name: "Mas Gandrik" }, select: { id: true } });
    if (!owner) fail('User OWNER "Mas Gandrik" tidak ditemukan.');
    const profile = await prisma.businessProfile.findFirst();
    if (!profile) fail("BusinessProfile tidak ditemukan.");
    const [instansi, unclassified, categories] = await Promise.all([
      prisma.customerType.findFirst({ where: { name: "Instansi" }, select: { id: true } }),
      prisma.customerType.findFirst({ where: { name: "Belum diklasifikasikan" }, select: { id: true } }),
      prisma.productCategory.findMany({ select: { id: true, name: true, garmentType: true } }),
    ]);
    if (!instansi || !unclassified) fail("Tipe customer Instansi atau Belum diklasifikasikan tidak ada.");
    const categoryByName = new Map(categories.map((category) => [category.name, category]));

    const retypeCount = await prisma.customer.count({ where: { customerNo: { startsWith: "CRM-" }, customerTypeId: instansi.id } });
    const existingInvoices = await prisma.invoice.findMany({ select: { id: true, total: true, snapshotCustomerName: true, issuedAt: true } });
    const existingRows = existingInvoices.map((invoice) => ({
      invoiceId: invoice.id,
      month: invoice.issuedAt ? jakartaMonth(invoice.issuedAt) : "",
      name: invoice.snapshotCustomerName,
      total: Math.round(Number(invoice.total)),
    }));
    const existingAugust = sum(existingRows.filter((row) => row.month === "2026-08").map((row) => row.total));
    const { fresh, revisions, skipped: skippedExisting } = partitionArchive(orders, existingRows);
    const freshSet = new Set(fresh);
    const revisionDelta = sum(revisions.map((item) => item.order.invoice - item.previousTotal));

    const guards = monthGuards(orders.map((order) => ({ ...order, skip: order.skip || (freshSet.has(order) ? null : "sudah-ada") })), existingAugust + revisionDelta);
    guards.push({ label: `Beban murni September ${rupiah(SEPTEMBER_MURNI)}`, ok: overheadSum === SEPTEMBER_MURNI });
    guards.push({ label: "Customer Instansi yang diubah 382 atau sudah diubah", ok: retypeCount === 382 || retypeCount === 0 });
    console.log("\n=== PENJAGA ===");
    for (const item of guards) console.log(`${item.ok ? "[OK ]" : "[GAGAL]"} ${item.label}`);
    console.log(`Order baru: ${fresh.length}. Sudah ada dan dilewati: ${skippedExisting}. Nominal disesuaikan: ${revisions.length}. Tipe Instansi tersisa: ${retypeCount}.`);
    for (const item of revisions) console.log(`  sesuaikan ${item.order.name}: ${rupiah(item.previousTotal)} -> ${rupiah(item.order.invoice)}`);
    if (!guards.every((item) => item.ok)) {
      console.log("\nAgustus yang masih dihitung baru:");
      for (const order of fresh.filter((order) => order.month === "2026-08")) console.log(`  ${order.name} ${rupiah(order.invoice)}`);
      console.log(`Agustus existing DB ${rupiah(existingAugust)} + selisih ${rupiah(revisionDelta)} + baru ${rupiah(sum(fresh.filter((order) => order.month === "2026-08").map((order) => order.invoice)))} target ${rupiah(AGUSTUS_2026)}`);
      fail("Ada penjaga yang gagal. Tidak ada yang ditulis.");
    }

    const hints = await readCrmHints();
    if (!APPLY) {
      console.log(`\nDRY RUN selesai. Beban September ${overheadRows.length} baris ${rupiah(overheadSum)}. Jalankan dengan --apply untuk menulis.\n`);
      return;
    }

    const expectedByMonth = new Map();
    for (const order of orders) {
      if (order.skip) continue;
      expectedByMonth.set(order.month, (expectedByMonth.get(order.month) ?? 0) + order.invoice);
    }

    console.log("\nMenulis ke database...");
    const result = await prisma.$transaction(async (tx) => {
      const retyped = await tx.customer.updateMany({ where: { customerNo: { startsWith: "CRM-" }, customerTypeId: instansi.id }, data: { customerTypeId: unclassified.id } });
      const placeholderOrders = await tx.purchaseOrder.findMany({
        where: { material: "Standard", opportunity: { customer: { name: { not: "Test" } } }, sizes: { every: { size: "All Size" } }, NOT: { sizes: { none: {} } } },
        select: { id: true },
      });
      if (placeholderOrders.length) {
        await tx.purchaseOrder.updateMany({ where: { id: { in: placeholderOrders.map((order) => order.id) } }, data: { material: PLACEHOLDER } });
        await tx.purchaseOrderSize.updateMany({ where: { purchaseOrderId: { in: placeholderOrders.map((order) => order.id) }, size: "All Size" }, data: { size: PLACEHOLDER } });
      }

      const customers = await tx.customer.findMany({ select: { id: true, customerNo: true, name: true, companyName: true, whatsapp: true, email: true, instagram: true, address: true, poCustomerCode: true } });
      const byName = new Map();
      let nextCustomer = 0;
      for (const customer of customers) {
        const key = normName(customer.name);
        const list = byName.get(key) ?? [];
        list.push(customer);
        byName.set(key, list);
        const number = Number(customer.customerNo.slice(4));
        if (customer.customerNo.startsWith("CRM-") && number > nextCustomer) nextCustomer = number;
      }
      const resolveCustomer = async (order) => {
        const key = normName(order.name);
        const matches = byName.get(key) ?? [];
        if (matches.length) return matches.sort((a, b) => a.customerNo.localeCompare(b.customerNo))[0];
        nextCustomer += 1;
        const customerNo = `CRM-${String(nextCustomer).padStart(4, "0")}`;
        const whatsapp = orderPhone(order, hints);
        const created = await tx.customer.create({
          data: {
            customerNo,
            name: order.name.replace(/\s+/g, " ").trim().slice(0, 160),
            whatsapp,
            instagram: whatsapp ? null : `NEEDS_CONTACT_ARSIP_${customerNo}`,
            notes: CUSTOMER_NOTE,
            customerTypeId: unclassified.id,
            lifecycle: "CUSTOMER",
            orderReminderEnabled: false,
          },
          select: { id: true, customerNo: true, name: true, companyName: true, whatsapp: true, email: true, instagram: true, address: true, poCustomerCode: true },
        });
        byName.set(key, [created]);
        return created;
      };

      let transfer = await tx.paymentMethod.findUnique({ where: { name: "Transfer" } });
      if (!transfer) {
        const maxPosition = (await tx.paymentMethod.aggregate({ _max: { position: true } }))._max.position ?? 0;
        transfer = await tx.paymentMethod.create({ data: { name: "Transfer", position: maxPosition + 1 } });
      }

      for (const revision of revisions) await reviseClosedInvoice(tx, revision);
      let written = 0;
      for (const order of fresh) {
        const customer = await resolveCustomer(order);
        const payment = decidePayment(order);
        const iso = orderDate(order, hints);
        const orderDay = dUTC(iso);
        const invoiceDate = atWib(iso, 9);
        const paidAt = atWib(payment.paidOn, 10);
        const lines = order.lines.length ? order.lines : [{ ...classify(""), qty: 1 }];
        const qty = Math.max(1, sum(lines.map((line) => line.qty)));
        const lead = lines[0];
        const leadCategory = categoryByName.get(lead.categoryName) ?? categoryByName.get("Lainnya");
        const opportunity = await tx.opportunity.create({
          data: {
            opportunityNo: await nextOpportunityNo(tx),
            customerId: customer.id,
            title: `${lead.name} ${qty} pcs`.slice(0, 180),
            stage: "DEAL",
            origin: "MANUAL",
            productName: lead.name,
            garmentType: leadCategory?.garmentType ?? lead.garmentType,
            productCategoryId: leadCategory?.id ?? null,
            version: 1,
            createdAt: atWib(iso, 8),
          },
          select: { id: true },
        });
        const purchaseOrderNo = await nextPurchaseOrderNo(tx, customer, orderDay);
        const purchaseOrder = await tx.purchaseOrder.create({
          data: {
            purchaseOrderNo,
            opportunityId: opportunity.id,
            revision: 1,
            status: "AGREED",
            productName: lead.name,
            garmentType: leadCategory?.garmentType ?? lead.garmentType,
            productCategoryId: leadCategory?.id ?? null,
            material: PLACEHOLDER,
            orderDate: orderDay,
            deadline: addDays(orderDay, 14),
            depositRequired: false,
            agreedAt: invoiceDate,
            snapshotBusinessName: profile.name,
            snapshotBusinessPhone: profile.phone,
            snapshotBusinessEmail: profile.email,
            snapshotBusinessAddress: profile.address,
            snapshotBusinessLogoPath: profile.logoPath,
            notes: "Ukuran dan bahan tidak ada di arsip laporan.",
            version: 1,
            createdById: owner.id,
            createdAt: invoiceDate,
            items: {
              create: lines.map((line, position) => {
                const category = categoryByName.get(line.categoryName) ?? categoryByName.get("Lainnya");
                return { position, name: line.name, productCategoryId: category?.id ?? null, garmentType: category?.garmentType ?? line.garmentType };
              }),
            },
          },
          include: { items: { orderBy: { position: "asc" } } },
        });
        await tx.purchaseOrderSize.createMany({
          data: purchaseOrder.items.map((item, position) => ({
            purchaseOrderId: purchaseOrder.id,
            position,
            itemId: item.id,
            size: PLACEHOLDER,
            sleeveLength: "PANJANG",
            quantity: lines[position].qty,
          })),
        });
        const invoiceNo = await nextInvoiceNo(tx, invoiceDate);
        const unitPrice = floor2(order.invoice / qty);
        const invoice = await tx.invoice.create({
          data: {
            invoiceNo,
            opportunityId: opportunity.id,
            purchaseOrderId: purchaseOrder.id,
            revision: 1,
            status: "ISSUED",
            snapshotCustomerName: customer.name,
            snapshotCompanyName: customer.companyName,
            snapshotWhatsapp: customer.whatsapp,
            snapshotEmail: customer.email,
            snapshotInstagram: customer.instagram,
            snapshotAddress: customer.address,
            snapshotBusinessName: profile.name,
            snapshotBusinessPhone: profile.phone,
            snapshotBusinessEmail: profile.email,
            snapshotBusinessAddress: profile.address,
            snapshotBusinessLogoPath: profile.logoPath,
            snapshotSignatureName: profile.signatureName,
            snapshotSignatureTitle: profile.signatureTitle,
            snapshotSignaturePath: profile.signaturePath,
            discountType: "NONE",
            subtotal: order.invoice,
            total: order.invoice,
            totalProfit: order.laba,
            issuedAt: invoiceDate,
            dueAt: addDays(orderDay, 7),
            notes: invoiceNotes(order, payment),
            version: 1,
            createdById: owner.id,
            createdAt: invoiceDate,
            items: { create: [{ position: 0, productName: lead.name, size: PLACEHOLDER, description: lead.name, quantity: qty, unitPrice, grossAmount: order.invoice, total: order.invoice, subtotal: order.invoice }] },
          },
          select: { id: true },
        });
        const salesOrder = await tx.salesOrder.create({
          data: {
            salesOrderNo: await nextSalesOrderNo(tx, paidAt),
            opportunityId: opportunity.id,
            purchaseOrderId: purchaseOrder.id,
            invoiceId: invoice.id,
            purchaseOrderNo,
            invoiceNo,
            status: "ACTIVE",
            snapshotCustomerName: customer.name,
            snapshotCompanyName: customer.companyName,
            snapshotWhatsapp: customer.whatsapp,
            snapshotEmail: customer.email,
            snapshotInstagram: customer.instagram,
            snapshotAddress: customer.address,
            discountType: "NONE",
            discountValue: 0,
            subtotal: order.invoice,
            total: order.invoice,
            acceptedAt: paidAt,
            createdById: owner.id,
            createdAt: paidAt,
            items: { create: [{ position: 0, productName: lead.name, size: PLACEHOLDER, description: lead.name, quantity: qty, unitPrice, grossAmount: order.invoice, total: order.invoice, subtotal: order.invoice }] },
            cost: { create: { ...Object.fromEntries(HPP_KEYS.map((key) => [key, new Prisma.Decimal(order.buckets[key] ?? 0)])), hppComplete: true } },
            // HPP per produk: nilai impor menempel pada produk order ini agar Edit HPP
            // di tabel Project langsung terisi.
            productCosts: {
              create: productCostSeedRows([{ position: 0, productName: lead.name }], purchaseOrder.productName).map((row, index) => ({
                ...row,
                ...(index === 0 ? hppValues(order.buckets) : {}),
              })),
            },
            payment: {
              create: {
                kind: payment.kind,
                paidAt,
                initialValueType: payment.kind === "LUNAS" ? "PERCENTAGE" : "NOMINAL",
                initialValue: payment.kind === "LUNAS" ? 100 : payment.paid,
                initialAmount: payment.paid,
                outstandingAmount: payment.outstanding,
                createdById: owner.id,
                ...(payment.outstanding > 0 ? { terms: { create: [{ position: 0, valueType: "NOMINAL", value: payment.outstanding, amount: payment.outstanding, dueAt: addDays(orderDay, 30) }] } } : {}),
                ...(payment.paid > 0 ? { transactions: { create: { amount: payment.paid, paidAt, paymentMethodId: transfer.id, note: payment.note, createdById: owner.id, createdAt: paidAt } } } : {}),
              },
            },
          },
          select: { id: true, productCosts: { select: { id: true }, orderBy: { position: "asc" }, take: 1 } },
        });
        for (const key of HPP_KEYS) {
          if (!(order.buckets[key] > 0)) continue;
          await tx.expense.create({
            data: {
              purpose: `HPP ${HPP_LABEL[key]} · ${customer.name} · ${lead.name} · ${invoiceNo}`.slice(0, 500),
              spentAt: orderDay,
              amount: new Prisma.Decimal(order.buckets[key]),
              category: "PROJECT",
              paymentMethodId: transfer.id,
              isReimbursable: false,
              customerName: customer.name.slice(0, 160),
              salesOrderId: salesOrder.id,
              salesOrderProductCostId: salesOrder.productCosts[0]?.id ?? null,
              hppKey: key,
              createdById: owner.id,
              createdAt: invoiceDate,
            },
          });
        }
        const startAt = atWib(iso, 8);
        const endAt = addDays(startAt, 11);
        const span = endAt.getTime() - startAt.getTime();
        for (const [index, item] of purchaseOrder.items.entries()) {
          const line = lines[index];
          const garment = item.garmentType ?? line.garmentType;
          const stages = garment === "AKSESORI" ? AKSESORI_STAGES : garment === "JERSEY" ? JERSEY_STAGES : NON_JERSEY_STAGES;
          const workOrder = await tx.productionWorkOrder.create({
            data: {
              workOrderNo: await nextWorkOrderNo(tx, orderDay),
              salesOrderId: salesOrder.id,
              purchaseOrderItemId: item.id,
              itemName: line.name,
              route: garment === "JERSEY" ? "JERSEY" : "NON_JERSEY",
              productName: line.name,
              quantity: line.qty,
              deadline: addDays(orderDay, 14),
              stageSequence: stages,
              currentStage: "SELESAI",
              status: "COMPLETED",
              completedAt: endAt,
              stageEnteredAt: endAt,
              designCompletedAt: startAt,
              version: 1,
              createdAt: startAt,
              steps: { create: stages.map((stage, position) => ({ stage, position, status: "COMPLETED", attemptCount: 1, startedAt: new Date(startAt.getTime() + (span * position) / stages.length), completedAt: new Date(startAt.getTime() + (span * (position + 1)) / stages.length) })) },
            },
            select: { id: true },
          });
          await tx.productionActivity.create({ data: { workOrderId: workOrder.id, actorId: owner.id, type: "CREATED", toStage: stages[0], createdAt: startAt } });
        }
        written += 1;
      }

      const overheadPurposes = overheadRows.map((row) => row.label.slice(0, 500));
      const overheadAlready = await tx.expense.aggregate({
        where: { spentAt: dUTC("2026-09-01"), deletedAt: null, category: { not: "PROJECT" }, purpose: { in: overheadPurposes } },
        _sum: { amount: true },
      });
      const overheadAlreadySum = Math.round(Number(overheadAlready._sum.amount ?? 0));
      if (overheadAlreadySum !== 0 && overheadAlreadySum !== SEPTEMBER_MURNI) {
        throw new Error(`Beban September yang sudah ada ${overheadAlreadySum}, bukan 0 atau ${SEPTEMBER_MURNI}.`);
      }
      if (overheadAlreadySum === 0) {
        for (const row of overheadRows) {
          await tx.expense.create({
            data: {
              purpose: row.label.slice(0, 500),
              spentAt: row.date,
              amount: new Prisma.Decimal(row.amount),
              category: row.category,
              paymentMethodId: transfer.id,
              createdById: owner.id,
              createdAt: atWib("2026-09-01", 11),
            },
          });
        }
      }

      const writtenInvoices = await tx.invoice.findMany({ select: { total: true, totalProfit: true, snapshotCustomerName: true, issuedAt: true } });
      const dbByMonth = new Map();
      for (const invoice of writtenInvoices) {
        if (!invoice.issuedAt) continue;
        const month = jakartaMonth(invoice.issuedAt);
        dbByMonth.set(month, (dbByMonth.get(month) ?? 0) + Math.round(Number(invoice.total)));
      }
      for (const [month, total] of expectedByMonth) {
        if ((dbByMonth.get(month) ?? 0) !== total) throw new Error(`Total invoice ${month} di database ${dbByMonth.get(month) ?? 0}, seharusnya ${total}.`);
      }
      const blocked = writtenInvoices.filter((invoice) => {
        if (!invoice.issuedAt) return false;
        const reason = decideSkip({ month: jakartaMonth(invoice.issuedAt), name: invoice.snapshotCustomerName, invoice: Math.round(Number(invoice.total)) });
        return reason === "tanya-1" || reason === "tanya-4";
      });
      if (blocked.length) throw new Error(`Baris yang harus absen ikut tertulis: ${blocked.map((invoice) => invoice.snapshotCustomerName).join(", ")}.`);
      const masBah = writtenInvoices.find((invoice) => invoice.issuedAt && jakartaMonth(invoice.issuedAt) === "2026-08" && normName(invoice.snapshotCustomerName).includes("mas bah") && Math.round(Number(invoice.total)) === MAS_BAH_INVOICE);
      if (!masBah || Math.round(Number(masBah.totalProfit)) !== MAS_BAH_LABA) throw new Error("Laba Mas Bah bukan 65.500.");
      const gibran = writtenInvoices.filter((invoice) => invoice.issuedAt && jakartaMonth(invoice.issuedAt) === "2026-09" && normName(invoice.snapshotCustomerName) === "gibran");
      if (gibran.length !== 1 || Math.round(Number(gibran[0].totalProfit)) !== 4_805_318) throw new Error("Laba Gibran September bukan 4.805.318.");
      const instansiLeft = await tx.customer.count({ where: { customerNo: { startsWith: "CRM-" }, customerTypeId: instansi.id } });
      if (instansiLeft !== 0) throw new Error("Masih ada customer CRM bertipe Instansi.");
      const testCustomer = await tx.customer.findFirst({ where: { name: "Test" }, select: { customerType: { select: { name: true } } } });
      if (testCustomer && testCustomer.customerType.name !== "Personal") throw new Error("Customer Test berubah tipenya.");
      const leftoverPlaceholder = await tx.purchaseOrder.count({
        where: { material: "Standard", opportunity: { customer: { name: { not: "Test" } } }, sizes: { every: { size: "All Size" } }, NOT: { sizes: { none: {} } } },
      });
      if (leftoverPlaceholder) throw new Error("Masih ada PO Standard / All Size.");
      const overheadLeft = await tx.expense.aggregate({
        where: { spentAt: dUTC("2026-09-01"), deletedAt: null, category: { not: "PROJECT" }, purpose: { in: overheadPurposes } },
        _sum: { amount: true },
      });
      if (Math.round(Number(overheadLeft._sum.amount ?? 0)) !== SEPTEMBER_MURNI) throw new Error("Beban September bukan 47.585.494.");

      return { written, retyped: retyped.count, placeholders: placeholderOrders.length, overhead: overheadRows.length };
    }, { timeout: 900_000, maxWait: 60_000 });

    console.log(`\nTertulis ${result.written} order, ${result.retyped} customer diubah tipenya, ${result.placeholders} PO placeholder dirapikan, ${result.overhead} beban September.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("GAGAL:", error);
  process.exit(1);
});
