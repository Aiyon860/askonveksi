"use client";

import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { AnimatePresence, MotionConfig, motion, useInView, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { getShortestCarouselDelta, wrapCarouselIndex } from "@/lib/carousel";
import { cn } from "@/lib/utils";

type Testimonial = {
  id: string;
  initials: string;
  name: string;
  quote: string;
};

const testimonials: Testimonial[] = [
  {
    id: "01",
    initials: "MP",
    name: "Muhammad Alaudin Candra Pratama",
    quote: "CAKEUPPP POLLL!!! Sablon Dtf nya high quality, bahannya juga bagus, pengerjaannya cepet bgtt!! Makasih as konveksii🤩 Recommendedd bangett si inehhh💓",
  },
  {
    id: "02",
    initials: "NS",
    name: "Nisrina Salsabila",
    quote: "Hasil sablon nya bagus, bahan nya juga enak pokoknya sesuai sama desain yg dikirim, keren bgtt 🙌🏻",
  },
  {
    id: "03",
    initials: "PR",
    name: "Prokopton",
    quote: "tempatnya oke, menawarkan kualitas bahan yang baik dengan harga yang bersaing, cocok untuk kebutuhan seragam, workshirt atau custom",
  },
  {
    id: "04",
    initials: "KH",
    name: "Kayla Hanania",
    quote: "kualitasnya bagus bangett, jahitannya rapi dan waktu pengerjaannya cepat, juga adminnya sangat responsif🤩🤩",
  },
];

const googleReviewsHref = "https://www.google.com/maps/search/?api=1&query=Askonveksi%20Semarang";

const desktopSlots = [
  { scale: 1, opacity: 1, zIndex: 4 },
  { scale: 0.72, opacity: 0.68, zIndex: 2 },
  { scale: 0.62, opacity: 0, zIndex: 1 },
  { scale: 0.72, opacity: 0.68, zIndex: 2 },
] as const;

const mobileSlots = [
  { scale: 1, opacity: 1, zIndex: 4 },
  { scale: 0.74, opacity: 0.68, zIndex: 2 },
  { scale: 0.62, opacity: 0, zIndex: 1 },
  { scale: 0.74, opacity: 0.68, zIndex: 2 },
] as const;

function TestimonialOrbit({ rotationStep, compact, onSelect }: { rotationStep: number; compact: boolean; onSelect: (index: number) => void }) {
  const slots = compact ? mobileSlots : desktopSlots;
  const activeIndex = wrapCarouselIndex(rotationStep, testimonials.length);

  return (
    <div className={cn("relative mx-auto", compact ? "aspect-[2/1] w-full max-w-sm" : "aspect-square w-full max-w-[420px]")}>
      <div aria-hidden="true" className="absolute inset-[16%] rounded-full bg-landing-cta/70 blur-3xl" />
      <svg
        aria-hidden="true"
        viewBox={compact ? "0 0 360 180" : "0 0 420 420"}
        className="absolute inset-0 size-full overflow-visible text-landing-accent/60"
      >
        <path
          d={
            compact
              ? "M 64 112 A 124 124 0 0 1 138 38 M 222 38 A 124 124 0 0 1 296 112"
              : "M 165 60 A 160 160 0 0 1 260 155 M 260 265 A 160 160 0 0 1 165 360"
          }
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {testimonials.map((testimonial, index) => {
        const slotIndex = wrapCarouselIndex(index - activeIndex, testimonials.length);
        const slot = slots[slotIndex];
        const hidden = slotIndex === 2;
        const active = slotIndex === 0;
        const angle = (compact ? -90 : 0) + index * 90 - rotationStep * 90;

        return (
          <motion.div
            key={testimonial.id}
            initial={false}
            animate={{
              rotate: angle,
              opacity: slot.opacity,
              zIndex: slot.zIndex,
            }}
            transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute h-0 origin-left",
              compact ? "left-1/2 top-[85.6%] w-[34.4%]" : "left-[26.2%] top-1/2 w-[38.1%]",
              hidden && "pointer-events-none",
            )}
          >
            <div className="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2">
              <motion.button
                initial={false}
                type="button"
                aria-current={active ? "true" : undefined}
                aria-hidden={hidden || undefined}
                aria-label={`Tampilkan testimoni ${testimonial.id}`}
                tabIndex={hidden ? -1 : 0}
                onClick={() => onSelect(index)}
                animate={{ rotate: -angle, scale: slot.scale }}
                transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "relative grid place-items-center overflow-hidden rounded-full bg-landing-card text-sm font-semibold tabular-nums text-landing-accent shadow-[0_10px_15px_-3px_rgb(0_0_0/0.12),0_4px_6px_-4px_rgb(0_0_0/0.1)] outline-none focus-visible:ring-3 focus-visible:ring-landing-ring",
                  compact ? "size-[60px]" : "size-[72px]",
                  active ? "ring-4 ring-landing-ring/35" : "ring-2 ring-landing-card",
                )}
              >
                <span aria-hidden="true">{testimonial.initials}</span>
              </motion.button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function LandingTestimonials({ headingClassName }: { headingClassName: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { amount: 0.3 });
  const prefersReducedMotion = useReducedMotion();
  const [rotationStep, setRotationStep] = useState(0);
  const [interactionPause, setInteractionPause] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const motionDisabled = Boolean(prefersReducedMotion);
  const activeIndex = wrapCarouselIndex(rotationStep, testimonials.length);
  const activeTestimonial = testimonials[activeIndex];

  const move = useCallback((step: -1 | 1) => {
    setRotationStep((current) => current + step);
  }, []);

  const select = useCallback((index: number) => {
    setRotationStep((current) => current + getShortestCarouselDelta(wrapCarouselIndex(current, testimonials.length), index, testimonials.length));
  }, []);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (!isInView || interactionPause || !pageVisible || motionDisabled) return;
    const timer = window.setTimeout(() => move(1), 6000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, interactionPause, isInView, motionDisabled, move, pageVisible]);

  return (
    <MotionConfig reducedMotion="user">
      <section
        ref={sectionRef}
        id="testimoni"
        aria-labelledby="testimonials-title"
        className="relative isolate scroll-mt-24 overflow-hidden bg-landing-fog px-5 py-24 sm:px-8 sm:py-32"
        onPointerEnter={() => setInteractionPause(true)}
        onPointerLeave={() => setInteractionPause(false)}
        onFocusCapture={() => setInteractionPause(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteractionPause(false);
        }}
      >
        <div className="mx-auto max-w-[1200px]">
          <header className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
            <h2
              id="testimonials-title"
              className={cn(
                headingClassName,
                "text-balance text-4xl font-semibold leading-tight tracking-[-0.035em] text-landing-text sm:text-5xl lg:text-6xl",
              )}
            >
              Cerita dari Pelanggan Askonveksi
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-landing-muted sm:text-lg lg:mx-0">
              Lihat testimoni selengkapnya pada{" "}
              <a
                href={googleReviewsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-landing-accent underline decoration-landing-accent/45 underline-offset-4 transition-colors hover:text-landing-text focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-landing-ring"
              >
                Google Review kami
              </a>
              .
            </p>
          </header>

          <div
            role="region"
            aria-roledescription="carousel"
            aria-label="Testimoni pelanggan Askonveksi"
            className="mt-12 lg:mt-16 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-16"
          >
            <div className="lg:hidden">
              <TestimonialOrbit rotationStep={rotationStep} compact onSelect={select} />
            </div>
            <div className="hidden lg:block">
              <TestimonialOrbit rotationStep={rotationStep} compact={false} onSelect={select} />
            </div>

            <motion.article
              layout={motionDisabled ? false : true}
              transition={{ layout: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }}
              className="relative mx-auto flex w-full max-w-xl flex-col overflow-hidden rounded-landing-card bg-landing-card p-6 shadow-[0_10px_15px_-3px_rgb(0_0_0/0.1),0_4px_6px_-4px_rgb(0_0_0/0.1)] sm:p-8 lg:p-12"
            >
              <Quote aria-hidden="true" className="size-12 text-landing-ring/55" strokeWidth={1.5} />

              <div aria-live={interactionPause ? "polite" : "off"} aria-atomic="true" className="relative flex items-center py-7">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.blockquote
                    key={activeTestimonial.id}
                    initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -10, filter: "blur(3px)" }}
                    transition={{ duration: motionDisabled ? 0.12 : 0.38, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full"
                  >
                    <p className="text-xl leading-8 tracking-[-0.02em] text-landing-text sm:text-2xl sm:leading-9">
                      {activeTestimonial.quote}
                    </p>
                    <footer className="mt-7 text-sm font-semibold text-landing-text">{activeTestimonial.name}</footer>
                  </motion.blockquote>
                </AnimatePresence>
              </div>

              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-medium tabular-nums text-landing-muted" aria-hidden="true">
                  {String(activeIndex + 1).padStart(2, "0")} / {String(testimonials.length).padStart(2, "0")}
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="landing" size="icon-lg" className="size-11" aria-label="Testimoni sebelumnya" onClick={() => move(-1)}>
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="landing" size="icon-lg" className="size-11" aria-label="Testimoni berikutnya" onClick={() => move(1)}>
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </motion.article>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
