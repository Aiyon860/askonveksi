import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { LandingReveal, LandingStagger } from "@/components/landing-motion";
import { LANDING_PRODUCTS } from "@/lib/products";
import { cn } from "@/lib/utils";

export function LandingProducts({ activeSlug, showCta = true }: { activeSlug?: string; showCta?: boolean }) {
  return (
    <section id="produk" aria-labelledby="products-title" className="scroll-mt-16 bg-[#edf4fa] py-16 sm:py-20 lg:py-24">
      <div className="mx-auto grid w-[90%] items-center gap-10 lg:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.7fr)] lg:gap-14 xl:gap-20">
        <LandingReveal className="max-w-md">
          <p className="text-sm font-semibold text-landing-accent">Produk Kami</p>
          <h2 id="products-title" className="mt-2 text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-[#142535] sm:text-4xl">
            Berbagai Pilihan Apparel Sesuai Kebutuhan Anda
          </h2>
          <p className="mt-5 text-sm leading-6 text-[#536578] sm:text-base sm:leading-7">
            Kami memproduksi berbagai jenis seragam dan apparel dengan kualitas terbaik, cocok untuk kebutuhan perusahaan, instansi, komunitas, sekolah, dan brand.
          </p>
          {showCta ? (
            <Link
              href="/#katalog-produk"
              className={buttonVariants({ size: "lg", className: "mt-7 h-11 gap-2 rounded-landing-control bg-landing-accent px-5 font-semibold text-white hover:bg-landing-accent/90 has-data-[icon=inline-end]:pr-5" })}
            >
              Lihat Semua Produk
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          ) : null}
        </LandingReveal>

        <LandingStagger id="katalog-produk" className="grid scroll-mt-20 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {LANDING_PRODUCTS.filter((product) => !product.hideFromCatalog).map((product) => (
            <article key={product.slug} className="group h-full overflow-hidden rounded-xl bg-[#fff] shadow-[0_6px_18px_rgb(20_37_53/0.07)]">
              <Link
                href={`/produk/${product.slug}`}
                aria-current={product.slug === activeSlug ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col rounded-xl outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-landing-accent/40",
                  product.slug === activeSlug
                    ? "ring-2 ring-landing-accent"
                    : "hover:shadow-[0_10px_24px_rgb(20_37_53/0.12)]",
                )}
              >
                <div className="relative aspect-square overflow-hidden bg-[#D4EEFF] px-3 pt-3 sm:px-4 sm:pt-4">
                  <Image
                    src={product.gallery[0].src}
                    alt={product.gallery[0].alt}
                    fill
                    sizes="(max-width: 767px) 45vw, (max-width: 1023px) 30vw, 16vw"
                    className="object-contain object-bottom transition-transform duration-300 group-hover:scale-[1.035]"
                  />
                </div>
                <h3 className="flex min-h-11 items-center justify-center px-2 text-center text-sm font-semibold text-[#174d82]">
                  {product.name}
                </h3>
              </Link>
            </article>
          ))}
        </LandingStagger>
      </div>
    </section>
  );
}
