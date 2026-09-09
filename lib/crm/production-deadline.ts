const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type ProductionDeadlineBaseOption = {
  label: string;
  value: string;
};

type ProductionDeadlineOption = ProductionDeadlineBaseOption & {
  isStoredValue?: boolean;
};

function jakartaDateKey(reference: Date) {
  return new Date(reference.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, monthIndex: month - 1, day };
}

function dateKeyFromParts(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function addDaysToDateKey(value: string, days: number) {
  const { year, monthIndex, day } = parseDateKey(value);
  return dateKeyFromParts(year, monthIndex, day + days);
}

function addMonthsToDateKey(value: string, months: number) {
  const { year, monthIndex, day } = parseDateKey(value);
  const targetMonthStart = new Date(Date.UTC(year, monthIndex + months, 1));
  const targetYear = targetMonthStart.getUTCFullYear();
  const targetMonth = targetMonthStart.getUTCMonth();
  const lastTargetDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return dateKeyFromParts(targetYear, targetMonth, Math.min(day, lastTargetDay));
}

export function formatProductionDeadlineDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function productionDeadlineBaseOptions(reference = new Date()): ProductionDeadlineBaseOption[] {
  const today = jakartaDateKey(reference);
  return [
    { label: `1 minggu (${formatProductionDeadlineDate(addDaysToDateKey(today, 7))})`, value: addDaysToDateKey(today, 7) },
    { label: `2 minggu (${formatProductionDeadlineDate(addDaysToDateKey(today, 14))})`, value: addDaysToDateKey(today, 14) },
    { label: `3 minggu (${formatProductionDeadlineDate(addDaysToDateKey(today, 21))})`, value: addDaysToDateKey(today, 21) },
    { label: `1 bulan (${formatProductionDeadlineDate(addMonthsToDateKey(today, 1))})`, value: addMonthsToDateKey(today, 1) },
  ];
}

export function productionDeadlineOptions(reference = new Date(), storedValue?: string | null): ProductionDeadlineOption[] {
  const options = productionDeadlineBaseOptions(reference);
  if (storedValue && ISO_DATE_PATTERN.test(storedValue) && !options.some((option) => option.value === storedValue)) {
    return [
      { label: `Tanggal tersimpan (${formatProductionDeadlineDate(storedValue)})`, value: storedValue, isStoredValue: true },
      ...options,
    ];
  }
  return options;
}
