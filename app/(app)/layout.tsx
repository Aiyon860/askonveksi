import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { landingPathForRole } from "@/lib/auth/landing-path";
import { canAccessPath } from "@/lib/auth/page-access";
import { isAttendanceOnly } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");

  // Satu pintu akses untuk semua halaman area aplikasi: path dari middleware,
  // aturan role dari matriks terpusat. Pelanggaran dirender sebagai 403.
  const pathname = (await headers()).get("x-pathname");
  if (!canAccessPath(actor.role, pathname)) {
    // Desainer dan Admin Saga memang hanya punya halaman Absen. Mengantar mereka
    // ke sana lebih baik daripada menampilkan 403 di halaman yang tidak pernah
    // boleh mereka buka — mis. saat bookmark lama masih menunjuk /dashboard.
    if (isAttendanceOnly(actor.role)) redirect(landingPathForRole(actor.role));
    forbidden();
  }

  return <AppShell actor={actor}>{children}</AppShell>;
}
