/**
 * Filter papan Pipeline CRM berjalan di browser: peluang yang sudah dimuat disaring
 * tanpa request baru. Semua aturan tinggal di sini supaya bisa diuji terpisah dari UI.
 */

export type PipelineFilters = {
  customerId: string;
  /** Format `YYYY-MM`, zona Jakarta. String kosong berarti semua bulan. */
  month: string;
  /** ID kategori produk, nilai `none`, atau string kosong untuk semua kategori. */
  categoryId: string;
};

export const EMPTY_PIPELINE_FILTERS: PipelineFilters = { customerId: "", month: "", categoryId: "" };

/** Nilai filter khusus untuk peluang yang belum punya kategori produk. */
export const NO_PRODUCT_CATEGORY = "none";

type PipelineFilterItem = {
  createdAt: string;
  customer: { id: string };
  productCategory: { id: string } | null;
};

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isPipelineMonth(value: string) {
  return MONTH_PATTERN.test(value);
}

/** Bulan kalender Jakarta dari timestamp ISO; tanggal tersimpan dalam UTC. */
export function jakartaMonthKey(value: string | null | undefined) {
  if (!value) return "";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";
  return new Date(time + JAKARTA_OFFSET_MS).toISOString().slice(0, 7);
}

/** Label bulan untuk ringkasan filter, mis. `2026-08` menjadi "Agustus 2026". */
export function formatPipelineMonth(month: string) {
  if (!isPipelineMonth(month)) return "";
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, monthNumber - 1, 1)),
  );
}

export function hasActivePipelineFilters(filters: PipelineFilters) {
  return Boolean(filters.customerId || filters.month || filters.categoryId);
}

export function filterPipelineOpportunities<T extends PipelineFilterItem>(
  items: T[],
  filters: PipelineFilters,
): T[] {
  const customerId = filters.customerId.trim();
  const month = isPipelineMonth(filters.month) ? filters.month : "";
  const categoryId = filters.categoryId.trim();

  if (!customerId && !month && !categoryId) return items;

  return items.filter((item) => {
    if (customerId && item.customer.id !== customerId) return false;
    if (month && jakartaMonthKey(item.createdAt) !== month) return false;
    if (categoryId === NO_PRODUCT_CATEGORY) return !item.productCategory;
    if (categoryId && item.productCategory?.id !== categoryId) return false;
    return true;
  });
}
