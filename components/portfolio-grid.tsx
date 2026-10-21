import Image from "next/image";

import { LandingReveal, LandingStagger } from "@/components/landing-motion";
import { RichText } from "@/components/rich-text";
import type { CmsPortfolio } from "@/lib/cms/types";

export function PortfolioHeader({ portfolio }: { portfolio: CmsPortfolio }) {
  return (
    <LandingReveal className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold text-landing-accent">{portfolio.eyebrow}</p>
      <h1 id="portfolio-title" className="mt-2 text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-[#142535] sm:text-4xl">
        {portfolio.title}
      </h1>
      <RichText html={portfolio.description} className="mt-4 text-sm leading-6 text-[#536578] sm:text-base sm:leading-7" />
    </LandingReveal>
  );
}

export function PortfolioGrid({ portfolio }: { portfolio: CmsPortfolio }) {
  const items = portfolio.items.filter((item) => item.visible);
  return (
    <LandingStagger className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:mt-12 lg:grid-cols-3 lg:gap-6">
      {items.map((item, index) => (
        <article
          key={`${item.name}-${index}`}
          className="group overflow-hidden rounded-landing-card border border-[#dde6ee] bg-white outline-none transition-[transform,box-shadow,border-color] duration-300 focus-visible:ring-3 focus-visible:ring-landing-accent/40 hover:-translate-y-1 hover:border-landing-accent/40 hover:shadow-[0_16px_32px_-12px_rgb(20_37_53/0.22)]"
        >
          <div className="relative aspect-video bg-landing-fog p-8 ring-1 ring-inset ring-[#dde6ee]/60 sm:p-10">
            <span aria-hidden="true" className="absolute top-3 left-4 text-xs font-bold tabular-nums tracking-[0.08em] text-[#9db4c6]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="relative h-full w-full">
              <Image
                src={item.logo.src}
                alt={item.logo.alt || `Logo ${item.name}`}
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
  );
}
