export type StringValue = { toString(): string };

export type InvoiceProductInput = {
  productName: string | null;
  quantity: number;
  position: number;
};

export type PurchaseOrderProductInput = {
  name: string;
  position: number;
  garmentType: string | null;
  productCategory: { name: string } | null;
};

export type ProductCostInput = {
  id: string;
  productName: string;
  version: number;
  kain: StringValue | null;
  zipper: StringValue | null;
  jahit: StringValue | null;
  pres: StringValue | null;
  dtfPlastisol: StringValue | null;
  bordir: StringValue | null;
  lainnya: StringValue | null;
};

export type ProjectProduct = {
  key: string;
  productName: string;
  label: string;
  quantity: number;
  costId: string | null;
  costVersion: number | null;
  kain: string | null;
  zipper: string | null;
  jahit: string | null;
  pres: string | null;
  dtfPlastisol: string | null;
  bordir: string | null;
  lainnya: string | null;
};

export function normalizeProductKey(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("id-ID");
}

/**
 * Satu produk = satu baris Project. Invoice lama bisa punya beberapa baris
 * untuk produk yang sama (per ukuran), jadi qty dan barisnya digabung.
 */
export function buildProjectProducts({
  invoiceItems,
  purchaseOrderItems,
  productCosts,
  fallbackProductName,
  fallbackGarmentType,
}: {
  invoiceItems: InvoiceProductInput[];
  purchaseOrderItems: PurchaseOrderProductInput[];
  productCosts: ProductCostInput[];
  fallbackProductName: string;
  fallbackGarmentType: string;
}): ProjectProduct[] {
  const fallbackName = fallbackProductName.trim() || "Produk";
  const fallbackLabel = fallbackGarmentType.trim() || fallbackName;
  const poByKey = new Map<string, PurchaseOrderProductInput>();
  for (const item of purchaseOrderItems) {
    const key = normalizeProductKey(item.name);
    if (key && !poByKey.has(key)) poByKey.set(key, item);
  }
  const costByKey = new Map<string, ProductCostInput>();
  for (const cost of productCosts) {
    const key = normalizeProductKey(cost.productName);
    if (key && !costByKey.has(key)) costByKey.set(key, cost);
  }

  const grouped = new Map<string, { productName: string; quantity: number; position: number }>();
  for (const item of invoiceItems) {
    const productName = item.productName?.trim() || fallbackName;
    const key = normalizeProductKey(productName);
    const current = grouped.get(key);
    if (current) {
      current.quantity += item.quantity;
      current.position = Math.min(current.position, item.position);
    } else {
      grouped.set(key, { productName, quantity: item.quantity, position: item.position });
    }
  }
  if (!grouped.size) {
    grouped.set(normalizeProductKey(fallbackName), { productName: fallbackName, quantity: 0, position: 0 });
  }

  return [...grouped.entries()]
    .map(([key, group]) => {
      const poItem = poByKey.get(key);
      const cost = costByKey.get(key);
      const label = poItem?.productCategory?.name?.trim() || poItem?.garmentType || (poItem ? group.productName : fallbackLabel);
      return {
        key,
        productName: group.productName,
        label,
        quantity: group.quantity,
        costId: cost?.id ?? null,
        costVersion: cost?.version ?? null,
        kain: cost?.kain?.toString() ?? null,
        zipper: cost?.zipper?.toString() ?? null,
        jahit: cost?.jahit?.toString() ?? null,
        pres: cost?.pres?.toString() ?? null,
        dtfPlastisol: cost?.dtfPlastisol?.toString() ?? null,
        bordir: cost?.bordir?.toString() ?? null,
        lainnya: cost?.lainnya?.toString() ?? null,
      };
    })
    .sort((a, b) => {
      const positionA = grouped.get(a.key)?.position ?? 0;
      const positionB = grouped.get(b.key)?.position ?? 0;
      return positionA - positionB || a.productName.localeCompare(b.productName, "id-ID");
    });
}

export function productCostSeeds(items: Array<{ position: number; productName: string | null }>) {
  const rows = new Map<string, { productName: string; position: number }>();
  for (const item of items) {
    const productName = item.productName?.trim() || "Produk";
    const key = normalizeProductKey(productName);
    if (!rows.has(key)) rows.set(key, { productName, position: item.position });
  }
  // Invoice tanpa item tetap perlu satu baris HPP agar Edit HPP tidak hilang.
  if (!rows.size) rows.set("produk", { productName: "Produk", position: 0 });
  return [...rows.values()];
}
