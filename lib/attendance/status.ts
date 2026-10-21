import { jakartaMinutesOfDay, isValidTimeKey } from "./time.ts";

/**
 * Toleransi dihitung dalam menit penuh. Jam masuk 08:00 + toleransi 15 menit
 * berarti 08:15:59 masih Hadir; 08:16:00 sudah Terlambat.
 */
export function resolveCheckInStatus(input: {
  checkInAt: Date;
  checkInTime: string;
  lateToleranceMinutes: number;
}): "HADIR" | "TERLAMBAT" {
  if (!isValidTimeKey(input.checkInTime)) {
    throw new Error("Jam masuk tidak valid.");
  }
  const [hour, minute] = input.checkInTime.split(":").map(Number);
  const threshold = hour * 60 + minute + Math.max(0, input.lateToleranceMinutes);
  return jakartaMinutesOfDay(input.checkInAt) <= threshold ? "HADIR" : "TERLAMBAT";
}
