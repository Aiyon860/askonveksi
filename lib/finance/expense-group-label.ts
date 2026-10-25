import { formatDateLong } from "../crm/format.ts";

/**
 * Label satu grup pengeluaran pada laporan keuangan.
 *
 * Contoh: `expenseGroupLabel("2026-10-01")` → "Pengeluaran tanggal 1 Oktober 2026".
 *
 * Modul ini murni (tanpa `server-only` dan tanpa alias `@/`) supaya halaman,
 * export Excel, export dataset, dan test memakai teks yang sama persis.
 * Tanggal dihitung sebagai awal hari UTC lalu diformat di zona Asia/Jakarta,
 * jadi tanggal tidak pernah bergeser satu hari.
 */
export function expenseGroupLabel(dateKey: string) {
  return `Pengeluaran tanggal ${formatDateLong(`${dateKey}T00:00:00.000Z`)}`;
}
