import { ImageIcon } from "lucide-react";
import Image from "next/image";

import { ComingSoonOverlay } from "@/components/coming-soon-overlay";
import { LandingReveal, LandingStagger } from "@/components/landing-motion";
import { RichText } from "@/components/rich-text";
import type { CmsFabric, CmsSiteContent } from "@/lib/cms/types";

const PLACEHOLDER_COUNT = 9;

export function KatalogKainHeader({ fabric }: { fabric: CmsFabric }) {
  return (
    <LandingReveal className="mx-auto max-w-2xl text-center">
      <h1 id="katalog-kain-title" className="text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-[#142535] sm:text-4xl">
        {fabric.title}
      </h1>
      <RichText html={fabric.description} className="mt-3 text-sm leading-6 text-[#5b7186] sm:text-base sm:leading-7" />
    </LandingReveal>
  );
}

export function KatalogKainGrid({ fabric, comingSoon }: { fabric: CmsFabric; comingSoon: CmsSiteContent["comingSoon"] }) {
  const items = fabric.items.filter((item) => item.visible);

  if (fabric.comingSoon) {
    return (
      <ComingSoonOverlay pageName={fabric.title} content={comingSoon}>
        <LandingStagger className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:mt-12 lg:grid-cols-3 lg:gap-4">
          {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
            <div key={`placeholder-${index + 1}`} aria-hidden="true" className="flex aspect-[3/4] items-center justify-center bg-[#e3eaf1]">
              <ImageIcon className="size-8 text-[#9db4c6] sm:size-10" strokeWidth={1.5} />
            </div>
          ))}
        </LandingStagger>
      </ComingSoonOverlay>
    );
  }

  if (!items.length) {
    return (
      <p className="mt-10 rounded-landing-card border border-dashed border-[#c9d8e5] bg-[#f7fafc] p-10 text-center text-sm text-[#647789]">
        Belum ada item kain. Silakan tambahkan dari CMS.
      </p>
    );
  }

  return (
    <LandingStagger className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:mt-12 lg:grid-cols-3 lg:gap-4">
      {items.map((item, index) => (
        <figure key={`${item.name}-${index}`} className="overflow-hidden rounded-landing-card border border-[#dde6ee] bg-white">
          <div className="relative aspect-[3/4] bg-[#e3eaf1]">
            <Image src={item.image.src} alt={item.image.alt || item.name} fill sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw" className="object-cover" />
          </div>
          <figcaption className="p-4 text-center">
            <p className="text-sm font-semibold text-[#17324d]">{item.name}</p>
            <RichText html={item.description} className="mt-1 text-sm text-[#5d7082]" />
          </figcaption>
        </figure>
      ))}
    </LandingStagger>
  );
}
