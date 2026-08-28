export const DATA_PAGE_SIZE = 20;
export const DATA_PAGE_SIZES = [10, DATA_PAGE_SIZE, 50] as const;
export type DataPageSize = (typeof DATA_PAGE_SIZES)[number];
const MAX_PAGE = 10_000;

export function parsePageParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return 1;
  return Math.min(Math.max(Number(raw), 1), MAX_PAGE);
}

export function parsePageSizeParam(value: string | string[] | undefined): DataPageSize {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return DATA_PAGE_SIZES.find((size) => size === parsed) ?? DATA_PAGE_SIZE;
}
