import type { Metadata } from "next";

import { SiteFooter, SiteNavbar } from "@/components/site-chrome";
import { LandingWhatsAppFab } from "@/components/landing-whatsapp-fab";
import { SizeChartGrid } from "@/components/size-chart-grid";

export const metadata: Metadata = {
  title: "Size Chart",
  description: "Panduan ukuran pakaian Askonveksi untuk memastikan seragam dan apparel custom Anda pas dipakai.",
};

export default function SizeChartPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <SiteNavbar />
      <div className="flex-1">
        <SizeChartGrid />
      </div>
      <SiteFooter />
        <LandingWhatsAppFab />
    </main>
  );
}
