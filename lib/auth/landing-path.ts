import type { AppRole } from "@prisma/client";

/**
 * Halaman pertama yang wajar untuk sebuah role setelah login.
 *
 * Modul ini sengaja murni (tanpa `server-only`, tanpa alias `@/`) supaya bisa
 * diuji langsung. Semua titik masuk — login, ganti password, halaman login yang
 * sudah punya sesi, dan guard layout — wajib memakai fungsi ini agar tidak ada
 * role yang dikirim ke halaman yang justru menolaknya (403).
 *
 * Desainer dan Admin Saga hanya bertugas absen, jadi tidak pernah dikirim ke
 * dashboard. Admin PO langsung ke produksi sesuai alur kerjanya.
 */
export function landingPathForRole(role: AppRole): string {
  if (role === "DESIGNER" || role === "ADMIN_SAGA") return "/absensi";
  if (role === "ADMIN_PO") return "/produksi";
  return "/dashboard";
}
