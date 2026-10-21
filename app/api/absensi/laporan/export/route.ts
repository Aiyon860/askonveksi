import { ATTENDANCE_ADMIN_ROLES, hasRole } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";
import { ATTENDANCE_SOURCE_LABEL, ATTENDANCE_STATUS_LABEL } from "@/lib/attendance/constants";
import { getAttendanceReport, type AttendanceReportFilters } from "@/lib/attendance/data";
import {
  dateKeyToUtcDate,
  formatAttendanceDateTime,
  formatAttendanceDateShort,
  jakartaTimeKey,
} from "@/lib/attendance/time";
import { ROLE_LABEL } from "@/lib/crm/constants";
import { downloadFilename } from "@/lib/download-filename";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dayName(dateKey: string) {
  const date = dateKeyToUtcDate(dateKey);
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" }).format(date);
}

function sourceLabel(row: {
  isDerived: boolean;
  source: "SELF" | "OWNER" | null;
  recordedByName: string | null;
}) {
  if (row.isDerived || !row.source) return "Otomatis";
  if (row.source === "OWNER") {
    return row.recordedByName ? `Owner (${row.recordedByName})` : "Owner";
  }
  return ATTENDANCE_SOURCE_LABEL.SELF;
}

export async function GET(request: Request) {
  const actor = await getCurrentActor();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  if (!hasRole(actor.role, ATTENDANCE_ADMIN_ROLES)) {
    return new Response("Forbidden", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const filters: AttendanceReportFilters = {
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    userId: params.get("userId") ?? undefined,
    status: params.get("status") ?? undefined,
  };
  const report = await getAttendanceReport(filters, { paginate: false });

  // Dynamic agar exceljs (~30MB) tidak masuk bundle dingin.
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Askonveksi";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Absensi");

  sheet.columns = [
    { header: "Tanggal", key: "date", width: 14 },
    { header: "Hari", key: "day", width: 11 },
    { header: "Pegawai", key: "employee", width: 26 },
    { header: "Role", key: "role", width: 16 },
    { header: "Status", key: "status", width: 13 },
    { header: "Jam masuk", key: "time", width: 12 },
    { header: "Keterangan", key: "note", width: 38 },
    { header: "Sumber", key: "source", width: 24 },
    { header: "Dikoreksi oleh", key: "correctedBy", width: 20 },
    { header: "Latitude", key: "latitude", width: 13 },
    { header: "Longitude", key: "longitude", width: 13 },
    { header: "Akurasi (m)", key: "accuracy", width: 12 },
    { header: "Lokasi dicatat", key: "locationAt", width: 26 },
    { header: "Foto", key: "photo", width: 9 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const row of report.rows) {
    sheet.addRow({
      date: formatAttendanceDateShort(row.dateKey),
      day: dayName(row.dateKey),
      employee: row.employeeName,
      role: ROLE_LABEL[row.employeeRole],
      status: ATTENDANCE_STATUS_LABEL[row.status],
      time: row.checkInAt ? `${jakartaTimeKey(row.checkInAt)} WIB` : "-",
      note: row.note ?? "-",
      source: sourceLabel(row),
      correctedBy: row.correctedByName ?? "-",
      latitude: row.latitude ?? "",
      longitude: row.longitude ?? "",
      accuracy: row.accuracyMeters ?? "",
      locationAt: row.locationAt ? formatAttendanceDateTime(row.locationAt) : "-",
      photo: row.hasPhoto ? "Ada" : "-",
    });
  }

  sheet.getColumn("latitude").numFmt = "0.000000";
  sheet.getColumn("longitude").numFmt = "0.000000";
  if (report.rows.length > 0) {
    sheet.autoFilter = { from: "A1", to: "N1" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${downloadFilename("laporan-absensi", "xlsx")}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
