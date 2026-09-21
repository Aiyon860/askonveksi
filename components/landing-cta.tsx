import { ArrowRight, MessageCircle } from "lucide-react";
import Image from "next/image";

import { LandingReveal } from "@/components/landing-motion";
import { ASKONVEKSI_WHATSAPP } from "@/lib/contact";

export function LandingCta() {
  return (
    <section id="kontak" aria-labelledby="cta-title" className="relative isolate overflow-hidden bg-[#075eae] text-white">
      <Image src="/cta.jpg" alt="Koleksi pakaian produksi Askonveksi" fill sizes="100vw" className="-z-20 object-cover object-center" />
      <div className="absolute inset-0 -z-10 bg-[#075eae]/88" aria-hidden="true" />

      <LandingReveal className="mx-auto flex min-h-44 w-[90%] flex-col justify-center gap-7 py-8 sm:flex-row sm:items-center sm:justify-between sm:py-7">
        <div>
          <h2 id="cta-title" className="text-2xl font-bold leading-tight tracking-[-0.02em]">
            Siap Membuat Seragam Impian Anda?
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/85">
            Konsultasikan kebutuhan apparel bisnis Anda sekarang juga.
            <br className="hidden sm:block" /> Tim kami siap membantu memberikan solusi terbaik.
          </p>
        </div>

        <a
          href={`https://wa.me/${ASKONVEKSI_WHATSAPP}?text=${encodeURIComponent("Halo Askonveksi, saya ingin berkonsultasi mengenai pembuatan seragam.")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-landing-control bg-white px-5 text-sm font-semibold text-[#075eae] transition-colors hover:bg-[#edf6ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:self-auto"
        >
          <MessageCircle aria-hidden="true" className="size-5" />
          Hubungi Kami Sekarang
          <ArrowRight aria-hidden="true" className="size-4" />
        </a>
      </LandingReveal>
    </section>
  );
}
