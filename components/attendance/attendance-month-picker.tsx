"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatAttendanceMonth, shiftMonthKey } from "@/lib/attendance/time";

export function AttendanceMonthPicker({
  month,
  minMonth,
  maxMonth,
}: {
  month: string;
  minMonth: string;
  maxMonth: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(nextMonth: string) {
    if (!nextMonth || nextMonth > maxMonth || nextMonth < minMonth) return;
    startTransition(() => router.push(`/absensi?bulan=${nextMonth}`));
  }

  const previous = shiftMonthKey(month, -1);
  const next = shiftMonthKey(month, 1);
  const canGoPrevious = Boolean(previous) && previous >= minMonth;
  const canGoNext = Boolean(next) && next <= maxMonth;

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto" aria-busy={pending}>
      {canGoPrevious ? (
        <Button
          variant="outline"
          size="icon-sm"
          nativeButton={false}
          render={<Link href={`/absensi?bulan=${previous}`} aria-label={`Bulan sebelumnya, ${formatAttendanceMonth(previous)}`} />}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
      ) : (
        <Button variant="outline" size="icon-sm" disabled aria-label="Bulan sebelumnya tidak tersedia">
          <ChevronLeft aria-hidden="true" />
        </Button>
      )}

      <label className="sr-only" htmlFor="attendance-month">Bulan riwayat absensi</label>
      <Input
        id="attendance-month"
        type="month"
        lang="id-ID"
        key={month}
        defaultValue={month}
        min={minMonth}
        max={maxMonth}
        className="min-w-0 flex-1 sm:w-[11.5rem] sm:flex-none"
        onChange={(event) => {
          if (event.target.value) go(event.target.value);
        }}
        disabled={pending}
      />

      {canGoNext ? (
        <Button
          variant="outline"
          size="icon-sm"
          nativeButton={false}
          render={<Link href={`/absensi?bulan=${next}`} aria-label={`Bulan berikutnya, ${formatAttendanceMonth(next)}`} />}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      ) : (
        <Button variant="outline" size="icon-sm" disabled aria-label="Bulan berikutnya tidak tersedia">
          <ChevronRight aria-hidden="true" />
        </Button>
      )}

      <span className="grid size-4 place-items-center" aria-live="polite">
        {pending ? <Spinner aria-label="Memuat bulan" /> : null}
      </span>
    </div>
  );
}
