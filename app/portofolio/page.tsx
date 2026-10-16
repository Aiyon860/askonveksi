import type { Metadata } from "next";

import { SiteFooter, SiteNavbar } from "@/components/site-chrome";
import { LandingWhatsAppFab } from "@/components/landing-whatsapp-fab";
import { PortfolioGrid } from "@/components/portfolio-grid";

export const metadata: Metadata = {
  title: "Portofolio",
  description:
    "Portofolio hasil produksi seragam dan apparel custom Askonveksi di Semarang untuk perusahaan, instansi, komunitas, dan brand.",
};

export default function PortofolioPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <SiteNavbar />
      <div className="flex-1">
        <PortfolioGrid />
      </div>
      <SiteFooter />
        <LandingWhatsAppFab />
    </main>
  );
}
