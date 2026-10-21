import { Badge } from "@/components/ui/badge";
import { ATTENDANCE_STATUS_LABEL, type AttendanceReportStatusValue } from "@/lib/attendance/constants";

const variantByStatus = {
  HADIR: "success",
  TERLAMBAT: "warning",
  IZIN: "info",
  ALPHA: "destructive",
  BELUM_ABSEN: "outline",
} as const;

export function AttendanceStatusBadge({ status }: { status: AttendanceReportStatusValue }) {
  return (
    <Badge variant={variantByStatus[status]} aria-label={`Status ${ATTENDANCE_STATUS_LABEL[status]}`}>
      {ATTENDANCE_STATUS_LABEL[status]}
    </Badge>
  );
}
