import Image from "next/image";

import { LandingReveal } from "@/components/landing-motion";
import { ASKONVEKSI_WHATSAPP } from "@/lib/contact";
import { CONTACT_CTA } from "@/lib/contact-page";

export function ContactCta() {
  return (
    <section aria-labelledby="contact-cta-title" className="relative isolate overflow-hidden bg-[#edf4fa]">
      <Image
        src="/cta.jpg"
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        className="-z-20 object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-white/70" aria-hidden="true" />

      <div className="mx-auto w-[90%] py-16 sm:py-20">
        <LandingReveal className="mx-auto max-w-xl rounded-landing-card border border-white/60 bg-white/95 p-8 text-center shadow-[0_12px_28px_rgb(20_37_53/0.14)] sm:p-10">
          <h2
            id="contact-cta-title"
            className="text-balance text-2xl font-bold leading-tight tracking-[-0.02em] text-[#142535] sm:text-3xl"
          >
            {CONTACT_CTA.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#536578] sm:text-base sm:leading-7">{CONTACT_CTA.subtitle}</p>
          <a
            href={`https://wa.me/${ASKONVEKSI_WHATSAPP}?text=${encodeURIComponent("Halo Askonveksi, saya ingin meminta penawaran untuk kebutuhan seragam.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex min-h-11 w-full items-center justify-center rounded-landing-control bg-[#142535] px-5 text-sm font-semibold uppercase tracking-[0.06em] text-white outline-none transition-[background-color,transform] duration-200 hover:bg-[#0d1c2b] focus-visible:ring-3 focus-visible:ring-landing-accent/30 active:translate-y-px sm:w-auto sm:min-w-64"
          >
            {CONTACT_CTA.buttonLabel}
          </a>
        </LandingReveal>
      </div>
    </section>
  );
}
