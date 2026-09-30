import type { Metadata } from "next";

import { LandingFooter } from "@/components/landing-footer";
import { LandingNavbar } from "@/components/landing-navbar";
import { KatalogKainGrid } from "@/components/katalog-kain-grid";

export const metadata: Metadata = {
  title: "Katalog Kain",
  description: "Katalog pilihan kain Askonveksi untuk seragam dan apparel custom Anda.",
};

export default function KatalogKainPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <LandingNavbar />
      <div className="flex-1">
        <KatalogKainGrid />
      </div>
      <LandingFooter />
    </main>
  );
}
