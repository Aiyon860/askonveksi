"use client";

import { LogOut, Menu, XIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { logoutAction } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Actor } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/crm/constants";

export function MobileAppNav({ actor }: { actor: Actor }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="nav-surface sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-nav-line px-4 text-nav-ink lg:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white p-1 ring-1 ring-nav-line">
          <Image src="/brand/askonveksi-mark.png" alt="" width={48} height={48} className="size-full object-contain" priority />
        </span>
        <p className="truncate text-sm font-semibold text-nav-ink">ASKonveksi</p>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="border-nav-line bg-nav-chip text-nav-ink hover:bg-nav-chip-strong hover:text-nav-active-ink focus-visible:ring-nav-chip-strong"
              aria-label="Buka menu utama"
            />
          }
        >
          <Menu aria-hidden="true" />
        </SheetTrigger>
        <SheetContent side="left" className="nav-surface gap-0 text-nav-ink" showCloseButton={false}>
          <SheetHeader className="flex-row items-center justify-between gap-3 border-b border-nav-line p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white p-1 ring-1 ring-nav-line">
                <Image src="/brand/askonveksi-mark.png" alt="" width={48} height={48} className="size-full object-contain" />
              </span>
              <div className="min-w-0">
                <SheetTitle className="text-nav-ink">Menu utama</SheetTitle>
                <SheetDescription className="truncate text-nav-ink-muted">{actor.name}</SheetDescription>
              </div>
            </div>
            <SheetClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-nav-ink hover:bg-nav-chip focus-visible:ring-nav-chip-strong"
                  aria-label="Tutup menu"
                />
              }
            >
              <XIcon aria-hidden="true" />
            </SheetClose>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <AppNav role={actor.role} onNavigate={() => setOpen(false)} />
          </div>
          <SheetFooter className="border-t border-nav-line p-4">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <p className="truncate text-xs text-nav-ink-muted">{actor.email}</p>
              <Badge variant="outline" className="shrink-0 border-nav-line bg-transparent text-nav-ink">{ROLE_LABEL[actor.role]}</Badge>
            </div>
            <form action={logoutAction}>
              <SubmitButton
                variant="ghost"
                className="w-full border border-nav-line bg-nav-chip text-nav-ink hover:bg-nav-chip-strong hover:text-nav-active-ink focus-visible:ring-nav-chip-strong"
                pendingLabel="Keluar..."
              >
                <LogOut data-icon="inline-start" aria-hidden="true" />
                Keluar
              </SubmitButton>
            </form>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </header>
  );
}
