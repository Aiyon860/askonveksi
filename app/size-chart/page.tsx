import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";

import { LandingWhatsAppFab } from "@/components/landing-whatsapp-fab";
import { SiteFooter, SiteNavbar } from "@/components/site-chrome";
import { SizeChartGrid, SizeChartHeader } from "@/components/size-chart-grid";
import { visibleSections } from "@/lib/cms/selectors";
import { getSiteContent } from "@/lib/cms/store";

export async function generateMetadata(): Promise<Metadata> {
  const { sizeChart } = await getSiteContent();
  return {
    title: sizeChart.seo.title,
    description: sizeChart.seo.description,
    robots: { index: true, follow: true },
    openGraph: {
      title: sizeChart.seo.title,
      description: sizeChart.seo.description,
      images: sizeChart.seo.ogImage ? [sizeChart.seo.ogImage.src] : undefined,
    },
  };
}

export default async function SizeChartPage() {
  const content = await getSiteContent();
  const sections = visibleSections(content.sizeChart.sections);

  const sectionMap: Record<string, ReactNode> = {
    header: (
      <div className="mx-auto w-[90%] pt-10 sm:pt-12 lg:pt-14">
        <SizeChartHeader sizeChart={content.sizeChart} />
      </div>
    ),
    grid: (
      <div className="mx-auto w-[90%] pb-16 sm:pb-20 lg:pb-24">
        <SizeChartGrid sizeChart={content.sizeChart} />
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
