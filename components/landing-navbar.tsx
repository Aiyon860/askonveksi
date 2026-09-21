"use client";

import { Menu, MessageCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const linkClassName =
  "flex min-h-11 items-center rounded-landing-control px-3 text-sm font-medium text-landing-muted underline-offset-4 outline-none transition-colors hover:text-landing-accent hover:underline focus-visible:ring-3 focus-visible:ring-landing-accent/30";

const navigationItems = [
  { href: "#beranda", label: "Beranda" },
  { href: "#tentang-kami", label: "Tentang Kami" },
  { href: "#produk", label: "Produk" },
  { href: "#testimoni", label: "Testimoni" },
] as const;

const contactHref = "#kontak";

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <motion.header
      initial={reduceMotion ? { opacity: 0.65 } : { opacity: 0, y: -18, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: reduceMotion ? 0.3 : 0.58, ease: [0.16, 1, 0.3, 1] }}
      className="landing-motion sticky top-0 z-40 w-full"
    >
      <nav
        aria-label="Navigasi Askonveksi"
        className="h-16 w-full border-b border-landing-border bg-landing-card"
      >
        <div className="mx-auto flex h-full w-[90%] items-center justify-between gap-3">
          <Link
            href="#beranda"
            className="flex min-h-11 min-w-0 items-center gap-2 rounded-landing-control text-landing-text outline-none transition-colors hover:text-landing-accent focus-visible:ring-3 focus-visible:ring-landing-accent/30 sm:gap-3"
            aria-label="Askonveksi, kembali ke beranda"
          >
            <Image
              src="/brand/askonveksi-mark.png"
              alt=""
              width={494}
              height={410}
              className="h-9 w-auto shrink-0 object-contain sm:h-10"
              priority
            />
            <span className="min-w-0 leading-none">
              <span className="block truncate text-sm font-semibold tracking-[-0.02em] sm:text-base">Askonveksi</span>
              <span className="mt-1 hidden text-sm font-medium uppercase tracking-[0.08em] text-landing-muted sm:block">
                Custom Uniform &amp; Apparel
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex xl:gap-2">
            {navigationItems.map((link) => (
              <Link key={link.href} href={link.href} className={linkClassName}>
                {link.label}
              </Link>
            ))}
          </div>

          <a
            href={contactHref}
            className="hidden min-h-11 shrink-0 items-center gap-2 rounded-landing-control bg-landing-accent px-5 text-sm font-semibold text-white outline-none transition-[background-color,transform] hover:bg-landing-accent/90 focus-visible:ring-3 focus-visible:ring-landing-accent/30 active:translate-y-px lg:inline-flex"
          >
            <MessageCircle aria-hidden="true" className="size-4" />
            Hubungi Kami
          </a>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="size-11 rounded-landing-control lg:hidden"
                  aria-label="Buka menu utama"
                />
              }
            >
              <Menu aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="right" className="gap-0 bg-landing-card text-landing-text lg:hidden">
              <SheetHeader className="border-b border-landing-border p-5 pr-14">
                <SheetTitle>Navigasi utama</SheetTitle>
                <SheetDescription className="sr-only">
                  Pilih bagian yang ingin Anda lihat.
                </SheetDescription>
              </SheetHeader>
              <nav aria-label="Navigasi seluler" className="flex flex-col gap-2 p-4">
                {navigationItems.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={linkClassName}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <a
                  href={contactHref}
                  className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-landing-control bg-landing-accent px-5 text-sm font-semibold text-white outline-none transition-colors hover:bg-landing-accent/90 focus-visible:ring-3 focus-visible:ring-landing-accent/30"
                  onClick={() => setOpen(false)}
                >
                  <MessageCircle aria-hidden="true" className="size-4" />
                  Hubungi Kami
                </a>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </motion.header>
  );
}
