import type { Metadata } from "next";

import { LandingClients } from "@/components/landing-clients";
import { LandingCta } from "@/components/landing-cta";
import { LandingFooter } from "@/components/landing-footer";
import { LandingHero } from "@/components/landing-hero";
import { LandingNavbar } from "@/components/landing-navbar";
import { LandingProcess } from "@/components/landing-process";
import { LandingProducts } from "@/components/landing-products";
import { LandingTestimonials } from "@/components/landing-testimonials";
import { LandingWhy } from "@/components/landing-why";
import { ASKONVEKSI_WHATSAPP } from "@/lib/contact";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/hero.jpg", width: 1920, height: 1080, alt: "Produksi seragam custom Askonveksi di Semarang" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/hero.jpg"],
  },
  verification: {
    google: "zpSFhEruGw-d1qYEo8_X9PNJdEwqRgTwUsUk3mhqIPs",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#organization`,
      name: SITE_NAME,
      alternateName: "AS Konveksi Semarang",
      url: SITE_URL.toString(),
      logo: new URL("/brand/askonveksi-logo.png", SITE_URL).toString(),
      image: new URL("/hero.jpg", SITE_URL).toString(),
      description: SITE_DESCRIPTION,
      telephone: `+${ASKONVEKSI_WHATSAPP}`,
      sameAs: ["https://www.instagram.com/askonveksi_/"],
      areaServed: [
        { "@type": "City", name: "Semarang" },
        { "@type": "AdministrativeArea", name: "Jawa Tengah" },
      ],
      contactPoint: {
        "@type": "ContactPoint",
        telephone: `+${ASKONVEKSI_WHATSAPP}`,
        contactType: "customer service",
        availableLanguage: ["Indonesian"],
        areaServed: "ID",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      url: SITE_URL.toString(),
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "id-ID",
      publisher: { "@id": `${SITE_URL}#organization` },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <main className="bg-white">
        <LandingNavbar />
        <LandingHero />
        <LandingProducts />
        <LandingProcess />
        <LandingWhy />
        <LandingClients />
        <LandingTestimonials />
        <LandingCta />
        <LandingFooter />
      </main>
    </>
  );
}
