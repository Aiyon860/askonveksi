/**
 * Helper murni untuk input nominal rupiah: format ribuan id-ID tanpa desimal.
 * Dipakai `components/money-input.tsx`; batas 16 digit menyamai regex parser server
 * (`moneyValueSchema` / `unitPrice` di `lib/crm/validation.ts`).
 */
export const MONEY_INPUT_MAX_DIGITS = 16;

/** Ambil hanya digit, buang leading zero, lalu batasi 16 digit. Contoh: "Rp 1.000" → "1000". */
export function parseRupiahInput(text: string): string {
  const digits = text.replace(/\D+/g, "");
  const withoutLeadingZeros = digits.replace(/^0+(?=\d)/, "");
  return withoutLeadingZeros.slice(0, MONEY_INPUT_MAX_DIGITS);
}

/** Format digit menjadi ribuan id-ID tanpa prefiks "Rp" (addon yang menampilkan Rp). */
export function formatRupiahInput(value: string): string {
  return parseRupiahInput(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function countDigits(text: string): number {
  return (text.match(/\d/g) ?? []).length;
}

/** Hapus satu digit pada indeks mentah (dipakai saat backspace mengenai pemisah "."). */
export function removeDigitAt(raw: string, index: number): string {
  if (index < 0 || index >= raw.length) return raw;
  return parseRupiahInput(raw.slice(0, index) + raw.slice(index + 1));
}

/** Posisi caret setelah sejumlah digit pertama pada teks berformat. */
export function caretForDigits(display: string, digits: number): number {
  if (digits <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < display.length; index += 1) {
    const character = display[index];
    if (character < "0" || character > "9") continue;
    seen += 1;
    if (seen === digits) return index + 1;
  }
  return display.length;
}
