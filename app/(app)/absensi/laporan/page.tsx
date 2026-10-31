import Link from "next/link";
import { redirect, forbidden } from "next/navigation";
import { CalendarX2, CheckCircle2, Clock3, Gauge, ShieldCheck, UserRoundCheck, UserRoundX, type LucideIcon } from "lucide-react";

import { AttendanceLocationDialog, AttendancePhotoDialog } from "@/components/attendance/attendance-detail-dialogs";
import { AttendanceStatusBadge } from "@/components/attendance/attendance-status-badge";
import { CorrectionAttendanceDialog, DeleteManualAttendanceButton } from "@/components/attendance/correction-attendance-dialog";
import { ManualAttendanceDialog } from "@/components/attendance/manual-attendance-dialog";
import { DataPagination } from "@/components/data-pagination";
import { ExportButton } from "@/components/export/export-button";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableViewport } from "@/components/table-viewport";
import { ATTENDANCE_ADMIN_ROLES, hasRole } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";
import {
  ATTENDANCE_REPORT_STATUSES,
  ATTENDANCE_SOURCE_LABEL,
  ATTENDANCE_STATUS_LABEL,
  type AttendanceReportStatusValue,
} from "@/lib/attendance/constants";
import { getAttendanceReport, type AttendanceReportFilters } from "@/lib/attendance/data";
import {
  formatAttendanceDateShort,
  formatAttendanceDateTime,
  jakartaTimeKey,
} from "@/lib/attendance/time";
import type { AttendanceCorrectionTarget, AttendanceEmployeeOption, AttendanceLocationView } from "@/lib/attendance/types";
import { ROLE_LABEL } from "@/lib/crm/constants";
import { formatPercentage } from "@/lib/crm/format";
import { DATA_PAGE_SIZE, DATA_PAGE_SIZES, pageSizeLabel, parsePageSizeParam } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type SearchParams = Promise<{
  from?: string | string[];
  to?: string | string[];
  userId?: string | string[];
  status?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
}>;

function locationView(row: {
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  locationAt: Date | null;
}): AttendanceLocationView | null {
  if (row.latitude === null || row.longitude === null) return null;
  return {
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyMeters: row.accuracyMeters,
    recordedAt: row.locationAt
      ? formatAttendanceDateTime(row.locationAt)
      : null,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${row.latitude},${row.longitude}`)}`,
  };
}

function sourceText(row: {
  isDerived: boolean;
  source: "SELF" | "OWNER" | null;
  recordedByName: string | null;
}) {
  if (row.isDerived || !row.source) return "Otomatis";
  if (row.source === "OWNER") {
    return row.recordedByName ? `Owner · ${row.recordedByName}` : "Owner";
  }
  return ATTENDANCE_SOURCE_LABEL.SELF;
}

const summaryToneClass = {
  neutral: "text-muted-foreground",
  primary: "text-highlight-surface-foreground",
  danger: "text-destructive-surface-foreground",
  warning: "text-warning-surface-foreground",
  success: "text-success-surface-foreground",
} as const;

type SummaryTone = keyof typeof summaryToneClass;

function SummaryMetric({
  label,
  value,
  meta,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  meta?: string;
  icon: LucideIcon;
  tone?: SummaryTone;
}) {
  return (
    <div className="flex min-h-24 flex-col justify-between gap-2 bg-card p-4">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon aria-hidden="true" className={cn("size-4", summaryToneClass[tone])} />
        <span>{label}</span>
      </dt>
      <dd className="font-mono text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </dd>
      {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
    </div>
  );
}

export default async function AttendanceReportPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, actor] = await Promise.all([searchParams, getCurrentActor()]);
  if (!actor) redirect("/login");
  if (!hasRole(actor.role, ATTENDANCE_ADMIN_ROLES)) forbidden();

  const pageSize = parsePageSizeParam(params.pageSize);
  const report = await getAttendanceReport(params as AttendanceReportFilters);
  const today = report.today;

  const persistent = {
    from: report.range.from,
    to: report.range.to,
    userId: report.selectedUserId || undefined,
    status: report.status === "ALL" ? undefined : report.status,
    pageSize: pageSize === DATA_PAGE_SIZE ? undefined : String(pageSize),
  } as Record<string, string | undefined>;
  const returnParams = new URLSearchParams();
  Object.entries(persistent).forEach(([key, value]) => {
    if (value) returnParams.set(key, value);
  });
  if (report.page > 1) returnParams.set("page", String(report.page));
  const returnQuery = returnParams.toString();
  const returnTo = returnQuery ? `/absensi/laporan?${returnQuery}` : "/absensi/laporan";
  const exportParams: Record<string, string> = { from: report.range.from, to: report.range.to };
  if (report.selectedUserId) exportParams.userId = report.selectedUserId;
  if (report.status !== "ALL") exportParams.status = report.status;

  const manualEmployees: AttendanceEmployeeOption[] = report.employees
    .filter((employee) => employee.isActive)
    .map((employee) => ({
      id: employee.id,
      name: employee.name,
      role: employee.role,
      isActive: employee.isActive,
    }));

  return (
    <main className="flex w-full min-w-0 flex-col gap-6">
      <PageHeader
        title="Laporan absensi"
        description="Rekap kehadiran pegawai, koreksi record, dan ekspor sesuai filter."
        action={
          <div className="flex flex-wrap gap-2">
            <ManualAttendanceDialog
              employees={manualEmployees}
              defaultCheckInTime={report.settings.checkInTime}
              today={today}
              returnTo={returnTo}
            />
            <ExportButton dataset="absensi" params={exportParams} />
          </div>
        }
      />
      <PageMessage />

      <dl
        aria-label="Ringkasan absensi"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 xl:grid-cols-6"
      >
        <SummaryMetric label="Hadir" value={report.summary.HADIR} tone="success" icon={CheckCircle2} />
        <SummaryMetric label="Terlambat" value={report.summary.TERLAMBAT} tone="warning" icon={Clock3} />
        <SummaryMetric label="Izin" value={report.summary.IZIN} tone="primary" icon={ShieldCheck} />
        <SummaryMetric label="Alpha" value={report.summary.ALPHA} tone="danger" icon={UserRoundX} />
        <SummaryMetric label="Belum absen" value={report.summary.BELUM_ABSEN} tone="neutral" icon={UserRoundCheck} meta="hari ini" />
        <div className="flex min-h-24 flex-col justify-between gap-2 bg-primary p-4 text-primary-foreground">
          <dt className="flex items-center gap-2 text-sm text-primary-foreground/85">
            <Gauge aria-hidden="true" className="size-4" />
            <span>Tingkat kehadiran</span>
          </dt>
          <dd className="font-mono text-2xl font-semibold tabular-nums">
            {formatPercentage(report.summary.attendanceRate)}
          </dd>
          <p className="text-xs text-primary-foreground/85">hadir + terlambat</p>
        </div>
      </dl>
      {report.status !== "ALL" ? (
        <p className="-mt-3 text-xs text-muted-foreground">
          Ringkasan di atas menghitung semua status; tabel di bawah hanya menampilkan status{" "}
          {ATTENDANCE_STATUS_LABEL[report.status]}.
        </p>
      ) : null}

      <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
        <form
          action="/absensi/laporan"
          aria-label="Filter laporan absensi"
          className="grid gap-3 border-b bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(14rem,1.6fr)_minmax(10rem,1.1fr)_minmax(8rem,0.8fr)_auto] xl:items-end"
        >
          <Field className="min-w-0">
            <FieldLabel htmlFor="attendance-report-from">Dari tanggal</FieldLabel>
            <Input
              id="attendance-report-from"
              name="from"
              type="date"
              max={today}
              defaultValue={report.range.from}
            />
          </Field>
          <Field className="min-w-0">
            <FieldLabel htmlFor="attendance-report-to">Sampai tanggal</FieldLabel>
            <Input
              id="attendance-report-to"
              name="to"
              type="date"
              max={today}
              defaultValue={report.range.to}
            />
          </Field>
          <Field className="min-w-0">
            <FieldLabel htmlFor="attendance-report-employee">Pegawai</FieldLabel>
            <NativeSelect
              id="attendance-report-employee"
              name="userId"
              className="w-full"
              defaultValue={report.selectedUserId}
            >
              <NativeSelectOption value="">Semua pegawai</NativeSelectOption>
              {report.employees.map((employee) => (
                <NativeSelectOption key={employee.id} value={employee.id}>
                  {employee.name} · {ROLE_LABEL[employee.role]}{employee.isActive ? "" : " (nonaktif)"}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field className="min-w-0">
            <FieldLabel htmlFor="attendance-report-status">Status</FieldLabel>
            <NativeSelect
              id="attendance-report-status"
              name="status"
              className="w-full"
              defaultValue={report.status}
            >
              <NativeSelectOption value="ALL">Semua status</NativeSelectOption>
              {ATTENDANCE_REPORT_STATUSES.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {ATTENDANCE_STATUS_LABEL[status]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field className="min-w-0">
            <FieldLabel htmlFor="attendance-report-page-size">Baris</FieldLabel>
            <NativeSelect
              id="attendance-report-page-size"
              name="pageSize"
              className="w-full"
              defaultValue={String(pageSize)}
            >
              {DATA_PAGE_SIZES.map((size) => (
                <NativeSelectOption key={size} value={String(size)}>{pageSizeLabel(size)}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" className="flex-1 xl:flex-none">Terapkan</Button>
            <Button variant="ghost" className="flex-1 xl:flex-none" nativeButton={false} render={<Link href="/absensi/laporan" />}>Reset</Button>
          </div>
        </form>

        {report.rows.length > 0 ? (
          <TableViewport className="min-w-0">
            <Table
              aria-label="Daftar absensi pegawai"
              className="min-w-[76rem] table-fixed"
              containerClassName="min-h-0 flex-1 overflow-auto"
            >
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow className="hover:bg-muted">
                  <TableHead className="w-[7rem]">Tanggal</TableHead>
                  <TableHead className="w-[13rem]">Pegawai</TableHead>
                  <TableHead className="w-[7rem]">Status</TableHead>
                  <TableHead className="w-[6rem]">Jam masuk</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="w-[9rem]">Sumber</TableHead>
                  <TableHead className="w-[11rem]">Bukti</TableHead>
                  <TableHead className="w-[12rem] text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => {
                  const timeLabel = row.checkInAt ? jakartaTimeKey(row.checkInAt) : null;
                  const rowLocation = locationView(row);
                  const photoUrl = row.attendanceId && row.hasPhoto
                    ? `/api/absensi/${row.attendanceId}/foto`
                    : null;
                  const dateLabel = formatAttendanceDateShort(row.dateKey);
                  const correctionTarget: AttendanceCorrectionTarget | null =
                    row.attendanceId && row.updatedAt && row.source && row.status !== "BELUM_ABSEN"
                      ? {
                          id: row.attendanceId,
                          employeeName: row.employeeName,
                          dateKey: row.dateKey,
                          dateLabel,
                          status: row.status as Exclude<AttendanceReportStatusValue, "BELUM_ABSEN">,
                          checkInTime: timeLabel,
                          note: row.note,
                          updatedAt: row.updatedAt.toISOString(),
                          source: row.source,
                        }
                      : null;

                  return (
                    <TableRow key={row.key}>
                      <TableCell className="whitespace-nowrap font-medium">{dateLabel}</TableCell>
                      <TableCell>
                        <span className="font-medium">{row.employeeName}</span>
                        <span className="block text-xs text-muted-foreground">{ROLE_LABEL[row.employeeRole]}</span>
                      </TableCell>
                      <TableCell><AttendanceStatusBadge status={row.status} /></TableCell>
                      <TableCell className="tabular-nums">{timeLabel ? `${timeLabel} WIB` : "-"}</TableCell>
                      <TableCell className="whitespace-normal break-words text-muted-foreground">
                        {row.note ?? "-"}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words">
                        <span className={row.isDerived ? "text-muted-foreground" : undefined}>
                          {sourceText(row)}
                        </span>
                        {row.correctedByName ? (
                          <span className="block text-xs text-muted-foreground">
                            Dikoreksi {row.correctedByName}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {photoUrl ? (
                            <AttendancePhotoDialog
                              photoUrl={photoUrl}
                              employeeName={row.employeeName}
                              dateLabel={dateLabel}
                              timeLabel={timeLabel}
                              location={rowLocation}
                            />
                          ) : null}
                          {rowLocation ? (
                            <AttendanceLocationDialog
                              employeeName={row.employeeName}
                              dateLabel={dateLabel}
                              location={rowLocation}
                            />
                          ) : !photoUrl ? (
                            <span className="text-sm text-muted-foreground">-</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {correctionTarget ? (
                            <CorrectionAttendanceDialog
                              target={correctionTarget}
                              defaultCheckInTime={report.settings.checkInTime}
                              returnTo={returnTo}
                            />
                          ) : (
                            <ManualAttendanceDialog
                              employees={manualEmployees}
                              defaultCheckInTime={report.settings.checkInTime}
                              today={today}
                              returnTo={returnTo}
                              initialUserId={row.userId}
                              initialDate={row.dateKey}
                              triggerLabel="Catat"
                              triggerSize="xs"
                              triggerVariant="outline"
                            />
                          )}
                          {correctionTarget && row.source === "OWNER" && row.attendanceId && row.updatedAt ? (
                            <DeleteManualAttendanceButton
                              attendanceId={row.attendanceId}
                              updatedAt={row.updatedAt.toISOString()}
                              returnTo={returnTo}
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <DataPagination
              pathname="/absensi/laporan"
              page={report.page}
              pageCount={report.pageCount}
              total={report.total}
              pageSize={pageSize}
              pageSizeOptions={DATA_PAGE_SIZES}
              params={persistent}
              className="border-t px-4 py-3"
            />
          </TableViewport>
        ) : (
          <Empty className="p-12">
            <EmptyHeader>
              <EmptyMedia variant="icon"><CalendarX2 aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>Belum ada data absensi</EmptyTitle>
              <EmptyDescription>
                Ubah rentang tanggal, pegawai, atau status. Record Alpha otomatis muncul untuk hari kerja
                yang sudah lewat tanpa absensi.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </main>
  );
}
