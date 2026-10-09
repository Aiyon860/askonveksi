"use client";

import type { AppRole } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { memo, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, BarChart3, Building2, CalendarClock, CircleDollarSign, ClipboardList, CreditCard, Database, Factory, FileText, Gauge, ImageUp, Kanban, KanbanSquare, LayoutDashboard, LayoutTemplate, Magnet, Megaphone, MessageCircle, PenTool, Receipt, Ruler, ScrollText, Settings2, ShieldCheck, Shirt, SlidersHorizontal, Tags, UserPlus, UsersRound, Wallet, Waypoints } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const mainItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;

const financeItems = [
  { href: "/keuangan/pemasukan", label: "Pemasukan", icon: Wallet },
  { href: "/keuangan/pengeluaran", label: "Pengeluaran", icon: CircleDollarSign },
  { href: "/keuangan/laporan", label: "Laporan", icon: FileText },
] as const;

const crmItems = [
  { href: "/crm", label: "Pipeline", icon: Kanban },
  { href: "/crm/prospek", label: "Prospek", icon: UserPlus },
  { href: "/customers", label: "Customer", icon: UsersRound },
  { href: "/crm/purchase-orders", label: "Purchase Order", icon: ClipboardList },
  { href: "/crm/invoices", label: "Invoice", icon: Receipt },
  { href: "/crm/sales-orders", label: "Sales Order", icon: ScrollText },
  { href: "/crm/follow-up", label: "Broadcast", icon: CalendarClock },
] as const;

const whatsAppItems = [
  { href: "/whatsapp", label: "Kotak Masuk", icon: MessageCircle },
  { href: "/master-data/whatsapp/templates", label: "Template Pesan", icon: LayoutTemplate },
  { href: "/master-data/whatsapp/accounts", label: "Akun & Koneksi", icon: Settings2 },
  { href: "/campaigns", label: "Campaign promo", icon: Megaphone },
] as const;

const productionItems = [
  { href: "/produksi", label: "Produksi", icon: Factory },
  { href: "/detail-desain", label: "Detail Desain", icon: PenTool },
] as const;

const designItems = [
  { href: "/desain", label: "Upload Desain", icon: ImageUp },
] as const;

const masterItems = [
  { href: "/master-data/customer-types", label: "Jenis customer", icon: Tags },
  { href: "/master-data/lead-sources", label: "Sumber lead", icon: Magnet },
  { href: "/master-data/garment-sizes", label: "Ukuran pakaian", icon: Ruler },
  { href: "/master-data/product-categories", label: "Kategori produk", icon: Shirt },
  { href: "/master-data/payment-methods", label: "Metode pembayaran", icon: CreditCard },
  { href: "/master-data/business-profile", label: "Profil perusahaan", icon: Building2 },
] as const;

const ownerMasterItems = [
  { href: "/admin/users", label: "Pengguna", icon: ShieldCheck },
] as const;

const analyticsItems = [
  { href: "/analytics", label: "Ringkasan", icon: Gauge },
  { href: "/analytics/lead-sources", label: "Sumber & omzet", icon: Waypoints },
] as const;

function isPathWithin(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isNavItemActive(pathname: string, href: string) {
  if (href === "/crm") return pathname === href || isPathWithin(pathname, "/crm/peluang");
  if (href === "/crm/sales-orders") return isPathWithin(pathname, href) || isPathWithin(pathname, "/sales-orders");
  if (href === "/crm/follow-up") return pathname === href;
  return isPathWithin(pathname, href);
}

function navCountLabel(count: number) {
  return count > 99 ? "99+" : String(count);
}

function NavLink({ pathname, item, nested = false, tone, onNavigate }: { pathname: string; item: { href: string; label: string; icon: LucideIcon; count?: number }; nested?: boolean; tone?: string; onNavigate?: () => void }) {
  const active = isNavItemActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-nav-chip-strong",
        nested && "ml-3",
        active
          ? "bg-nav-chip-strong font-semibold text-nav-active-ink"
          : "text-nav-ink hover:bg-nav-chip",
      )}
    >
      <Icon aria-hidden="true" className={cn("size-4", !active && tone)} />
      {item.label}
      {typeof item.count === "number" ? (
        <Badge
          variant="outline"
          className={cn(
            "ml-auto min-w-6 border-transparent px-1.5 font-semibold tabular-nums",
            active ? "bg-nav-active-ink text-nav-chip-strong" : "bg-nav-chip-strong text-nav-active-ink",
          )}
          aria-label={`${item.count} item perlu diperiksa`}
        >
          {navCountLabel(item.count)}
        </Badge>
      ) : null}
    </Link>
  );
}

function NavGroup({ label, icon: Icon, tone, children }: { label: ReactNode; icon: LucideIcon; tone?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-9 w-full shrink-0 items-center gap-2 px-3 text-[11px] font-semibold tracking-wide text-nav-ink-muted uppercase">
        <Icon aria-hidden="true" className={cn("size-4", tone)} />
        {label}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

export const AppNav = memo(function AppNav({ role, onNavigate }: { role: AppRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [whatsAppCount, setWhatsAppCount] = useState(0);

  useEffect(() => {
    fetch("/api/crm/badge-counts", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setWhatsAppCount(data.whatsAppCount ?? 0);
      })
      .catch(() => {});
  }, []);

  const isDeveloper = role === "DEVELOPER";
  const canManageMasterData = isDeveloper || role === "OWNER";
  const canViewAnalytics = isDeveloper || role === "OWNER" || role === "KEUANGAN";
  const canViewCrm = isDeveloper || role === "OWNER" || role === "ADMIN_CUSTOMER";
  const canViewDashboard = canViewCrm || role === "KEUANGAN";
  const canViewProduction = isDeveloper || role === "OWNER" || role === "ADMIN_PRODUCTION";
  const canViewFinance = isDeveloper || role === "OWNER" || role === "KEUANGAN";
  const canViewDesign = isDeveloper || role === "OWNER" || role === "ADMIN_CUSTOMER" || role === "DESIGNER";
  return (
    <nav aria-label="Navigasi utama" className="flex min-w-0 flex-col gap-1">
      {canViewDashboard ? mainItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} onNavigate={onNavigate} />) : null}
      {canViewFinance ? (
        <NavGroup label={<span>Keuangan</span>} icon={Banknote} tone="text-nav-tone-finance">
          {financeItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested tone="text-nav-tone-finance" onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {canViewCrm ? (
        <NavGroup label={<span>CRM</span>} icon={KanbanSquare} tone="text-nav-tone-crm">
          {crmItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested tone="text-nav-tone-crm" onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {canViewCrm ? (
        <NavGroup label={<span>WhatsApp</span>} icon={MessageCircle} tone="text-nav-tone-whatsapp">
          {whatsAppItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item.href === "/whatsapp" ? { ...item, count: whatsAppCount } : item} nested tone="text-nav-tone-whatsapp" onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {canViewProduction || canViewDesign ? (
        <NavGroup label={<span>Produksi</span>} icon={Factory} tone="text-nav-tone-production">
          {canViewProduction ? productionItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested tone="text-nav-tone-production" onNavigate={onNavigate} />) : null}
          {canViewDesign ? designItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested tone="text-nav-tone-production" onNavigate={onNavigate} />) : null}
        </NavGroup>
      ) : null}
      {canViewAnalytics ? (
        <NavGroup label={<span>Analytics</span>} icon={BarChart3} tone="text-nav-tone-analytics">
          {analyticsItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested tone="text-nav-tone-analytics" onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {canManageMasterData ? (
        <NavGroup label={<span>Data Master</span>} icon={Database} tone="text-nav-tone-master">
          {masterItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested tone="text-nav-tone-master" onNavigate={onNavigate} />)}
          {ownerMasterItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested tone="text-nav-tone-master" onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {canViewCrm ? <NavLink pathname={pathname} item={{ href: "/settings", label: "Pengaturan", icon: SlidersHorizontal }} onNavigate={onNavigate} /> : null}
    </nav>
  );
});
