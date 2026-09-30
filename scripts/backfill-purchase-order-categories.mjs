import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum dikonfigurasi.");
  process.exit(1);
}

// Pemetaan nama produk PO lama -> kategori produk. Hanya mengisi kategori yang masih kosong.
// WellWell dan "test" sengaja dibiarkan kosong: kartunya tetap tampil di kanban karena
// filter kategori selalu menyertakan Work Order tanpa kategori produk.
const CATEGORY_BY_PURCHASE_ORDER_NO = {
  "PO-DEM150926-6": "Seragam Kerja",
  "PO-2026-00014": "Jersey",
  "PO-2026-00018": "Jersey",
  "PO-DEM140926-2": "Jersey",
  "PO-DEM140926-4": "Jersey",
  "PO-DEM140926-5": "Jersey",
  "PO-DEM140926-3": "Jaket",
  "PO-DEM280926-10": "Jaket",
  "PO-DEM230926-9": "Jaket",
  "PO-DPP140926-1": "PDH / PDL",
  "PO-DEM190926-7": "PDH / PDL",
};

const GROUP_RANK = { JERSEY: 0, NON_JERSEY: 1, AKSESORI: 2 };

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

try {
  const categories = await prisma.productCategory.findMany({
    select: { id: true, name: true, garmentType: true },
  });
  const byName = new Map(categories.map((item) => [item.name.toLocaleLowerCase("id-ID"), item]));

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { purchaseOrderNo: { in: Object.keys(CATEGORY_BY_PURCHASE_ORDER_NO) } },
    select: { id: true, purchaseOrderNo: true, productName: true, garmentType: true, productCategoryId: true },
  });

  const updated = [];
  const skipped = [];
  for (const order of purchaseOrders) {
    const categoryName = CATEGORY_BY_PURCHASE_ORDER_NO[order.purchaseOrderNo];
    const category = byName.get(categoryName.toLocaleLowerCase("id-ID"));
    if (!category) {
      skipped.push(`${order.purchaseOrderNo} (kategori "${categoryName}" tidak ditemukan)`);
      continue;
    }
    if (order.productCategoryId === category.id) {
      skipped.push(`${order.purchaseOrderNo} (sudah terisi)`);
      continue;
    }
    if (order.productCategoryId) {
      skipped.push(`${order.purchaseOrderNo} (sudah punya kategori lain)`);
      continue;
    }
    if (order.garmentType && GROUP_RANK[order.garmentType] !== GROUP_RANK[category.garmentType]) {
      skipped.push(`${order.purchaseOrderNo} (jenis PO ${order.garmentType} berbeda dengan kategori ${category.garmentType})`);
      continue;
    }
    await prisma.purchaseOrder.update({
      where: { id: order.id },
      data: { productCategoryId: category.id },
    });
    updated.push(`${order.purchaseOrderNo} | ${order.productName} -> ${category.name}`);
  }

  const missing = Object.keys(CATEGORY_BY_PURCHASE_ORDER_NO).filter(
    (no) => !purchaseOrders.some((order) => order.purchaseOrderNo === no),
  );
  for (const no of missing) skipped.push(`${no} (PO tidak ditemukan)`);

  console.log(`Backfill kategori produk PO selesai. Diubah: ${updated.length}; dilewati: ${skipped.length}.`);
  for (const line of updated) console.log(`+ ${line}`);
  for (const line of skipped) console.log(`! ${line}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Backfill kategori produk PO gagal.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
