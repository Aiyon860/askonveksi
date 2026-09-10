export type DesignTaskStatus = "BELUM_DIUPLOAD" | "SUDAH_DIUPLOAD" | "TERLAMBAT";

export function designStatus(deadline: Date, revisionCount: number, today = new Date()) : DesignTaskStatus {
  if (revisionCount) return "SUDAH_DIUPLOAD";
  return deadline.getTime() < today.setHours(0, 0, 0, 0) ? "TERLAMBAT" : "BELUM_DIUPLOAD";
}
