"use client";

import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { ChevronLeft, ChevronRight, XIcon } from "lucide-react";
import Image from "next/image";
import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const products = [
  {
    name: "Kaos",
    src: "/product/kaos.png",
    description:
      "Ringan, nyaman, dan mudah disesuaikan untuk kepanitiaan, komunitas, event, hingga merchandise. Pilih bahan, warna, ukuran, serta sablon atau bordir sesuai identitas kelompok Anda.",
  },
  {
    name: "Kemeja",
    src: "/product/kemeja.png",
    description:
      "Pilihan profesional untuk kantor, organisasi, maupun kegiatan lapangan. Model, bahan, warna, ukuran, dan detail identitas dapat disesuaikan dengan kebutuhan penggunaan.",
  },
  {
    name: "Jersey",
    src: "/product/jersey.png",
    description:
      "Buat klub olahraga tampil kompak dengan desain, nama, nomor, dan warna khas Anda. Material dan potongan dapat disesuaikan agar tetap nyaman saat bergerak.",
  },
  {
    name: "PDH",
    src: "/product/pdh.png",
    description:
      "Seragam organisasi dan instansi yang tegas, rapi, dan sesuai karakter pemakainya. Atur warna, atribut, ukuran, serta detail bordir dalam satu desain yang konsisten.",
  },
  {
    name: "Rompi",
    src: "/product/rompi.png",
    description:
      "Praktis untuk kegiatan lapangan, operasional, panitia, dan komunitas. Model, warna, ukuran, serta penempatan identitas dapat disesuaikan dengan fungsi pemakaian.",
  },
  {
    name: "Apron",
    src: "/product/apron.png",
    description:
      "Buat kru kuliner, workshop, dan layanan terlihat lebih profesional. Pilih model, bahan, warna, ukuran, serta posisi logo sesuai aktivitas kerja.",
  },
  {
    name: "Jaket",
    src: "/product/jaket.png",
    description:
      "Hangat, nyaman, dan berkarakter untuk komunitas, organisasi, maupun kegiatan luar ruang. Sesuaikan model, bahan, warna, ukuran, dan identitas kelompok Anda.",
  },
] as const;

type CarouselOffset = -2 | -1 | 0 | 1 | 2;

const carouselOffsets: CarouselOffset[] = [-2, -1, 0, 1, 2];
const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

const positions: Record<CarouselOffset, string> = {
  [-2]: "hidden md:block md:left-0 md:top-[36%] md:w-[11%] lg:top-[36%] lg:w-[12%]",
  [-1]: "left-0 top-[22%] w-[22%] sm:top-[22%] sm:w-[24%] md:left-[14%] md:top-[30%] md:w-[16%] lg:left-[15%] lg:top-[28%] lg:w-[17%]",
  [0]: "left-[24%] top-[8%] w-[52%] sm:left-[28%] sm:top-[8%] sm:w-[44%] md:left-[33%] md:top-[10%] md:w-[34%] lg:left-[35%] lg:w-[30%]",
  [1]: "left-[78%] top-[22%] w-[22%] sm:left-[76%] sm:top-[22%] sm:w-[24%] md:left-[70%] md:top-[30%] md:w-[16%] lg:left-[68%] lg:top-[28%] lg:w-[17%]",
  [2]: "hidden md:block md:left-[89%] md:top-[36%] md:w-[11%] lg:left-[88%] lg:top-[36%] lg:w-[12%]",
};

const rotations: Record<CarouselOffset, number> = {
  [-2]: -7,
  [-1]: -4,
  [0]: 0,
  [1]: 4,
  [2]: 7,
};

export function LandingProducts({ headingClassName }: { headingClassName: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const activeProduct = products[activeIndex] ?? products[0];
  const modalProduct = products[selectedIndex ?? activeIndex] ?? activeProduct;

  const move = (step: -1 | 1) => {
    setActiveIndex((index) => (index + step + products.length) % products.length);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x <= -60) move(1);
    if (info.offset.x >= 60) move(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    }
  };

  const visibleProducts = carouselOffsets.map((offset) => {
    const index = (activeIndex + offset + products.length) % products.length;
    return { ...products[index], index, offset };
  });

  return (
    <section id="produk" aria-labelledby="products-title" className="scroll-mt-24 bg-landing-canvas px-4 py-24 sm:px-8 sm:py-32">
      <noscript>
        <style>{`.landing-products-reveal{opacity:1!important;transform:none!important;clip-path:none!important}`}</style>
      </noscript>

      <motion.div
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: false, amount: 0.15 }}
        variants={{ hidden: {}, visible: {} }}
        className="mx-auto max-w-[1200px]"
      >
        <motion.h2
          id="products-title"
          variants={{
            hidden: {
              opacity: 0,
              y: 18,
              clipPath: "inset(0 0 100% 0)",
              transition: { duration: 0.26, ease: easeOut },
            },
            visible: {
              opacity: 1,
              y: 0,
              clipPath: "inset(0 0 0% 0)",
              transition: { duration: 0.58, ease: easeOut },
            },
          }}
          className={cn(
            headingClassName,
            "landing-products-reveal text-center text-4xl font-semibold leading-tight tracking-[-0.035em] text-landing-text sm:text-5xl lg:text-6xl",
          )}
        >
          Seragam untuk Setiap Kebutuhan
        </motion.h2>

        <div
          aria-hidden={selectedIndex !== null}
          className={cn(
            "transition-[opacity,transform,filter] duration-300 ease-[var(--ease-out)]",
            selectedIndex !== null && "pointer-events-none scale-[0.98] opacity-0 blur-sm",
          )}
        >
          <motion.div
            role="region"
            aria-roledescription="carousel"
            aria-label="Pilihan produk Askonveksi"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            variants={{
              hidden: {
                opacity: 0,
                y: 44,
                scale: 0.96,
                clipPath: "inset(10% 3% 10% 3% round 16px)",
                transition: { duration: 0.3, ease: easeOut },
              },
              visible: {
                opacity: 1,
                y: 0,
                scale: 1,
                clipPath: "inset(0% 0% 0% 0% round 16px)",
                transition: { duration: 0.7, delay: 0.08, ease: easeOut },
              },
            }}
            className="landing-products-reveal relative mt-10 h-[400px] overflow-hidden text-landing-text outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-landing-ring sm:mt-14 sm:h-[520px] lg:h-[600px]"
          >
            <motion.div
              className="absolute inset-x-11 inset-y-0 z-10 cursor-grab touch-pan-y active:cursor-grabbing sm:inset-x-16 lg:inset-x-20"
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              onDragEnd={handleDragEnd}
            >
              <AnimatePresence initial={false}>
                {visibleProducts.map((product) => (
                  <motion.button
                    layout={reduceMotion ? false : true}
                    type="button"
                    key={product.name}
                    aria-label={
                      product.offset === 0 ? `Buka detail produk ${product.name}` : `Tampilkan produk ${product.name}`
                    }
                    aria-current={product.offset === 0 ? "true" : undefined}
                    aria-haspopup={product.offset === 0 ? "dialog" : undefined}
                    onClick={() =>
                      product.offset === 0 ? setSelectedIndex(product.index) : setActiveIndex(product.index)
                    }
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.86 }}
                    animate={{
                      opacity: product.offset === 0 ? 1 : Math.abs(product.offset) === 1 ? 0.86 : 0.62,
                      rotate: reduceMotion ? 0 : rotations[product.offset],
                      scale: 1,
                      zIndex: product.offset === 0 ? 5 : 3 - Math.abs(product.offset),
                    }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.86 }}
                    transition={{ duration: reduceMotion ? 0.12 : 0.42, ease: easeOut }}
                    className={cn(
                      "absolute aspect-[3/4] outline-none focus-visible:ring-3 focus-visible:ring-landing-ring",
                      positions[product.offset],
                    )}
                  >
                    <Image
                      src={product.src}
                      alt={`Produk ${product.name}`}
                      fill
                      sizes="(max-width: 639px) 45vw, (max-width: 1023px) 32vw, 312px"
                      className="object-contain"
                    />
                  </motion.button>
                ))}
              </AnimatePresence>
            </motion.div>

            <Button
              type="button"
              variant="landing"
              size="icon-lg"
              aria-label="Produk sebelumnya"
              onClick={() => move(-1)}
              className="absolute left-0 top-[34%] z-30 -translate-y-1/2 sm:left-2 sm:top-[37%] md:top-[46%] lg:left-5 lg:top-[47%]"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="landing"
              size="icon-lg"
              aria-label="Produk berikutnya"
              onClick={() => move(1)}
              className="absolute right-0 top-[34%] z-30 -translate-y-1/2 sm:right-2 sm:top-[37%] md:top-[46%] lg:right-5 lg:top-[47%]"
            >
              <ChevronRight aria-hidden="true" />
            </Button>

            <div className="absolute inset-x-12 bottom-2 z-20 text-center sm:bottom-5">
              <p className="text-xl font-semibold tracking-[-0.025em] sm:text-2xl" aria-live="polite">
                {activeProduct.name}
              </p>
              <p className="mt-1 text-xs font-medium tabular-nums text-landing-muted">
                {String(activeIndex + 1).padStart(2, "0")} / {String(products.length).padStart(2, "0")}
              </p>
            </div>
          </motion.div>
        </div>

        <Dialog open={selectedIndex !== null} onOpenChange={(open) => !open && setSelectedIndex(null)}>
          <DialogContent
            showCloseButton={false}
            className="max-h-[calc(100svh-2rem)] gap-0 overflow-visible rounded-3xl bg-transparent p-0 text-landing-text shadow-none ring-0 duration-300 sm:max-w-4xl lg:max-w-5xl"
          >
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scaleX: 0.24, scaleY: 0.96 }}
              animate={{ opacity: 1, scaleX: 1, scaleY: 1 }}
              transition={{ duration: reduceMotion ? 0.18 : 0.56, ease: easeOut }}
              className="relative max-h-[calc(100svh-2rem)] origin-center overflow-x-hidden overflow-y-auto rounded-3xl bg-landing-card shadow-[0_10px_15px_-3px_rgb(0_0_0/0.1),0_4px_6px_-4px_rgb(0_0_0/0.1)] will-change-transform"
            >
              <DialogClose
                render={
                  <Button
                    variant="landing"
                    size="icon-sm"
                    className="absolute right-4 top-4 z-10"
                    aria-label="Tutup detail produk"
                  />
                }
              >
                <XIcon aria-hidden="true" />
              </DialogClose>

              <div className="grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <motion.div
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 72, scale: 0.94 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: reduceMotion ? 0.18 : 0.52, delay: reduceMotion ? 0 : 0.16, ease: easeOut }}
                  className="bg-landing-fog p-3 sm:p-4 md:min-h-[520px]"
                >
                  <div className="relative aspect-[4/3] h-full overflow-hidden rounded-landing-control bg-landing-card md:aspect-auto md:min-h-[488px]">
                    <Image
                      src={modalProduct.src}
                      alt={`Produk ${modalProduct.name}`}
                      fill
                      sizes="(max-width: 767px) calc(100vw - 3.5rem), 420px"
                      className="object-contain"
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: reduceMotion ? 0.18 : 0.46, delay: reduceMotion ? 0 : 0.28, ease: easeOut }}
                  className="flex items-center p-6 sm:p-8 lg:p-12"
                >
                  <DialogHeader className="gap-5 text-left">
                    <DialogTitle
                      className={cn(
                        headingClassName,
                        "text-4xl font-semibold leading-[1.1] tracking-[-0.025em] sm:text-5xl",
                      )}
                    >
                      {modalProduct.name}
                    </DialogTitle>
                    <DialogDescription className="max-w-xl text-base leading-6 text-landing-muted sm:text-lg sm:leading-7">
                      {modalProduct.description}
                    </DialogDescription>
                  </DialogHeader>
                </motion.div>
              </div>
            </motion.div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </section>
  );
}
