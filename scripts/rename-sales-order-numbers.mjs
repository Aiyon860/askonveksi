import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum dikonfigurasi.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

try {
  const legacy = await prisma.salesOrder.findMany({
    where: { salesOrderNo: { startsWith: "SALES-ORDER-" } },
    select: { id: true, salesOrderNo: true },
    orderBy: { salesOrderNo: "asc" },
  });

  const targets = legacy.map((order) => ({
    id: order.id,
    from: order.salesOrderNo,
    to: order.salesOrderNo.replace(/^SALES-ORDER-/, "SO-"),
  }));

  const duplicates = targets.filter((target, index, all) => all.findIndex((item) => item.to === target.to) !== index);
  const existing = targets.length
    ? await prisma.salesOrder.findMany({
        where: { salesOrderNo: { in: targets.map((target) => target.to) } },
        select: { salesOrderNo: true },
      })
    : [];

  console.log(`Ditemukan ${targets.length} Sales Order dengan format lama.`);
  console.log(`Target bentrok dengan nomor yang sudah ada: ${existing.length + duplicates.length}.`);
  console.log(`Contoh: ${targets.slice(0, 3).map((target) => `${target.from} -> ${target.to}`).join(" | ") || "-"}`);

  if (existing.length || duplicates.length) {
    console.error("Migrasi dibatalkan: ada nomor tujuan yang sudah dipakai.");
    process.exitCode = 1;
  } else if (dryRun) {
    console.log("Mode dry-run: tidak ada yang diubah.");
  } else if (targets.length) {
    const updated = await prisma.$transaction(
      targets.map((target) =>
        prisma.salesOrder.update({
          where: { id: target.id },
          data: { salesOrderNo: target.to },
          select: { id: true },
        }),
      ),
    );
    console.log(`Selesai: ${updated.length} nomor Sales Order diperbarui.`);
  } else {
    console.log("Tidak ada data lama yang perlu diubah.");
  }
} finally {
  await prisma.$disconnect();
}
