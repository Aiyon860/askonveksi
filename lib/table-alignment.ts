import { cn } from "@/lib/utils";

type NumericLike = number | string | { toString(): string } | null | undefined;

/**
 * Nilai kolom angka dianggap kosong bila null/undefined, string kosong, tanda
 * strip ("-"), atau nol. Nilai seperti itu ditampilkan di tengah kolom; angka
 * nyata (mis. 10.000) tetap mengikuti perataan aslinya.
 */
export function isZeroOrEmptyNumeric(value: NumericLike) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "-" || trimmed === "–") return true;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric === 0 : false;
}

/** Kelas sel kolom angka: `base` dipertahankan, nilai kosong/nol di tengah. */
export function numericCellClass(value: NumericLike, base = "text-right") {
  return cn(base, isZeroOrEmptyNumeric(value) ? "text-center" : undefined);
}
