export const CUSTOMER_HISTORY_PAGE_SIZES = [5, 10, 20] as const;

export function normalizeCustomerHistoryPageSize(value: unknown) {
  const size = Number(value);
  return CUSTOMER_HISTORY_PAGE_SIZES.find((option) => option === size) ?? 5;
}

export type CustomerHistoryData = {
  items: Array<Record<string, unknown>>;
  total: number;
  pageCount: number;
};
