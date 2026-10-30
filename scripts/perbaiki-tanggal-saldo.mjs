#!/usr/bin/env node
/**
 * Ganti tanggal 1 hasil impor arsip dengan tanggal uang masuk di sheet Saldo Akhir.
 *   node scripts/perbaiki-tanggal-saldo.mjs
 *   node scripts/perbaiki-tanggal-saldo.mjs --apply
 */

import "dotenv/config";

import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { looseName } from "./keuangan-arsip-rules.mjs";
import { assignSaldoPayments, distinctiveTokens, parseSaldoDate } from "./saldo-tanggal.mjs";

const APPLY = process.argv.includes("--apply");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data-keuangan");
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });

function text(cell) {
  const value = cell?.value;
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("").trim();
    if (typeof value.text === "string") return value.text.trim();
    if (value.result instanceof Date) return value.result.toISOString().slice(0, 10);
    if (value.result != null && typeof value.result !== "object") return String(value.result).trim();
  }
  return "";
}

function amount(cell) {
  const value = cell?.value;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (value && typeof value === "object" && typeof value.result === "number") return Math.round(value.result);
  return null;
}

function isoDay(date) {
  return dayFormat.format(date);
}

function atWib(iso, hour) {
  return new Date(`${iso}T${String(hour - 7).padStart(2, "0")}:00:00.000Z`);
}

function dateOnly(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

async function readInflows() {
  const rows = [];
  for (const file of readdirSync(DATA_DIR).filter((name) => name.endsWith(".xlsx"))) {
    const year = Number(file.match(/20\d{2}/)[0]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(DATA_DIR, file));
    const sheet = workbook.worksheets.find((item) => /saldo akhir/i.test(item.name));
    if (!sheet) continue;
    for (let row = 1; row <= sheet.rowCount; row += 1) {
      const label = text(sheet.getCell(row, 2));
      const debit = amount(sheet.getCell(row, 3));
      const date = parseSaldoDate(text(sheet.getCell(row, 1)), year);
      if (!label || !debit || debit <= 0 || !date) continue;
      if (/pengeluaran|saldo awal|saldo project|pinjam|tf mandiri|tf bni|tukar cash|kembalian belanja/i.test(label)) continue;
      rows.push({ date, amount: debit, label });
    }
  }
  return rows;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL belum dikonfigurasi.");
  const hostname = new URL(databaseUrl).hostname;
  if (!["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(hostname.toLowerCase())) {
    throw new Error("Database bukan lokal.");
  }
  const inflows = await readInflows();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const invoices = await prisma.invoice.findMany({
      select: {
        id: true,
        total: true,
        notes: true,
        issuedAt: true,
        dueAt: true,
        snapshotCustomerName: true,
        purchaseOrder: { select: { id: true, orderDate: true, deadline: true, opportunityId: true } },
        salesOrder: {
          select: {
            id: true,
            acceptedAt: true,
            payment: {
              select: {
                id: true,
                outstandingAmount: true,
                transactions: { select: { id: true, paidAt: true, amount: true, note: true, paymentMethodId: true, createdById: true } },
                terms: { select: { id: true } },
              },
            },
            expenses: { select: { id: true, spentAt: true } },
            productionWorkOrders: {
              select: {
                id: true,
                createdAt: true,
                deadline: true,
                completedAt: true,
                stageEnteredAt: true,
                designCompletedAt: true,
                steps: { select: { id: true, startedAt: true, completedAt: true } },
              },
            },
          },
        },
      },
    });
    const fake = invoices.filter((invoice) => {
      const transactions = invoice.salesOrder?.payment?.transactions ?? [];
      return transactions.length > 0 && transactions.every((entry) => isoDay(entry.paidAt).endsWith("-01"));
    });
    const orders = fake.map((invoice) => ({
      id: invoice.id,
      name: invoice.snapshotCustomerName,
      month: isoDay(invoice.issuedAt).slice(0, 7),
      paid: invoice.salesOrder.payment.transactions.reduce((sum, entry) => sum + Math.round(Number(entry.amount)), 0),
      invoice: Math.round(Number(invoice.total)),
    }));
    const fakeIds = new Set(fake.map((invoice) => invoice.id));
    const booked = new Set();
    const bookedAmount = new Set();
    for (const invoice of invoices) {
      if (fakeIds.has(invoice.id)) continue;
      for (const entry of invoice.salesOrder?.payment?.transactions ?? []) {
        const day = isoDay(entry.paidAt);
        const value = Math.round(Number(entry.amount));
        bookedAmount.add(`${day}|${value}`);
        if (entry.note?.startsWith("Saldo Akhir:")) booked.add(`${day}|${value}|${looseName(entry.note.slice("Saldo Akhir:".length))}`);
      }
    }
    const openInflows = inflows.filter((row) => !booked.has(`${row.date}|${row.amount}|${looseName(row.label)}`) && !bookedAmount.has(`${row.date}|${row.amount}`));
    const { matched, unmatched } = assignSaldoPayments(
      orders,
      openInflows,
      invoices.map((invoice) => ({ name: invoice.snapshotCustomerName, month: isoDay(invoice.issuedAt).slice(0, 7) })),
    );
    const exact = matched.filter((item) => item.mode === "exact");
    const partial = matched.filter((item) => item.mode === "partial");
    const partialGap = partial.reduce((sum, item) => {
      const order = orders.find((row) => row.id === item.id);
      const saldo = item.payments.reduce((paid, row) => paid + row.amount, 0);
      return sum + Math.max(0, (order.invoice ?? order.paid) - saldo);
    }, 0);
    console.log(`Uang masuk di Saldo Akhir: ${inflows.length}`);
    console.log(`Pembayaran yang masih tanggal 1: ${fake.length}`);
    console.log(`Cocok utuh: ${exact.length}. Cocok sebagian: ${partial.length}. Belum ketemu: ${unmatched.length}.`);
    console.log(`Sisa yang belum ada di Saldo Akhir: ${partialGap.toLocaleString("id-ID")}`);
    const missed = unmatched.map((id) => orders.find((order) => order.id === id));
    for (const order of missed) {
      const tokens = distinctiveTokens(order.name);
      const [year, month] = order.month.split("-").map(Number);
      const near = new Set([-1, 0, 1, 2].map((delta) => {
        const date = new Date(Date.UTC(year, month - 1 + delta, 1));
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      }));
      const hits = openInflows.filter((row) => near.has(row.date.slice(0, 7)) && tokens.some((token) => distinctiveTokens(row.label).some((item) => item === token || item.includes(token) || token.includes(item)))).slice(0, 3);
      console.log(`  belum: ${order.month} ${order.name} ${order.invoice.toLocaleString("id-ID")}${hits.length ? ` | ${hits.map((row) => `${row.date} ${row.amount} ${row.label}`).join(" || ")}` : ""}`);
    }
    for (const item of matched) {
      const order = orders.find((row) => row.id === item.id);
      const sum = item.payments.reduce((paid, row) => paid + row.amount, 0);
      console.log(`  ${order.month} ${order.name} ${item.mode} ${item.payments[0].date} ${sum.toLocaleString("id-ID")}/${order.invoice.toLocaleString("id-ID")} | ${item.payments.map((row) => row.label).join(" + ")}`);
    }
    if (!APPLY) {
      console.log("\nDRY RUN. Jalankan dengan --apply untuk menulis tanggal.\n");
      return;
    }
    const byId = new Map(fake.map((invoice) => [invoice.id, invoice]));
    await prisma.$transaction(async (tx) => {
      for (const item of matched) {
        const invoice = byId.get(item.id);
        const payment = invoice.salesOrder.payment;
        const paidSum = item.payments.reduce((sum, row) => sum + row.amount, 0);
        const previousPaid = payment.transactions.reduce((sum, entry) => sum + Math.round(Number(entry.amount)), 0);
        const outstanding = Math.max(0, Math.round(Number(payment.outstandingAmount)) + (previousPaid - paidSum));
        const [first, ...rest] = item.payments;
        const earliest = first.date;
        const actorId = payment.transactions[0].createdById;
        const methodId = payment.transactions[0].paymentMethodId;
        await tx.paymentTransaction.deleteMany({ where: { paymentId: payment.id } });
        await tx.paymentTerm.deleteMany({ where: { paymentId: payment.id } });
        const paymentRow = (row, paymentTermId) => ({
          paymentId: payment.id,
          paymentTermId,
          amount: row.amount,
          paidAt: atWib(row.date, 10),
          paymentMethodId: methodId,
          note: `Saldo Akhir: ${row.label}`.slice(0, 1000),
          createdById: actorId,
          createdAt: atWib(row.date, 10),
        });
        await tx.paymentTransaction.create({ data: paymentRow(first, null) });
        for (const [index, row] of rest.entries()) {
          const term = await tx.paymentTerm.create({ data: { paymentId: payment.id, position: index, valueType: "NOMINAL", value: row.amount, amount: row.amount, dueAt: dateOnly(row.date) } });
          await tx.paymentTransaction.create({ data: paymentRow(row, term.id) });
        }
        if (outstanding > 0) {
          await tx.paymentTerm.create({ data: { paymentId: payment.id, position: rest.length, valueType: "NOMINAL", value: outstanding, amount: outstanding, dueAt: addDays(dateOnly(earliest), 30) } });
        }
        await tx.dealPayment.update({
          where: { id: payment.id },
          data: {
            paidAt: atWib(earliest, 10),
            kind: outstanding === 0 ? "LUNAS" : "DP",
            initialValueType: outstanding === 0 ? "PERCENTAGE" : "NOMINAL",
            initialValue: outstanding === 0 ? 100 : first.amount,
            initialAmount: first.amount,
            outstandingAmount: outstanding,
          },
        });
        await tx.salesOrder.update({ where: { id: invoice.salesOrder.id }, data: { acceptedAt: atWib(earliest, 10) } });
        const orderDay = isoDay(invoice.purchaseOrder.orderDate);
        if (orderDay.endsWith("-01") && earliest.startsWith(orderDay.slice(0, 7))) {
          const delta = Math.round((Date.parse(earliest) - Date.parse(orderDay)) / 86_400_000);
          const shift = (date) => (date ? addDays(date, delta) : date);
          await tx.purchaseOrder.update({ where: { id: invoice.purchaseOrder.id }, data: { orderDate: dateOnly(earliest), deadline: shift(invoice.purchaseOrder.deadline) } });
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              issuedAt: atWib(earliest, 9),
              dueAt: shift(invoice.dueAt),
              notes: (invoice.notes ?? "").replace("Pelunasan tidak ada di arsip. Dicatat lunas pada tanggal 1 bulan laporan supaya tidak masuk piutang berjalan.", "Tanggal uang masuk mengikuti sheet Saldo Akhir.").trim() || null,
            },
          });
          await tx.opportunity.update({ where: { id: invoice.purchaseOrder.opportunityId }, data: { createdAt: atWib(earliest, 8) } });
          for (const expense of invoice.salesOrder.expenses) {
            if (isoDay(expense.spentAt).endsWith("-01")) await tx.expense.update({ where: { id: expense.id }, data: { spentAt: dateOnly(earliest) } });
          }
          for (const workOrder of invoice.salesOrder.productionWorkOrders) {
            await tx.productionWorkOrder.update({
              where: { id: workOrder.id },
              data: { createdAt: shift(workOrder.createdAt), deadline: shift(workOrder.deadline), completedAt: shift(workOrder.completedAt), stageEnteredAt: shift(workOrder.stageEnteredAt), designCompletedAt: shift(workOrder.designCompletedAt) },
            });
            for (const step of workOrder.steps) {
              await tx.productionStep.update({ where: { id: step.id }, data: { startedAt: shift(step.startedAt), completedAt: shift(step.completedAt) } });
            }
          }
        } else if ((invoice.notes ?? "").includes("tanggal 1")) {
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { notes: invoice.notes.replace("Pelunasan tidak ada di arsip. Dicatat lunas pada tanggal 1 bulan laporan supaya tidak masuk piutang berjalan.", "Tanggal uang masuk mengikuti sheet Saldo Akhir.") },
          });
        }
      }
    }, { timeout: 300_000, maxWait: 60_000 });
    console.log(`\nTanggal ${matched.length} order disesuaikan.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("GAGAL:", error);
  process.exit(1);
});
