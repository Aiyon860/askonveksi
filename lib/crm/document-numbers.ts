/**
 * Penomoran dokumen yang murni (tanpa Prisma/brand context) supaya bisa diuji
 * langsung lewat `node --test`. Aplikasi memanggilnya dari `lib/crm/numbers.ts`,
 * yang menambahkan brand aktif dan counter database.
 */

/** Kode brand untuk nomor dokumen: AS (Askonveksi) atau SG (SAGA). */
export type DocumentBrandCode = "AS" | "SG";

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

/**
 * Kode PO mengikuti brand: PO-AS-..., PO-SG-...
 * Kode pelanggan tetap satu per customer (dipakai lintas brand dengan prefix
 * brand yang berbeda), sehingga customer `BOTH` tidak punya dua identitas.
 */
export function formatPurchaseOrderNo(customerCode: string, ordinal: number, date = new Date(), brand: DocumentBrandCode = "AS") {
  return `PO-${brand}-${customerCode}${jakartaDateCode(date)}-${ordinal}`;
}

export function formatPurchaseOrderRevisionNo(purchaseOrderNo: string, revision: number) {
  return `${purchaseOrderNo.replace(/-R\d+$/, "")}-R${revision}`;
}
