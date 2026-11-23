import { UserFacingError } from "../actions/errors.ts";

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

export type SubmittedInvoiceItem = {
  /** Kunci produk PO; kosong = produk tambahan khusus invoice. */
  purchaseOrderItemId?: string;
  productName: string;
  description: string;
  quantity: number;
  unitPrice: string;
  discountType?: "NONE" | "NOMINAL" | "PERCENTAGE";
  discountPercent?: string;
  discountNominal?: string;
};

export type ResolvedInvoiceItem = SubmittedInvoiceItem & {
  /** Kunci sumber yang disimpan: id produk PO, "__legacy__", atau kosong untuk produk tambahan. */
  sourceKey: string;
};

/**
 * Urutan baris mengikuti kiriman form (mendukung drag-sort). Setiap produk PO wajib
 * hadir tepat satu kali; baris tanpa kunci PO dianggap produk tambahan invoice.
 */
export function resolveInvoiceProductRows(groups: InvoiceProductGroup[], submitted: SubmittedInvoiceItem[]): ResolvedInvoiceItem[] {
  const groupByKey = new Map(groups.map((group) => [group.key, group]));
  const seen = new Set<string>();
  const rows: ResolvedInvoiceItem[] = [];

  for (const item of submitted) {
    const sourceKey = (item.purchaseOrderItemId ?? "").trim();
    if (!sourceKey) {
      rows.push({ ...item, sourceKey: "" });
      continue;
    }
    const group = groupByKey.get(sourceKey);
    if (!group) throw new UserFacingError("Produk invoice tidak berasal dari PO ini.");
    if (seen.has(sourceKey)) throw new UserFacingError("Produk PO tidak boleh muncul lebih dari satu baris invoice.");
    seen.add(sourceKey);
    rows.push({ ...item, sourceKey, productName: item.productName.trim() || group.productName });
  }

  if (seen.size !== groups.length) throw new UserFacingError("Seluruh produk PO wajib ada pada invoice.");
  return rows;
}

export type InvoiceSavedRow = {
  /** Kunci produk PO sumber baris; kosong untuk produk tambahan atau dokumen lama. */
  purchaseOrderItemId?: string | null;
  productName?: string;
  description?: string;
  quantity?: number;
  unitPrice: string;
  discountType?: "NONE" | "NOMINAL" | "PERCENTAGE";
  discountPercent?: string;
  discountNominal?: string;
};

export type InvoiceFormProductRow = {
  key: string;
  sourceKey: string;
  productName: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountType: "NOMINAL" | "PERCENTAGE";
  discountPercent: string;
  discountNominal: string;
};

type InvoiceRowPricing = Pick<InvoiceFormProductRow, "unitPrice" | "discountType" | "discountPercent" | "discountNominal">;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function initNumber(value: string | undefined) {
  const text = (value ?? "").trim();
  return text === "" || text === "0" ? "" : text;
}

/** Harga/diskon awal revisi. Draft lama berbaris per ukuran dirata-ratakan agar total tidak melompat. */
function savedPricing(items: InvoiceSavedRow[]): InvoiceRowPricing {
  if (!items.length) return { unitPrice: "", discountType: "PERCENTAGE", discountPercent: "", discountNominal: "" };
  const first = items[0];
  const savedQuantity = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const savedBase = items.reduce((sum, item) => sum + (Number(item.unitPrice) || 0) * (item.quantity ?? 0), 0);
  const unitPrice = items.length === 1
    ? first.unitPrice
    : savedQuantity > 0
      ? String(round2(savedBase / savedQuantity))
      : first.unitPrice;
  const allNominal = items.every((item) => item.discountType === "NOMINAL");
  const nominalTotal = items.reduce((sum, item) => sum + (Number(item.discountNominal) || 0), 0);
  return {
    unitPrice,
    discountType: first.discountType === "NOMINAL" ? "NOMINAL" : "PERCENTAGE",
    discountPercent: first.discountType === "NOMINAL" ? "" : initNumber(first.discountPercent),
    discountNominal: allNominal ? initNumber(String(round2(nominalTotal))) : first.discountType === "NOMINAL" ? initNumber(first.discountNominal) : "",
  };
}

function normalizeProductName(value: string | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("id-ID");
}

function emptyProductRow(sourceKey: string, productName: string, quantity: number): InvoiceFormProductRow {
  return {
    key: `po:${sourceKey}`,
    sourceKey,
    productName,
    description: "",
    quantity: String(quantity),
    unitPrice: "",
    discountType: "PERCENTAGE",
    discountPercent: "",
    discountNominal: "",
  };
}

/**
 * Baris revisi mengikuti urutan tersimpan. Rujukan id produk PO dipakai lebih dulu;
 * invoice lama belum menyimpannya, jadi fallback nama lalu urutan seperti sebelumnya.
 */
export function buildInvoiceProductRows(groups: InvoiceProductGroup[], savedItems: InvoiceSavedRow[]): InvoiceFormProductRow[] {
  if (!savedItems.length) return groups.map((group) => emptyProductRow(group.key, group.productName, group.quantity));

  const groupByKey = new Map(groups.map((group) => [group.key, group]));
  const savedByGroup = new Map<string, InvoiceSavedRow[]>();
  const assignments: Array<{ item: InvoiceSavedRow; groupKey: string | null }> = [];
  // Dokumen baru menyimpan kunci sumber; baris tanpa kunci berarti produk tambahan.
  // Dokumen lama tidak punya kunci sama sekali, jadi baru boleh ditebak lewat nama/urutan.
  const hasSourceKeys = savedItems.some((item) => Boolean((item.purchaseOrderItemId ?? "").trim()));

  savedItems.forEach((item) => {
    const sourceKey = (item.purchaseOrderItemId ?? "").trim();
    if (sourceKey && groupByKey.has(sourceKey)) {
      savedByGroup.set(sourceKey, [...(savedByGroup.get(sourceKey) ?? []), item]);
      assignments.push({ item, groupKey: sourceKey });
      return;
    }
    assignments.push({ item, groupKey: null });
  });

  if (!hasSourceKeys) {
    assignments.forEach((assignment, index) => {
      if (assignment.groupKey) return;
      const item = assignment.item;
      // Data lama boleh punya beberapa baris per produk (satu baris per ukuran),
      // jadi pencocokan nama ikut menggabungkan baris ke grup yang sama.
      const byName = groups.find((group) => normalizeProductName(group.productName) === normalizeProductName(item.productName));
      const byOrder = !byName && savedItems.length === groups.length ? groups[index] : undefined;
      const group = byName ?? byOrder;
      if (!group) return;
      assignment.groupKey = group.key;
      savedByGroup.set(group.key, [...(savedByGroup.get(group.key) ?? []), item]);
    });
  }

  const emitted = new Set<string>();
  const rows: InvoiceFormProductRow[] = [];
  assignments.forEach((assignment, index) => {
    if (!assignment.groupKey) {
      const item = assignment.item;
      rows.push({
        key: `extra:${index}`,
        sourceKey: "",
        productName: item.productName ?? "",
        description: item.description ?? "",
        quantity: String(item.quantity ?? 1),
        ...savedPricing([item]),
      });
      return;
    }
    if (emitted.has(assignment.groupKey)) return;
    emitted.add(assignment.groupKey);
    const group = groupByKey.get(assignment.groupKey);
    if (!group) return;
    const saved = savedByGroup.get(assignment.groupKey) ?? [];
    const quantity = saved.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    rows.push({
      key: `po:${group.key}`,
      sourceKey: group.key,
      productName: saved[0]?.productName?.trim() || group.productName,
      description: saved[0]?.description ?? "",
      quantity: String(quantity > 0 ? quantity : group.quantity),
      ...savedPricing(saved),
    });
  });

  // Jaga-jaga: produk PO yang tidak terpetakan tetap tampil, jangan sampai hilang.
  groups.forEach((group) => {
    if (!emitted.has(group.key)) rows.push(emptyProductRow(group.key, group.productName, group.quantity));
  });
  return rows;
}
