import type { Metadata } from "next";

import { ContactCta } from "@/components/contact-cta";
import { ContactFaqForm } from "@/components/contact-faq-form";
import { ContactHeader, ContactInfo } from "@/components/contact-info";
import { ContactMap } from "@/components/contact-map";
import { LandingFooter } from "@/components/landing-footer";
import { LandingNavbar } from "@/components/landing-navbar";

export const metadata: Metadata = {
  title: "Kontak Kami",
  description: "Hubungi Askonveksi untuk konsultasi dan pemesanan seragam serta apparel custom.",
};

export default function ContactPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <LandingNavbar />
      <div className="flex-1">
        <ContactHeader />
        <ContactInfo />
        <ContactFaqForm />
        <ContactMap />
        <ContactCta />
      </div>
      <LandingFooter />
    </main>
  );
}
