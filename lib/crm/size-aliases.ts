/**
 * Alias penulisan ukuran yang lazim dipakai customer/penjahit → nama baku.
 * Dipakai bersama oleh impor roster, pratinjau Excel, dan PDF PO agar "XXL"
 * dan "2XL" diperlakukan sebagai ukuran yang sama.
 */
const SIZE_ALIASES: Record<string, string> = {
  XXL: "2XL",
  XXXL: "3XL",
  "3X": "3XL",
  XXXXL: "4XL",
  XXXXXL: "5XL",
};

/** Trim, rapikan spasi, huruf besar, lalu petakan ke nama baku. */
export function normalizeGarmentSizeName(name: string) {
  const upper = name.trim().toLocaleUpperCase("id-ID").replace(/\s+/g, " ");
  return SIZE_ALIASES[upper] ?? upper;
}

/**
 * Cari ukuran master dari nama bebas. Nama asli dicoba lebih dulu supaya master
 * yang memang bernama "XXL" tetap cocok, lalu bentuk alias bakunya ("2XL").
 * `byName` harus memakai kunci huruf kecil.
 */
export function findGarmentSizeByName<T>(byName: ReadonlyMap<string, T>, name: string): T | undefined {
  const lower = name.trim().toLocaleLowerCase("id-ID");
  return byName.get(lower) ?? byName.get(normalizeGarmentSizeName(name).toLocaleLowerCase("id-ID"));
}
