import { DEFAULT_BRAND, BRAND_COOKIE, type Brand } from "./config";
import { getBrandContext, setBrandContext, type BrandContextValue } from "./context";
import { parseBrandCookie } from "./cookie";

/**
 * Brand aktif untuk request HTTP. Cookie hanya dipercaya bila tanda tangannya
 * valid dan terikat ke user yang sedang login (header `x-user-id` diisi
 * middleware dari klaim Supabase).
 *
 * Di luar request (worker/script) fungsi ini jatuh ke ASKONVEKSI; pekerjaan
 * tersebut wajib memakai `brandScopedClient`/`forBrand` agar brand eksplisit.
 */
async function brandFromNextRequest(): Promise<Brand | null> {
  try {
    const [{ cookies, headers }] = await Promise.all([import("next/headers")]);
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
    const userId = headerStore.get("x-user-id") ?? "";
    return parseBrandCookie(cookieStore.get(BRAND_COOKIE)?.value, userId);
  } catch {
    return null;
  }
}

export async function resolveRequestBrandOrAll(): Promise<BrandContextValue> {
  const explicit = getBrandContext();
  if (explicit) return explicit;

  const brand = (await brandFromNextRequest()) ?? DEFAULT_BRAND;
  // Simpan pada async context saat ini supaya query berikutnya di request yang
  // sama tidak perlu membaca cookie/header lagi.
  setBrandContext(brand);
  return brand;
}

export async function resolveRequestBrand(): Promise<Brand> {
  const brand = await resolveRequestBrandOrAll();
  return brand === "ALL" ? DEFAULT_BRAND : brand;
}
