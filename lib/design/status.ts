import type { DesignRevisionStatus } from "@prisma/client";

export type DesignTaskStatus = "BELUM_DIUPLOAD" | "MENUNGGU_PERSETUJUAN" | "DISETUJUI" | "DITOLAK" | "TERLAMBAT";

export function designStatus(deadline: Date, latestStatus: DesignRevisionStatus | null, today = new Date()): DesignTaskStatus {
  if (latestStatus === "APPROVED") return "DISETUJUI";
  if (latestStatus === "PENDING_REVIEW") return "MENUNGGU_PERSETUJUAN";
  if (latestStatus === "REJECTED") return "DITOLAK";
  return deadline.getTime() < today.setHours(0, 0, 0, 0) ? "TERLAMBAT" : "BELUM_DIUPLOAD";
}
