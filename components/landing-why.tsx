import { ArrowRight, BadgeDollarSign, Factory, Handshake, UserRoundCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { LandingReveal, LandingStagger } from "@/components/landing-motion";

const advantages = [
  {
    title: "Pengalaman",
    description: "Bertahun-tahun di industri konveksi dan apparel",
    icon: Handshake,
  },
  {
    title: "Tim Profesional",
    description: "Didukung oleh tenaga kerja terampil dan berpengalaman",
    icon: UserRoundCheck,
  },
  {
    title: "Kapasitas Produksi Besar",
    description: "Siap menangani pemesanan dalam jumlah kecil maupun besar",
    icon: Factory,
  },
  {
    title: "Harga Kompetitif",
    description: "Kualitas terbaik dengan harga yang bersaing",
    icon: BadgeDollarSign,
  },
] as const;

export function LandingWhy() {
  return (
    <section id="tentang-kami" aria-labelledby="why-title" className="relative isolate overflow-hidden bg-[#071d32] text-white">
      <Image src="/hero.jpg" alt="" fill sizes="100vw" className="-z-20 object-cover object-center" aria-hidden="true" />
      <div className="absolute inset-0 -z-10 bg-[#071d32]/90" aria-hidden="true" />

      <div className="mx-auto grid min-h-[19rem] w-[90%] items-center gap-12 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <LandingReveal className="max-w-xl">
          <p className="text-sm font-semibold text-[#9bcaf6]">Mengapa Memilih Askonveksi?</p>
          <h2 id="why-title" className="mt-2 text-balance text-3xl font-bold leading-tight tracking-[-0.025em] sm:text-4xl">
            Layanan Konveksi di Jawa Tengah untuk Kebutuhan Bisnis
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/80 sm:text-base sm:leading-7">
            Kami melayani kebutuhan seragam custom untuk bisnis di Semarang dan berbagai wilayah Jawa Tengah, dari konsultasi desain hingga produk siap dikirim.
          </p>
          <Link
            href="#kontak"
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-landing-control bg-landing-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-landing-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Konsultasikan Kebutuhan
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </LandingReveal>

        <LandingStagger className="grid gap-x-12 gap-y-9 sm:grid-cols-2 lg:gap-x-14">
          {advantages.map(({ title, description, icon: Icon }) => (
            <div key={title} className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/8 text-[#9bcaf6] ring-1 ring-white/10" aria-hidden="true">
                <Icon className="size-6" strokeWidth={1.8} />
              </span>
              <div>
                <h3 className="text-sm font-semibold leading-5 text-white">{title}</h3>
                <p className="mt-1 max-w-56 text-sm leading-5 text-white/70">{description}</p>
              </div>
            </div>
          ))}
        </LandingStagger>
      </div>
    </section>
  );
}
