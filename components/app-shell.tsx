import { LogOut } from "lucide-react";
import Image from "next/image";

import { logoutAction } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { MobileAppNav } from "@/components/mobile-app-nav";
import { PageMessage } from "@/components/page-message";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { WhatsAppHealthMonitor } from "@/components/whatsapp-health-monitor";
import type { Actor } from "@/lib/auth/session";
import { CRM_ROLES, hasRole } from "@/lib/auth/permissions";
import { ROLE_LABEL } from "@/lib/crm/constants";
import { getSiteLogo } from "@/lib/site-logo";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return `${parts[0][0]}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export async function AppShell({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  const logo = await getSiteLogo();
  return (
    <div className="min-h-svh w-full max-w-full overflow-x-clip bg-app-canvas lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
      <aside className="nav-surface sticky top-0 hidden h-svh self-start flex-col border-r border-nav-line text-nav-ink lg:flex">
        <div className="flex items-center gap-3 px-4 py-5">
          <span className="flex h-10 items-center rounded-xl bg-white px-2 py-1 ring-1 ring-nav-line">
            <Image src={logo.src} alt="ASKonveksi" width={1920} height={1080} className="h-8 w-auto object-contain" priority unoptimized={logo.unoptimized} />
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-nav-line px-3 py-4">
          <AppNav role={actor.role} />
        </div>
        <div className="border-t border-nav-line p-3">
          <div className="rounded-xl border border-nav-line bg-nav-chip p-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-nav-chip-strong text-xs font-semibold text-nav-active-ink">
                {initialsOf(actor.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-nav-ink">{actor.name}</p>
                <p className="truncate text-xs text-nav-ink-muted">{actor.email}</p>
              </div>
            </div>
            <div className="mt-2.5 flex min-w-0 items-center justify-between gap-2">
              <Badge variant="outline" className="min-w-0 shrink border-nav-line bg-transparent text-nav-ink">{ROLE_LABEL[actor.role]}</Badge>
              <form action={logoutAction} className="shrink-0">
                <SubmitButton
                  variant="ghost"
                  size="sm"
                  className="text-nav-ink hover:bg-nav-chip focus-visible:ring-nav-chip-strong"
                  pendingLabel="Keluar..."
                >
                  <LogOut data-icon="inline-start" aria-hidden="true" />
                  Keluar
                </SubmitButton>
              </form>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 overflow-x-clip">
        <MobileAppNav actor={actor} logoSrc={logo.src} logoUnoptimized={logo.unoptimized} />
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <PageMessage />
          {hasRole(actor.role, CRM_ROLES) ? <WhatsAppHealthMonitor role={actor.role} /> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
