"use client";

import type { AppRole } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { memo, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, CalendarClock, ChartNoAxesCombined, ChevronDown, CircleDollarSign, Database, Factory, FileText, KanbanSquare, LayoutDashboard, MessageCircle, Palette, Receipt, Ruler, ScrollText, Settings2, Tags, UsersRound, Waypoints } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const mainItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;

const financeItems = [
  { href: "/keuangan", label: "Keuangan", icon: CircleDollarSign },
] as const;

const crmItems = [
  { href: "/crm", label: "Pipeline", icon: KanbanSquare },
  { href: "/crm/follow-up", label: "Follow-up", icon: CalendarClock },
  { href: "/crm/follow-up/settings", label: "Pengaturan follow up", icon: Settings2 },
  { href: "/crm/purchase-orders", label: "Purchase Order", icon: FileText },
  { href: "/crm/invoices", label: "Invoice", icon: Receipt },
  { href: "/crm/sales-orders", label: "Sales Order", icon: ScrollText },
] as const;

const customerItems = [
  { href: "/customers", label: "Customer", icon: UsersRound },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/master-data/whatsapp/templates", label: "Template chat", icon: MessageCircle },
] as const;

const masterItems = [
  { href: "/master-data/customer-types", label: "Jenis customer", icon: Tags },
  { href: "/master-data/lead-sources", label: "Sumber lead", icon: Waypoints },
  { href: "/master-data/garment-sizes", label: "Ukuran pakaian", icon: Ruler },
  { href: "/master-data/payment-methods", label: "Metode pembayaran", icon: CircleDollarSign },
  { href: "/master-data/business-profile", label: "Profil perusahaan", icon: Building2 },
  { href: "/master-data/whatsapp/accounts", label: "Account WhatsApp", icon: Settings2 },
] as const;

const ownerMasterItems = [
  { href: "/admin/users", label: "Pengguna", icon: UsersRound },
] as const;

const analyticsItems = [
  { href: "/analytics/sales-performance", label: "Performa sales", icon: ChartNoAxesCombined },
  { href: "/analytics/lead-sources", label: "Sumber & omzet", icon: Waypoints },
] as const;

function isPathWithin(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isNavItemActive(pathname: string, href: string) {
  if (href === "/crm") return pathname === href || isPathWithin(pathname, "/crm/peluang") || isPathWithin(pathname, "/sales-orders");
  if (href === "/crm/follow-up") return pathname === href;
  return isPathWithin(pathname, href);
}

function NavLink({ pathname, item, nested = false, onNavigate }: { pathname: string; item: { href: string; label: string; icon: LucideIcon; count?: number }; nested?: boolean; onNavigate?: () => void }) {
  const active = isNavItemActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        nested && "ml-3",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {item.label}
      {typeof item.count === "number" ? (
        <Badge variant={active ? "secondary" : "default"} className="ml-auto size-6 px-0 font-semibold tabular-nums" aria-label={`${item.count} item perlu diperiksa`}>
          {item.count}
        </Badge>
      ) : null}
    </Link>
  );
}

export const AppNav = memo(function AppNav({ role, onNavigate }: { role: AppRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [masterDataOpen, setMasterDataOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [crmOpen, setCrmOpen] = useState(false);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [whatsAppCount, setWhatsAppCount] = useState(0);

  useEffect(() => {
    fetch("/api/crm/badge-counts", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setFollowUpCount(data.followUpCount ?? 0);
        setWhatsAppCount(data.whatsAppCount ?? 0);
      })
      .catch(() => {});
  }, []);

  const canManageMasterData = role === "OWNER";
  const canViewAnalytics = role === "OWNER";
  const canViewCrm = role === "OWNER" || role === "ADMIN_CUSTOMER";
  const canViewProduction = role === "OWNER" || role === "ADMIN_PRODUCTION";
  const canViewFinance = role === "OWNER";
  const canViewDesign = role === "OWNER" || role === "ADMIN_CUSTOMER" || role === "DESIGNER";
  const masterDataActive = (isPathWithin(pathname, "/master-data") && pathname !== "/master-data/whatsapp/templates") || isPathWithin(pathname, "/admin/users");
  const analyticsActive = isPathWithin(pathname, "/analytics");
  const crmActive = isPathWithin(pathname, "/crm") || isPathWithin(pathname, "/sales-orders");

  return (
    <nav aria-label="Navigasi utama" className="flex min-w-0 flex-col gap-1">
      {canViewCrm ? mainItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} onNavigate={onNavigate} />) : null}
      {canViewFinance ? financeItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} onNavigate={onNavigate} />) : null}
      {canViewCrm ? (
        <Collapsible open={crmActive || crmOpen} onOpenChange={setCrmOpen} className="group/collapsible flex flex-col gap-1">
          <CollapsibleTrigger className="flex h-9 w-full shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            <KanbanSquare aria-hidden="true" className="size-4" />
            <span>CRM</span>
            <ChevronDown aria-hidden="true" className="ml-auto size-4 transition-transform group-data-open/collapsible:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-1">
            {crmItems.map((item) => (
              <NavLink
                key={item.href}
                pathname={pathname}
                item={item.href === "/crm/follow-up" ? { ...item, count: followUpCount } : item}
                nested
                onNavigate={onNavigate}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      {canViewCrm ? customerItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item.href === "/whatsapp" ? { ...item, count: whatsAppCount } : item} onNavigate={onNavigate} />) : null}
      {canViewProduction ? <NavLink pathname={pathname} item={{ href: "/produksi", label: "Produksi", icon: Factory }} onNavigate={onNavigate} /> : null}
      {canViewDesign ? <NavLink pathname={pathname} item={{ href: "/desain", label: "Upload Desain", icon: Palette }} onNavigate={onNavigate} /> : null}
      {canViewAnalytics ? (
        <Collapsible open={analyticsActive || analyticsOpen} onOpenChange={setAnalyticsOpen} className="group/collapsible flex flex-col gap-1">
          <CollapsibleTrigger className="flex h-9 w-full shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            <BarChart3 aria-hidden="true" className="size-4" />
            <span>Analytics</span>
            <ChevronDown aria-hidden="true" className="ml-auto size-4 transition-transform group-data-open/collapsible:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-1">
            {analyticsItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested onNavigate={onNavigate} />)}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      {canManageMasterData ? (
        <Collapsible open={masterDataActive || masterDataOpen} onOpenChange={setMasterDataOpen} className="group/collapsible flex flex-col gap-1">
          <CollapsibleTrigger className="flex h-9 w-full shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            <Database aria-hidden="true" className="size-4" />
            <span>Data Master</span>
            <ChevronDown aria-hidden="true" className="ml-auto size-4 transition-transform group-data-open/collapsible:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-1">
            {masterItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested onNavigate={onNavigate} />)}
            {role === "OWNER" ? ownerMasterItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested onNavigate={onNavigate} />) : null}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </nav>
  );
});
