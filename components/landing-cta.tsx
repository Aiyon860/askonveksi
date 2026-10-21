import { ArrowRight, MessageCircle } from "lucide-react";
import Image from "next/image";

import { LandingReveal } from "@/components/landing-motion";
import { RichText } from "@/components/rich-text";
import { objectPosition, waHref } from "@/lib/cms/selectors";
import type { CmsCtaSection } from "@/lib/cms/types";

export function LandingCta({ section, phone }: { section: CmsCtaSection; phone: string }) {
  return (
    <section id="kontak" aria-labelledby="cta-title" className="relative isolate scroll-mt-20 overflow-hidden bg-[#075eae] text-white">
      <Image
        src={section.image.src}
        alt={section.image.alt}
        fill
        sizes="100vw"
        style={{ objectPosition: objectPosition(section.image.focus) }}
        className="-z-20 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-[#075eae]/88" aria-hidden="true" />

      <LandingReveal className="mx-auto flex min-h-44 w-[90%] flex-col justify-center gap-7 py-8 sm:flex-row sm:items-center sm:justify-between sm:py-7">
        <div>
          <h2 id="cta-title" className="text-2xl font-bold leading-tight tracking-[-0.02em]">
            {section.title}
          </h2>
          <RichText html={section.description} className="mt-3 text-sm leading-6 text-white/85" />
        </div>

        <a
          href={waHref(phone, section.whatsappMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-landing-control bg-white px-5 text-sm font-semibold text-[#075eae] transition-colors hover:bg-[#edf6ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:self-auto"
        >
          <MessageCircle aria-hidden="true" className="size-5" />
          {section.buttonLabel}
          <ArrowRight aria-hidden="true" className="size-4" />
        </a>
      </LandingReveal>
    </section>
  );
}
