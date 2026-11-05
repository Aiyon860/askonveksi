import { LogOut } from "lucide-react";
import Image from "next/image";

import { logoutAction } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { AutoRefresh } from "@/components/auto-refresh";
import { BrandThemeAttribute } from "@/components/brand-theme-attribute";
import { BrandSwitcher } from "@/components/brand-switcher";
import { MainScrollReset } from "@/components/main-scroll-reset";
import { MobileAppNav } from "@/components/mobile-app-nav";
import { PageMessage } from "@/components/page-message";
import { PreferencesSync } from "@/components/preferences-sync";
import { SidebarCollapseToggle } from "@/components/sidebar-collapse-toggle";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WhatsAppHealthMonitor } from "@/components/whatsapp-health-monitor";
import type { Actor } from "@/lib/auth/session";
import { CRM_ROLES, hasRole } from "@/lib/auth/permissions";
import { brandDataAttribute } from "@/lib/brand/config";
import { ROLE_LABEL } from "@/lib/crm/constants";
import { getSiteLogo } from "@/lib/site-logo";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return `${parts[0][0]}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export async function AppShell({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  const logo = await getSiteLogo(actor.brand);
  return (
    <TooltipProvider delay={220} closeDelay={0} timeout={300}>
    <div
      data-brand={brandDataAttribute(actor.brand)}
      className="app-shell min-h-svh w-full max-w-full overflow-x-clip bg-app-canvas lg:flex lg:h-svh lg:overflow-hidden"
    >
      <BrandThemeAttribute brand={actor.brand} />
      <PreferencesSync />
      <AutoRefresh />
      <aside id="app-sidebar" className="app-sidebar nav-surface sticky top-0 hidden h-svh self-start flex-col border-r border-nav-line text-nav-ink lg:flex">
        <div className="app-sidebar-header flex items-center justify-between gap-3 px-4 py-5">
          <span className="app-logo flex h-10 items-center rounded-xl bg-white px-2 py-1 ring-1 ring-nav-line">
            <Image src={logo.src} alt={logo.name} width={1920} height={1080} className="h-8 w-auto object-contain" priority unoptimized={logo.unoptimized} />
          </span>
          <SidebarCollapseToggle />
        </div>
        <div className="app-sidebar-nav min-h-0 flex-1 overflow-y-auto border-t border-nav-line px-3 py-4">
          <AppNav role={actor.role} />
        </div>
        <div className="app-sidebar-footer border-t border-nav-line p-3">
          {actor.canSwitchBrand ? <BrandSwitcher brand={actor.brand} className="app-brand-switcher mb-3" /> : null}
          <div className="app-user-card rounded-xl border border-nav-line bg-nav-chip p-3">
            <div className="app-user-row flex min-w-0 items-center gap-2.5">
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-nav-chip-strong text-xs font-semibold text-nav-active-ink">
                {initialsOf(actor.name)}
              </span>
              <div className="nav-user-meta min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-nav-ink">{actor.name}</p>
                <p className="truncate text-xs text-nav-ink-muted">{actor.email}</p>
              </div>
            </div>
            <div className="app-user-actions mt-2.5 flex min-w-0 items-center justify-between gap-2">
              <Badge variant="outline" className="nav-user-badge min-w-0 shrink border-nav-line bg-transparent text-nav-ink">{ROLE_LABEL[actor.role]}</Badge>
              <form action={logoutAction} className="shrink-0">
                <SubmitButton
                  variant="ghost"
                  size="sm"
                  className="app-user-logout text-nav-ink hover:bg-nav-chip focus-visible:ring-nav-chip-strong"
                  pendingLabel="Keluar..."
                  title="Keluar"
                >
                  <LogOut data-icon="inline-start" aria-hidden="true" />
                  <span className="nav-label">Keluar</span>
                </SubmitButton>
              </form>
            </div>
          </div>
        </div>
      </aside>
      {/* Desktop: hanya area ini yang menggulir, setinggi viewport, supaya
          halaman tidak bisa digulir melewati batas layar. Mobile tetap memakai
          scroll dokumen seperti biasa. */}
      <main
        data-app-scroll
        className="min-w-0 overflow-x-clip lg:h-svh lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-y-contain"
      >
        <MainScrollReset />
        <MobileAppNav actor={actor} logoSrc={logo.src} logoName={logo.name} logoUnoptimized={logo.unoptimized} />
        <div className="flex w-full max-w-full flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <PageMessage />
          {hasRole(actor.role, CRM_ROLES) ? <WhatsAppHealthMonitor /> : null}
          {children}
        </div>
      </main>
    </div>
    </TooltipProvider>
  );
}
