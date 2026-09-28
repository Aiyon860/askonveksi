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

/** Nilai ukuran halaman yang berarti tampilkan semua baris dalam satu halaman. */
export const ALL_PAGE_SIZE = 0;

/** Pilihan baris per halaman untuk tabel pemilih penerima (Broadcast & Pilih Customer). */
export const RECIPIENT_PAGE_SIZES = [10, 25, 100] as const;
export const RECIPIENT_PAGE_SIZE = 10;

/** Rentang baris yang terlihat untuk satu halaman, dengan paginasi dimatikan saat ALL_PAGE_SIZE. */
export function pageWindow(total: number, page: number, pageSize: number) {
  const pageCount = pageSize === ALL_PAGE_SIZE ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const start = pageSize === ALL_PAGE_SIZE ? 0 : (safePage - 1) * pageSize;
  const end = pageSize === ALL_PAGE_SIZE ? total : Math.min(start + pageSize, total);
  return { page: safePage, pageCount, start, end, first: total === 0 ? 0 : start + 1, last: end };
}

/** Potong daftar untuk halaman aktif sekaligus menghitung jendela paginasinya. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number) {
  const window = pageWindow(items.length, page, pageSize);
  return { ...window, items: items.slice(window.start, window.end), total: items.length };
}
