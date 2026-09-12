import type { CustomerReminderType } from "@prisma/client";

export const CUSTOMER_REMINDER_DELAYS = {
  REACTIVATION: 6,
} as const satisfies Partial<Record<CustomerReminderType, number>>;

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
