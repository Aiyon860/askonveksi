import Image from "next/image";

import { LandingCta } from "@/components/landing-cta";
import { LandingReveal, LandingStagger } from "@/components/landing-motion";
import { PORTFOLIO_ITEMS } from "@/lib/portfolio";

export function PortfolioGrid() {
  return (
    <>
      <section aria-labelledby="portfolio-title" className="bg-white pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-24">
        <div className="mx-auto w-[90%]">
          <LandingReveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-landing-accent">
              Dipercaya {PORTFOLIO_ITEMS.length} perusahaan &amp; instansi
            </p>
            <h1
              id="portfolio-title"
              className="mt-2 text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-[#142535] sm:text-4xl"
            >
              Portofolio Kami
            </h1>
            <p className="mt-4 text-sm leading-6 text-[#536578] sm:text-base sm:leading-7">
              Kumpulan hasil produksi seragam dan apparel custom untuk perusahaan, instansi, komunitas, dan brand
              yang telah memercayakan kebutuhannya kepada Askonveksi.
            </p>
          </LandingReveal>

          <LandingStagger className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:mt-12 lg:grid-cols-3 lg:gap-6">
            {PORTFOLIO_ITEMS.map((item, index) => (
              <article
                key={item.name}
                className="group overflow-hidden rounded-landing-card border border-[#dde6ee] bg-white outline-none transition-[transform,box-shadow,border-color] duration-300 focus-visible:ring-3 focus-visible:ring-landing-accent/40 hover:-translate-y-1 hover:border-landing-accent/40 hover:shadow-[0_16px_32px_-12px_rgb(20_37_53/0.22)]"
              >
                <div className="relative aspect-video bg-landing-fog p-8 ring-1 ring-inset ring-[#dde6ee]/60 sm:p-10">
                  <span
                    aria-hidden="true"
                    className="absolute top-3 left-4 text-xs font-bold tabular-nums tracking-[0.08em] text-[#9db4c6]"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="relative h-full w-full">
                    <Image
                      src={item.src}
                      alt={`Logo ${item.name}`}
                      fill
                      sizes="(max-width: 639px) 90vw, (max-width: 1023px) 45vw, 28vw"
                      className="object-contain transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 p-4 text-center sm:p-5">
                  <h2 className="text-sm font-semibold leading-6 text-[#17324d] sm:text-base">{item.name}</h2>
                </div>
              </article>
            ))}
          </LandingStagger>
        </div>
      </section>
      <LandingCta />
    </>
  );
}
