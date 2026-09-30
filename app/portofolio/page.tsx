import type { Metadata } from "next";

import { LandingFooter } from "@/components/landing-footer";
import { LandingNavbar } from "@/components/landing-navbar";
import { PortfolioGrid } from "@/components/portfolio-grid";

export const metadata: Metadata = {
  title: "Portofolio",
  description:
    "Portofolio hasil produksi seragam dan apparel custom Askonveksi di Semarang untuk perusahaan, instansi, komunitas, dan brand.",
};

export default function PortofolioPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <LandingNavbar />
      <div className="flex-1">
        <PortfolioGrid />
      </div>
      <LandingFooter />
    </main>
  );
}
