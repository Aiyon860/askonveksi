import type { Prisma } from "@prisma/client";

import { brandCode, DEFAULT_BRAND, type Brand } from "@/lib/brand/config";
import { getBrandContext } from "@/lib/brand/context";
import { allBrands } from "@/lib/brand/prisma-extension";
import { resolveRequestBrand } from "@/lib/brand/request-brand";
import {
  formatPurchaseOrderRevisionNo,
  formatPurchaseOrderNo as formatPurchaseOrderNoWithBrand,
  purchaseOrderCustomerCodeBase,
} from "@/lib/crm/document-numbers";

export { formatPurchaseOrderRevisionNo, purchaseOrderCustomerCodeBase };

type TransactionClient = Prisma.TransactionClient;

function contextBrand(): Brand {
  const context = getBrandContext();
  return context && context !== "ALL" ? context : DEFAULT_BRAND;
}

function counterKey(brand: Brand, key: string) {
  return `${brand}:${key}`;
}

async function nextValue(tx: TransactionClient, brand: Brand, key: string) {
  const counter = await tx.sequenceCounter.upsert({
    where: { key: counterKey(brand, key) },
    create: { key: counterKey(brand, key), value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  return counter.value;
}

export async function nextCustomerNo(tx: TransactionClient, brandOverride?: Brand) {
  const brand = brandOverride ?? await resolveRequestBrand();
  const value = await nextValue(tx, brand, "customer");
  return `CUS-${brandCode(brand)}-${String(value).padStart(6, "0")}`;
}

export async function nextOpportunityNo(tx: TransactionClient, brandOverride?: Brand) {
  const brand = brandOverride ?? await resolveRequestBrand();
  const value = await nextValue(tx, brand, "opportunity");
  return `OPP-${brandCode(brand)}-${String(value).padStart(6, "0")}`;
}

export async function nextInvoiceNo(tx: TransactionClient, date = new Date()) {
  const brand = await resolveRequestBrand();
  const year = date.getUTCFullYear();
  const value = await nextValue(tx, brand, `invoice:${year}`);
  return `INV-${brandCode(brand)}-${year}-${String(value).padStart(5, "0")}`;
}

/**
 * Kode PO mengikuti brand: PO-AS-..., PO-SG-...
 * Kode pelanggan tetap satu per customer (dipakai lintas brand dengan prefix
 * brand yang berbeda), sehingga customer `BOTH` tidak punya dua identitas.
 */
export function formatPurchaseOrderNo(customerCode: string, ordinal: number, date = new Date(), brand: Brand = contextBrand()) {
  return formatPurchaseOrderNoWithBrand(customerCode, ordinal, date, brandCode(brand));
}

async function purchaseOrderCustomerCode(tx: TransactionClient, customer: { id: string; name: string; poCustomerCode: string | null }) {
  if (customer.poCustomerCode) return customer.poCustomerCode;
  const base = purchaseOrderCustomerCodeBase(customer.name);
  for (let suffix = 0; ; suffix += 1) {
    const code = `${base}${suffix || ""}`;
    // Kode pelanggan unik lintas brand, jadi pencarian bentrok harus unscoped.
    const used = await tx.customer.findUnique(allBrands({ where: { poCustomerCode: code }, select: { id: true } }));
    if (!used || used.id === customer.id) {
      await tx.customer.update({ where: { id: customer.id }, data: { poCustomerCode: code } });
      return code;
    }
  }
}

export async function nextPurchaseOrderNo(tx: TransactionClient, customer: { id: string; name: string; poCustomerCode: string | null }, date = new Date()) {
  const brand = await resolveRequestBrand();
  const code = await purchaseOrderCustomerCode(tx, customer);
  const key = `purchase-order:${customer.id}`;
  const existingOrderCount = await tx.purchaseOrder.count({
    where: { opportunity: { customerId: customer.id }, revision: 1 },
  });
  const counter = await tx.sequenceCounter.upsert({
    where: { key: counterKey(brand, key) },
    create: { key: counterKey(brand, key), value: existingOrderCount + 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  const value = counter.value;
  return formatPurchaseOrderNo(code, value, date, brand);
}

export async function nextSalesOrderNo(tx: TransactionClient, date = new Date()) {
  const brand = await resolveRequestBrand();
  const year = date.getUTCFullYear();
  const value = await nextValue(tx, brand, `sales-order:${year}`);
  return `SO-${brandCode(brand)}-${year}-${String(value).padStart(5, "0")}`;
}

export async function nextWorkOrderNo(tx: TransactionClient, date = new Date()) {
  const brand = await resolveRequestBrand();
  const year = date.getUTCFullYear();
  const value = await nextValue(tx, brand, `work-order:${year}`);
  return `WO-${brandCode(brand)}-${year}-${String(value).padStart(5, "0")}`;
}
