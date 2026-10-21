const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;
const TIME_KEY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function validDate(value: Date | string | number) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Tanggal kalender WIB (YYYY-MM-DD) dari sebuah instant. */
export function jakartaDateKey(value: Date | string | number = new Date()) {
  const date = validDate(value);
  if (!date) return "";
  return new Date(date.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Jam WIB (HH:mm) dari sebuah instant. */
export function jakartaTimeKey(value: Date | string | number = new Date()) {
  const date = validDate(value);
  if (!date) return "";
  return new Date(date.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(11, 16);
}

export function jakartaMinutesOfDay(value: Date | string | number = new Date()) {
  const time = jakartaTimeKey(value);
  if (!time) return 0;
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Date.UTC memetakan tahun 0-99 ke 1900-1999, jadi tolak tahun tersebut.
  if (year < 100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidTimeKey(value: unknown): value is string {
  return typeof value === "string" && TIME_KEY_PATTERN.test(value);
}

/** Date UTC tengah malam untuk kolom Prisma @db.Date. */
export function dateKeyToUtcDate(value: string) {
  if (!isValidDateKey(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Kembalikan Date @db.Date menjadi tanggal kalender tanpa pergeseran zona waktu. */
export function utcDateToDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

/** Instant UTC dari tanggal + jam dinding WIB. */
export function jakartaDateTimeToUtc(dateKey: string, timeKey: string) {
  const date = dateKeyToUtcDate(dateKey);
  if (!date || !isValidTimeKey(timeKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = timeKey.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - JAKARTA_OFFSET_MS);
}

/** Hari ISO: Senin = 1 ... Minggu = 7. */
export function jakartaWeekday(dateKey: string) {
  const date = dateKeyToUtcDate(dateKey);
  if (!date) return 0;
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = dateKeyToUtcDate(dateKey);
  if (!date) return "";
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Selisih hari kalender (to - from). */
export function daysBetweenDateKeys(from: string, to: string) {
  const start = dateKeyToUtcDate(from);
  const end = dateKeyToUtcDate(to);
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

export function eachDateKey(from: string, to: string, maxDays = 366) {
  const start = dateKeyToUtcDate(from);
  const end = dateKeyToUtcDate(to);
  if (!start || !end || start > end) return [];
  const total = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  if (total > maxDays) return [];
  return Array.from({ length: total }, (_, index) =>
    new Date(start.getTime() + index * DAY_MS).toISOString().slice(0, 10),
  );
}

export function monthKeyOf(dateKey: string) {
  return isValidDateKey(dateKey) ? dateKey.slice(0, 7) : "";
}

/** Rentang tanggal untuk input type=month. */
export function monthKeyRange(monthKey: string) {
  const match = MONTH_KEY_PATTERN.exec(monthKey ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 100 || month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${match[1]}-${match[2]}-01`,
    to: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function shiftMonthKey(monthKey: string, delta: number) {
  const match = MONTH_KEY_PATTERN.exec(monthKey ?? "");
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function formatAttendanceDate(dateKey: string) {
  const date = dateKeyToUtcDate(dateKey);
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatAttendanceDateShort(dateKey: string) {
  const date = dateKeyToUtcDate(dateKey);
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatAttendanceMonth(monthKey: string) {
  const range = monthKeyRange(monthKey);
  if (!range) return "-";
  const date = dateKeyToUtcDate(range.from);
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatAttendanceDateTime(value: Date | string | number) {
  const date = validDate(value);
  if (!date) return "-";
  return `${formatAttendanceDate(jakartaDateKey(date))} · ${jakartaTimeKey(date)} WIB`;
}

export { DAY_MS };
