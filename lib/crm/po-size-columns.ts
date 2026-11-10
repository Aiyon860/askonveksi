import { compareGarmentSizeNames, normalizeGarmentSizeName } from "./size-aliases.ts";

/**
 * Jumlah kolom ukuran pada matriks PO: 7 kolom tetap dari Data Master + 1 kolom yang
 * namanya boleh diganti admin (ukuran barunya otomatis dibuat di master).
 * Kolom `REQ` selalu ikut di kanan sendiri, tidak terhitung dalam batas ini.
 */
export const PO_SIZE_COLUMN_COUNT = 8;

type SizeRef = { id: string; name: string };

function isRequestSize(size: SizeRef) {
  return normalizeGarmentSizeName(size.name) === "REQ";
}

/** Ukuran yang ikut jatah kolom tetap + kolom ubahan (REQ dipisah, selalu paling kanan). */
function columnCandidates<T extends SizeRef>(options: T[]) {
  return options.filter((size) => !isRequestSize(size));
}

/** Id ukuran yang sudah punya jumlah di matriks (`lengan:id`; data impor lama bisa berisi nama). */
function matrixSizeIds(matrix: Record<string, number>) {
  return new Set(Object.keys(matrix).map((key) => key.slice(key.indexOf(":") + 1)));
}

/**
 * Kolom ukuran satu produk: 7 ukuran master pertama, kolom ke-8 pilihan admin, ukuran lain
 * yang sudah dipakai PO lama, lalu `REQ` paling kanan — supaya jumlah lama tidak hilang saat revisi.
 */
export function poSizeColumns<T extends SizeRef>(options: T[], custom: T | null, matrix: Record<string, number>) {
  const base = columnCandidates(options);
  const fixed = base.slice(0, PO_SIZE_COLUMN_COUNT - 1);
  const taken = new Set<string>([...fixed.map((size) => size.id), ...(custom ? [custom.id] : [])]);
  const used = matrixSizeIds(matrix);
  const legacy = base.filter((size) => !taken.has(size.id) && used.has(size.id));
  const columns = [...fixed, ...(custom ? [custom] : []), ...legacy].sort((left, right) => compareGarmentSizeNames(left.name, right.name));
  const request = options.find(isRequestSize);
  return request ? [...columns.filter((size) => size.id !== request.id), request] : columns;
}

/** Kolom ke-8 untuk PO baru: ukuran master kedelapan (di luar REQ). */
export function defaultPoCustomSize<T extends SizeRef>(options: T[]) {
  return columnCandidates(options)[PO_SIZE_COLUMN_COUNT - 1] ?? null;
}

/** Kolom ke-8 saat membuka PO lama: ukuran pertama di luar 7 kolom tetap yang sudah dipakai. */
export function savedPoCustomSize<T extends SizeRef>(options: T[], matrix: Record<string, number>) {
  const base = columnCandidates(options);
  const used = matrixSizeIds(matrix);
  const fixed = new Set(base.slice(0, PO_SIZE_COLUMN_COUNT - 1).map((size) => size.id));
  return base.find((size) => !fixed.has(size.id) && used.has(size.id)) ?? defaultPoCustomSize(options);
}

/** Pindahkan jumlah kolom ke-8 saat namanya diganti; jumlah tidak pernah hilang. */
export function remapPoSizeColumn(matrix: Record<string, number>, fromId: string, toId: string) {
  const next: Record<string, number> = { ...matrix };
  for (const sleeveLength of ["PENDEK", "PANJANG"]) {
    const from = `${sleeveLength}:${fromId}`;
    const to = `${sleeveLength}:${toId}`;
    const quantity = fromId ? next[from] ?? 0 : 0;
    if (fromId) delete next[from];
    next[to] = (next[to] ?? 0) + quantity;
  }
  return next;
}
