import { AsyncLocalStorage } from "node:async_hooks";

import type { Brand } from "./config";

/**
 * Konteks brand pada async context. Nilainya dibaca oleh `contextBrand()`
 * untuk penomoran dokumen. Penting: jangan mengandalkan konteks ini untuk
 * menscope query Prisma — handler ekstensi Prisma berjalan di luar konteks
 * pemanggil. Untuk query pakai `brandScopedClient`/`forBrand`/`allBrands`.
 */
export type BrandContextValue = Brand | "ALL";

const storage = new AsyncLocalStorage<BrandContextValue>();

export function getBrandContext(): BrandContextValue | undefined {
  return storage.getStore();
}

/**
 * Menyimpan brand pada async context yang sedang berjalan. Dipakai resolver
 * request agar query-query berikutnya dalam request yang sama tidak membaca
 * cookie/header berulang kali.
 */
export function setBrandContext(value: BrandContextValue) {
  storage.enterWith(value);
}
