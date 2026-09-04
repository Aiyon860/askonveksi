"use server";

import { getInvoiceDetail, getPurchaseOrderDetail } from "@/lib/crm/data";

export async function purchaseOrderDetailAction(id: string) {
  return getPurchaseOrderDetail(id);
}

export async function invoiceDetailAction(id: string) {
  return getInvoiceDetail(id);
}
