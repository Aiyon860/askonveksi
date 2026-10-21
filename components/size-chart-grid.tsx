import Image from "next/image";

import { LandingReveal, LandingStagger } from "@/components/landing-motion";
import { RichText } from "@/components/rich-text";
import type { CmsSizeChart } from "@/lib/cms/types";

export function SizeChartHeader({ sizeChart }: { sizeChart: CmsSizeChart }) {
  return (
    <LandingReveal className="mx-auto max-w-2xl text-center">
      <h1 id="size-chart-title" className="text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-[#142535] sm:text-4xl">
        {sizeChart.title}
      </h1>
      <RichText html={sizeChart.description} className="mt-3 text-sm leading-6 text-[#5b7186] sm:text-base sm:leading-7" />
    </LandingReveal>
  );
}

export function SizeChartGrid({ sizeChart }: { sizeChart: CmsSizeChart }) {
  if (!sizeChart.images.length) {
    return (
      <p className="mt-10 rounded-landing-card border border-dashed border-[#c9d8e5] bg-[#f7fafc] p-10 text-center text-sm text-[#647789]">
        Belum ada gambar size chart. Silakan tambahkan dari CMS.
      </p>
    );
  }
  return (
    <LandingStagger className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:mt-12 lg:grid-cols-3 lg:gap-4">
      {sizeChart.images.map((image, index) => (
        <figure key={`${image.src}-${index}`} className="relative aspect-square w-full overflow-hidden bg-[#e3eaf1]">
          <Image
            src={image.src}
            alt={image.alt || `Size chart Askonveksi ${index + 1}`}
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
            className="object-cover"
            priority={index < 3}
          />
        </figure>
      ))}
    </LandingStagger>
  );
}
