import { LogOut } from "lucide-react";
import Image from "next/image";

import { logoutAction } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { MobileAppNav } from "@/components/mobile-app-nav";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import type { Actor } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/crm/constants";

export function AppShell({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  return (
    <div className="min-h-svh w-full max-w-full overflow-x-hidden bg-background lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-svh flex-col border-r bg-card lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <Image src="/brand/askonveksi-mark.png" alt="" width={48} height={48} className="size-9 shrink-0 object-contain" priority />
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">ERM</p>
              <p className="truncate text-sm font-semibold">ASKonveksi</p>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-t px-4 py-4">
          <AppNav role={actor.role} />
        </div>
        <div className="border-t p-4">
          <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{actor.name}</p>
              <p className="truncate text-xs text-muted-foreground">{actor.email}</p>
            </div>
            <Badge variant="outline" className="shrink-0">{ROLE_LABEL[actor.role]}</Badge>
          </div>
          <form action={logoutAction}>
            <SubmitButton variant="destructive" size="sm" className="w-full" pendingLabel="Keluar...">
                          <LogOut data-icon="inline-start" aria-hidden="true" />
                          Keluar
                        </SubmitButton>
          </form>
        </div>
      </aside>
      <main className="min-w-0 overflow-x-clip">
        <MobileAppNav actor={actor} />
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
