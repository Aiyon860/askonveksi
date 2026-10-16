import Image from "next/image";

import { LandingReveal, LandingStagger } from "@/components/landing-motion";

const SIZE_CHART_IMAGES = [
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.07%20AM.webp", alt: "Size chart Askonveksi 1" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.08%20AM.webp", alt: "Size chart Askonveksi 2" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.08%20AM%20%281%29.webp", alt: "Size chart Askonveksi 3" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.09%20AM.webp", alt: "Size chart Askonveksi 4" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.09%20AM%20%281%29.webp", alt: "Size chart Askonveksi 5" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.09%20AM%20%282%29.webp", alt: "Size chart Askonveksi 6" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.10%20AM.webp", alt: "Size chart Askonveksi 7" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.10%20AM%20%281%29.webp", alt: "Size chart Askonveksi 8" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.10%20AM%20%282%29.webp", alt: "Size chart Askonveksi 9" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.11%20AM.webp", alt: "Size chart Askonveksi 10" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.11%20AM%20%281%29.webp", alt: "Size chart Askonveksi 11" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.11%20AM%20%282%29.webp", alt: "Size chart Askonveksi 12" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.12%20AM.webp", alt: "Size chart Askonveksi 13" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.12%20AM%20%281%29.webp", alt: "Size chart Askonveksi 14" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.12%20AM%20%282%29.webp", alt: "Size chart Askonveksi 15" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.12%20AM%20%283%29.webp", alt: "Size chart Askonveksi 16" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.13%20AM.webp", alt: "Size chart Askonveksi 17" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.13%20AM%20%281%29.webp", alt: "Size chart Askonveksi 18" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.13%20AM%20%282%29.webp", alt: "Size chart Askonveksi 19" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.14%20AM.webp", alt: "Size chart Askonveksi 20" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.14%20AM%20%281%29.webp", alt: "Size chart Askonveksi 21" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.14%20AM%20%282%29.webp", alt: "Size chart Askonveksi 22" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.15%20AM.webp", alt: "Size chart Askonveksi 23" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.15%20AM%20%281%29.webp", alt: "Size chart Askonveksi 24" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.15%20AM%20%282%29.webp", alt: "Size chart Askonveksi 25" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.16%20AM.webp", alt: "Size chart Askonveksi 26" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.16%20AM%20%281%29.webp", alt: "Size chart Askonveksi 27" },
  { src: "/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.16%20AM%20%282%29.webp", alt: "Size chart Askonveksi 28" },
];

export function SizeChartGrid() {
  return (
    <section aria-labelledby="size-chart-title" className="bg-white pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-24">
      <div className="mx-auto w-[90%]">
        <LandingReveal className="mx-auto max-w-2xl text-center">
          <h1
            id="size-chart-title"
            className="text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-[#142535] sm:text-4xl"
          >
            Size chart
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#5b7186] sm:text-base sm:leading-7">
            Panduan ukuran pakaian Askonveksi untuk memastikan seragam dan apparel custom Anda pas dipakai.
          </p>
        </LandingReveal>

        <LandingStagger className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:mt-12 lg:grid-cols-3 lg:gap-4">
          {SIZE_CHART_IMAGES.map((image, index) => (
            <figure
              key={image.src}
              className="relative aspect-square w-full overflow-hidden bg-[#e3eaf1]"
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
                className="object-cover"
                priority={index < 3}
              />
            </figure>
          ))}
        </LandingStagger>
      </div>
    </section>
  );
}
