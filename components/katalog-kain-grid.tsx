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

function FabricImageGrid({
  images,
  categoryTitle,
  priorityCount = 0,
}: {
  images: CmsFabric["categories"][number]["images"];
  categoryTitle: string;
  priorityCount?: number;
}) {
  return (
    <LandingStagger className="mt-5 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 lg:gap-4">
      {images.map((image, index) => (
        <figure key={`${image.src}-${index}`} className="relative aspect-[3/4] w-full overflow-hidden bg-[#e3eaf1]">
          <Image
            src={image.src}
            alt={image.alt || `${categoryTitle} ${index + 1}`}
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
            className="object-cover"
            priority={index < priorityCount}
          />
        </figure>
      ))}
    </LandingStagger>
  );
}

export function KatalogKainGrid({ fabric, comingSoon }: { fabric: CmsFabric; comingSoon: CmsSiteContent["comingSoon"] }) {
  // Guard: cache CMS lama (pra-categories) bisa sempat ter-serve sebelum revalidate.
  const categories = (fabric.categories ?? []).filter((category) => category.visible && category.images.length > 0);

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

  if (!categories.length) {
    return (
      <p className="mt-10 rounded-landing-card border border-dashed border-[#c9d8e5] bg-[#f7fafc] p-10 text-center text-sm text-[#647789]">
        Belum ada kategori kain. Silakan tambahkan dari CMS.
      </p>
    );
  }

  return (
    <div className="mt-10 flex flex-col gap-12 sm:mt-12 sm:gap-14 lg:gap-16">
      {categories.map((category, categoryIndex) => (
        <section key={`${category.title}-${categoryIndex}`} aria-labelledby={`fabric-category-${categoryIndex}`}>
          <LandingReveal>
            <h2
              id={`fabric-category-${categoryIndex}`}
              className="text-balance text-center text-2xl font-bold tracking-[-0.025em] text-[#1764b3] sm:text-3xl"
            >
              {category.title}
            </h2>
          </LandingReveal>
          <FabricImageGrid images={category.images} categoryTitle={category.title} priorityCount={categoryIndex === 0 ? 3 : 0} />
        </section>
      ))}
    </div>
  );
}
