import { ImageIcon } from "lucide-react";
import Image from "next/image";

import { ComingSoonOverlay } from "@/components/coming-soon-overlay";
import { LandingReveal, LandingStagger } from "@/components/landing-motion";
import { RichText } from "@/components/rich-text";
import type { CmsImage, CmsProduct, CmsSiteContent } from "@/lib/cms/types";

const PLACEHOLDER_COUNT = 9;

export function ProductDetailGallery({ images }: { images: CmsImage[] }) {
  return (
    <LandingStagger className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:mt-12 lg:grid-cols-3 lg:gap-4">
      {images.map((image, index) => (
        <div key={`${image.src}-${index}`} className="relative aspect-[3/2] w-full overflow-hidden bg-[#e3eaf1]">
          <Image
            src={image.src}
            alt={image.alt || `Foto produk ${index + 1}`}
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 26vw"
            className="object-cover"
          />
        </div>
      ))}
    </LandingStagger>
  );
}

export function ProductDetailPlaceholder({
  pageName,
  comingSoon,
}: {
  pageName: string;
  comingSoon: CmsSiteContent["comingSoon"];
}) {
  return (
    <ComingSoonOverlay pageName={pageName} content={comingSoon}>
      <LandingStagger className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:mt-12 lg:grid-cols-3 lg:gap-4">
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
          <div key={`placeholder-${index + 1}`} aria-hidden="true" className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden bg-[#e3eaf1]">
            <ImageIcon className="size-8 text-[#9db4c6] sm:size-10" strokeWidth={1.5} />
          </div>
        ))}
      </LandingStagger>
    </ComingSoonOverlay>
  );
}

export function ProductDetailGrid({ product, comingSoon }: { product: CmsProduct; comingSoon: CmsSiteContent["comingSoon"] }) {
  return (
    <section aria-labelledby="product-detail-title" className="bg-white pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-24">
      <div className="mx-auto w-[90%]">
        <LandingReveal className="mx-auto max-w-2xl text-center">
          <h1 id="product-detail-title" className="text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-[#142535] sm:text-4xl">
            {product.name}
          </h1>
          <RichText html={product.description} className="mt-4 text-sm leading-6 text-[#536578] sm:text-base sm:leading-7" />
        </LandingReveal>

        {product.gallery.length ? (
          <ProductDetailGallery images={product.gallery} />
        ) : (
          <ProductDetailPlaceholder pageName={product.name} comingSoon={comingSoon} />
        )}
      </div>
    </section>
  );
}
