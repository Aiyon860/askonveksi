"use client";

import type { AppRole } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { memo, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, CalendarClock, CircleDollarSign, Database, Factory, FileText, KanbanSquare, LayoutDashboard, Megaphone, MessageCircle, Palette, Receipt, Ruler, ScrollText, Settings2, Shirt, Tags, UsersRound, Waypoints } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
  { href: "/crm/follow-up", label: "Broadcast", icon: CalendarClock },
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
  { href: "/master-data/product-categories", label: "Kategori produk", icon: Shirt },
  { href: "/master-data/payment-methods", label: "Metode pembayaran", icon: CircleDollarSign },
  { href: "/master-data/business-profile", label: "Profil perusahaan", icon: Building2 },
] as const;

const ownerMasterItems = [
  { href: "/admin/users", label: "Pengguna", icon: UsersRound },
] as const;

const analyticsItems = [
  { href: "/analytics", label: "Ringkasan", icon: BarChart3 },
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
        "flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-nav-chip-strong",
        nested && "ml-3",
        active
          ? "bg-nav-chip-strong font-semibold text-nav-active-ink"
          : "text-nav-ink hover:bg-nav-chip",
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
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

function NavGroup({ label, icon: Icon, children }: { label: ReactNode; icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-9 w-full shrink-0 items-center gap-2 px-3 text-[11px] font-semibold tracking-wide text-nav-ink-muted uppercase">
        <Icon aria-hidden="true" className="size-4" />
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
        <NavGroup label={<span>Keuangan</span>} icon={CircleDollarSign}>
          {financeItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {canViewCrm ? (
        <NavGroup label={<span>CRM</span>} icon={KanbanSquare}>
          {crmItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {canViewCrm ? prospectItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} onNavigate={onNavigate} />) : null}
      {canViewCrm ? customerItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} onNavigate={onNavigate} />) : null}
      {canViewCrm ? (
        <NavGroup label={<span>WhatsApp</span>} icon={MessageCircle}>
          {whatsAppItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item.href === "/whatsapp" ? { ...item, count: whatsAppCount } : item} nested onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {canViewCrm ? <NavLink pathname={pathname} item={{ href: "/campaigns", label: "Campaign promo", icon: Megaphone }} onNavigate={onNavigate} /> : null}
      {canViewProduction ? <NavLink pathname={pathname} item={{ href: "/produksi", label: "Produksi", icon: Factory }} onNavigate={onNavigate} /> : null}
      {canViewProduction ? <NavLink pathname={pathname} item={{ href: "/detail-desain", label: "Detail Desain", icon: Palette }} onNavigate={onNavigate} /> : null}
      {canViewDesign ? <NavLink pathname={pathname} item={{ href: "/desain", label: "Upload Desain", icon: Palette }} onNavigate={onNavigate} /> : null}
      {canViewAnalytics ? (
        <NavGroup label={<span>Analytics</span>} icon={BarChart3}>
          {analyticsItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {canManageMasterData ? (
        <NavGroup label={<span>Data Master</span>} icon={Database}>
          {masterItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested onNavigate={onNavigate} />)}
          {ownerMasterItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {canViewCrm ? <NavLink pathname={pathname} item={{ href: "/settings", label: "Pengaturan", icon: Settings2 }} onNavigate={onNavigate} /> : null}
    </nav>
  );
});
