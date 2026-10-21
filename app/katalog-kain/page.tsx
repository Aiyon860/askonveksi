import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";

import { KatalogKainGrid, KatalogKainHeader } from "@/components/katalog-kain-grid";
import { LandingWhatsAppFab } from "@/components/landing-whatsapp-fab";
import { SiteFooter, SiteNavbar } from "@/components/site-chrome";
import { visibleSections } from "@/lib/cms/selectors";
import { getSiteContent } from "@/lib/cms/store";

export async function generateMetadata(): Promise<Metadata> {
  const { fabric } = await getSiteContent();
  return {
    title: fabric.seo.title,
    description: fabric.seo.description,
    robots: { index: true, follow: true },
    openGraph: {
      title: fabric.seo.title,
      description: fabric.seo.description,
      images: fabric.seo.ogImage ? [fabric.seo.ogImage.src] : undefined,
    },
  };
}

export default async function KatalogKainPage() {
  const content = await getSiteContent();
  const sections = visibleSections(content.fabric.sections);

  const sectionMap: Record<string, ReactNode> = {
    header: (
      <div className="mx-auto w-[90%] pt-10 sm:pt-12 lg:pt-14">
        <KatalogKainHeader fabric={content.fabric} />
      </div>
    ),
    grid: (
      <div className="mx-auto w-[90%] pb-16 sm:pb-20 lg:pb-24">
        <KatalogKainGrid fabric={content.fabric} comingSoon={content.comingSoon} />
      </div>
    ),
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
      <LandingWhatsAppFab
        phone={content.site.whatsapp}
        message={content.whatsappFab.message}
        visible={content.whatsappFab.visible}
      />
    </main>
  );
}
