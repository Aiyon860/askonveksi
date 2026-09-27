import type { Metadata } from "next";

import { LandingFooter } from "@/components/landing-footer";
import { LandingNavbar } from "@/components/landing-navbar";

export const metadata: Metadata = {
  title: "Portofolio",
};

export default function PortofolioPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <LandingNavbar />
      <div aria-hidden="true" className="flex-1" />
      <LandingFooter />
    </main>
  );
}
