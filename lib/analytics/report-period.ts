export const ANALYTICS_PERIODS = ["month", "year", "all"] as const;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export function parseAnalyticsPeriod(value: unknown): AnalyticsPeriod {
  return ANALYTICS_PERIODS.includes(value as AnalyticsPeriod)
    ? (value as AnalyticsPeriod)
    : "month";
}

export function getAnalyticsPeriodBounds(
  period: AnalyticsPeriod,
  reference = new Date(),
) {
  if (period === "all") return null;

  const shifted = new Date(reference.getTime() + JAKARTA_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = period === "month" ? shifted.getUTCMonth() : 0;
  const endYear = period === "month" && month === 11 ? year + 1 : year;
  const endMonth = period === "month" ? (month + 1) % 12 : 0;

  return {
    start: new Date(Date.UTC(year, month, 1) - JAKARTA_OFFSET_MS),
    end: new Date(
      Date.UTC(period === "year" ? year + 1 : endYear, endMonth, 1) -
        JAKARTA_OFFSET_MS,
    ),
  };
}

export function analyticsPeriodLabel(
  period: AnalyticsPeriod,
  reference = new Date(),
) {
  if (period === "all") return "Seluruh waktu";

  if (period === "year") {
    return new Intl.DateTimeFormat("id-ID", {
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(reference);
  }

  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(reference);
}
