import { ImageIcon } from "lucide-react";

import { LandingReveal, LandingStagger } from "@/components/landing-motion";
import { PORTFOLIO_ITEMS } from "@/lib/portfolio";

export function PortfolioGrid() {
  return (
    <section aria-labelledby="portfolio-title" className="bg-white pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-24">
      <div className="mx-auto w-[90%]">
        <LandingReveal className="mx-auto max-w-2xl text-center">
          <h1
            id="portfolio-title"
            className="text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-[#142535] sm:text-4xl"
          >
            Portofolio Kami
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#536578] sm:text-base sm:leading-7">
            Kumpulan hasil produksi seragam dan apparel custom untuk perusahaan, instansi, komunitas, dan brand
            yang telah memercayakan kebutuhannya kepada Askonveksi.
          </p>
        </LandingReveal>

        <LandingStagger className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:mt-12 lg:grid-cols-3 lg:gap-6">
          {PORTFOLIO_ITEMS.map((item) => (
            <article
              key={item.name}
              aria-label={item.name}
              className="group overflow-hidden rounded-landing-card border border-[#dde6ee] bg-white outline-none transition-colors focus-visible:ring-3 focus-visible:ring-landing-accent/40 hover:border-landing-accent/40"
            >
              <div aria-hidden="true" className="flex aspect-video items-center justify-center bg-[#e3eaf1]">
                <ImageIcon className="size-10 text-[#9db4c6] sm:size-12" strokeWidth={1.5} />
              </div>
              <div className="flex flex-col items-center gap-2 p-4 text-center sm:p-5">
                <h2 className="text-sm font-semibold leading-6 text-[#17324d] sm:text-base">{item.name}</h2>
                <p>
                  <span className="inline-flex items-center rounded-full bg-[#e4f1fc] px-3 py-1 text-xs font-semibold text-landing-accent">
                    {item.category}
                  </span>
                </p>
              </div>
            </article>
          ))}
        </LandingStagger>
      </div>
    </section>
  );
}
