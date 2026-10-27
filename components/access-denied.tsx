import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { landingPathForRole } from "@/lib/auth/landing-path";
import { isAttendanceOnly } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";

/**
 * Isi halaman 403. Dipakai `app/forbidden.tsx` (di luar shell) dan
 * `app/(app)/forbidden.tsx` (di dalam shell) supaya pesan dan tombol kembali
 * selalu sesuai role yang ditolak.
 */
export async function accessDeniedContent() {
  const actor = await getCurrentActor();
  const attendanceOnly = actor ? isAttendanceOnly(actor.role) : false;
  const homePath = actor ? landingPathForRole(actor.role) : "/login";
  const homeLabel = !actor ? "Masuk" : attendanceOnly ? "Buka Absen" : "Buka Dashboard";

  const description = !actor
    ? "Sesi Anda sudah berakhir. Masuk kembali untuk melanjutkan."
    : attendanceOnly
      ? "Akun Anda hanya memiliki akses ke halaman Absen. Halaman lain tidak dapat dibuka."
      : "Role akun Anda tidak memiliki izin membuka halaman ini. Hubungi Owner bila akses memang dibutuhkan.";

  return { homePath, homeLabel, description };
}

export function AccessDeniedPanel({ description, homePath, homeLabel }: {
  description: string;
  homePath: string;
  homeLabel: string;
}) {
  return (
    <Empty className="min-h-80 border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon"><ShieldAlert aria-hidden="true" /></EmptyMedia>
        <EmptyTitle>Akses ditolak</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link href={homePath} />} nativeButton={false} className="h-11 sm:h-9">
          {homeLabel}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
