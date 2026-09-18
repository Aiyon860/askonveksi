import type { Metadata } from "next";
import { Fraunces, Sora } from "next/font/google";

import { ContactPage } from "@/components/contact-page";
import { LandingAbout } from "@/components/landing-about";
import { LandingClients } from "@/components/landing-clients";
import { LandingFooter } from "@/components/landing-footer";
import { LandingHero } from "@/components/landing-hero";
import { LandingNavbar } from "@/components/landing-navbar";
import { LandingProducts } from "@/components/landing-products";
import { LandingTestimonials } from "@/components/landing-testimonials";
import { cn } from "@/lib/utils";

const fraunces = Fraunces({ subsets: ["latin"], weight: "variable", display: "swap" });
const sora = Sora({ subsets: ["latin"], weight: "variable", display: "swap" });

export const metadata: Metadata = {
  title: "Askonveksi | Konveksi Seragam Custom Semarang",
  description:
    "Buat kaos, jersey, jaket, polo, kemeja, lanyard, totebag, dan seragam custom bersama Askonveksi. Konsultasi dan desain gratis via WhatsApp.",
};

export default function LandingPage() {
  return (
    <main className={cn(sora.className, "min-h-screen bg-landing-canvas")}>
      <LandingNavbar />
      <LandingHero headingClassName={fraunces.className} />
      <LandingAbout headingClassName={fraunces.className} />
      <LandingClients headingClassName={fraunces.className} />
      <LandingProducts headingClassName={fraunces.className} />
      <LandingTestimonials headingClassName={fraunces.className} />
      <ContactPage headingClassName={fraunces.className} />
      <LandingFooter headingClassName={fraunces.className} />
    </main>
  );
}
