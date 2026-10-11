import type { Metadata } from "next";

import { SiteFooter, SiteNavbar } from "@/components/site-chrome";
import { LandingWhatsAppFab } from "@/components/landing-whatsapp-fab";
import { KatalogKainGrid } from "@/components/katalog-kain-grid";

export const metadata: Metadata = {
  title: "Katalog Kain",
  description: "Katalog pilihan kain Askonveksi untuk seragam dan apparel custom Anda.",
};

export default function KatalogKainPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <SiteNavbar />
      <div className="flex-1">
        <KatalogKainGrid />
      </div>
      <SiteFooter />
        <LandingWhatsAppFab />
    </main>
  );
}
