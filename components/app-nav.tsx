"use client";

import type { AppRole } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { memo, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, CalendarClock, ChevronDown, CircleDollarSign, Database, Factory, FileText, KanbanSquare, LayoutDashboard, Megaphone, MessageCircle, Palette, Receipt, Ruler, ScrollText, Settings2, Tags, UsersRound, Waypoints } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const mainItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;

const financeItems = [
  { href: "/keuangan/pemasukan", label: "Pemasukan", icon: Receipt },
  { href: "/keuangan/pengeluaran", label: "Pengeluaran", icon: CircleDollarSign },
  { href: "/keuangan/laporan", label: "Laporan", icon: FileText },
] as const;

const crmItems = [
  { href: "/crm", label: "Pipeline", icon: KanbanSquare },
  { href: "/crm/follow-up", label: "Follow-up", icon: CalendarClock },
  { href: "/crm/purchase-orders", label: "Purchase Order", icon: FileText },
  { href: "/crm/invoices", label: "Invoice", icon: Receipt },
  { href: "/crm/sales-orders", label: "Sales Order", icon: ScrollText },
] as const;

const customerItems = [
  { href: "/customers", label: "Customer", icon: UsersRound },
] as const;

const whatsAppItems = [
  { href: "/whatsapp", label: "Kotak Masuk", icon: MessageCircle },
  { href: "/master-data/whatsapp/templates", label: "Template Pesan", icon: MessageCircle },
  { href: "/master-data/whatsapp/accounts", label: "Akun & Koneksi", icon: Settings2 },
] as const;

const prospectItems = [
  { href: "/crm/prospek", label: "Prospek", icon: UsersRound },
] as const;

const masterItems = [
  { href: "/master-data/customer-types", label: "Jenis customer", icon: Tags },
  { href: "/master-data/lead-sources", label: "Sumber lead", icon: Waypoints },
  { href: "/master-data/garment-sizes", label: "Ukuran pakaian", icon: Ruler },
  { href: "/master-data/payment-methods", label: "Metode pembayaran", icon: CircleDollarSign },
  { href: "/master-data/business-profile", label: "Profil perusahaan", icon: Building2 },
] as const;

const ownerMasterItems = [
  { href: "/admin/users", label: "Pengguna", icon: UsersRound },
] as const;

const analyticsItems = [
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

function navCountLabel(count: number) {
  return count > 99 ? "99+" : String(count);
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
        <Badge variant={active ? "secondary" : "default"} className="ml-auto min-w-6 px-1.5 font-semibold tabular-nums" aria-label={`${item.count} item perlu diperiksa`}>
          {navCountLabel(item.count)}
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
  const [financeOpen, setFinanceOpen] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
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

  const isDeveloper = role === "DEVELOPER";
  const canManageMasterData = isDeveloper || role === "OWNER";
  const canViewAnalytics = isDeveloper || role === "OWNER";
  const canViewCrm = isDeveloper || role === "OWNER" || role === "ADMIN_CUSTOMER";
  const canViewProduction = isDeveloper || role === "OWNER" || role === "ADMIN_PRODUCTION";
  const canViewFinance = isDeveloper || role === "OWNER";
  const canViewDesign = isDeveloper || role === "OWNER" || role === "ADMIN_CUSTOMER" || role === "DESIGNER";
  const masterDataActive = (isPathWithin(pathname, "/master-data") && !isPathWithin(pathname, "/master-data/whatsapp")) || isPathWithin(pathname, "/admin/users");
  const analyticsActive = isPathWithin(pathname, "/analytics");
  const crmActive = isPathWithin(pathname, "/crm") || isPathWithin(pathname, "/sales-orders");
  const financeActive = isPathWithin(pathname, "/keuangan");
  const whatsAppActive = isPathWithin(pathname, "/whatsapp") || isPathWithin(pathname, "/master-data/whatsapp");

  return (
    <nav aria-label="Navigasi utama" className="flex min-w-0 flex-col gap-1">
      {canViewCrm ? mainItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} onNavigate={onNavigate} />) : null}
      {canViewFinance ? (
        <Collapsible open={financeActive || financeOpen} onOpenChange={setFinanceOpen} className="group/collapsible flex flex-col gap-1">
          <CollapsibleTrigger className="flex h-9 w-full shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            <CircleDollarSign aria-hidden="true" className="size-4" />
            <span>Keuangan</span>
            <ChevronDown aria-hidden="true" className="ml-auto size-4 transition-transform group-data-open/collapsible:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-1">
            {financeItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested onNavigate={onNavigate} />)}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
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
      {canViewCrm ? prospectItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} onNavigate={onNavigate} />) : null}
      {canViewCrm ? customerItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} onNavigate={onNavigate} />) : null}
      {canViewCrm ? (
        <Collapsible open={whatsAppActive || whatsAppOpen} onOpenChange={setWhatsAppOpen} className="group/collapsible flex flex-col gap-1">
          <CollapsibleTrigger className="flex h-9 w-full shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            <MessageCircle aria-hidden="true" className="size-4" />
            <span>WhatsApp</span>
            <ChevronDown aria-hidden="true" className="ml-auto size-4 transition-transform group-data-open/collapsible:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-1">
            {whatsAppItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item.href === "/whatsapp" ? { ...item, count: whatsAppCount } : item} nested onNavigate={onNavigate} />)}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      {canViewCrm ? <NavLink pathname={pathname} item={{ href: "/campaigns", label: "Campaign promo", icon: Megaphone }} onNavigate={onNavigate} /> : null}
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
            {canManageMasterData ? ownerMasterItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested onNavigate={onNavigate} />) : null}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      {canViewCrm ? <NavLink pathname={pathname} item={{ href: "/settings", label: "Pengaturan", icon: Settings2 }} onNavigate={onNavigate} /> : null}
    </nav>
  );
});
