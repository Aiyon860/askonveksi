import { MessageCircle } from "lucide-react";
import Image from "next/image";

import { RichText } from "@/components/rich-text";
import { getCmsIcon } from "@/lib/cms/icons";
import { objectPosition, whatsappCtaHref } from "@/lib/cms/selectors";
import type { CmsHero } from "@/lib/cms/types";

export function LandingHero({ hero, phone }: { hero: CmsHero; phone: string }) {
  const benefits = hero.benefits.filter((benefit) => benefit.visible);
  const primaryHref = whatsappCtaHref(hero.primaryCta.href, phone, hero.primaryCta.whatsappMessage);

  return (
    <section id="beranda" aria-labelledby="hero-title" className="flex min-h-[calc(100dvh-4rem)] scroll-mt-16 flex-col">
      <div className="relative isolate flex flex-1 overflow-hidden bg-[#142535] text-white">
        <Image
          src={hero.image.src}
          alt={hero.image.alt}
          fill
          priority
          sizes="100vw"
          style={{ objectPosition: objectPosition(hero.image.focus) }}
          className="object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,28,43,0.15)_0%,rgba(11,28,43,0.45)_35%,rgba(11,28,43,0.94)_80%,#0b1c2b_100%)] lg:bg-[linear-gradient(90deg,#0b1c2b_0%,rgba(11,28,43,0.88)_33%,rgba(11,28,43,0.78)_50%,transparent_66%)]" />

        <div className="relative mx-auto flex w-[90%] flex-col justify-end py-10 sm:py-12 lg:justify-center lg:py-16 lg:pl-6">
          <div className="landing-hero-intro max-w-[52rem]">
            <p className="text-sm font-semibold uppercase tracking-[0.13em] text-[#bdd9f5]">{hero.eyebrow}</p>
            <h1 id="hero-title" className="mt-4 text-balance text-[clamp(2rem,5vw,2.75rem)] font-bold leading-[1.13] tracking-[-0.025em] sm:text-4xl lg:text-[clamp(1.75rem,2.15vw,2.5rem)]">
              <span className="block lg:whitespace-nowrap">{hero.titleLine1}</span>
              <span className="block max-w-[36rem] text-[#80bcf5]">{hero.titleLine2}</span>
            </h1>
            <RichText html={hero.description} className="mt-5 max-w-[29rem] text-sm leading-6 text-white/90 sm:text-base sm:leading-7 lg:mt-4 lg:text-sm lg:leading-6 xl:text-base" />
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={primaryHref}
                target={primaryHref.startsWith("http") ? "_blank" : undefined}
                rel={primaryHref.startsWith("http") ? "noopener noreferrer" : undefined}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-landing-control bg-landing-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-landing-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                {hero.primaryCta.label}
              </a>
              <a
                href={hero.secondaryCta.href}
                className="inline-flex min-h-11 items-center justify-center rounded-landing-control border border-white/65 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {hero.secondaryCta.label}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div id="keunggulan" className="scroll-mt-16 border-b border-[#e3eaf1] bg-white">
        <div className="mx-auto grid w-[90%] grid-cols-2 gap-x-4 gap-y-4 py-8 sm:gap-x-6 sm:py-10 lg:grid-cols-4 lg:gap-0">
          {benefits.map((benefit) => {
            const Icon = getCmsIcon(benefit.icon);
            return (
              <div key={benefit.title} className="landing-benefit-item flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4 lg:border-l lg:border-[#e3eaf1] lg:px-5 lg:first:border-l-0 lg:first:pl-0 lg:last:pr-0">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[#a5ccef] bg-[#f4f9fe] text-landing-accent sm:size-12" aria-hidden="true">
                  <Icon className="size-6" strokeWidth={1.8} />
                </span>
                <div>
                  <h2 className="text-sm font-semibold leading-5 text-[#142535]">{benefit.title}</h2>
                  <p className="mt-1 text-sm leading-[1.5] text-[#536578]">{benefit.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
