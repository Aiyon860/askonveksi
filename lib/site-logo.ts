import "server-only";

import { unstable_cache } from "next/cache";

import { getPrismaClient } from "@/lib/prisma";
import { SITE_NAME } from "@/lib/site";

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

const getCachedBusinessProfileLogo = unstable_cache(
  async () =>
    getPrismaClient().businessProfile.findUnique({
      where: { id: "default" },
      select: { name: true, logoPath: true, version: true },
    }),
  ["site-logo-profile"],
  { tags: [SITE_LOGO_CACHE_TAG], revalidate: 3600 },
);

/**
 * Logo situs untuk chrome publik (navbar, footer, sidebar, login).
 * Tanpa auth agar bisa dipakai halaman publik; gagal DB saat build/prerender
 * jatuh ke logo statis supaya build tidak pecah.
 */
export async function getSiteLogo(): Promise<SiteLogo> {
  try {
    const profile = await getCachedBusinessProfileLogo();
    const name = profile?.name?.trim() || SITE_NAME;
    if (profile?.logoPath) {
      return { src: `${SITE_LOGO_API_PATH}?v=${profile.version}`, name, unoptimized: true };
    }
    return { src: SITE_LOGO_FALLBACK_SRC, name, unoptimized: false };
  } catch {
    return { src: SITE_LOGO_FALLBACK_SRC, name: SITE_NAME, unoptimized: false };
  }
}
