"use client";

import { LogOut, Menu } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { logoutAction } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
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
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-card px-4 lg:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <Image src="/brand/askonveksi-mark.png" alt="" width={48} height={48} className="size-8 shrink-0 object-contain" priority />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">ASKonveksi</p>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Buka menu utama" />}>
          <Menu aria-hidden="true" />
        </SheetTrigger>
        <SheetContent side="left" className="gap-0">
          <SheetHeader className="border-b p-5 pr-14">
            <div className="flex items-center gap-3">
              <Image src="/brand/askonveksi-mark.png" alt="" width={48} height={48} className="size-9 shrink-0 object-contain" />
              <div className="min-w-0">
                <SheetTitle>Menu utama</SheetTitle>
                <SheetDescription className="truncate">{actor.name}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <AppNav role={actor.role} onNavigate={() => setOpen(false)} />
          </div>
          <SheetFooter className="border-t">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <p className="truncate text-xs text-muted-foreground">{actor.email}</p>
              <Badge variant="outline">{ROLE_LABEL[actor.role]}</Badge>
            </div>
            <form action={logoutAction}>
              <SubmitButton variant="destructive" className="w-full" pendingLabel="Keluar...">
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
