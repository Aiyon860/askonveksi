import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";

import { LandingCta } from "@/components/landing-cta";
import { LandingWhatsAppFab } from "@/components/landing-whatsapp-fab";
import { PortfolioGrid, PortfolioHeader } from "@/components/portfolio-grid";
import { SiteFooter, SiteNavbar } from "@/components/site-chrome";
import { visibleSections } from "@/lib/cms/selectors";
import { getSiteContent } from "@/lib/cms/store";

export async function generateMetadata(): Promise<Metadata> {
  const { portfolio } = await getSiteContent();
  return {
    title: portfolio.seo.title,
    description: portfolio.seo.description,
    robots: { index: true, follow: true },
    openGraph: {
      title: portfolio.seo.title,
      description: portfolio.seo.description,
      images: portfolio.seo.ogImage ? [portfolio.seo.ogImage.src] : undefined,
    },
  };
}

export default async function PortofolioPage() {
  const content = await getSiteContent();
  const phone = content.site.whatsapp;
  const sections = visibleSections(content.portfolio.sections);

  const sectionMap: Record<string, ReactNode> = {
    header: (
      <div className="mx-auto w-[90%] pt-10 sm:pt-12 lg:pt-14">
        <PortfolioHeader portfolio={content.portfolio} />
      </div>
    ),
    grid: (
      <div className="mx-auto w-[90%] pb-16 sm:pb-20 lg:pb-24">
        <PortfolioGrid portfolio={content.portfolio} />
      </div>
    ),
    cta: <LandingCta section={content.home.cta} phone={phone} />,
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
