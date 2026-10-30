/**
 * Verifikasi: setiap produk yang tampil di tabel Project harus punya baris HPP
 * (costId tidak null). Meniru mapIncome/getIncomeOrders persis.
 */
import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { buildProjectProducts, normalizeProductKey } from "../lib/finance/project-products.ts";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const where = {
  status: "ACTIVE",
  invoice: { status: "ISSUED" },
  payment: { is: { transactions: { some: { status: "ACTIVE" } } } },
};

const orders = await prisma.salesOrder.findMany({
  where,
  select: {
    id: true, invoiceNo: true,
    purchaseOrder: { select: { productName: true, garmentType: true, productCategory: { select: { name: true } } } },
    invoice: { select: { items: { select: { productName: true, quantity: true, position: true }, orderBy: { position: "asc" } } } },
    productCosts: { select: { id: true, productName: true, version: true, kain: true, zipper: true, jahit: true, pres: true, dtfPlastisol: true, bordir: true, lainnya: true }, orderBy: { position: "asc" } },
  },
  orderBy: [{ acceptedAt: "desc" }, { id: "asc" }],
});

let products = 0;
const missing = [];
for (const order of orders) {
  const rows = buildProjectProducts({
    invoiceItems: order.invoice.items,
    purchaseOrderItems: [],
    productCosts: order.productCosts,
    fallbackProductName: order.purchaseOrder.productName,
    fallbackGarmentType: order.purchaseOrder.productCategory?.name ?? order.purchaseOrder.garmentType ?? "-",
  });
  for (const product of rows) {
    products += 1;
    if (!product.costId) missing.push({ invoiceNo: order.invoiceNo, product: product.productName, keys: order.productCosts.map((c) => c.productName) });
  }
}

// Dokumen unik: nama HPP per order tidak boleh duplikat (constraint unique).
const dupes = [];
for (const order of orders) {
  const seen = new Set();
  for (const cost of order.productCosts) {
    const key = normalizeProductKey(cost.productName);
    if (seen.has(key)) dupes.push({ invoiceNo: order.invoiceNo, product: cost.productName });
    seen.add(key);
  }
}

console.log(`Order tampil           : ${orders.length}`);
console.log(`Produk tampil          : ${products}`);
console.log(`Produk tanpa baris HPP : ${missing.length}`);
console.log(`Nama HPP duplikat      : ${dupes.length}`);
if (missing.length) console.log(missing.slice(0, 15));
if (dupes.length) console.log(dupes.slice(0, 15));

await prisma.$disconnect();
process.exitCode = missing.length || dupes.length ? 1 : 0;
