/**
 * Daftar halaman yang masih ikut auto-refresh 15 detik dari `<AutoRefresh />`.
 *
 * Prinsip: hanya halaman monitoring/read-only yang boleh di-refresh otomatis.
 * Halaman yang punya form, dialog input, checkbox pilihan, atau editor sengaja
 * TIDAK didaftarkan, karena `router.refresh()` bisa mengembalikan isian form ke
 * nilai awal dan menghapus pilihan checkbox yang sedang dibuat user.
 *
 * Secara default halaman baru TIDAK ikut auto-refresh. Daftarkan path di sini
 * hanya kalau halaman tersebut benar-benar tidak punya input yang bisa hilang
 * saat refresh (mis. dashboard angka, laporan baca-saja, board status).
 *
 * Pengecualian yang disengaja (jangan ditambahkan):
 * - seluruh grup menu WhatsApp (`/whatsapp`, `/whatsapp/jobs`)
 * - seluruh master data (`/master-data/*`)
 * - halaman transaksi yang punya form/checkbox (`/crm/*`, `/customers/*`,
 *   `/keuangan/pemasukan`, `/keuangan/pengeluaran`, `/campaigns`, `/settings`,
 *   `/absensi*`, `/admin/users`, detail dokumen, dan sejenisnya)
 */
export const AUTO_REFRESH_ROUTES = [
  "/dashboard",
  "/analytics",
  "/analytics/lead-sources",
  "/produksi",
  "/keuangan",
  "/log-aktivitas",
] as const;

const AUTO_REFRESH_ROUTE_SET: ReadonlySet<string> = new Set(AUTO_REFRESH_ROUTES);

/** Samakan trailing slash supaya `/dashboard/` tetap dianggap `/dashboard`. */
function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

/**
 * Apakah halaman ini boleh ikut auto-refresh berkala.
 *
 * Pencocokan bersifat exact (bukan prefix) supaya halaman turunan seperti
 * `/produksi/[id]` atau `/keuangan/pengeluaran` tidak ikut ter-refresh hanya
 * karena parent-nya terdaftar.
 */
export function isAutoRefreshRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return AUTO_REFRESH_ROUTE_SET.has(normalizePathname(pathname));
}
