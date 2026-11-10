"use client";

import type { AppRole } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { createContext, memo, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, BarChart3, Building2, CalendarCheck2, CalendarClock, CircleDollarSign, ClipboardList, CreditCard, Database, Factory, FileText, Gauge, Globe2, History, Kanban, KanbanSquare, KeyRound, LayoutDashboard, LayoutTemplate, Magnet, Megaphone, MessageCircle, PenTool, Receipt, Ruler, ScrollText, Settings2, Shirt, SlidersHorizontal, Tags, UserPlus, Users, UsersRound, Wallet, Waypoints } from "lucide-react";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { hasRole, CRM_OPERATOR_ROLES, CRM_ROLES, CRM_VIEW_ROLES, GARMENT_SIZE_ROLES, OWNER_ACTION_ROLES } from "@/lib/auth/permissions";
import { fetcher } from "@/lib/fetcher";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { cn } from "@/lib/utils";
import { describeWhatsAppHealth, isWhatsAppConnected, type WhatsAppHealthState } from "@/lib/whatsapp/health";
import { WHATSAPP_INBOX_ROLES } from "@/lib/whatsapp/access";

const mainItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
] as const;

const attendanceEmployeeItem = { href: "/absensi", label: "Absen", icon: CalendarCheck2 } as const;
const attendanceReportItem = { href: "/absensi/laporan", label: "Laporan absensi", icon: ClipboardList } as const;

const financeItems = [
  { href: "/keuangan/pemasukan", label: "Project", icon: Wallet },
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

const masterItems = [
  { href: "/master-data/customer-types", label: "Jenis customer", icon: Tags },
  { href: "/master-data/lead-sources", label: "Sumber lead", icon: Magnet },
  { href: "/master-data/garment-sizes", label: "Ukuran pakaian", icon: Ruler },
  { href: "/master-data/product-categories", label: "Kategori produk", icon: Shirt },
  { href: "/master-data/payment-methods", label: "Metode pembayaran", icon: CreditCard },
  { href: "/master-data/invoice-settings", label: "Pengaturan invoice", icon: FileText },
  { href: "/master-data/business-profile", label: "Profil perusahaan", icon: Building2 },
] as const;

const ownerMasterItems = [
  { href: "/admin/users", label: "Pengguna", icon: Users },
  { href: "/admin/ai-access", label: "Akses AI", icon: KeyRound },
] as const;

const websiteItems = [
  { href: "/cms", label: "Kelola Website", icon: Globe2 },
  { href: "/cms/riwayat", label: "Riwayat Perubahan", icon: History },
] as const;

const analyticsItems = [
  { href: "/analytics", label: "Ringkasan", icon: Gauge },
  { href: "/analytics/lead-sources", label: "Kanal akuisisi", icon: Waypoints },
] as const;

// Satu subscription collapse untuk seluruh menu. Tanpa context, setiap link
// dan grup berlangganan sendiri sehingga satu toggle memicu puluhan update.
const SidebarCollapsedContext = createContext(false);

function isPathWithin(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isNavItemActive(pathname: string, href: string) {
  if (href === "/absensi") return pathname === href;
  if (href === "/crm") return pathname === href || isPathWithin(pathname, "/crm/peluang");
  if (href === "/crm/sales-orders") return isPathWithin(pathname, href) || isPathWithin(pathname, "/sales-orders");
  if (href === "/crm/follow-up") return pathname === href;
  // Ringkasan analytics hanya aktif di halaman itu sendiri: "/analytics" bukan
  // awalan yang boleh menyalakan juga saat halaman Sumber & omzet dibuka.
  if (href === "/analytics") return pathname === href;
  return isPathWithin(pathname, href);
}

function navCountLabel(count: number) {
  return count > 99 ? "99+" : String(count);
}

function NavLink({ pathname, item, nested = false, tone, onNavigate }: { pathname: string; item: { href: string; label: string; icon: LucideIcon; count?: number }; nested?: boolean; tone?: string; onNavigate?: () => void }) {
  const active = isNavItemActive(pathname, item.href);
  const collapsed = useContext(SidebarCollapsedContext);
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "nav-link flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-nav-chip-strong",
        nested && "ml-3",
        active
          ? "bg-nav-chip-strong font-semibold text-nav-active-ink"
          : "text-nav-ink hover:bg-nav-chip",
      )}
    >
      <Icon aria-hidden="true" className={cn("size-4", !active && tone)} />
      <span className="nav-label">{item.label}</span>
      {typeof item.count === "number" ? (
        <Badge
          variant="outline"
          className={cn(
            "nav-badge ml-auto min-w-6 border-transparent px-1.5 font-semibold tabular-nums",
            active ? "bg-nav-active-ink text-nav-chip-strong" : "bg-nav-chip-strong text-nav-active-ink",
          )}
          aria-label={`${item.count} item perlu diperiksa`}
        >
          {navCountLabel(item.count)}
        </Badge>
      ) : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right" sideOffset={10} className="max-w-64 flex-col items-start gap-0.5 px-3 py-2">
        <span className="text-xs font-semibold">{item.label}</span>
        {typeof item.count === "number" ? (
          <span className="text-[11px] font-normal text-background/70">{item.count} item perlu diperiksa</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

function NavGroup({ label, title, icon: Icon, tone, children }: { label: ReactNode; title: string; icon: LucideIcon; tone?: string; children: ReactNode }) {
  const collapsed = useContext(SidebarCollapsedContext);
  const header = (
    <div className="nav-group-header flex h-9 w-full shrink-0 items-center gap-2 px-3 text-[11px] font-semibold tracking-wide text-nav-ink-muted uppercase">
      <Icon aria-hidden="true" className={cn("size-4", tone)} />
      <span className="nav-group-label flex min-w-0 items-center gap-2">{label}</span>
    </div>
  );

  return (
    <div className="nav-group flex flex-col gap-1">
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger render={header} />
          <TooltipContent side="right" sideOffset={10} className="max-w-64 flex-col items-start gap-0.5 px-3 py-2">
            <span className="text-xs font-semibold">{title}</span>
            <span className="text-[11px] font-normal text-background/70">Kelompok menu</span>
          </TooltipContent>
        </Tooltip>
      ) : header}
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

const WHATSAPP_STATUS_POLL_MS = 10_000;

/**
 * Status koneksi nomor WhatsApp, menggantikan banner “WhatsApp perlu perhatian”
 * yang dulu muncul di setiap halaman. Polling hanya berjalan saat grup WhatsApp
 * tampil, dan SWR melewati polling ketika tab tidak terlihat.
 */
function WhatsAppStatusChip({ enabled }: { enabled: boolean }) {
  const { data } = useSWR<{ state: WhatsAppHealthState }>(enabled ? "/api/whatsapp/health" : null, fetcher, {
    refreshInterval: WHATSAPP_STATUS_POLL_MS,
    dedupingInterval: 5_000,
    shouldRetryOnError: false,
    revalidateOnFocus: true,
  });

  const state = data?.state;
  if (!state) return null;
  const connected = isWhatsAppConnected(state);

  return (
    <span
      title={describeWhatsAppHealth(state)}
      className={cn(
        "ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-semibold tracking-normal",
        connected
          ? "border-nav-status-connected/40 bg-nav-status-connected/10 text-nav-status-connected"
          : "border-nav-status-disconnected/40 bg-nav-status-disconnected/10 text-nav-status-disconnected",
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", connected ? "bg-nav-status-connected" : "bg-nav-status-disconnected")} />
      {connected ? "Connect" : "Disconnect"}
    </span>
  );
}

export const AppNav = memo(function AppNav({ role, onNavigate }: { role: AppRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  const collapsed = useSidebarCollapsed();
  const [whatsAppCount, setWhatsAppCount] = useState(0);

  // Owner, Developer, dan Keuangan memiliki akses area administratif yang sama.
  const isOwnerEquivalent = hasRole(role, OWNER_ACTION_ROLES);
  const canViewCrm = hasRole(role, CRM_VIEW_ROLES);
  const canOperateCrm = hasRole(role, CRM_OPERATOR_ROLES);
  const canManageWhatsApp = hasRole(role, CRM_ROLES);
  const canViewWhatsAppInbox = hasRole(role, WHATSAPP_INBOX_ROLES);
  const crmVisibleItems = crmItems.filter((item) => item.href !== "/crm/follow-up" || canOperateCrm);
  const whatsAppVisibleItems = whatsAppItems.filter((item) =>
    item.href === "/whatsapp" ? canViewWhatsAppInbox : canManageWhatsApp,
  );

  useEffect(() => {
    if (!canViewWhatsAppInbox) return;
    fetch("/api/crm/badge-counts", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setWhatsAppCount(data.whatsAppCount ?? 0);
      })
      .catch(() => {});
  }, [canViewWhatsAppInbox]);

  const isDeveloper = role === "DEVELOPER";
  const canManageMasterData = isOwnerEquivalent;
  // Admin PO hanya mengelola satu data master: Ukuran pakaian.
  const canManageGarmentSizes = hasRole(role, GARMENT_SIZE_ROLES);
  const masterVisibleItems = canManageMasterData
    ? masterItems
    : canManageGarmentSizes
      ? masterItems.filter((item) => item.href === "/master-data/garment-sizes")
      : [];
  const canManageUsers = isOwnerEquivalent;
  const canViewAnalytics = isOwnerEquivalent;
  const canViewAudit = isOwnerEquivalent;
  const canViewDashboard = canViewCrm;
  // Admin Customer hanya melihat modul Produksi (mode lihat saja); aksi tetap terbatas tim Produksi.
  const canViewProduction = isOwnerEquivalent || role === "ADMIN_PO" || role === "ADMIN_CUSTOMER";
  const canViewFinance = isOwnerEquivalent;
  const canClockIn = role !== "OWNER" && role !== "DEVELOPER";
  const canViewAttendanceReport = isOwnerEquivalent;
  const canManageWebsite = isOwnerEquivalent;
  const canViewSettings = isOwnerEquivalent;
  return (
    <SidebarCollapsedContext.Provider value={collapsed}>
    <nav aria-label="Navigasi utama" className="flex min-w-0 flex-col gap-1">
      {canViewDashboard ? mainItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} onNavigate={onNavigate} />) : null}
      <NavGroup label={<span>Absensi</span>} title="Absensi" icon={CalendarCheck2} tone="text-nav-tone-attendance">
        {canClockIn ? <NavLink pathname={pathname} item={attendanceEmployeeItem} nested tone="text-nav-tone-attendance" onNavigate={onNavigate} /> : null}
        {canViewAttendanceReport ? <NavLink pathname={pathname} item={attendanceReportItem} nested tone="text-nav-tone-attendance" onNavigate={onNavigate} /> : null}
      </NavGroup>
      {canViewFinance ? (
        <NavGroup label={<span>Keuangan</span>} title="Keuangan" icon={Banknote} tone="text-nav-tone-finance">
          {financeItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested tone="text-nav-tone-finance" onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {canViewCrm ? (
        <NavGroup label={<span>CRM</span>} title="CRM" icon={KanbanSquare} tone="text-nav-tone-crm">
          {crmVisibleItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested tone="text-nav-tone-crm" onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {whatsAppVisibleItems.length ? (
        <NavGroup
          label={
            <>
              <span>WhatsApp</span>
              <WhatsAppStatusChip enabled={canViewWhatsAppInbox} />
            </>
          }
          title="WhatsApp"
          icon={MessageCircle}
          tone="text-nav-tone-whatsapp"
        >
          {whatsAppVisibleItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item.href === "/whatsapp" ? { ...item, count: whatsAppCount } : item} nested tone="text-nav-tone-whatsapp" onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {canViewProduction ? (
        <NavGroup label={<span>Produksi</span>} title="Produksi" icon={Factory} tone="text-nav-tone-production">
          {productionItems.filter((item) => isDeveloper || item.href !== "/detail-desain").map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested tone="text-nav-tone-production" onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {canManageWebsite ? (
        <NavGroup label={<span>Website</span>} title="Website" icon={Globe2} tone="text-nav-tone-website">
          {websiteItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested tone="text-nav-tone-website" onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {canViewAnalytics ? (
        <NavGroup label={<span>Analytics</span>} title="Analytics" icon={BarChart3} tone="text-nav-tone-analytics">
          {analyticsItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested tone="text-nav-tone-analytics" onNavigate={onNavigate} />)}
        </NavGroup>
      ) : null}
      {masterVisibleItems.length ? (
        <NavGroup label={<span>Data Master</span>} title="Data Master" icon={Database} tone="text-nav-tone-master">
          {masterVisibleItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested tone="text-nav-tone-master" onNavigate={onNavigate} />)}
          {canManageUsers ? ownerMasterItems.map((item) => <NavLink key={item.href} pathname={pathname} item={item} nested tone="text-nav-tone-master" onNavigate={onNavigate} />) : null}
        </NavGroup>
      ) : null}
      {canViewAudit ? <NavLink pathname={pathname} item={{ href: "/log-aktivitas", label: "Log aktivitas", icon: History }} onNavigate={onNavigate} /> : null}
      {canViewSettings ? <NavLink pathname={pathname} item={{ href: "/settings", label: "Pengaturan", icon: SlidersHorizontal }} onNavigate={onNavigate} /> : null}
    </nav>
    </SidebarCollapsedContext.Provider>
  );
});
