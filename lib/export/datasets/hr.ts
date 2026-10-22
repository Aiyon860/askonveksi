import "server-only";

import { ATTENDANCE_SOURCE_LABEL, ATTENDANCE_STATUS_LABEL } from "@/lib/attendance/constants";
import { getAttendanceReport, type AttendanceReportFilters } from "@/lib/attendance/data";
import { dateKeyToUtcDate, formatAttendanceDateShort, jakartaTimeKey } from "@/lib/attendance/time";
import { ROLE_LABEL } from "@/lib/crm/constants";
import { exportDateTime, exportFilterSummary } from "@/lib/export/params";
import type { ExportColumn, ExportDatasetResult, ExportRow } from "@/lib/export/types";

type LoadInput = { searchParams: URLSearchParams };

export const ABSENSI_COLUMNS: ExportColumn[] = [
  { header: "Tanggal", width: 14 },
  { header: "Hari", width: 11 },
  { header: "Pegawai", width: 26 },
  { header: "Role", width: 16 },
  { header: "Status", width: 13 },
  { header: "Jam masuk", width: 12 },
  { header: "Keterangan", width: 38 },
  { header: "Sumber", width: 24 },
  { header: "Dikoreksi oleh", width: 20 },
  { header: "Latitude", format: "number", width: 13 },
  { header: "Longitude", format: "number", width: 13 },
  { header: "Akurasi (m)", format: "number", width: 12 },
  { header: "Lokasi dicatat", format: "datetime", width: 26 },
  { header: "Foto", width: 9 },
];

function dayName(dateKey: string) {
  const date = dateKeyToUtcDate(dateKey);
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" }).format(date);
}

function sourceLabel(row: { isDerived: boolean; source: "SELF" | "OWNER" | null; recordedByName: string | null }) {
  if (row.isDerived || !row.source) return "Otomatis";
  if (row.source === "OWNER") return row.recordedByName ? `Owner (${row.recordedByName})` : "Owner";
  return ATTENDANCE_SOURCE_LABEL.SELF;
}

export async function loadAbsensi({ searchParams }: LoadInput): Promise<ExportDatasetResult> {
  const filters: AttendanceReportFilters = {
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    userId: searchParams.get("userId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  };
  const report = await getAttendanceReport(filters, { paginate: false });
  const rows: ExportRow[] = report.rows.map((item) => ({
    cells: [
      formatAttendanceDateShort(item.dateKey),
      dayName(item.dateKey),
      item.employeeName,
      ROLE_LABEL[item.employeeRole],
      ATTENDANCE_STATUS_LABEL[item.status],
      item.checkInAt ? `${jakartaTimeKey(item.checkInAt)} WIB` : "-",
      item.note ?? "-",
      sourceLabel(item),
      item.correctedByName ?? "-",
      item.latitude ?? null,
      item.longitude ?? null,
      item.accuracyMeters ?? null,
      exportDateTime(item.locationAt),
      item.hasPhoto ? "Ada" : "-",
    ],
  }));
  return {
    rows,
    total: rows.length,
    filterSummary: exportFilterSummary([
      `${report.range.from} s.d. ${report.range.to}`,
      report.selectedUserId ? "Satu pegawai" : "Semua pegawai",
      report.status !== "ALL" ? ATTENDANCE_STATUS_LABEL[report.status] : null,
    ]),
    notes: ["Kolom Lokasi dicatat disimpan sebagai tanggal+jam (zona waktu Asia/Jakarta pada tampilan aplikasi)."],
  };
}
