import { LandingFooter } from "@/components/landing-footer";
import { LandingNavbar } from "@/components/landing-navbar";
import { getSiteLogo } from "@/lib/site-logo";

/**
 * Pembungkus server untuk chrome landing publik.
 * Mengambil logo dari profil perusahaan (dengan fallback statis)
 * lalu meneruskannya ke komponen client navbar/footer.
 */
export async function SiteNavbar() {
  const logo = await getSiteLogo();
  return <LandingNavbar logoSrc={logo.src} brandName={logo.name} logoUnoptimized={logo.unoptimized} />;
}

export async function SiteFooter() {
  const logo = await getSiteLogo();
  return <LandingFooter logoSrc={logo.src} brandName={logo.name} logoUnoptimized={logo.unoptimized} />;
}
