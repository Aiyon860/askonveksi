import { getPrismaClient } from "@/lib/prisma";
import { BUSINESS_ASSETS_BUCKET, erpStorage } from "@/lib/storage/erp-storage";

export const runtime = "nodejs";
/** Jangan di-prerender saat build; logo harus selalu mengikuti profil terbaru. */
export const dynamic = "force-dynamic";

/**
 * Menyajikan logo profil perusahaan untuk publik (navbar, footer, sidebar).
 * Sengaja tanpa auth: logo adalah identitas publik situs.
 * Satu-satunya data yang keluar adalah file logo itu sendiri — logoPath dari DB
 * divalidasi allowlist ketat sehingga tidak bisa dipakai untuk path traversal.
 */
const LOGO_PATH_PATTERN = /^business\/logo-[A-Za-z0-9-]+\.(png|jpg|jpeg|webp)$/;

function contentTypeFor(path: string): string | null {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  return null;
}

export async function GET() {
  try {
    const profile = await getPrismaClient().businessProfile.findUnique({
      where: { id: "default" },
      select: { logoPath: true },
    });
    const logoPath = profile?.logoPath;
    const contentType = logoPath ? contentTypeFor(logoPath) : null;
    if (!logoPath || !contentType || !LOGO_PATH_PATTERN.test(logoPath)) {
      return new Response("Logo tidak ditemukan.", { status: 404 });
    }
    const { data, error } = await erpStorage(BUSINESS_ASSETS_BUCKET).download(logoPath);
    if (error || !data) return new Response("Logo tidak ditemukan.", { status: 404 });
    // URL memuat `?v=` versi profil, jadi cache immutable aman: ganti logo = URL baru.
    return new Response(await data.arrayBuffer(), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Logo tidak ditemukan.", { status: 404 });
  }
}
