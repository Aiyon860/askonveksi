/**
 * Logika HPP per produk untuk script non-TypeScript (impor historis + backfill).
 * Harus sejalan dengan lib/finance/project-products.ts: nama produk memakai
 * nama item invoice → nama produk PO → "Produk", karena tabel Project mencocokkan
 * baris HPP ke produk berdasarkan nama yang dinormalisasi.
 */

export const HPP_KEYS = ["kain", "zipper", "jahit", "pres", "dtfPlastisol", "bordir", "lainnya"];

export function normalizeProductKey(value) {
  return (value ?? "").trim().toLocaleLowerCase("id-ID");
}

export function productCostProductName(value, fallbackProductName) {
  return (value ?? "").trim() || (fallbackProductName ?? "").trim() || "Produk";
}

/** Satu baris HPP per nama produk, urut posisi seperti tabel Project. */
export function productCostSeedRows(items, fallbackProductName) {
  const rows = new Map();
  for (const item of items ?? []) {
    const productName = productCostProductName(item?.productName, fallbackProductName);
    const key = normalizeProductKey(productName);
    if (!rows.has(key)) rows.set(key, { productName, position: item?.position ?? 0 });
  }
  // Invoice tanpa item tetap perlu satu baris HPP agar Edit HPP tidak hilang.
  if (!rows.size) {
    const productName = productCostProductName(null, fallbackProductName);
    rows.set(normalizeProductKey(productName), { productName, position: 0 });
  }
  return [...rows.values()];
}

/**
 * Nilai HPP agregat level order yang ditempatkan pada baris produk pertama.
 * Jenis bernilai 0 tidak ditulis supaya kolom lain tetap null seperti perilaku UI.
 */
export function hppValues(buckets) {
  return Object.fromEntries(
    HPP_KEYS.filter((key) => Number(buckets?.[key] ?? 0) > 0).map((key) => [key, String(buckets[key])]),
  );
}
