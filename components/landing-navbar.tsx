"use client";

import { ChevronDown, Menu, MessageCircle, Shirt } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LANDING_CONTACT_HREF, LANDING_NAV_LINKS } from "@/lib/navigation";
import { LANDING_PRODUCTS } from "@/lib/products";

const linkClassName =
  "flex min-h-11 items-center rounded-landing-control px-3 text-sm font-medium text-landing-muted underline-offset-4 outline-none transition-colors hover:text-landing-accent hover:underline focus-visible:ring-3 focus-visible:ring-landing-accent/30";

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
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
            href="/#beranda"
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
            {LANDING_NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={linkClassName}>
                {link.label}
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex min-h-11 items-center gap-1.5 rounded-landing-control px-3 text-sm font-medium text-landing-muted underline-offset-4 outline-none transition-colors hover:text-landing-accent hover:underline focus-visible:ring-3 focus-visible:ring-landing-accent/30 aria-expanded:text-landing-accent"
                  >
                    Produk
                    <ChevronDown aria-hidden="true" className="size-4 transition-transform duration-200 aria-expanded:rotate-180" />
                  </button>
                }
              />
              <DropdownMenuContent
                side="bottom"
                align="end"
                sideOffset={8}
                className="w-72 rounded-landing-card border border-landing-border bg-landing-card p-1.5 shadow-[0_12px_28px_rgb(20_37_53/0.14)]"
              >
                {LANDING_PRODUCTS.map((product) => (
                  <DropdownMenuItem
                    key={product.slug}
                    render={<Link href={`/produk/${product.slug}`} />}
                    className="rounded-landing-control px-2 py-2 text-sm text-landing-text outline-none focus:bg-landing-fog focus:text-landing-accent data-highlighted:bg-landing-fog data-highlighted:text-landing-accent"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#D4EEFF]" aria-hidden="true">
                      <Image
                        src={product.gallery[0].src}
                        alt=""
                        width={36}
                        height={36}
                        className="size-full object-contain object-bottom p-0.5"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{product.name}</span>
                      <span className="block truncate text-xs text-landing-muted">{product.tagline}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <a
            href={LANDING_CONTACT_HREF}
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
            <SheetContent side="right" className="gap-0 overflow-y-auto bg-landing-card text-landing-text lg:hidden">
              <SheetHeader className="border-b border-landing-border p-5 pr-14">
                <SheetTitle>Navigasi utama</SheetTitle>
                <SheetDescription className="sr-only">
                  Pilih bagian yang ingin Anda lihat.
                </SheetDescription>
              </SheetHeader>
              <nav aria-label="Navigasi seluler" className="flex flex-col gap-2 p-4">
                {LANDING_NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={linkClassName}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}

                <Collapsible open={productsOpen} onOpenChange={setProductsOpen}>
                  <CollapsibleTrigger
                    className="flex min-h-11 w-full items-center gap-2 rounded-landing-control px-3 text-left text-sm font-medium text-landing-muted underline-offset-4 outline-none transition-colors hover:text-landing-accent focus-visible:ring-3 focus-visible:ring-landing-accent/30 aria-expanded:text-landing-accent"
                  >
                    <Shirt aria-hidden="true" className="size-4" />
                    Produk
                    <ChevronDown aria-hidden="true" className="ml-auto size-4 transition-transform duration-200 aria-expanded:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-3 mt-1 flex flex-col border-l border-landing-border pl-3">
                      {LANDING_PRODUCTS.map((product) => (
                        <Link
                          key={product.slug}
                          href={`/produk/${product.slug}`}
                          className="flex min-h-10 items-center rounded-landing-control px-3 text-sm text-landing-muted underline-offset-4 outline-none transition-colors hover:text-landing-accent hover:underline focus-visible:ring-3 focus-visible:ring-landing-accent/30"
                          onClick={() => {
                            setProductsOpen(false);
                            setOpen(false);
                          }}
                        >
                          {product.name}
                        </Link>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <a
                  href={LANDING_CONTACT_HREF}
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
