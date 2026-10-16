import type { PDFFont } from "pdf-lib";

/**
 * Ukuran minimum seluruh teks pada dokumen cetak (PO, invoice, kwitansi).
 * 16 px di layar = 12 pt, karena 1 pt = 1,333 px pada 96 dpi. Dipakai bersama
 * supaya dokumen tetap terbaca dan tidak ada lagi teks 7–9 pt yang lolos.
 */
export const PRINT_MIN_FONT_PX = 16;
export const MIN_FONT_SIZE = (PRINT_MIN_FONT_PX * 3) / 4;

/** Bungkus teks ke beberapa baris sesuai lebar kolom (teks sudah disanitasi pemanggil). */
export function wrapPdfText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** Potong teks satu baris bila melebihi lebar kolom, dengan penanda tiga titik. */
export function clipPdfText(value: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let clipped = value;
  while (clipped.length > 1 && font.widthOfTextAtSize(`${clipped}...`, size) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}...`;
}
