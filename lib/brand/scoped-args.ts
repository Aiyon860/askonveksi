/**
 * Bentuk argumen Prisma setelah filter brand disisipkan.
 *
 * Modul ini sengaja murni (tanpa Prisma/brand context) supaya bisa diuji
 * langsung lewat `node --test`. `lib/brand/prisma-extension.ts` hanya
 * menyediakan nilai `scope`-nya.
 */

/**
 * Operasi dengan `WhereUniqueInput`. Prisma 7 mewajibkan minimal satu kolom
 * unik berada di level atas `where`, jadi `id` TIDAK boleh didorong ke dalam
 * `AND` — cukup tambahkan scope sebagai filter tambahan di `AND`.
 */
const UNIQUE_INPUT_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "delete",
  "upsert",
]);

/** Operasi dengan `WhereInput` biasa; scope boleh dibungkus `AND` penuh. */
const FILTER_OPERATIONS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

export type BrandField = "brand" | "brandScope";

/**
 * Normalisasi argumen query sebelum penanda brand ditambahkan.
 *
 * Prisma memanggil delegate tanpa argumen untuk query seperti `findMany()` atau
 * `count()`. Kalau `undefined` diteruskan apa adanya, penanda brand tidak ikut
 * terkirim dan query jatuh ke brand default — bukan brand yang diminta
 * `brandScopedClient`. Karena itu argumen kosong diubah menjadi objek.
 */
export function brandScopeArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) return {};
  return args as Record<string, unknown>;
}

/**
 * Terapkan scope brand ke `where` sesuai jenis operasi.
 * Mengembalikan `undefined` untuk operasi yang tidak memakai `where`.
 */
export function brandScopedWhere(
  operation: string,
  where: unknown,
  scope: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const exists = Boolean(where) && typeof where === "object" && !Array.isArray(where);
  const empty = !exists || Object.keys(where as object).length === 0;

  if (UNIQUE_INPUT_OPERATIONS.has(operation)) {
    // Tanpa kolom unik, query ini memang tidak valid; biarkan Prisma yang
    // melaporkannya agar kesalahan pemanggil tidak tersamarkan.
    if (empty) return scope;
    const current = where as Record<string, unknown>;
    const existing = current.AND;
    const andList = Array.isArray(existing) ? existing : existing === undefined ? [] : [existing];
    return { ...current, AND: [...andList, scope] };
  }

  if (FILTER_OPERATIONS.has(operation)) {
    if (empty) return scope;
    return { AND: [where, scope] };
  }

  return undefined;
}

/**
 * Setel kolom brand pada data tulis. Customer `BOTH` yang diminta eksplisit
 * dipertahankan (auto-merge antar-brand); nilai brand lain tetap dipaksa
 * mengikuti brand aktif agar tidak ada penulisan lintas-brand.
 */
export function withBrandField<T extends Record<string, unknown>>(
  data: T,
  brand: string,
  field: BrandField,
): T {
  if (field === "brandScope" && data.brandScope === "BOTH") return data;
  return { ...data, [field]: brand } as T;
}
