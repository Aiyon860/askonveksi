"use client";

import { ArrowDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

const heroCards = [
  {
    alt: "Proses pemeriksaan hasil sablon pada kaos",
    src: "/hero-element/1.png",
    sizes: "(max-width: 767px) 120px, (max-width: 1023px) 160px, 192px",
    className: "left-4 top-24 w-[120px] md:left-[7%] md:top-[10%] md:w-40 lg:left-[8%] lg:top-[11%] lg:w-48",
    rotate: -3,
    enterX: -56,
    enterY: -44,
    loading: "eager" as const,
  },
  {
    alt: "Proses pengeringan sablon pada kain",
    src: "/hero-element/2.png",
    sizes: "(max-width: 767px) 120px, (max-width: 1023px) 160px, 192px",
    className: "bottom-8 right-4 w-[120px] md:bottom-auto md:right-[7%] md:top-[11%] md:w-40 lg:right-[8%] lg:top-[12%] lg:w-48",
    rotate: 3,
    enterX: 56,
    enterY: -40,
    loading: "eager" as const,
  },
  {
    alt: "Proses pembuatan desain produk",
    src: "/hero-element/3.png",
    sizes: "(max-width: 1023px) 160px, 192px",
    className: "bottom-[12%] left-[7%] hidden w-40 md:block lg:bottom-[13%] lg:left-[8%] lg:w-48",
    rotate: 2,
    enterX: -52,
    enterY: 46,
  },
  {
    alt: "Proses pemeriksaan hasil produksi jersey",
    src: "/hero-element/4.png",
    sizes: "(max-width: 1023px) 160px, 192px",
    className: "bottom-[12%] right-[7%] hidden w-40 md:block lg:bottom-[14%] lg:right-[8%] lg:w-48",
    rotate: -2,
    enterX: 52,
    enterY: 46,
  },
  {
    alt: "Proses sablon kaos dengan mesin press",
    src: "/hero-element/5.png",
    sizes: "176px",
    className: "bottom-[3%] left-[28%] hidden w-44 lg:block",
    rotate: -2,
    enterX: -24,
    enterY: 58,
  },
  {
    alt: "Proses produksi pakaian di workshop",
    src: "/hero-element/6.png",
    sizes: "176px",
    className: "bottom-[3%] right-[28%] hidden w-44 lg:block",
    rotate: 2,
    enterX: 24,
    enterY: 58,
  },
] as const;

export function LandingHero({ headingClassName }: { headingClassName: string }) {
  const reduceMotion = useReducedMotion();
  const copyHidden = reduceMotion
    ? { opacity: 0.55 }
    : {
        opacity: 0,
        y: 24,
        filter: "blur(7px)",
        clipPath: "inset(0 0 18% 0)",
        transition: { duration: 0.28, ease: easeOut },
      };

  return (
    <section
      id="beranda"
      aria-labelledby="hero-title"
      className="landing-grid relative isolate flex min-h-[820px] scroll-mt-24 items-center justify-center overflow-hidden px-5 py-32 sm:px-8 md:min-h-[860px] lg:min-h-[900px]"
    >
      <noscript>
        <style>{`.landing-motion{opacity:1!important;transform:none!important;filter:none!important;clip-path:none!important}`}</style>
      </noscript>

      <motion.div
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: false, amount: 0.2 }}
        variants={{
          hidden: {},
          visible: { transition: { delayChildren: 0.14, staggerChildren: reduceMotion ? 0.04 : 0.1 } },
        }}
        className="relative z-20 flex max-w-3xl flex-col items-center text-center"
      >
        <motion.h1
          id="hero-title"
          variants={{
            hidden: copyHidden,
            visible: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              clipPath: "inset(0 0 0% 0)",
              transition: { duration: 0.72, ease: easeOut },
            },
          }}
          className={cn(
            headingClassName,
            "landing-motion max-w-3xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-landing-text sm:text-6xl lg:text-8xl",
          )}
        >
          Rajanya Pembuatan Seragam
        </motion.h1>
        <motion.p
          variants={{
            hidden: copyHidden,
            visible: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              clipPath: "inset(0 0 0% 0)",
              transition: { duration: 0.62, ease: easeOut },
            },
          }}
          className="landing-motion mt-6 max-w-xl text-pretty text-base leading-7 text-landing-muted sm:text-lg"
        >
          Bikin seragam custom untuk komunitas, organisasi, acara, dan perusahaan. Dari kaos sampai kemeja,
          konsultasi dan desainnya gratis.
        </motion.p>
        <motion.a
          href="#form-kontak"
          variants={{
            hidden: copyHidden,
            visible: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              clipPath: "inset(0 0 0% 0)",
              transition: { duration: 0.52, ease: easeOut },
            },
          }}
          whileHover={reduceMotion ? undefined : { y: -3 }}
          whileTap={{ scale: 0.97 }}
          className={cn(buttonVariants({ variant: "landing", size: "lg" }), "landing-motion mt-8 min-h-11 px-5")}
        >
          Mulai Konsultasi Gratis
          <ArrowDown data-icon="inline-end" aria-hidden="true" />
        </motion.a>
      </motion.div>

      {heroCards.map((card, index) => (
        <motion.figure
          key={card.src}
          initial={reduceMotion ? false : "hidden"}
          whileInView={reduceMotion ? undefined : "visible"}
          viewport={{ once: false, amount: 0.15 }}
          variants={{
            hidden: {
              opacity: 0,
              x: card.enterX,
              y: card.enterY,
              scale: 0.9,
              rotate: card.rotate + Math.sign(card.rotate) * 5,
              filter: "blur(6px)",
              transition: { duration: 0.28, ease: easeOut },
            },
            visible: {
              opacity: 1,
              x: 0,
              y: 0,
              scale: 1,
              rotate: card.rotate,
              filter: "blur(0px)",
              transition: { duration: 0.72, delay: 0.18 + index * 0.07, ease: easeOut },
            },
          }}
          whileHover={reduceMotion ? undefined : { y: -7, rotate: 0, scale: 1.025 }}
          className={cn(
            "landing-motion absolute z-10 rounded-landing-card bg-landing-card p-2 shadow-[0_10px_15px_-3px_rgb(0_0_0/0.1),0_4px_6px_-4px_rgb(0_0_0/0.1)]",
            card.className,
          )}
        >
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-landing-control bg-landing-fog">
            <Image
              src={card.src}
              alt={card.alt}
              fill
              sizes={card.sizes}
              className="object-cover"
              loading={"loading" in card ? card.loading : "lazy"}
            />
          </div>
          <motion.span
            aria-hidden="true"
            initial={reduceMotion ? false : "hidden"}
            whileInView={reduceMotion ? undefined : "visible"}
            viewport={{ once: false, amount: 0.5 }}
            variants={{
              hidden: { opacity: 0, y: -8, transition: { duration: 0.16, ease: easeOut } },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.28, delay: 0.62 + index * 0.07, ease: easeOut },
              },
            }}
            className="landing-pin"
          />
        </motion.figure>
      ))}
    </section>
  );
}
