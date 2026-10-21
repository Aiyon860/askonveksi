import type { AttendanceReportSummary } from "@/lib/attendance/report";
import { formatPercentage } from "@/lib/crm/format";

const summaryMetrics = [
  { key: "HADIR", label: "Hadir" },
  { key: "TERLAMBAT", label: "Terlambat" },
  { key: "IZIN", label: "Izin" },
  { key: "ALPHA", label: "Alpha" },
  { key: "BELUM_ABSEN", label: "Belum absen" },
] as const;

export function AttendanceMonthSummary({
  summary,
  monthLabel,
}: {
  summary: AttendanceReportSummary;
  monthLabel: string;
}) {
  const ratedDays = summary.HADIR + summary.TERLAMBAT + summary.IZIN + summary.ALPHA;

  return (
    <dl
      aria-label={`Ringkasan absensi ${monthLabel}`}
      className="grid grid-cols-2 gap-px border-b bg-border sm:grid-cols-3 xl:grid-cols-6"
    >
      {summaryMetrics.map((metric) => (
        <div
          key={metric.key}
          className="flex min-h-20 flex-col justify-between gap-2 bg-card p-4"
        >
          <dt className="text-sm text-muted-foreground">{metric.label}</dt>
          <dd className="font-mono text-xl font-semibold tabular-nums text-foreground">
            {summary[metric.key]}
          </dd>
        </div>
      ))}
      <div className="flex min-h-20 flex-col justify-between gap-2 bg-primary p-4 text-primary-foreground">
        <dt className="text-sm text-primary-foreground/85">Tingkat kehadiran</dt>
        <dd className="font-mono text-xl font-semibold tabular-nums">
          {ratedDays > 0 ? formatPercentage(summary.attendanceRate) : "—"}
        </dd>
      </div>
    </dl>
  );
}
