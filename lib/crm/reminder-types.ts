import type { CustomerReminderType } from "@prisma/client";

export const CUSTOMER_REMINDER_DELAYS = {
  REACTIVATION: 6,
} as const satisfies Partial<Record<CustomerReminderType, number>>;

export const DEFAULT_REPEAT_ORDER_INTERVALS = [6, 5] as const;

export type CustomerActivityStatus =
  | "BELUM_ORDER"
  | "AKTIF"
  | "TIDAK_AKTIF";

export const CUSTOMER_ACTIVITY_LABELS: Record<CustomerActivityStatus, string> = {
  BELUM_ORDER: "Belum order",
  AKTIF: "Aktif",
  TIDAK_AKTIF: "Tidak aktif",
};

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export function addCalendarMonthsJakarta(value: Date, months: number) {
  const local = new Date(value.getTime() + JAKARTA_OFFSET_MS);
  const targetMonthStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  const targetLocal = Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth(),
    Math.min(local.getUTCDate(), lastDay),
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds(),
  );
  return new Date(targetLocal - JAKARTA_OFFSET_MS);
}

export function repeatOrderOccurrenceMonths(intervals: readonly number[], occurrence: number) {
  if (!intervals.length || occurrence < 1 || !Number.isInteger(occurrence)) throw new Error("Pola atau urutan reminder tidak valid.");
  const completedCycles = Math.floor((occurrence - 1) / intervals.length);
  const remainder = occurrence % intervals.length || intervals.length;
  return completedCycles * intervals.reduce((total, interval) => total + interval, 0)
    + intervals.slice(0, remainder).reduce((total, interval) => total + interval, 0);
}

export function repeatOrderDueAt(acceptedAt: Date, intervals: readonly number[], occurrence: number) {
  const target = addCalendarMonthsJakarta(acceptedAt, repeatOrderOccurrenceMonths(intervals, occurrence));
  const jakarta = new Date(target.getTime() + JAKARTA_OFFSET_MS);
  return new Date(Date.UTC(jakarta.getUTCFullYear(), jakarta.getUTCMonth(), jakarta.getUTCDate(), 2));
}

export function firstFutureRepeatOrderOccurrence(
  acceptedAt: Date,
  intervals: readonly number[],
  reference: Date,
  startOccurrence = 1,
) {
  let occurrence = Math.max(1, Math.trunc(startOccurrence));
  let dueAt = repeatOrderDueAt(acceptedAt, intervals, occurrence);
  while (dueAt <= reference) {
    occurrence += 1;
    dueAt = repeatOrderDueAt(acceptedAt, intervals, occurrence);
  }
  return { occurrence, dueAt };
}

export function activityStatusFromSchedule(
  schedule: Array<{ type: CustomerReminderType; dueAt: Date }>,
  reference = new Date(),
  hasOpenOpportunity = false,
): CustomerActivityStatus {
  if (!schedule.length) return "BELUM_ORDER";
  if (hasOpenOpportunity) return "AKTIF";
  const reactivation = schedule.find((item) => item.type === "REACTIVATION");
  if (reactivation && reactivation.dueAt <= reference) return "TIDAK_AKTIF";
  return "AKTIF";
}
