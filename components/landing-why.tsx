import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { LandingReveal, LandingStagger } from "@/components/landing-motion";
import { RichText } from "@/components/rich-text";
import { getCmsIcon } from "@/lib/cms/icons";
import { objectPosition } from "@/lib/cms/selectors";
import type { CmsWhySection } from "@/lib/cms/types";

export function LandingWhy({ section }: { section: CmsWhySection }) {
  const advantages = section.advantages.filter((advantage) => advantage.visible);

  return (
    <section id="tentang-kami" aria-labelledby="why-title" className="relative isolate scroll-mt-20 overflow-hidden bg-[#071d32] text-white">
      <Image
        src={section.image.src}
        alt={section.image.alt}
        fill
        sizes="100vw"
        style={{ objectPosition: objectPosition(section.image.focus) }}
        className="-z-20 object-cover"
        aria-hidden={section.image.alt ? undefined : true}
      />
      <div className="absolute inset-0 -z-10 bg-[#071d32]/90" aria-hidden="true" />

      <div className="mx-auto grid min-h-[19rem] w-[90%] items-center gap-12 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <LandingReveal className="max-w-xl">
          <p className="text-sm font-semibold text-[#9bcaf6]">{section.eyebrow}</p>
          <h2 id="why-title" className="mt-2 text-balance text-3xl font-bold leading-tight tracking-[-0.025em] sm:text-4xl">
            {section.title}
          </h2>
          <RichText html={section.description} className="mt-4 max-w-lg text-sm leading-6 text-white/80 sm:text-base sm:leading-7" />
          {section.cta.visible ? (
            <Link
              href={section.cta.href}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-landing-control bg-landing-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-landing-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {section.cta.label}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </LandingReveal>

        <LandingStagger className="grid gap-x-12 gap-y-9 sm:grid-cols-2 lg:gap-x-14">
          {advantages.map((advantage) => {
            const Icon = getCmsIcon(advantage.icon);
            return (
              <div key={advantage.title} className="flex items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/8 text-[#9bcaf6] ring-1 ring-white/10" aria-hidden="true">
                  <Icon className="size-6" strokeWidth={1.8} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold leading-5 text-white">{advantage.title}</h3>
                  <p className="mt-1 max-w-56 text-sm leading-5 text-white/70">{advantage.description}</p>
                </div>
              </div>
            );
          })}
        </LandingStagger>
      </div>
    </section>
  );
}
