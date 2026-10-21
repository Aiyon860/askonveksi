import { CalendarX2 } from "lucide-react";
import { redirect } from "next/navigation";

import { AttendanceClockCard } from "@/components/attendance/attendance-clock-card";
import { AttendanceMonthPicker } from "@/components/attendance/attendance-month-picker";
import { AttendanceMonthSummary } from "@/components/attendance/attendance-month-summary";
import { AttendanceLocationDialog, AttendancePhotoDialog } from "@/components/attendance/attendance-detail-dialogs";
import { AttendanceStatusBadge } from "@/components/attendance/attendance-status-badge";
import { PageHeader } from "@/components/page-header";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isAttendanceEmployee } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";
import { getAttendanceHistory, getAttendanceToday } from "@/lib/attendance/data";
import { summarizeAttendanceRows } from "@/lib/attendance/report";
import {
  formatAttendanceDate,
  formatAttendanceDateTime,
  formatAttendanceMonth,
  jakartaDateKey,
  jakartaMinutesOfDay,
  jakartaTimeKey,
  jakartaWeekday,
} from "@/lib/attendance/time";
import type { AttendanceLocationView, AttendanceTodayRecordView } from "@/lib/attendance/types";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function decimalToNumber(value: { toString(): string } | number | null) {
  if (value === null) return null;
  const result = Number(typeof value === "object" ? value.toString() : value);
  return Number.isFinite(result) ? result : null;
}

function locationView(record: {
  latitude: { toString(): string } | number | null;
  longitude: { toString(): string } | number | null;
  accuracyMeters: number | null;
  locationAt: Date | null;
}): AttendanceLocationView | null {
  const latitude = decimalToNumber(record.latitude);
  const longitude = decimalToNumber(record.longitude);
  if (latitude === null || longitude === null) return null;
  return {
    latitude,
    longitude,
    accuracyMeters: record.accuracyMeters,
    recordedAt: record.locationAt ? formatAttendanceDateTime(record.locationAt) : null,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`,
  };
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string | string[] }>;
}) {
  const [params, actor] = await Promise.all([searchParams, getCurrentActor()]);
  if (!actor) redirect("/login");
  if (!isAttendanceEmployee(actor.role)) redirect("/absensi/laporan");

  const now = new Date();
  const today = jakartaDateKey(now);
  const [todayData, history] = await Promise.all([
    getAttendanceToday(actor.id, today),
    getAttendanceHistory({ userId: actor.id, month: first(params.bulan) }),
  ]);

  const settings = todayData.settings;
  const isWorkday = settings.workDays.includes(jakartaWeekday(today));
  const thresholdMinutes = Number(settings.checkInTime.slice(0, 2)) * 60
    + Number(settings.checkInTime.slice(3, 5))
    + settings.lateToleranceMinutes;
  const lateWindow = jakartaMinutesOfDay(now) > thresholdMinutes;
  const historySummary = summarizeAttendanceRows(history.rows);

  const todayRecord: AttendanceTodayRecordView | null = todayData.record
    ? {
        id: todayData.record.id,
        status: todayData.record.status,
        checkInTime: todayData.record.checkInAt ? jakartaTimeKey(todayData.record.checkInAt) : null,
        note: todayData.record.note,
        source: todayData.record.source,
        photoUrl: todayData.record.photoPath ? `/api/absensi/${todayData.record.id}/foto` : null,
        location: locationView(todayData.record),
        corrected: Boolean(todayData.record.correctedById),
      }
    : null;

  const employeeCreatedMonth = history.employee
    ? jakartaDateKey(history.employee.createdAt).slice(0, 7)
    : today.slice(0, 7);
  const attendanceStartMonth = settings.startDate.slice(0, 7);
  const historyMinMonth = attendanceStartMonth > employeeCreatedMonth
    ? attendanceStartMonth
    : employeeCreatedMonth;
  const currentMonth = today.slice(0, 7);

  return (
    <main className="flex w-full min-w-0 flex-col gap-6">
      <PageHeader
        title="Absensi"
        description="Ambil foto absen masuk hari ini dan lihat riwayat kehadiran Anda."
      />

      <AttendanceClockCard
        dateLabel={formatAttendanceDate(today)}
        timeLabel={jakartaTimeKey(now)}
        checkInTime={settings.checkInTime}
        lateToleranceMinutes={settings.lateToleranceMinutes}
        isWorkday={isWorkday}
        holidayName={todayData.holiday?.name ?? null}
        lateWindow={lateWindow}
        record={todayRecord}
      />

      <section
        aria-labelledby="attendance-history-title"
        className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card"
      >
        <div className="flex flex-col gap-4 border-b bg-muted/20 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h2 id="attendance-history-title" className="font-heading text-base font-medium">
              Riwayat absensi
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {history.holidays.length > 0
                ? `${history.holidays.length} hari libur pada bulan ini tidak dihitung Alpha.`
                : "Alpha otomatis dihitung untuk hari kerja yang sudah lewat tanpa catatan absensi."}
            </p>
          </div>
          <AttendanceMonthPicker
            month={history.month}
            minMonth={historyMinMonth}
            maxMonth={currentMonth}
          />
        </div>

        <AttendanceMonthSummary
          summary={historySummary}
          monthLabel={formatAttendanceMonth(history.month)}
        />

        {history.rows.length > 0 ? (
          <p className="border-b px-4 py-2 text-xs text-muted-foreground xl:hidden">
            Geser tabel ke samping untuk melihat semua kolom.
          </p>
        ) : null}

        {history.rows.length === 0 ? (
          <Empty className="rounded-none border-0 px-6 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarX2 aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Belum ada data absensi</EmptyTitle>
              <EmptyDescription>
                Alpha otomatis akan muncul untuk hari kerja yang sudah lewat tanpa catatan absensi.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table
            aria-label="Riwayat absensi bulan ini"
            className="min-w-[58rem] table-fixed"
            containerProps={{
              tabIndex: 0,
              role: "region",
              "aria-label": "Tabel riwayat absensi. Geser horizontal untuk melihat semua kolom.",
            }}
            containerClassName="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-muted/60">
                <TableHead className="w-[14rem] pl-4">Tanggal</TableHead>
                <TableHead className="w-[9rem]">Status</TableHead>
                <TableHead className="w-[9rem]">Jam masuk</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="w-[12rem] pr-4">Bukti</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.rows.map((row) => {
                const rowLocation = row.latitude !== null && row.longitude !== null
                  ? {
                      latitude: row.latitude,
                      longitude: row.longitude,
                      accuracyMeters: row.accuracyMeters,
                      recordedAt: row.locationAt ? formatAttendanceDateTime(row.locationAt) : null,
                      mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${row.latitude},${row.longitude}`)}`,
                    }
                  : null;
                const timeLabel = row.checkInAt ? jakartaTimeKey(row.checkInAt) : null;
                const photoUrl = row.attendanceId && row.hasPhoto
                  ? `/api/absensi/${row.attendanceId}/foto`
                  : null;

                return (
                  <TableRow key={row.key} className="h-14">
                    <TableCell className="whitespace-nowrap pl-4 font-medium">
                      {formatAttendanceDate(row.dateKey)}
                    </TableCell>
                    <TableCell><AttendanceStatusBadge status={row.status} /></TableCell>
                    <TableCell className="tabular-nums">
                      {timeLabel ? `${timeLabel} WIB` : "-"}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words text-muted-foreground">
                      {row.note ?? (row.isDerived ? "-" : "Tidak ada keterangan")}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center gap-2">
                        {photoUrl ? (
                          <AttendancePhotoDialog
                            photoUrl={photoUrl}
                            employeeName={actor.name}
                            dateLabel={formatAttendanceDate(row.dateKey)}
                            timeLabel={timeLabel}
                            location={rowLocation}
                          />
                        ) : null}
                        {rowLocation ? (
                          <AttendanceLocationDialog
                            employeeName={actor.name}
                            dateLabel={formatAttendanceDate(row.dateKey)}
                            location={rowLocation}
                          />
                        ) : !photoUrl ? (
                          <span className="text-sm text-muted-foreground">-</span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </main>
  );
}
