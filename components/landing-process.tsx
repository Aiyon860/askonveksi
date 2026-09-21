import { ArrowRight, BadgeCheck, ClipboardCheck, MessagesSquare, Shirt, Truck } from "lucide-react";
import Image from "next/image";
import { Fragment } from "react";

import { LandingReveal } from "@/components/landing-motion";

const productionSteps = [
  {
    title: "Konsultasi & Desain",
    description: "Diskusi kebutuhan, konsep, dan desain",
    icon: MessagesSquare,
  },
  {
    title: "Pemilihan Bahan",
    description: "Bahan sesuai spesifikasi",
    icon: ClipboardCheck,
  },
  {
    title: "Produksi",
    description: "Cutting, jahit, bordir/sablon",
    icon: Shirt,
  },
  {
    title: "Finishing",
    description: "Quality control dan packing",
    icon: BadgeCheck,
  },
  {
    title: "Pengiriman",
    description: "Tepat waktu ke seluruh Indonesia",
    icon: Truck,
  },
] as const;

export function LandingProcess() {
  return (
    <section id="proses" aria-labelledby="process-title" className="bg-white">
      <div className="grid w-full overflow-hidden lg:min-h-[28rem] lg:grid-cols-[42%_58%]">
        <LandingReveal className="relative min-h-[22rem] overflow-hidden sm:min-h-[28rem] lg:min-h-full">
          <Image
            src="/tailor.jpg"
            alt="Proses pemotongan kain di workshop Askonveksi"
            fill
            sizes="(max-width: 1023px) 90vw, 38vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#071726]/75 to-transparent" aria-hidden="true" />
          <p className="absolute bottom-7 left-7 max-w-48 text-xl font-bold italic leading-snug text-white sm:bottom-9 sm:left-9 sm:text-2xl">
            Dari Desain
            <br />
            Hingga Siap Pakai
          </p>
        </LandingReveal>

        <LandingReveal className="flex flex-col justify-center px-6 py-12 sm:px-10 sm:py-14 lg:px-12 xl:px-16" delay={0.08}>
          <p className="text-sm font-semibold text-landing-accent">Proses Produksi Kami</p>
          <h2 id="process-title" className="mt-2 text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-[#142535] sm:text-4xl">
            Terlengkap, Modern, dan Terpercaya
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#536578] sm:text-base sm:leading-7">
            Dengan dukungan tenaga kerja berpengalaman dan mesin modern, kami memastikan setiap tahap produksi berjalan dengan standar kualitas tinggi.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-2">
            {productionSteps.map((step, index) => {
              const Icon = step.icon;

              return (
                <Fragment key={step.title}>
                  <div className="flex w-full flex-1 flex-col items-center text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-[#dceeff] text-landing-accent ring-1 ring-[#b9daf8]">
                      <Icon aria-hidden="true" className="size-6" strokeWidth={1.8} />
                    </div>
                    <h3 className="mt-4 text-sm font-bold leading-5 text-[#142535]">
                      {index + 1}. {step.title}
                    </h3>
                    <p className="mt-2 max-w-40 text-sm leading-5 text-[#657587]">{step.description}</p>
                  </div>

                  {index < productionSteps.length - 1 && (
                    <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 rotate-90 text-[#92a9bd] sm:mt-4 sm:rotate-0" />
                  )}
                </Fragment>
              );
            })}
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
