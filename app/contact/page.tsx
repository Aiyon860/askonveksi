import type { Metadata } from "next";

import { ContactCta } from "@/components/contact-cta";
import { ContactFaqForm } from "@/components/contact-faq-form";
import { ContactHeader, ContactInfo } from "@/components/contact-info";
import { ContactMap } from "@/components/contact-map";
import { SiteFooter, SiteNavbar } from "@/components/site-chrome";
import { LandingWhatsAppFab } from "@/components/landing-whatsapp-fab";

export const metadata: Metadata = {
  title: "Kontak Kami",
  description: "Hubungi Askonveksi untuk konsultasi dan pemesanan seragam serta apparel custom.",
};

export default function ContactPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <SiteNavbar />
      <div className="flex-1">
        <ContactHeader />
        <ContactInfo />
        <ContactFaqForm />
        <ContactMap />
        <ContactCta />
      </div>
      <SiteFooter />
        <LandingWhatsAppFab />
    </main>
  );
}
