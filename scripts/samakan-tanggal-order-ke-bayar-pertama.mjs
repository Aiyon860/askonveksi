#!/usr/bin/env node
/**
 * Samakan tanggal order (PO/SO/invoice/dealPayment) ke pembayaran pertama.
 * Multi-baris nama sama yang berbagi tanggal bayar ikut DP paling awal.
 *
 *   node scripts/samakan-tanggal-order-ke-bayar-pertama.mjs
 *   node scripts/samakan-tanggal-order-ke-bayar-pertama.mjs --apply --allow-remote
 */

import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { clusterOrderMasukDates, jakartaDay } from "./order-tanggal-bayar-pertama.mjs";

const APPLY = process.argv.includes("--apply");
const ALLOW_REMOTE = process.argv.includes("--allow-remote");
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });

function atWib(iso, hour) {
  return new Date(`${iso}T${String(hour - 7).padStart(2, "0")}:00:00.000Z`);
}

function dateOnly(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function addDays(date, days) {
  return date ? new Date(date.getTime() + days * 86_400_000) : date;
}

function isoDay(date) {
  return dayFormat.format(date);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL belum dikonfigurasi.");
  const hostname = new URL(databaseUrl).hostname.toLowerCase();
  const local = ["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(hostname);
  if (!local && !ALLOW_REMOTE) throw new Error("Database bukan lokal. Tambahkan --allow-remote bila memang yakin.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const rows = await prisma.salesOrder.findMany({
      select: {
        id: true,
        salesOrderNo: true,
        snapshotCustomerName: true,
        acceptedAt: true,
        purchaseOrder: { select: { id: true, orderDate: true, deadline: true } },
        invoice: { select: { id: true, issuedAt: true, dueAt: true } },
        payment: {
          select: {
            id: true,
            paidAt: true,
            transactions: { select: { paidAt: true }, orderBy: { paidAt: "asc" } },
          },
        },
      },
    });

    const withPay = rows.filter((row) => row.payment?.transactions?.length);
    const clustered = clusterOrderMasukDates(
      withPay.map((row) => ({
        id: row.id,
        name: row.snapshotCustomerName,
        firstPayDay: jakartaDay(row.payment.transactions[0].paidAt),
        payDays: row.payment.transactions.map((entry) => jakartaDay(entry.paidAt)),
      })),
    );

    const changes = [];
    for (const row of withPay) {
      const target = clustered.get(row.id);
      if (!target) continue;
      const orderDay = row.purchaseOrder.orderDate ? isoDay(row.purchaseOrder.orderDate) : null;
      const acceptedDay = isoDay(row.acceptedAt);
      const issuedDay = isoDay(row.invoice.issuedAt);
      const paidDay = row.payment.paidAt ? isoDay(row.payment.paidAt) : null;
      if (orderDay === target && acceptedDay === target && issuedDay === target && paidDay === target) continue;
      changes.push({
        row,
        target,
        from: { orderDay, acceptedDay, issuedDay, paidDay },
        delta: orderDay ? Math.round((Date.parse(target) - Date.parse(orderDay)) / 86_400_000) : 0,
      });
    }

    console.log(`Sales order berbayar: ${withPay.length}`);
    console.log(`Perlu disamakan ke bayar pertama: ${changes.length}`);
    for (const item of changes.filter((entry) => /angga arsa/i.test(entry.row.snapshotCustomerName))) {
      console.log(
        `  ANGGA ${item.row.salesOrderNo} | order ${item.from.orderDay} accepted ${item.from.acceptedDay} → ${item.target}`,
      );
    }
    for (const item of changes.slice(0, 20)) {
      console.log(
        `  ${item.row.salesOrderNo} ${item.row.snapshotCustomerName} | order ${item.from.orderDay} accepted ${item.from.acceptedDay} → ${item.target}`,
      );
    }
    if (changes.length > 20) console.log(`  ... +${changes.length - 20} lagi`);

    if (!APPLY) {
      console.log("\nDRY RUN. Jalankan dengan --apply untuk menulis.\n");
      return;
    }

    let written = 0;
    for (const item of changes) {
      const { row, target, delta } = item;
      await prisma.$transaction(async (tx) => {
        await tx.purchaseOrder.update({
          where: { id: row.purchaseOrder.id },
          data: { orderDate: dateOnly(target), deadline: addDays(row.purchaseOrder.deadline, delta) },
        });
        await tx.salesOrder.update({
          where: { id: row.id },
          data: { acceptedAt: atWib(target, 10) },
        });
        await tx.invoice.update({
          where: { id: row.invoice.id },
          data: { issuedAt: atWib(target, 9), dueAt: addDays(row.invoice.dueAt, delta) },
        });
        await tx.dealPayment.update({
          where: { id: row.payment.id },
          data: { paidAt: atWib(target, 10) },
        });
      });
      written += 1;
      if (written % 50 === 0) console.log(`  progress ${written}/${changes.length}`);
    }
    console.log(`\nDisamakan ${written} order ke tanggal bayar pertama.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("GAGAL:", error);
  process.exit(1);
});
