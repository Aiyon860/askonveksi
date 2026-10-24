export type InvoiceProductGroup = {
  /** Kunci stabil untuk input form: id produk PO, atau penanda data lama tanpa itemId. */
  key: string;
  purchaseOrderItemId: string;
  productName: string;
  quantity: number;
  isAccessory: boolean;
};

type PurchaseOrderForGrouping = {
  productName: string;
  garmentType?: "JERSEY" | "NON_JERSEY" | "AKSESORI" | null;
  items?: Array<{ id: string; name: string; garmentType?: "JERSEY" | "NON_JERSEY" | "AKSESORI" | null }>;
  sizes: Array<{ itemId?: string; quantity: number }>;
};

/**
 * Invoice hanya memakai satu baris per produk PO. Semua ukuran dan lengan
 * (Pendek/Panjang) dijumlahkan; identitas ukuran tidak dibawa ke invoice.
 */
export function groupPurchaseOrderInvoiceItems(purchaseOrder: PurchaseOrderForGrouping): InvoiceProductGroup[] {
  const itemById = new Map((purchaseOrder.items ?? []).map((item) => [item.id, item]));
  const groups = new Map<string, InvoiceProductGroup>();

  for (const size of purchaseOrder.sizes) {
    const purchaseOrderItemId = size.itemId ?? "";
    const key = purchaseOrderItemId || "__legacy__";
    const item = purchaseOrderItemId ? itemById.get(purchaseOrderItemId) : undefined;
    const current = groups.get(key);
    if (current) {
      current.quantity += size.quantity;
      continue;
    }
    groups.set(key, {
      key,
      purchaseOrderItemId,
      productName: item?.name ?? purchaseOrder.productName,
      quantity: size.quantity,
      isAccessory: (item?.garmentType ?? purchaseOrder.garmentType) === "AKSESORI",
    });
  }

  return Array.from(groups.values()).filter((group) => group.quantity > 0);
}
