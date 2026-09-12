const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function jakartaDateKey(date: Date) {
  return new Date(date.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

function jakartaDayStart(value: string) {
  if (!DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day) - JAKARTA_OFFSET_MS);
  return jakartaDateKey(date) === value ? date : null;
}

export function parseDocumentDateRange(
  fromValue: string | string[] | undefined,
  toValue: string | string[] | undefined,
  reference = new Date(),
) {
  const from = first(fromValue)?.trim() ?? "";
  const requestedTo = first(toValue)?.trim() ?? "";
  const today = jakartaDateKey(reference);
  const to = requestedTo || today;
  const start = jakartaDayStart(from);
  const endStart = jakartaDayStart(to);

  if (!start || !endStart || to > today || start > endStart) {
    return { from: "", to: "", start: null, end: null, today };
  }

  return {
    from,
    to,
    start,
    end: new Date(endStart.getTime() + 24 * 60 * 60 * 1000),
    today,
  };
}

export function parseOpenDateRange(
  fromValue: string | string[] | undefined,
  toValue: string | string[] | undefined,
) {
  const from = first(fromValue)?.trim() ?? "";
  const to = first(toValue)?.trim() ?? "";
  const start = from ? jakartaDayStart(from) : null;
  const endStart = to ? jakartaDayStart(to) : null;

  if ((from && !start) || (to && !endStart) || (start && endStart && start > endStart)) {
    return { from: "", to: "", start: null, end: null };
  }

  return { from, to, start, end: endStart ? new Date(endStart.getTime() + 24 * 60 * 60 * 1000) : null };
}
