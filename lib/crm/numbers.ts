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

export async function nextQuotationNo(tx: TransactionClient, date = new Date()) {
  const year = date.getUTCFullYear();
  const value = await nextValue(tx, `quotation:${year}`);
  return `QT-${year}-${String(value).padStart(5, "0")}`;
}

export async function nextSalesOrderNo(tx: TransactionClient, date = new Date()) {
  const year = date.getUTCFullYear();
  const value = await nextValue(tx, `sales-order:${year}`);
  return `SALES-ORDER-${year}-${String(value).padStart(5, "0")}`;
}
