import "server-only";

import { unstable_cache } from "next/cache";

import { BRAND_THEME, DEFAULT_BRAND, brandLabel, type Brand } from "@/lib/brand/config";
import { forBrand } from "@/lib/brand/prisma-extension";
import { getPrismaClient } from "@/lib/prisma";

/** Logo statis yang dipakai saat profil perusahaan belum mengunggah logo. */
export const SITE_LOGO_FALLBACK_SRC = "/new-logo.webp";
/** Endpoint publik (tanpa login) yang menyajikan logo dari profil perusahaan. */
export const SITE_LOGO_API_PATH = "/api/public/business-logo";
/** Cache tag untuk me-refresh logo situs setelah profil perusahaan disimpan. */
export const SITE_LOGO_CACHE_TAG = "site-logo";

export type SiteLogo = {
  /** URL gambar: file statis atau endpoint publik dengan `?v=` pemecah cache. */
  src: string;
  /** Nama perusahaan untuk alt/aria. */
  name: string;
  /** True untuk logo dinamis (lewati optimasi gambar Next). */
  unoptimized: boolean;
};

function getCachedBusinessProfileLogo(brand: Brand) {
  return unstable_cache(
    async () =>
      getPrismaClient().businessProfile.findFirst(
        forBrand(brand, {
          where: {},
          select: { name: true, logoPath: true, version: true },
        }),
      ),
    ["site-logo-profile", brand],
    { tags: [SITE_LOGO_CACHE_TAG], revalidate: 3600 },
  )();
}

/**
 * Logo situs untuk chrome publik (navbar, footer, sidebar, login).
 * Tanpa auth agar bisa dipakai halaman publik; gagal DB saat build/prerender
 * jatuh ke logo statis supaya build tidak pecah.
 */
export async function getSiteLogo(brand: Brand = DEFAULT_BRAND): Promise<SiteLogo> {
  const fallbackSrc = brand === "ASKONVEKSI" ? SITE_LOGO_FALLBACK_SRC : BRAND_THEME[brand].logoSrc;
  try {
    const profile = await getCachedBusinessProfileLogo(brand);
    const name = profile?.name?.trim() || brandLabel(brand);
    if (profile?.logoPath) {
      return { src: `${SITE_LOGO_API_PATH}?brand=${brand}&v=${profile.version}`, name, unoptimized: true };
    }
    return { src: fallbackSrc, name, unoptimized: true };
  } catch {
    return { src: fallbackSrc, name: brandLabel(brand), unoptimized: true };
  }
}
