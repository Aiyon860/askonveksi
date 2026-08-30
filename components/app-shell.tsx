import { LogOut } from "lucide-react";
import Image from "next/image";

import { logoutAction } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import type { Actor } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/crm/constants";

export function AppShell({ actor, followUpCount, children }: { actor: Actor; followUpCount: number; children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-muted/40 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="border-b bg-background lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-5 lg:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/brand/askonveksi-mark.png" alt="" width={48} height={48} className="size-9 shrink-0 object-contain" priority />
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">ERM</p>
              <p className="truncate text-sm font-semibold">ASKonveksi</p>
            </div>
          </div>
          <Badge variant="outline" className="lg:hidden">{ROLE_LABEL[actor.role]}</Badge>
        </div>
        <div className="border-t px-3 py-2 lg:flex-1 lg:px-4 lg:py-4">
          <AppNav role={actor.role} followUpCount={followUpCount} />
        </div>
        <div className="hidden border-t p-4 lg:block">
          <div className="mb-3 min-w-0">
            <p className="truncate text-sm font-medium">{actor.name}</p>
            <p className="truncate text-xs text-muted-foreground">{actor.email}</p>
          </div>
          <form action={logoutAction}>
            <SubmitButton variant="destructive" size="sm" className="w-full" pendingLabel="Keluar...">
                          <LogOut data-icon="inline-start" aria-hidden="true" />
                          Keluar
                        </SubmitButton>
          </form>
        </div>
      </aside>
      <main className="min-w-0">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex items-center justify-between gap-4 lg:hidden">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{actor.name}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABEL[actor.role]}</p>
            </div>
            <form action={logoutAction}>
              <SubmitButton variant="destructive" size="sm" pendingLabel="Keluar...">
                              <LogOut data-icon="inline-start" aria-hidden="true" />
                              Keluar
                            </SubmitButton>
            </form>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
