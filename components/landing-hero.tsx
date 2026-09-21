import { Clock3, MessageCircle, Paintbrush, Spool, Shirt } from "lucide-react";
import Image from "next/image";

import { ASKONVEKSI_WHATSAPP } from "@/lib/contact";

const benefits = [
  {
    icon: Shirt,
    title: "Bahan Berkualitas",
    description: "Pilihan bahan yang nyaman dan tahan lama",
  },
  {
    icon: Spool,
    title: "Jahitan Presisi",
    description: "Hasil rapi dan kuat dengan standar tinggi",
  },
  {
    icon: Paintbrush,
    title: "Custom Desain",
    description: "Bebas desain, warna, ukuran, dan logo",
  },
  {
    icon: Clock3,
    title: "On Time Production",
    description: "Komitmen pada ketepatan waktu produksi",
  },
] as const;

export function LandingHero() {
  return (
    <section id="beranda" aria-labelledby="hero-title" className="flex min-h-[calc(100dvh-4rem)] scroll-mt-16 flex-col">
      <div className="relative isolate flex flex-1 overflow-hidden bg-[#142535] text-white">
        <Image
          src="/hero.jpg"
          alt="Dua pekerja konveksi meninjau desain pakaian di ruang jahit"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[60%_center] lg:object-center"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,28,43,0.15)_0%,rgba(11,28,43,0.45)_35%,rgba(11,28,43,0.94)_80%,#0b1c2b_100%)] lg:bg-[linear-gradient(90deg,#0b1c2b_0%,rgba(11,28,43,0.88)_33%,rgba(11,28,43,0.78)_50%,transparent_66%)]" />

        <div className="relative mx-auto flex w-[90%] flex-col justify-end py-10 sm:py-12 lg:justify-center lg:py-16 lg:pl-6">
          <div className="landing-hero-intro max-w-[52rem]">
            <p className="text-sm font-semibold uppercase tracking-[0.13em] text-[#bdd9f5]">
              Konveksi di Semarang
            </p>
            <h1 id="hero-title" className="mt-4 text-balance text-[clamp(2rem,5vw,2.75rem)] font-bold leading-[1.13] tracking-[-0.025em] sm:text-4xl lg:text-[clamp(1.75rem,2.15vw,2.5rem)]">
              <span className="block lg:whitespace-nowrap">Konveksi di Semarang untuk</span>
              <span className="block max-w-[36rem] text-[#80bcf5]">Seragam dan Apparel Custom</span>
            </h1>
            <p className="mt-5 max-w-[29rem] text-sm leading-6 text-white/90 sm:text-base sm:leading-7 lg:mt-4 lg:text-sm lg:leading-6 xl:text-base">
              Askonveksi melayani pembuatan seragam dan apparel custom untuk perusahaan, instansi, sekolah, komunitas, dan brand di Semarang serta berbagai wilayah Jawa Tengah.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={`https://wa.me/${ASKONVEKSI_WHATSAPP}?text=${encodeURIComponent("Halo Askonveksi, saya ingin konsultasi pembuatan seragam.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-landing-control bg-landing-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-landing-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                Konsultasi Sekarang
              </a>
              <a
                href="#keunggulan"
                className="inline-flex min-h-11 items-center justify-center rounded-landing-control border border-white/65 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Lihat Keunggulan
              </a>
            </div>
          </div>
        </div>
      </div>

      <div id="keunggulan" className="scroll-mt-16 border-b border-[#e3eaf1] bg-white">
        <div className="mx-auto grid w-[90%] grid-cols-2 gap-x-4 gap-y-4 py-8 sm:gap-x-6 sm:py-10 lg:grid-cols-4 lg:gap-0">
          {benefits.map(({ icon: Icon, title, description }) => (
            <div key={title} className="landing-benefit-item flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4 lg:border-l lg:border-[#e3eaf1] lg:px-5 lg:first:border-l-0 lg:first:pl-0 lg:last:pr-0">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[#a5ccef] bg-[#f4f9fe] text-landing-accent sm:size-12" aria-hidden="true">
                <Icon className="size-6" strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-sm font-semibold leading-5 text-[#142535]">{title}</h2>
                <p className="mt-1 text-sm leading-[1.5] text-[#536578]">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
