import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";

import { ContactCta } from "@/components/contact-cta";
import { ContactFaqForm } from "@/components/contact-faq-form";
import { ContactHeader, ContactInfo } from "@/components/contact-info";
import { ContactMap } from "@/components/contact-map";
import { LandingWhatsAppFab } from "@/components/landing-whatsapp-fab";
import { SiteFooter, SiteNavbar } from "@/components/site-chrome";
import { visibleSections } from "@/lib/cms/selectors";
import { getSiteContent } from "@/lib/cms/store";

export async function generateMetadata(): Promise<Metadata> {
  const { contact } = await getSiteContent();
  return {
    title: contact.seo.title,
    description: contact.seo.description,
    robots: { index: true, follow: true },
    openGraph: {
      title: contact.seo.title,
      description: contact.seo.description,
      images: contact.seo.ogImage ? [contact.seo.ogImage.src] : undefined,
    },
  };
}

export default async function ContactPage() {
  const content = await getSiteContent();
  const phone = content.site.whatsapp;
  const sections = visibleSections(content.contact.sections);

  const sectionMap: Record<string, ReactNode> = {
    header: <ContactHeader title={content.contact.title} />,
    info: <ContactInfo contact={content.contact} />,
    faq: <ContactFaqForm contact={content.contact} phone={phone} />,
    map: content.contact.map.visible ? <ContactMap map={content.contact.map} /> : null,
    cta: <ContactCta section={content.contact.cta} phone={phone} />,
  };

  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <SiteNavbar />
      <div className="flex-1">
        {sections.map((section) => (
          <Fragment key={section.id}>{sectionMap[section.id] ?? null}</Fragment>
        ))}
      </div>
      <SiteFooter />
      <LandingWhatsAppFab phone={phone} message={content.whatsappFab.message} visible={content.whatsappFab.visible} />
    </main>
  );
}
