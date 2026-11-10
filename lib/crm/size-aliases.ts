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

/** Urutan huruf tetap sebelum tangga N-XL. */
const LETTER_SIZE_RANK: Record<string, number> = {
  XS: 10,
  S: 20,
  M: 30,
  L: 40,
  XL: 50,
};

/** Trim, rapikan spasi, huruf besar, lalu petakan ke nama baku. */
export function normalizeGarmentSizeName(name: string) {
  const upper = name.trim().toLocaleUpperCase("id-ID").replace(/\s+/g, " ");
  return SIZE_ALIASES[upper] ?? upper;
}

/**
 * Kunci urutan: XS…XL, lalu 2XL…N XL (numerik), nama lain, REQ paling akhir.
 * Dipakai master ukuran, matriks PO, dan kolom size chart PDF.
 */
export function garmentSizeSortKey(name: string) {
  const normalized = normalizeGarmentSizeName(name);
  if (normalized === "REQ") return 1_000_000;
  const letterRank = LETTER_SIZE_RANK[normalized];
  if (letterRank != null) return letterRank;
  const xlMatch = /^(\d+)XL$/.exec(normalized);
  if (xlMatch) return 50 + Number(xlMatch[1]);
  return 900_000;
}

export function compareGarmentSizeNames(left: string, right: string) {
  const keyDelta = garmentSizeSortKey(left) - garmentSizeSortKey(right);
  if (keyDelta !== 0) return keyDelta;
  return normalizeGarmentSizeName(left).localeCompare(normalizeGarmentSizeName(right), "id-ID", { numeric: true });
}

export function sortGarmentSizeNames(names: Iterable<string>) {
  return [...names].sort(compareGarmentSizeNames);
}

export function sortGarmentSizeRows<T extends { name: string }>(rows: T[]) {
  return [...rows].sort((left, right) => compareGarmentSizeNames(left.name, right.name));
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
