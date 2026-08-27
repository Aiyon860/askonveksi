export function formatCurrency(value: { toString(): string } | string | number | null | undefined) {
  if (value === null || value === undefined) return "—";

  const amount = Number(typeof value === "object" ? value.toString() : value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(value: Date | string | null | undefined, includeTime = false) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export function toDateTimeLocalValue(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const jakartaOffsetMs = 7 * 60 * 60 * 1000;
  return new Date(date.getTime() + jakartaOffsetMs).toISOString().slice(0, 16);
}
