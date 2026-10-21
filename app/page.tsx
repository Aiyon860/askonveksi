import type { Metadata } from "next";
import Script from "next/script";
import { Fragment, type ReactNode } from "react";

import { LandingClients } from "@/components/landing-clients";
import { LandingCta } from "@/components/landing-cta";
import { LandingHero } from "@/components/landing-hero";
import { LandingProcess } from "@/components/landing-process";
import { LandingProducts } from "@/components/landing-products";
import { LandingTestimonials } from "@/components/landing-testimonials";
import { LandingWhatsAppFab } from "@/components/landing-whatsapp-fab";
import { LandingWhy } from "@/components/landing-why";
import { SiteFooter, SiteNavbar } from "@/components/site-chrome";
import { catalogProducts, visibleSections } from "@/lib/cms/selectors";
import { getSiteContent } from "@/lib/cms/store";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getSiteContent();
  const url = new URL(site.url);
  const image = site.ogImage?.src ?? "/hero.jpg";
  return {
    title: { absolute: site.title },
    description: site.description,
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
      siteName: site.title,
      title: site.title,
      description: site.description,
      images: [{ url: image, width: 1920, height: 1080, alt: site.ogImage?.alt ?? "Askonveksi" }],
    },
    twitter: {
      card: "summary_large_image",
      title: site.title,
      description: site.description,
      images: [image],
    },
    verification: site.searchConsoleVerification ? { google: site.searchConsoleVerification } : undefined,
    metadataBase: url,
  };
}

export default async function HomePage() {
  const content = await getSiteContent();
  const phone = content.site.whatsapp;
  const sections = visibleSections(content.home.sections);

  const sectionMap: Record<string, ReactNode> = {
    hero: <LandingHero hero={content.home.hero} phone={phone} />,
    products: <LandingProducts section={content.home.products} products={catalogProducts(content)} />,
    process: <LandingProcess section={content.home.process} />,
    why: <LandingWhy section={content.home.why} />,
    clients: <LandingClients section={content.home.clients} />,
    testimonials: <LandingTestimonials section={content.home.testimonials} />,
    cta: <LandingCta section={content.home.cta} phone={phone} />,
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${content.site.url}#organization`,
        name: content.brand.name,
        alternateName: "AS Konveksi Semarang",
        url: content.site.url,
        logo: new URL(content.brand.logo?.src ?? "/new-logo.webp", content.site.url).toString(),
        image: new URL(content.site.ogImage?.src ?? "/hero.jpg", content.site.url).toString(),
        description: content.site.description,
        telephone: `+${content.site.whatsapp}`,
        email: content.site.email,
        sameAs: content.site.socials.filter((social) => social.visible && social.url).map((social) => social.url),
        areaServed: content.site.areaServed.map((area) => ({ "@type": "AdministrativeArea", name: area })),
        contactPoint: {
          "@type": "ContactPoint",
          telephone: `+${content.site.whatsapp}`,
          contactType: "customer service",
          availableLanguage: ["Indonesian"],
          areaServed: "ID",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${content.site.url}#website`,
        url: content.site.url,
        name: content.brand.name,
        description: content.site.description,
        inLanguage: "id-ID",
        publisher: { "@id": `${content.site.url}#organization` },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <main className="bg-white">
        <SiteNavbar />
        {sections.map((section) => (
          <Fragment key={section.id}>{sectionMap[section.id] ?? null}</Fragment>
        ))}
        <SiteFooter />
        <LandingWhatsAppFab phone={phone} message={content.whatsappFab.message} visible={content.whatsappFab.visible} />
      </main>
      {content.site.analyticsId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${content.site.analyticsId}`} strategy="afterInteractive" />
          <Script id="google-analytics" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${content.site.analyticsId}');`}
          </Script>
        </>
      ) : null}
    </>
  );
}
