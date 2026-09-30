import type { Metadata } from "next";

import { LandingFooter } from "@/components/landing-footer";
import { LandingNavbar } from "@/components/landing-navbar";
import { SizeChartGrid } from "@/components/size-chart-grid";

export const metadata: Metadata = {
  title: "Size Chart",
  description: "Panduan ukuran pakaian Askonveksi untuk memastikan seragam dan apparel custom Anda pas dipakai.",
};

export default function SizeChartPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <LandingNavbar />
      <div className="flex-1">
        <SizeChartGrid />
      </div>
      <LandingFooter />
    </main>
  );
}
