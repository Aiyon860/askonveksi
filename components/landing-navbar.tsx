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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { CmsProductMenuEntry } from "@/lib/cms/selectors";
import type { CmsSiteContent } from "@/lib/cms/types";

const linkClassName =
  "flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-landing-control px-2.5 text-[13px] font-medium text-landing-muted underline-offset-4 outline-none transition-colors hover:text-landing-accent hover:underline focus-visible:ring-3 focus-visible:ring-landing-accent/30 2xl:px-3 2xl:text-sm";

function isGroup(entry: CmsProductMenuEntry): entry is Extract<CmsProductMenuEntry, { children: unknown[] }> {
  return "children" in entry;
}

export function LandingNavbar({
  nav,
  menu,
  brandName,
  logoSrc,
  logoUnoptimized = false,
}: {
  nav: CmsSiteContent["nav"];
  menu: CmsProductMenuEntry[];
  brandName: string;
  logoSrc: string;
  logoUnoptimized?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const items = nav.items.filter((item) => item.visible);

  function closeMobileNav() {
    setProductsOpen(false);
    setOpenSub(null);
    setOpen(false);
  }

  return (
    <motion.header
      initial={reduceMotion ? { opacity: 0.65 } : { opacity: 0, y: -18, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: reduceMotion ? 0.3 : 0.58, ease: [0.16, 1, 0.3, 1] }}
      className="landing-motion sticky top-0 z-40 w-full"
    >
      <nav aria-label={`Navigasi ${brandName}`} className="h-16 w-full border-b border-landing-border bg-landing-card">
        <div className="mx-auto flex h-full w-[90%] items-center justify-between gap-2">
          <Link
            href="/#beranda"
            className="flex min-h-11 min-w-0 shrink-0 items-center gap-2 rounded-landing-control text-landing-text outline-none transition-colors hover:text-landing-accent focus-visible:ring-3 focus-visible:ring-landing-accent/30 sm:gap-3"
            aria-label={`${brandName}, kembali ke beranda`}
          >
            <Image
              src={logoSrc}
              alt={brandName}
              width={1920}
              height={1080}
              className="h-9 w-auto shrink-0 object-contain sm:h-10"
              priority
              unoptimized={logoUnoptimized}
            />
          </Link>

          <div className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 xl:flex 2xl:gap-2">
            {items.map((item) =>
              item.type === "products" ? (
                <DropdownMenu key={`products-${item.label}`}>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-landing-control px-2.5 text-[13px] font-medium text-landing-muted underline-offset-4 outline-none transition-colors hover:text-landing-accent hover:underline focus-visible:ring-3 focus-visible:ring-landing-accent/30 2xl:px-3 2xl:text-sm aria-expanded:text-landing-accent"
                      >
                        {item.label}
                        <ChevronDown aria-hidden="true" className="size-4 transition-transform duration-200 aria-expanded:rotate-180" />
                      </button>
                    }
                  />
                  <DropdownMenuContent
                    side="bottom"
                    align="end"
                    sideOffset={8}
                    className="w-56 rounded-landing-card border border-landing-border bg-landing-card p-1.5 shadow-[0_12px_28px_rgb(20_37_53/0.14)]"
                  >
                    {menu.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-landing-muted">Belum ada produk tampil.</p>
                    ) : (
                      menu.map((entry) =>
                        isGroup(entry) ? (
                          <DropdownMenuSub key={entry.label}>
                            <DropdownMenuSubTrigger className="rounded-landing-control px-3 py-2 text-sm text-landing-text outline-none focus:bg-landing-fog focus:text-landing-accent data-popup-open:bg-landing-fog data-popup-open:text-landing-accent">
                              <Link
                                href={entry.href}
                                className="rounded-landing-control outline-none hover:text-landing-accent hover:underline focus-visible:ring-3 focus-visible:ring-landing-accent/30"
                              >
                                {entry.label}
                              </Link>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-56 rounded-landing-card border border-landing-border bg-landing-card p-1.5 shadow-[0_12px_28px_rgb(20_37_53/0.14)]">
                              {entry.children.map((child) => (
                                <DropdownMenuItem
                                  key={child.href}
                                  render={<Link href={child.href} />}
                                  className="rounded-landing-control px-3 py-2 text-sm text-landing-text outline-none focus:bg-landing-fog focus:text-landing-accent data-highlighted:bg-landing-fog data-highlighted:text-landing-accent"
                                >
                                  {child.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        ) : (
                          <DropdownMenuItem
                            key={entry.href}
                            render={<Link href={entry.href} />}
                            className="rounded-landing-control px-3 py-2 text-sm text-landing-text outline-none focus:bg-landing-fog focus:text-landing-accent data-highlighted:bg-landing-fog data-highlighted:text-landing-accent"
                          >
                            {entry.label}
                          </DropdownMenuItem>
                        ),
                      )
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link key={`${item.href}-${item.label}`} href={item.href} className={linkClassName}>
                  {item.label}
                </Link>
              ),
            )}
          </div>

          {nav.cta.visible ? (
            <a
              href={nav.cta.href}
              className="hidden min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-landing-control bg-landing-accent px-4 text-[13px] font-semibold text-white outline-none transition-[background-color,transform] hover:bg-landing-accent/90 focus-visible:ring-3 focus-visible:ring-landing-accent/30 active:translate-y-px xl:inline-flex 2xl:px-5 2xl:text-sm"
            >
              <MessageCircle aria-hidden="true" className="size-4" />
              {nav.cta.label}
            </a>
          ) : null}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon-lg" className="size-11 rounded-landing-control xl:hidden" aria-label="Buka menu utama" />
              }
            >
              <Menu aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="right" className="gap-0 overflow-y-auto bg-landing-card text-landing-text xl:hidden">
              <SheetHeader className="border-b border-landing-border p-5 pr-14">
                <SheetTitle>{nav.mobileTitle}</SheetTitle>
                <SheetDescription className="sr-only">Pilih bagian yang ingin Anda lihat.</SheetDescription>
              </SheetHeader>
              <nav aria-label="Navigasi seluler" className="flex flex-col gap-2 p-4">
                {items.map((item) =>
                  item.type === "products" ? (
                    <Collapsible key={`products-${item.label}`} open={productsOpen} onOpenChange={setProductsOpen}>
                      <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-2 rounded-landing-control px-3 text-left text-sm font-medium text-landing-muted underline-offset-4 outline-none transition-colors hover:text-landing-accent focus-visible:ring-3 focus-visible:ring-landing-accent/30 aria-expanded:text-landing-accent">
                        <Shirt aria-hidden="true" className="size-4" />
                        {item.label}
                        <ChevronDown aria-hidden="true" className="ml-auto size-4 transition-transform duration-200 aria-expanded:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-landing-border pl-3">
                          {menu.map((entry) =>
                            isGroup(entry) ? (
                              <Collapsible
                                key={entry.label}
                                open={openSub === entry.label}
                                onOpenChange={(next) => setOpenSub(next ? entry.label : null)}
                              >
                                <div className="flex min-h-10 items-center gap-1">
                                  <Link
                                    href={entry.href}
                                    className="flex min-h-10 flex-1 items-center rounded-landing-control px-3 text-left text-sm font-medium text-landing-muted outline-none transition-colors hover:text-landing-accent focus-visible:ring-3 focus-visible:ring-landing-accent/30"
                                    onClick={closeMobileNav}
                                  >
                                    {entry.label}
                                  </Link>
                                  <CollapsibleTrigger
                                    aria-label={`Tampilkan sub-produk ${entry.label}`}
                                    className="flex size-10 shrink-0 items-center justify-center rounded-landing-control text-landing-muted outline-none transition-colors hover:text-landing-accent focus-visible:ring-3 focus-visible:ring-landing-accent/30 aria-expanded:text-landing-accent"
                                  >
                                    <ChevronDown
                                      aria-hidden="true"
                                      className="size-4 transition-transform duration-200 aria-expanded:rotate-180"
                                    />
                                  </CollapsibleTrigger>
                                </div>
                                <CollapsibleContent>
                                  <div className="ml-3 mt-0.5 flex flex-col border-l border-landing-border pl-3">
                                    {entry.children.map((child) => (
                                      <Link
                                        key={child.href}
                                        href={child.href}
                                        className="flex min-h-10 items-center rounded-landing-control px-3 text-sm text-landing-muted underline-offset-4 outline-none transition-colors hover:text-landing-accent hover:underline focus-visible:ring-3 focus-visible:ring-landing-accent/30"
                                        onClick={closeMobileNav}
                                      >
                                        {child.label}
                                      </Link>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            ) : (
                              <Link
                                key={entry.href}
                                href={entry.href}
                                className="flex min-h-10 items-center rounded-landing-control px-3 text-sm text-landing-muted underline-offset-4 outline-none transition-colors hover:text-landing-accent hover:underline focus-visible:ring-3 focus-visible:ring-landing-accent/30"
                                onClick={closeMobileNav}
                              >
                                {entry.label}
                              </Link>
                            ),
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <Link
                      key={`${item.href}-${item.label}`}
                      href={item.href}
                      className={linkClassName}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ),
                )}

                {nav.cta.visible ? (
                  <a
                    href={nav.cta.href}
                    className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-landing-control bg-landing-accent px-5 text-sm font-semibold text-white outline-none transition-colors hover:bg-landing-accent/90 focus-visible:ring-3 focus-visible:ring-landing-accent/30"
                    onClick={() => setOpen(false)}
                  >
                    <MessageCircle aria-hidden="true" className="size-4" />
                    {nav.cta.label}
                  </a>
                ) : null}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </motion.header>
  );
}
