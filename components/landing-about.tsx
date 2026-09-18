"use client";

import Image from "next/image";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef, type CSSProperties } from "react";

import ScrollReveal from "@/components/react-bits/scroll-reveal";
import { cn } from "@/lib/utils";

const aboutCopy =
  (
    <>
      Askonveksi membantu <em className="font-normal italic text-landing-muted">komunitas, organisasi, dan perusahaan</em>{" "}
      tampil kompak <strong className="font-semibold">tanpa proses yang membingungkan.</strong>{" "}
      Mulai dari memilih model dan bahan, menyiapkan desain, hingga produksi <em className="font-normal italic text-landing-muted">kaos, jersey, jaket, polo, kemeja, lanyard, dan totebag.</em>{" "}
      Semuanya dapat dikonsultasikan sesuai kebutuhan.
    </>
  );

const floatingIcons = [
  {
    src: "/baju.svg",
    className:
      "left-[5%] top-[10%] size-7 sm:left-[7%] sm:top-[12%] sm:size-8 md:left-[4%] md:top-[14%] md:size-9 lg:left-[7%] lg:top-[17%] lg:size-12",
    x: [0, 8, -4, 0],
    y: [0, -10, 4, 0],
    rotate: [-8, -3, -10, -8],
    duration: 7.2,
  },
  {
    src: "/box.svg",
    className: "hidden md:block md:left-0 md:top-[46%] md:size-8 lg:left-[3%] lg:top-[50%] lg:size-10",
    x: [0, -7, 4, 0],
    y: [0, 8, -4, 0],
    rotate: [6, 2, 8, 6],
    duration: 8.4,
  },
  {
    src: "/cutting.svg",
    className:
      "right-[5%] top-[17%] size-7 sm:right-[8%] sm:top-[19%] sm:size-8 md:right-[4%] md:top-[17%] md:size-9 lg:right-[8%] lg:top-[20%] lg:size-11",
    x: [0, -6, 5, 0],
    y: [0, -9, 4, 0],
    rotate: [8, 4, 10, 8],
    duration: 6.8,
  },
  {
    src: "/sewing.svg",
    className:
      "bottom-[5%] left-[6%] size-7 sm:bottom-[7%] sm:left-[8%] sm:size-8 md:bottom-[12%] md:left-[3%] md:size-9 lg:bottom-[18%] lg:left-[7%] lg:size-12",
    x: [0, 9, -3, 0],
    y: [0, 7, -5, 0],
    rotate: [-5, -1, -7, -5],
    duration: 7.8,
  },
  {
    src: "/print.svg",
    className: "hidden md:block md:bottom-[9%] md:right-0 md:size-8 lg:bottom-[15%] lg:right-[4%] lg:size-10",
    x: [0, -8, 3, 0],
    y: [0, -6, 5, 0],
    rotate: [4, 8, 2, 4],
    duration: 8.8,
  },
];

export function LandingAbout({ headingClassName }: { headingClassName: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const isInView = useInView(sectionRef, { amount: 0.15 });

  return (
    <section
      ref={sectionRef}
      id="tentang"
      aria-labelledby="about-title"
      className="relative isolate flex min-h-[calc(100svh-5rem)] scroll-mt-[-4rem] items-center overflow-hidden bg-landing-fog py-12 sm:py-14 lg:py-16"
    >
      <noscript>
        <style>{`.landing-about-motion{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 mx-auto w-full max-w-[1440px] select-none">
        {floatingIcons.map((icon, index) => (
          <motion.span
            key={icon.src}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.82 }}
            animate={
              isInView
                ? { opacity: reduceMotion ? 0.58 : 0.68, scale: 1 }
                : { opacity: 0, scale: reduceMotion ? 1 : 0.88 }
            }
            transition={{
              duration: isInView ? 0.56 : 0.24,
              delay: isInView && !reduceMotion ? 0.08 + index * 0.06 : 0,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={cn("landing-about-motion absolute", icon.className)}
          >
            <motion.span
              animate={
                isInView && !reduceMotion
                  ? { x: icon.x, y: icon.y, rotate: icon.rotate }
                  : { x: 0, y: 0, rotate: icon.rotate[0] }
              }
              transition={
                isInView && !reduceMotion
                  ? { duration: icon.duration, ease: "easeInOut", repeat: Infinity }
                  : { duration: 0.2 }
              }
              className="block size-full bg-landing-accent"
              style={
                {
                  WebkitMask: `url("${icon.src}") center / contain no-repeat`,
                  mask: `url("${icon.src}") center / contain no-repeat`,
                } as CSSProperties
              }
            />
          </motion.span>
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-5 sm:px-8">
        <motion.h2
          id="about-title"
          className={cn(
            headingClassName,
            "landing-about-motion mb-6 text-center text-4xl font-semibold leading-tight tracking-[-0.035em] text-landing-text sm:mb-8 sm:text-5xl lg:text-6xl",
          )}
          initial={reduceMotion ? false : "hidden"}
          whileInView={reduceMotion ? undefined : "visible"}
          viewport={{ once: false, amount: 0.6 }}
          variants={{
            hidden: { opacity: 0, y: 18, transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } },
            visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
          }}
        >
          Seragam yang Bikin Semua Kompak
        </motion.h2>

        <motion.div
          className="landing-about-motion flex justify-center"
          initial={reduceMotion ? false : "hidden"}
          whileInView={reduceMotion ? undefined : "visible"}
          viewport={{ once: false, amount: 0.6 }}
          variants={{
            hidden: { opacity: 0, scale: 0.94, transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] } },
            visible: {
              opacity: 1,
              scale: 1,
              transition: { duration: 0.65, delay: 0.12, ease: [0.16, 1, 0.3, 1] },
            },
          }}
        >
          <Image
            src="/brand/askonveksi-logo.png"
            alt="Logo Askonveksi"
            width={591}
            height={591}
            className="h-auto w-24 object-contain sm:w-28 lg:w-32"
            loading="lazy"
          />
        </motion.div>

        <ScrollReveal
          baseOpacity={0}
          baseRotation={0}
          blurStrength={6}
          enableBlur
          rotationEnd="bottom 65%"
          wordAnimationEnd="bottom 65%"
          containerClassName="!mt-8 !max-w-[58rem] sm:!mt-10"
          textClassName="!text-center !font-normal !leading-[1.3] !tracking-[-0.025em]"
        >
          {aboutCopy}
        </ScrollReveal>
      </div>
    </section>
  );
}
