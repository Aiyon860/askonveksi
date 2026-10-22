export function exportText(value: string | null | undefined, max = 80) {
  return (value ?? "").trim().slice(0, max);
}

/** "YYYY-MM-DD" (WIB) → Date UTC tengah malam, atau null bila kosong/tidak valid. */
export function exportDate(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function exportDateKey(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function exportDateTime(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

/** Batas eksklusif: `to` = awal hari setelah tanggal "sampai" (WIB). */
export function exportRange(from: Date | null, to: Date | null) {
  if (!from || !to) return null;
  const end = new Date(to.getTime());
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: from, end };
}

export function exportFilterSummary(parts: Array<string | null | false | undefined>) {
  return parts.filter(Boolean).join(" · ");
}
