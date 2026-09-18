import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

async function nextValue(tx: TransactionClient, key: string) {
  const counter = await tx.sequenceCounter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  return counter.value;
}

export async function nextCustomerNo(tx: TransactionClient) {
  const value = await nextValue(tx, "customer");
  return `CUS-${String(value).padStart(6, "0")}`;
}

export async function nextOpportunityNo(tx: TransactionClient) {
  const value = await nextValue(tx, "opportunity");
  return `OPP-${String(value).padStart(6, "0")}`;
}

export async function nextInvoiceNo(tx: TransactionClient, date = new Date()) {
  const year = date.getUTCFullYear();
  const value = await nextValue(tx, `invoice:${year}`);
  return `INV-${year}-${String(value).padStart(5, "0")}`;
}

function jakartaDateCode(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "2-digit" }).formatToParts(date);
  return ["day", "month", "year"].map((type) => parts.find((part) => part.type === type)?.value).join("");
}

export function purchaseOrderCustomerCodeBase(name: string) {
  const words = (name.match(/[\p{L}\p{N}]+/gu) ?? []).map((word) => word.toLocaleUpperCase("id-ID"));
  while (["PT", "CV", "UD", "TOKO", "BAPAK", "IBU"].includes(words[0] ?? "")) words.shift();
  if (words.length === 1) return words[0].slice(0, 3) || "CUS";
  if (words.length === 2) return `${words[0].slice(0, 2)}${words[1].slice(0, 1)}` || "CUS";
  if (words.length >= 3) return words.slice(0, 3).map((word) => word[0]).join("") || "CUS";
  return "CUS";
}

export function formatPurchaseOrderNo(customerCode: string, ordinal: number, date = new Date()) {
  return `PO-${customerCode}${jakartaDateCode(date)}-${ordinal}`;
}

export function formatPurchaseOrderRevisionNo(purchaseOrderNo: string, revision: number) {
  return `${purchaseOrderNo.replace(/-R\d+$/, "")}-R${revision}`;
}

async function purchaseOrderCustomerCode(tx: TransactionClient, customer: { id: string; name: string; poCustomerCode: string | null }) {
  if (customer.poCustomerCode) return customer.poCustomerCode;
  const base = purchaseOrderCustomerCodeBase(customer.name);
  for (let suffix = 0; ; suffix += 1) {
    const code = `${base}${suffix || ""}`;
    const used = await tx.customer.findUnique({ where: { poCustomerCode: code }, select: { id: true } });
    if (!used || used.id === customer.id) {
      await tx.customer.update({ where: { id: customer.id }, data: { poCustomerCode: code } });
      return code;
    }
  }
}

export async function nextPurchaseOrderNo(tx: TransactionClient, customer: { id: string; name: string; poCustomerCode: string | null }, date = new Date()) {
  const code = await purchaseOrderCustomerCode(tx, customer);
  const key = `purchase-order:${customer.id}`;
  const existingOrderCount = await tx.purchaseOrder.count({
    where: { opportunity: { customerId: customer.id }, revision: 1 },
  });
  const counter = await tx.sequenceCounter.upsert({
    where: { key },
    create: { key, value: existingOrderCount + 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  const value = counter.value;
  return formatPurchaseOrderNo(code, value, date);
}

export async function nextSalesOrderNo(tx: TransactionClient, date = new Date()) {
  const year = date.getUTCFullYear();
  const value = await nextValue(tx, `sales-order:${year}`);
  return `SALES-ORDER-${year}-${String(value).padStart(5, "0")}`;
}

export async function nextWorkOrderNo(tx: TransactionClient, date = new Date()) {
  const year = date.getUTCFullYear();
  const value = await nextValue(tx, `work-order:${year}`);
  return `WO-${year}-${String(value).padStart(5, "0")}`;
}
