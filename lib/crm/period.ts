/**
 * Perhitungan periode analitik (Asia/Jakarta) — modul murni tanpa dependensi
 * Next/Prisma supaya bisa dipakai API AI dan diuji langsung.
 */

export type AnalyticsQueryParams = {
  mode?: string | string[];
  from?: string | string[];
  to?: string | string[];
  range?: string | string[];
  sourceId?: string | string[];
  categoryId?: string | string[];
};

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export function toJakartaDate(date: Date) {
  return new Date(date.getTime() + JAKARTA_OFFSET_MS);
}

export function parsePeriodBounds(params: AnalyticsQueryParams) {
  const rangePreset = typeof params.range === "string" ? params.range : (Array.isArray(params.range) ? params.range[0] : "this-month");
  const rawFrom = typeof params.from === "string" ? params.from : (Array.isArray(params.from) ? params.from[0] : undefined);
  const rawTo = typeof params.to === "string" ? params.to : (Array.isArray(params.to) ? params.to[0] : undefined);

  const now = new Date();
  const shifted = toJakartaDate(now);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();

  let start: Date | null = null;
  let end: Date | null = null;
  let prevStart: Date | null = null;
  let prevEnd: Date | null = null;
  let label = "Bulan Ini";
  let preset = rangePreset || "this-month";

  if (rawFrom && rawTo) {
    preset = "custom";
    const [fy, fm, fd] = rawFrom.split("-").map(Number);
    const [ty, tm, td] = rawTo.split("-").map(Number);
    start = new Date(Date.UTC(fy, fm - 1, fd) - JAKARTA_OFFSET_MS);
    end = new Date(Date.UTC(ty, tm - 1, td + 1) - JAKARTA_OFFSET_MS);
    const duration = end.getTime() - start.getTime();
    prevEnd = start;
    prevStart = new Date(start.getTime() - duration);
    label = `${rawFrom} s/d ${rawTo}`;
  } else if (rangePreset === "today") {
    start = new Date(Date.UTC(y, m, d) - JAKARTA_OFFSET_MS);
    end = new Date(start.getTime() + 24 * 3600 * 1000);
    prevEnd = start;
    prevStart = new Date(start.getTime() - 24 * 3600 * 1000);
    label = "Hari Ini";
  } else if (rangePreset === "yesterday") {
    end = new Date(Date.UTC(y, m, d) - JAKARTA_OFFSET_MS);
    start = new Date(end.getTime() - 24 * 3600 * 1000);
    prevEnd = start;
    prevStart = new Date(start.getTime() - 24 * 3600 * 1000);
    label = "Kemarin";
  } else if (rangePreset === "7d") {
    end = new Date(Date.UTC(y, m, d + 1) - JAKARTA_OFFSET_MS);
    start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
    prevEnd = start;
    prevStart = new Date(start.getTime() - 7 * 24 * 3600 * 1000);
    label = "7 Hari Terakhir";
  } else if (rangePreset === "30d") {
    end = new Date(Date.UTC(y, m, d + 1) - JAKARTA_OFFSET_MS);
    start = new Date(end.getTime() - 30 * 24 * 3600 * 1000);
    prevEnd = start;
    prevStart = new Date(start.getTime() - 30 * 24 * 3600 * 1000);
    label = "30 Hari Terakhir";
  } else if (rangePreset === "last-month") {
    start = new Date(Date.UTC(y, m - 1, 1) - JAKARTA_OFFSET_MS);
    end = new Date(Date.UTC(y, m, 1) - JAKARTA_OFFSET_MS);
    prevStart = new Date(Date.UTC(y, m - 2, 1) - JAKARTA_OFFSET_MS);
    prevEnd = start;
    const lastMonthDate = new Date(Date.UTC(y, m - 1, 1));
    label = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(lastMonthDate);
  } else if (rangePreset === "this-year") {
    start = new Date(Date.UTC(y, 0, 1) - JAKARTA_OFFSET_MS);
    end = new Date(Date.UTC(y + 1, 0, 1) - JAKARTA_OFFSET_MS);
    prevStart = new Date(Date.UTC(y - 1, 0, 1) - JAKARTA_OFFSET_MS);
    prevEnd = start;
    label = `Tahun ${y}`;
  } else if (rangePreset === "all") {
    start = null;
    end = null;
    prevStart = null;
    prevEnd = null;
    label = "Semua Waktu";
  } else {
    // "this-month" default
    preset = "this-month";
    start = new Date(Date.UTC(y, m, 1) - JAKARTA_OFFSET_MS);
    end = new Date(Date.UTC(y, m + 1, 1) - JAKARTA_OFFSET_MS);
    prevStart = new Date(Date.UTC(y, m - 1, 1) - JAKARTA_OFFSET_MS);
    prevEnd = start;
    const monthFormatter = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
    const firstDay = new Date(Date.UTC(y, m, 1));
    const lastDay = new Date(Date.UTC(y, m + 1, 0));
    label = `${monthFormatter.format(firstDay)} - ${monthFormatter.format(lastDay)}`;
  }

  const toYMD = (d: Date | null) => (d ? toJakartaDate(d).toISOString().slice(0, 10) : "");

  return {
    start,
    end,
    prevStart,
    prevEnd,
    label,
    preset,
    from: toYMD(start),
    to: toYMD(end ? new Date(end.getTime() - 1000) : null),
  };
}

export function calcGrowth(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}
