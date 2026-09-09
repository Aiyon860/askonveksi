"use server";

import { getInvoiceDetail, getPurchaseOrderDetail, getSalesOrderDocumentDetail } from "@/lib/crm/data";

export async function purchaseOrderDetailAction(id: string) {
  return getPurchaseOrderDetail(id);
}

export async function invoiceDetailAction(id: string) {
  return getInvoiceDetail(id);
}

export async function salesOrderDetailAction(id: string) {
  return getSalesOrderDocumentDetail(id);
}
