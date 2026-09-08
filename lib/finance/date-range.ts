const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type FinanceDateRange = {
  from: string;
  to: string;
  start: Date;
  end: Date;
  label: string;
  isDefault: boolean;
};

export type FinanceReportMode = "range" | "all";

function jakartaDateKey(date: Date) {
  return new Date(date.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

function dateKeyToJakartaStart(value: string) {
  if (!DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day) - JAKARTA_OFFSET_MS);
  return jakartaDateKey(date) === value ? date : null;
}

function defaultMonthRange(reference: Date) {
  const shifted = new Date(reference.getTime() + JAKARTA_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1) - JAKARTA_OFFSET_MS);
  const end = new Date(Date.UTC(month === 11 ? year + 1 : year, (month + 1) % 12, 1) - JAKARTA_OFFSET_MS);

  return {
    from: jakartaDateKey(start),
    to: jakartaDateKey(new Date(end.getTime() - 1)),
    start,
    end,
    isDefault: true,
  };
}

export function parseFinanceDateRange(
  fromValue: string | string[] | undefined,
  toValue: string | string[] | undefined,
  reference = new Date(),
): FinanceDateRange {
  const rawFrom = Array.isArray(fromValue) ? fromValue[0] : fromValue;
  const rawTo = Array.isArray(toValue) ? toValue[0] : toValue;
  const defaultRange = defaultMonthRange(reference);
  const fromStart = rawFrom ? dateKeyToJakartaStart(rawFrom) : null;
  const toStart = rawTo ? dateKeyToJakartaStart(rawTo) : null;

  if (!rawFrom || !rawTo || !fromStart || !toStart || fromStart > toStart) {
    return {
      ...defaultRange,
      label: "Bulan berjalan",
    };
  }

  const end = new Date(toStart.getTime() + 24 * 60 * 60 * 1000);

  return {
    from: rawFrom,
    to: rawTo,
    start: fromStart,
    end,
    label: rawFrom === rawTo ? rawFrom : `${rawFrom} sampai ${rawTo}`,
    isDefault: rawFrom === defaultRange.from && rawTo === defaultRange.to,
  };
}

export function parseFinanceReportMode(value: unknown): FinanceReportMode {
  return value === "all" ? "all" : "range";
}
