"use client";

import { Menu } from "lucide-react";
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
import { landingLinks } from "@/lib/landing-links";

const linkClassName =
  "flex min-h-11 items-center rounded-landing-control px-3 text-sm font-medium text-landing-text underline-offset-4 outline-none transition-colors hover:text-landing-accent hover:underline focus-visible:ring-3 focus-visible:ring-landing-accent/30";

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <motion.header
      initial={reduceMotion ? { opacity: 0.65 } : { opacity: 0, y: -18, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: reduceMotion ? 0.3 : 0.58, ease: [0.16, 1, 0.3, 1] }}
      className="landing-motion sticky top-4 z-40 mx-auto mt-4 w-[calc(100%-2rem)] max-w-[1200px]"
    >
      <nav
        aria-label="Navigasi Askonveksi"
        className="flex h-14 items-center justify-between rounded-landing-nav border border-landing-border bg-landing-card px-4 shadow-[0_2px_8px_rgb(0_0_0/0.08)] md:px-6"
      >
        <Link
          href="#beranda"
          className="flex min-h-11 items-center gap-3 rounded-landing-control text-landing-text outline-none transition-colors hover:text-landing-accent focus-visible:ring-3 focus-visible:ring-landing-accent/30"
          aria-label="Askonveksi, kembali ke beranda"
        >
          <Image
            src="/brand/askonveksi-mark.png"
            alt=""
            width={494}
            height={410}
            className="h-8 w-auto shrink-0 object-contain"
            priority
          />
          <span aria-hidden="true" className="h-5 w-px bg-landing-border" />
          <span className="text-base font-semibold">Askonveksi</span>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          {landingLinks.map((link) => (
            <Link key={link.href} href={link.href} className={linkClassName}>
              {link.label}
            </Link>
          ))}
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                className="rounded-landing-control md:hidden"
                aria-label="Buka menu utama"
              />
            }
          >
            <Menu aria-hidden="true" />
          </SheetTrigger>
          <SheetContent side="right" className="gap-0 bg-landing-card text-landing-text md:hidden">
            <SheetHeader className="border-b border-landing-border p-5 pr-14">
              <SheetTitle>Navigasi utama</SheetTitle>
              <SheetDescription className="sr-only">
                Pilih bagian yang ingin Anda lihat.
              </SheetDescription>
            </SheetHeader>
            <nav aria-label="Navigasi seluler" className="flex flex-col gap-2 p-4">
              {landingLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={linkClassName}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </nav>
    </motion.header>
  );
}
