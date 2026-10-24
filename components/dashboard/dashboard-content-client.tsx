"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Bell,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  Compass,
  Factory,
  Filter,
  Footprints,
  Globe,
  Handshake,
  Layers,
  Lightbulb,
  Megaphone,
  MessageCircle,
  Moon,
  MousePointerClick,
  Package,
  Percent,
  Radio,
  Receipt,
  Search,
  Share2,
  Shirt,
  ShoppingBag,
  Sparkles,
  Store,
  Sun,
  Tag,
  Target,
  Ticket,
  TrendingUp,
  UserCheck,
  Users,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import { formatCurrency } from "@/lib/crm/format";
import type { FullDashboardData } from "@/lib/crm/dashboard-data";
import { ExportButton } from "@/components/export/export-button";
import { cn } from "@/lib/utils";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function getLeadSourceIcon(sourceName: string) {
  const s = sourceName.toLowerCase();
  if (s.includes("whatsapp")) {
    return <MessageCircle className="size-4 text-emerald-500 shrink-0" />;
  }
  if (s.includes("instagram")) {
    return <InstagramIcon className="size-4 text-pink-500 shrink-0" />;
  }
  if (s.includes("landing")) {
    return <MousePointerClick className="size-4 text-cyan-500 shrink-0" />;
  }
  if (s.includes("web")) {
    return <Globe className="size-4 text-blue-500 shrink-0" />;
  }
  if (s.includes("market") || s.includes("shopee") || s.includes("tokopedia")) {
    return <Store className="size-4 text-orange-500 shrink-0" />;
  }
  if (s.includes("walk") || s.includes("toko") || s.includes("offline")) {
    return <Footprints className="size-4 text-purple-500 shrink-0" />;
  }
  if (s.includes("event") || s.includes("expo") || s.includes("bazaar")) {
    return <Ticket className="size-4 text-rose-500 shrink-0" />;
  }
  if (s.includes("referral") || s.includes("rekomendasi") || s.includes("teman")) {
    return <Share2 className="size-4 text-teal-500 shrink-0" />;
  }
  return <Tag className="size-4 text-slate-400 shrink-0" />;
}

function formatDonutOmzet(totalOmzetStr: string) {
  if (!totalOmzetStr) return "Rp 0";
  const num = parseInt(totalOmzetStr.replace(/\D/g, ""), 10) || 0;
  if (num >= 1_000_000_000) {
    const val = (num / 1_000_000_000).toFixed(1).replace(/\.0$/, "");
    return `Rp ${val}M`;
  }
  if (num >= 1_000_000) {
    const val = (num / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `Rp ${val}jt`;
  }
  return totalOmzetStr;
}

const DATE_PRESETS = [
  { id: "today", label: "Hari Ini" },
  { id: "yesterday", label: "Kemarin" },
  { id: "7d", label: "7 Hari Terakhir" },
  { id: "this-month", label: "Bulan Ini" },
  { id: "last-month", label: "Bulan Lalu" },
  { id: "30d", label: "30 Hari Terakhir" },
  { id: "this-year", label: "Tahun Ini" },
  { id: "all", label: "Semua Waktu" },
] as const;

const SEARCHABLE_MENUS = [
  { title: "Dashboard Sales & Marketing", href: "/dashboard", category: "Utama", icon: BarChart3 },
  { title: "Pipeline & Prospek CRM", href: "/crm", category: "CRM", icon: UsersRound },
  { title: "Database Pelanggan / Customer", href: "/customers", category: "CRM", icon: UserCheck },
  { title: "Sales Orders", href: "/crm/sales-orders", category: "Penjualan", icon: Package },
  { title: "Purchase Orders (PO)", href: "/crm/purchase-orders", category: "Penjualan", icon: Clock },
  { title: "Invoices & Tagihan", href: "/crm/invoices", category: "Keuangan", icon: Wallet },
  { title: "Broadcast & Follow-up", href: "/crm/follow-up", category: "CRM", icon: MessageCircle },
  { title: "Produksi Kanban & SPK", href: "/produksi", category: "Produksi", icon: Factory },
  { title: "Detail Desain Produksi", href: "/detail-desain", category: "Produksi", icon: Shirt },
  { title: "Keuangan Pemasukan", href: "/keuangan/pemasukan", category: "Keuangan", icon: Wallet },
  { title: "Keuangan Pengeluaran", href: "/keuangan/pengeluaran", category: "Keuangan", icon: Coins },
  { title: "Laporan Keuangan", href: "/keuangan/laporan", category: "Keuangan", icon: BarChart3 },
  { title: "Kotak Masuk WhatsApp", href: "/whatsapp", category: "WhatsApp", icon: MessageCircle },
  { title: "Campaign Promo", href: "/campaigns", category: "Marketing", icon: Target },
  { title: "Master Kategori Produk", href: "/master-data/product-categories", category: "Master Data", icon: Layers },
  { title: "Master Sumber Lead", href: "/master-data/lead-sources", category: "Master Data", icon: Share2 },
  { title: "Master Ukuran Pakaian", href: "/master-data/garment-sizes", category: "Master Data", icon: Shirt },
  { title: "Master Metode Pembayaran", href: "/master-data/payment-methods", category: "Master Data", icon: Wallet },
  { title: "Master Jenis Customer", href: "/master-data/customer-types", category: "Master Data", icon: Users },
  { title: "Profil Perusahaan", href: "/master-data/business-profile", category: "Pengaturan", icon: Globe },
];

export function DashboardContentClient({ initialData }: { initialData: FullDashboardData }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active query parameters for SWR
  const activeRange = searchParams.get("range") || initialData.period.preset;
  const activeFrom = searchParams.get("from") || "";
  const activeTo = searchParams.get("to") || "";
  const activeSourceId = searchParams.get("sourceId") || "";
  const activeCategoryId = searchParams.get("categoryId") || "";

  const queryKey = useMemo(() => {
    const p = new URLSearchParams();
    if (activeRange) p.set("range", activeRange);
    if (activeFrom) p.set("from", activeFrom);
    if (activeTo) p.set("to", activeTo);
    if (activeSourceId) p.set("sourceId", activeSourceId);
    if (activeCategoryId) p.set("categoryId", activeCategoryId);
    return `/api/crm/dashboard?${p.toString()}`;
  }, [activeRange, activeFrom, activeTo, activeSourceId, activeCategoryId]);

  const { data = initialData } = useSWR<FullDashboardData>(queryKey, fetcher, {
    fallbackData: initialData,
    revalidateOnFocus: false,
    refreshInterval: 45000,
    dedupingInterval: 5000,
  });

  // Data finansial hanya dikirim server untuk role Keuangan (Owner/Developer ikut lolos hasRole).
  const canViewFinancialData = data.canViewFinancialData;

  // Cakupan data per peran. Tampilan/tipografi tidak berubah; hanya data yang
  // disajikan yang disesuaikan: Admin Customer fokus pelanggan & CRM, Admin PO
  // fokus order, produk, dan produksi. Owner/Developer/Keuangan tetap penuh.
  const scope = data.dashboardScope ?? "FULL";
  const isFullScope = scope === "FULL";
  const isCustomerScope = scope === "CUSTOMER";
  const isProductionScope = scope === "PRODUCTION";
  const initialTrendMetric: "omzet" | "order" | "lead" | "pcs" = canViewFinancialData
    ? "omzet"
    : isProductionScope
      ? "pcs"
      : isCustomerScope
        ? "lead"
        : "order";

  // UI States
  const [trendMetric, setTrendMetric] = useState<"omzet" | "order" | "lead" | "pcs">(initialTrendMetric);
  const [categoryMetric, setCategoryMetric] = useState<"revenue" | "pcs">(
    data.canViewFinancialData ? "revenue" : "pcs",
  );
  const [picMetric, setPicMetric] = useState<"revenue" | "deal">(
    data.canViewFinancialData ? "revenue" : "deal",
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customFrom, setCustomFrom] = useState(data.period.from);
  const [customTo, setCustomTo] = useState(data.period.to);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const notifContainerRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
      if (notifContainerRef.current && !notifContainerRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Menu pada kolom pencarian mengikuti hak akses peran; menu yang tidak boleh
  // diakses (Keuangan, Data Master, Pengaturan) tidak ditampilkan ke admin.
  const scopedMenus = useMemo(() => {
    if (isFullScope) return SEARCHABLE_MENUS;
    const allowedHrefs = isCustomerScope
      ? ["/dashboard", "/crm", "/customers", "/crm/purchase-orders", "/crm/sales-orders", "/crm/follow-up", "/whatsapp", "/campaigns", "/produksi", "/detail-desain"]
      : ["/dashboard", "/crm/purchase-orders", "/crm/sales-orders", "/produksi", "/detail-desain"];
    return SEARCHABLE_MENUS.filter((menu) => allowedHrefs.includes(menu.href));
  }, [isFullScope, isCustomerScope]);

  // Filtered menus for search
  const filteredMenus = useMemo(() => {
    if (!searchKeyword.trim()) return scopedMenus.slice(0, 8);
    const q = searchKeyword.toLowerCase();
    return scopedMenus.filter(
      (m) => m.title.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
    );
  }, [scopedMenus, searchKeyword]);

  // Filtered categories for search
  const filteredCategories = useMemo(() => {
    if (!searchKeyword.trim()) return [];
    const q = searchKeyword.toLowerCase();
    return data.filterMeta.productCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [data.filterMeta.productCategories, searchKeyword]);

  // Filtered orders for search
  const filteredOrders = useMemo(() => {
    if (!searchKeyword.trim()) return [];
    const q = searchKeyword.toLowerCase();
    return data.recentOrders.filter(
      (o) =>
        o.orderNo.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q)
    );
  }, [data.recentOrders, searchKeyword]);

  // Notifications list
  const notificationsList = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      description: string;
      time: string;
      href: string;
      type: "warning" | "danger" | "info";
    }> = [];

    if (!isCustomerScope && data.operational.overdueCount > 0) {
      list.push({
        id: "notif-overdue",
        title: "Pesanan Terlambat (Overdue)",
        description: `${data.operational.overdueCount} SPK melewati batas tanggal deadline.`,
        time: "Mendesak",
        href: "/produksi",
        type: "danger",
      });
    }

    if (!isCustomerScope && data.operational.approachingDeadlineCount > 0) {
      list.push({
        id: "notif-deadline",
        title: "Mendekati Deadline (< 3 Hari)",
        description: `${data.operational.approachingDeadlineCount} SPK mendekati batas tanggal kirim.`,
        time: "Segera",
        href: "/produksi",
        type: "warning",
      });
    }

    if (!isProductionScope) {
      data.urgentActions.forEach((act) => {
        list.push({
          id: `urgent-${act.id}`,
          title: `Follow-up: ${act.customerName}`,
          description: `${act.nextAction} · ${act.title}`,
          time: act.nextActionAt,
          href: "/crm/follow-up",
          type: act.isOverdue ? "danger" : "info",
        });
      });
    }

    if (canViewFinancialData && data.cashflow.outstandingOrderCount > 0) {
      list.push({
        id: "notif-cashflow",
        title: "Sisa Piutang Customer Aktif",
        description: `${data.cashflow.outstandingOrderCount} Sales Order memiliki saldo piutang (${data.cashflow.outstandingAmount}).`,
        time: "Bulan ini",
        href: "/keuangan/laporan",
        type: "warning",
      });
    }

    return list;
  }, [canViewFinancialData, isCustomerScope, isProductionScope, data.operational, data.urgentActions, data.cashflow]);

  // Merged categories list (ranking by omzet untuk Keuangan, volume untuk admin)
  const categoryMergedList = useMemo(() => {
    return data.categoryRevenueDonut
      .map((cat) => {
        const prog = data.categoryProgress.find((p) => p.name === cat.name);
        return {
          name: cat.name,
          color: cat.color,
          revenue: cat.revenue,
          revenueNum: cat.revenueNum,
          percentage: cat.percentage,
          orderCount: prog?.count ?? 0,
          pcs: prog?.pcs ?? 0,
        };
      })
      .sort((a, b) => {
        if (canViewFinancialData) return b.revenueNum - a.revenueNum || b.orderCount - a.orderCount || b.pcs - a.pcs;
        return b.pcs - a.pcs || b.orderCount - a.orderCount;
      });
  }, [canViewFinancialData, data.categoryRevenueDonut, data.categoryProgress]);

  // Merged lead sources list (ranking channels by lead and deal volume)
  const leadSourcesMerged = useMemo(() => {
    return data.leadSourceTable
      .map((row) => {
        const donut = data.leadSourcesDonut.find((d) => d.name === row.name);
        return {
          ...row,
          color: donut?.color ?? "#3b82f6",
          sharePercentage: donut?.percentage ?? 0,
        };
      })
      .sort((a, b) => b.leadCount - a.leadCount || b.dealCount - a.dealCount);
  }, [data.leadSourceTable, data.leadSourcesDonut]);

  // Top PIC sales performance data for comparative bar chart
  const picChartData = useMemo(() => {
    return [...data.picPerformance]
      .sort((a, b) => (b.revenueNum ?? 0) - (a.revenueNum ?? 0) || b.dealCount - a.dealCount)
      .slice(0, 6);
  }, [data.picPerformance]);

  // Top categories data for comparative bar chart
  const topCategoriesChartData = useMemo(() => {
    return categoryMergedList.slice(0, 6);
  }, [categoryMergedList]);

  // Comparative cashflow liquidity vs outstanding receivables
  const cashflowChartData = useMemo(() => {
    return [
      {
        name: "Kas Masuk",
        nominal: data.cashflow.moneyInNum ?? 0,
        nominalFormatted: data.cashflow.moneyInThisMonth,
        fill: "#10b981",
        label: "Realisasi Kas",
      },
      {
        name: "Sisa Piutang",
        nominal: data.cashflow.outstandingNum ?? 0,
        nominalFormatted: data.cashflow.outstandingAmount,
        fill: "#f59e0b",
        label: `${data.cashflow.outstandingOrderCount} Order Belum Lunas`,
      },
    ];
  }, [data.cashflow]);

  // Factory workload by production division
  const operationalStagesData = useMemo(() => {
    return data.operational.stages.map((st) => ({
      name: st.label.split(" (")[0],
      fullName: st.label,
      count: st.count,
    }));
  }, [data.operational.stages]);

  const updateFilters = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    router.push(`/dashboard?${params.toString()}`);
  };

  const handlePresetChange = (preset: string) => {
    setShowDatePicker(false);
    updateFilters({ range: preset, from: "", to: "" });
  };

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customFrom && customTo) {
      setShowDatePicker(false);
      updateFilters({ range: "custom", from: customFrom, to: customTo });
    }
  };

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    setIsDarkMode(isDark);
  };

  // Helper for trend chart formatting
  const getTrendYAxisTick = (val: number) => {
    if (trendMetric === "omzet") {
      if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)}jt`;
      if (val >= 1000) return `Rp ${(val / 1000).toFixed(0)}rb`;
      return `Rp ${val}`;
    }
    return val.toString();
  };

  return (
    <div className="flex flex-col gap-6 text-base text-slate-800 dark:text-slate-100">
      {/* =========================================================================
          TOP UTILITY & SEARCH BAR (Fully Functional)
          ========================================================================= */}
      <div className="flex flex-col gap-3 rounded-2xl neu-card p-3.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input with Interactive Command Dropdown */}
        <div className="relative flex-1 sm:max-w-md" ref={searchContainerRef}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder="Cari menu, produk, atau transaksi..."
            className="h-11 w-full rounded-xl neu-inset pl-11 pr-10 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
          />
          {searchKeyword && (
            <button
              type="button"
              onClick={() => setSearchKeyword("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="size-4" />
            </button>
          )}

          {/* Search Results Dropdown Popover */}
          {searchFocused && (
            <div className="absolute left-0 top-13 z-50 w-full min-w-80 rounded-2xl neu-popover p-3.5">
              {/* Menu & Navigation Results */}
              <div>
                <p className="px-2 py-1 text-base font-bold uppercase tracking-wider text-slate-400">
                  {searchKeyword ? "Hasil Menu & Navigasi" : "Pintasan Menu Cepat"}
                </p>
                <div className="mt-1 flex flex-col gap-1 max-h-56 overflow-y-auto">
                  {filteredMenus.length > 0 ? (
                    filteredMenus.map((menu) => {
                      const Icon = menu.icon;
                      return (
                        <Link
                          key={menu.href}
                          href={menu.href}
                          onClick={() => {
                            setSearchFocused(false);
                            setSearchKeyword("");
                          }}
                          className="flex items-center justify-between rounded-xl px-3 py-2.5 text-base font-medium text-slate-700 transition hover:bg-slate-200/50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                        >
                          <span className="flex items-center gap-2.5">
                            <span className="flex size-8 items-center justify-center rounded-lg neu-icon-soft text-blue-600 dark:text-blue-400">
                              <Icon className="size-4" />
                            </span>
                            <span>{menu.title}</span>
                          </span>
                          <span className="text-base font-semibold text-slate-400">{menu.category}</span>
                        </Link>
                      );
                    })
                  ) : (
                    <p className="px-2 py-2 text-base text-slate-400">Tidak ada menu yang cocok</p>
                  )}
                </div>
              </div>

              {/* Matching Orders */}
              {filteredOrders.length > 0 && (
                <div className="mt-3 border-t border-slate-200/60 pt-3 dark:border-white/5">
                  <p className="px-2 py-1 text-base font-bold uppercase tracking-wider text-slate-400">
                    Transaksi / Order Terkait
                  </p>
                  <div className="mt-1 flex flex-col gap-1 max-h-44 overflow-y-auto">
                    {filteredOrders.map((ord) => (
                      <Link
                        key={ord.id}
                        href="/crm/sales-orders"
                        onClick={() => {
                          setSearchFocused(false);
                          setSearchKeyword("");
                        }}
                        className="flex items-center justify-between rounded-xl px-3 py-2 text-base transition hover:bg-slate-200/50 dark:hover:bg-slate-800/60"
                      >
                        <div>
                          <p className="font-mono font-bold text-slate-900 dark:text-slate-100">{ord.orderNo}</p>
                          <p className="text-base text-slate-500">{ord.customerName} · {ord.productName}</p>
                        </div>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {canViewFinancialData ? ord.total : `${ord.totalQty} pcs`}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Categories */}
              {filteredCategories.length > 0 && (
                <div className="mt-3 border-t border-slate-200/60 pt-3 dark:border-white/5">
                  <p className="px-2 py-1 text-base font-bold uppercase tracking-wider text-slate-400">
                    Kategori Produk
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 p-1">
                    {filteredCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          updateFilters({ categoryId: cat.id });
                          setSearchFocused(false);
                          setSearchKeyword("");
                        }}
                        className="rounded-lg neu-button px-3 py-1.5 text-base font-semibold text-blue-700 dark:text-blue-300"
                      >
                        Filter {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right utility items: Notifications & Theme toggle */}
        <div className="flex items-center justify-end gap-3">
          {/* Notification Bell with Functional Popover */}
          <div className="relative" ref={notifContainerRef}>
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative flex size-11 items-center justify-center rounded-xl neu-button text-slate-700 focus:outline-none dark:text-slate-200"
              title="Notifikasi Aktivitas & Peringatan Bisnis"
            >
              <Bell className="size-5" />
              {notificationsList.length > 0 && (
                <span className="absolute -right-1 -top-1 flex size-5.5 items-center justify-center rounded-full bg-red-600 text-base font-bold text-white shadow-xs ring-2 ring-white dark:ring-card">
                  {notificationsList.length}
                </span>
              )}
            </button>

            {/* Notification Popover Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-13 z-50 w-80 sm:w-96 rounded-2xl neu-popover p-4">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100">Notifikasi Bisnis</span>
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-base font-bold text-red-700 dark:bg-red-950/50 dark:text-red-400">
                      {notificationsList.length} aktif
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="mt-3 flex flex-col divide-y divide-slate-100 dark:divide-white/5 max-h-72 overflow-y-auto">
                  {notificationsList.length > 0 ? (
                    notificationsList.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setShowNotifications(false)}
                        className="flex items-start gap-3 py-3 transition hover:bg-slate-200/40 dark:hover:bg-slate-800/40 rounded-xl px-2.5"
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg text-base font-bold mt-0.5",
                            item.type === "danger"
                              ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                              : item.type === "warning"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400"
                          )}
                        >
                          {item.type === "danger" ? "!" : item.type === "warning" ? "⚠" : "i"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="truncate text-base font-bold text-slate-900 dark:text-slate-100">
                              {item.title}
                            </p>
                            <span className="text-base font-semibold text-slate-400 shrink-0 ml-1.5">
                              {item.time}
                            </span>
                          </div>
                          <p className="mt-1 text-base text-slate-500 dark:text-slate-400 leading-snug">
                            {item.description}
                          </p>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="py-6 text-center text-base text-slate-400">
                      <CheckCheck className="size-6 mx-auto mb-1 text-emerald-500" />
                      Tidak ada peringatan mendesak saat ini. Semua operasional berjalan normal.
                    </div>
                  )}
                </div>

                <div className="mt-3 border-t border-slate-200/60 pt-3 flex items-center justify-between text-base dark:border-white/5">
                  <Link
                    href="/produksi"
                    onClick={() => setShowNotifications(false)}
                    className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Antrean Produksi &rarr;
                  </Link>
                  <Link
                    href="/crm/follow-up"
                    onClick={() => setShowNotifications(false)}
                    className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Follow-up CRM &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex size-11 items-center justify-center rounded-xl neu-button text-slate-700 focus:outline-none dark:text-slate-200"
            title="Ganti Mode Gelap / Terang"
          >
            {isDarkMode ? <Sun className="size-5 text-amber-500" /> : <Moon className="size-5" />}
          </button>
        </div>
      </div>

      {/* =========================================================================
          PAGE HEADER BANNER (1:1 Reference Match)
          ========================================================================= */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Title & Icon */}
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl neu-icon-soft text-blue-600 dark:text-blue-400">
            <BarChart3 className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              {isCustomerScope ? "Dashboard Customer" : isProductionScope ? "Dashboard Produksi" : "Dashboard"}
            </h1>
            <p className="mt-0.5 text-base text-slate-500 dark:text-slate-400 sm:text-base">
              {isCustomerScope
                ? "Ringkasan pelanggan, prospek, dan aktivitas CRM"
                : isProductionScope
                  ? "Ringkasan order, volume produk, dan beban kerja produksi"
                  : "Ringkasan metrik eksekutif, pipeline penjualan, dan performa operasional bisnis"}
            </p>
          </div>
        </div>

        {/* Date Filter & Export Button */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker Button & Popover */}
          <div className="relative" ref={datePickerRef}>
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex h-11 items-center gap-2.5 rounded-xl neu-button px-4 text-base font-semibold text-slate-700 focus:outline-none dark:text-slate-200"
            >
              <CalendarDays className="size-4.5 text-slate-500" />
              <span>{data.period.label}</span>
              <ChevronDown className="size-4 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {showDatePicker && (
              <div className="absolute right-0 top-13 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-2xl neu-popover p-4.5">
                <p className="px-1 text-base font-bold uppercase tracking-wider text-slate-400">Pilih Rentang</p>
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  {DATE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetChange(preset.id)}
                      className={cn(
                        "whitespace-nowrap rounded-xl px-3.5 py-2.5 text-center text-base font-medium transition",
                        data.period.preset === preset.id
                          ? "neu-button-primary font-semibold"
                          : "text-slate-600 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3.5 border-t border-slate-200/60 pt-3.5 dark:border-white/5">
                  <p className="px-1 text-base font-bold uppercase tracking-wider text-slate-400">Custom Tanggal</p>
                  <form onSubmit={handleCustomDateSubmit} className="mt-2 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-sm font-medium text-slate-400 block mb-1">Dari:</label>
                        <input
                          type="date"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          className="w-full rounded-xl neu-inset px-3 py-2 text-base text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-400 block mb-1">Sampai:</label>
                        <input
                          type="date"
                          value={customTo}
                          onChange={(e) => setCustomTo(e.target.value)}
                          className="w-full rounded-xl neu-inset px-3 py-2 text-base text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="mt-0.5 rounded-xl neu-button-primary py-2.5 text-base font-semibold text-white shadow-xs"
                    >
                      Terapkan Rentang
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Export laporan multi-sheet (memuat omzet — khusus Keuangan) */}
          {canViewFinancialData && (
            <ExportButton
              analysisScope="dashboard"
              params={{
                range: activeRange,
                from: activeFrom || undefined,
                to: activeTo || undefined,
                sourceId: activeSourceId || undefined,
                categoryId: activeCategoryId || undefined,
              }}
              label="Export Excel"
              variant="default"
              className="h-11 rounded-xl px-4.5 text-base font-semibold"
            />
          )}
        </div>
      </div>

      {/* =========================================================================
          MULTI-DIMENSIONAL QUICK FILTER BAR
          ========================================================================= */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl neu-inset p-3 text-base">
        <span className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
          <Filter className="size-4" />
          Filter:
        </span>

        {/* Lead Source Filter Dropdown */}
        {!isProductionScope && (
        <select
          value={activeSourceId}
          onChange={(e) => updateFilters({ sourceId: e.target.value })}
          className="h-10 rounded-lg neu-button px-3 py-1.5 text-base font-medium text-slate-700 focus:outline-none dark:text-slate-200"
        >
          <option value="">Semua Sumber Lead</option>
          {data.filterMeta.leadSources.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        )}

        {/* Product Category Filter Dropdown */}
        <select
          value={activeCategoryId}
          onChange={(e) => updateFilters({ categoryId: e.target.value })}
          className="h-10 rounded-lg neu-button px-3 py-1.5 text-base font-medium text-slate-700 focus:outline-none dark:text-slate-200"
        >
          <option value="">Semua Kategori Produk</option>
          {data.filterMeta.productCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Quick Clear Filter if active */}
        {(activeSourceId || activeCategoryId) && (
          <button
            type="button"
            onClick={() => updateFilters({ sourceId: "", categoryId: "" })}
            className="rounded-lg neu-button px-2.5 py-1.5 text-base font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400"
          >
            Reset Filter
          </button>
        )}
      </div>

      {/* =========================================================================
          TOP KPI METRIC CARDS (3x2 Grid: 3 Atas, 3 Bawah - Perfectly Aligned)
          ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Total Lead (Blue Tint) */}
        {!isProductionScope && (
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-blue p-6">
          <div className="flex items-center justify-between">
            <div className="flex size-14 items-center justify-center rounded-2xl neu-icon-blue text-white">
              <Users className="size-7" />
            </div>
            <div className="flex items-center gap-1.5 text-right">
              <span className={cn(
                "flex items-center text-base font-bold",
                data.summary.leadGrowth >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {data.summary.leadGrowth >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                {Math.abs(data.summary.leadGrowth)}%
              </span>
              <span className="text-base font-medium text-slate-400">vs. lalu</span>
            </div>
          </div>
          <div className="mt-5">
            <p className="flex h-5 items-center text-base font-semibold text-slate-600 dark:text-slate-300">Total Lead</p>
            <div className="mt-1 flex h-11 items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {data.summary.totalLead}
              </span>
            </div>
          </div>
          <div className="mt-4 border-t border-blue-200/60 pt-3 dark:border-blue-900/30">
            <p className="text-base text-slate-500 dark:text-slate-400">Jumlah calon pelanggan yang masuk</p>
          </div>
        </div>
        )}

        {/* Card 2: Total Deal (Emerald Tint) */}
        {!isProductionScope && (
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-emerald p-6">
          <div className="flex items-center justify-between">
            <div className="flex size-14 items-center justify-center rounded-2xl neu-icon-emerald text-white">
              <Handshake className="size-7" />
            </div>
            <div className="flex items-center gap-1.5 text-right">
              <span className={cn(
                "flex items-center text-base font-bold",
                data.summary.dealGrowth >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {data.summary.dealGrowth >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                {Math.abs(data.summary.dealGrowth)}%
              </span>
              <span className="text-base font-medium text-slate-400">vs. lalu</span>
            </div>
          </div>
          <div className="mt-5">
            <p className="flex h-5 items-center text-base font-semibold text-slate-600 dark:text-slate-300">Total Deal</p>
            <div className="mt-1 flex h-11 items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {data.summary.totalDeal}
              </span>
            </div>
          </div>
          <div className="mt-4 border-t border-emerald-200/60 pt-3 dark:border-emerald-900/30">
            <p className="text-base text-slate-500 dark:text-slate-400">Jumlah deal yang berhasil</p>
          </div>
        </div>
        )}

        {/* Card 3: Total Order (Purple Tint) */}
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-purple p-6">
          <div className="flex items-center justify-between">
            <div className="flex size-14 items-center justify-center rounded-2xl neu-icon-purple text-white">
              <Package className="size-7" />
            </div>
            <div className="flex items-center gap-1.5 text-right">
              <span className={cn(
                "flex items-center text-base font-bold",
                data.summary.orderGrowth >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {data.summary.orderGrowth >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                {Math.abs(data.summary.orderGrowth)}%
              </span>
              <span className="text-base font-medium text-slate-400">vs. lalu</span>
            </div>
          </div>
          <div className="mt-5">
            <p className="flex h-5 items-center text-base font-semibold text-slate-600 dark:text-slate-300">Total Order</p>
            <div className="mt-1 flex h-11 items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {data.summary.totalOrder}
              </span>
            </div>
          </div>
          <div className="mt-4 border-t border-purple-200/60 pt-3 dark:border-purple-900/30">
            <p className="text-base text-slate-500 dark:text-slate-400">Jumlah pesanan yang masuk</p>
          </div>
        </div>

        {/* Card 4: Total Omzet (Indigo Tint) — khusus Keuangan */}
        {canViewFinancialData && (
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-indigo p-6">
          <div className="flex items-center justify-between">
            <div className="flex size-14 items-center justify-center rounded-2xl neu-icon-indigo text-white">
              <Coins className="size-7" />
            </div>
            <div className="flex items-center gap-1.5 text-right">
              <span className={cn(
                "flex items-center text-base font-bold",
                data.summary.omzetGrowth >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {data.summary.omzetGrowth >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                {Math.abs(data.summary.omzetGrowth)}%
              </span>
              <span className="text-base font-medium text-slate-400">vs. lalu</span>
            </div>
          </div>
          <div className="mt-5">
            <p className="flex h-5 items-center text-base font-semibold text-slate-600 dark:text-slate-300">Total Omzet</p>
            <div className="mt-1 flex h-11 items-baseline gap-1.5">
              <span className="truncate text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100" title={data.summary.totalOmzet}>
                {data.summary.totalOmzet}
              </span>
            </div>
          </div>
          <div className="mt-4 border-t border-indigo-200/60 pt-3 dark:border-indigo-900/30">
            <p className="text-base text-slate-500 dark:text-slate-400">Total pendapatan dari semua order</p>
          </div>
        </div>
        )}

        {/* Card 5: Total Volume Pcs Pakaian (Cyan Tint) */}
        {!isCustomerScope && (
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-cyan p-6">
          <div className="flex items-center justify-between">
            <div className="flex size-14 items-center justify-center rounded-2xl neu-icon-cyan text-white">
              <Shirt className="size-7" />
            </div>
            <div className="flex items-center gap-1.5 text-right">
              <span className={cn(
                "flex items-center text-base font-bold",
                data.summary.volumeGrowth >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {data.summary.volumeGrowth >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                {Math.abs(data.summary.volumeGrowth)}%
              </span>
              <span className="text-base font-medium text-slate-400">vs. lalu</span>
            </div>
          </div>
          <div className="mt-5">
            <p className="flex h-5 items-center text-base font-semibold text-slate-600 dark:text-slate-300">Volume Produksi</p>
            <div className="mt-1 flex h-11 items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {data.summary.totalVolumePcs}
              </span>
              <span className="text-base font-semibold text-slate-400">pcs</span>
            </div>
          </div>
          <div className="mt-4 border-t border-cyan-200/60 pt-3 dark:border-cyan-900/30">
            <p className="text-base text-slate-500 dark:text-slate-400">Total potong pakaian dipesan</p>
          </div>
        </div>
        )}

        {/* Card 6: Win Rate Closing (Amber Tint) */}
        {!isProductionScope && (
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-amber p-6">
          <div className="flex items-center justify-between">
            <div className="flex size-14 items-center justify-center rounded-2xl neu-icon-amber text-white">
              <Percent className="size-7" />
            </div>
            <div className="flex items-center gap-1.5 text-right">
              <span className={cn(
                "flex items-center text-base font-bold",
                data.summary.winRateGrowth >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {data.summary.winRateGrowth >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                {Math.abs(data.summary.winRateGrowth)}%
              </span>
              <span className="text-base font-medium text-slate-400">vs. lalu</span>
            </div>
          </div>
          <div className="mt-5">
            <p className="flex h-5 items-center text-base font-semibold text-slate-600 dark:text-slate-300">Closing Rate</p>
            <div className="mt-1 flex h-11 items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {data.summary.winRate}%
              </span>
            </div>
          </div>
          <div className="mt-4 border-t border-amber-200/60 pt-3 dark:border-amber-900/30">
            <p className="text-base text-slate-500 dark:text-slate-400">Rasio lead menjadi deal</p>
          </div>
        </div>
        )}

        {/* Card 7: SPK Aktif (Orange Tint) — khusus dashboard produksi */}
        {isProductionScope && (
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-orange p-6">
          <div className="flex items-center justify-between">
            <div className="flex size-14 items-center justify-center rounded-2xl neu-icon-orange text-white">
              <Factory className="size-7" />
            </div>
            <div className="flex items-center gap-1.5 text-right">
              <span className="text-base font-medium text-slate-400">antrean aktif</span>
            </div>
          </div>
          <div className="mt-5">
            <p className="flex h-5 items-center text-base font-semibold text-slate-600 dark:text-slate-300">SPK Aktif</p>
            <div className="mt-1 flex h-11 items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {data.operational.activeWorkOrders}
              </span>
              <span className="text-base font-semibold text-slate-400">SPK</span>
            </div>
          </div>
          <div className="mt-4 border-t border-orange-200/60 pt-3 dark:border-orange-900/30">
            <p className="text-base text-slate-500 dark:text-slate-400">Total work order berjalan di semua divisi</p>
          </div>
        </div>
        )}

        {/* Card 8: Pesanan Terlambat (Amber Tint) — khusus dashboard produksi */}
        {isProductionScope && (
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-amber p-6">
          <div className="flex items-center justify-between">
            <div className="flex size-14 items-center justify-center rounded-2xl neu-icon-amber text-white">
              <AlertTriangle className="size-7" />
            </div>
            <div className="flex items-center gap-1.5 text-right">
              <span className="text-base font-medium text-slate-400">perlu tindakan</span>
            </div>
          </div>
          <div className="mt-5">
            <p className="flex h-5 items-center text-base font-semibold text-slate-600 dark:text-slate-300">Pesanan Terlambat</p>
            <div className="mt-1 flex h-11 items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {data.operational.overdueCount}
              </span>
              <span className="text-base font-semibold text-slate-400">SPK</span>
            </div>
          </div>
          <div className="mt-4 border-t border-amber-200/60 pt-3 dark:border-amber-900/30">
            <p className="text-base text-slate-500 dark:text-slate-400">
              {data.operational.approachingDeadlineCount} SPK lagi mendekati deadline
            </p>
          </div>
        </div>
        )}
      </div>

      {/* =========================================================================
          ROW 2: TREN PENJUALAN HARIAN & ORDER TERBARU (Spacious & No-Cramp)
          ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Chart 1: Tren Harian (Spline Area Chart) - 7 Cols */}
        <div className="flex flex-col justify-between rounded-2xl neu-card p-6 lg:col-span-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 items-center justify-center rounded-xl neu-icon-soft text-blue-600 dark:text-blue-400">
                <TrendingUp className="size-6" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                  Tren {data.period.label}
                </h3>
                <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">Perkembangan harian dari semua sumber order</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Metric Switcher Pills */}
              <div className="flex items-center rounded-xl neu-inset p-1">
                {canViewFinancialData && (
                  <button
                    type="button"
                    onClick={() => setTrendMetric("omzet")}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-base sm:text-lg font-semibold transition",
                      trendMetric === "omzet"
                        ? "neu-button-primary font-semibold"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    )}
                  >
                    Omzet
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTrendMetric("order")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-base sm:text-lg font-semibold transition",
                    trendMetric === "order"
                      ? "neu-button-primary font-semibold"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  )}
                >
                  Order
                </button>
                {!isProductionScope && (
                <button
                  type="button"
                  onClick={() => setTrendMetric("lead")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-base sm:text-lg font-semibold transition",
                    trendMetric === "lead"
                      ? "neu-button-primary font-semibold"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  )}
                >
                  Lead
                </button>
                )}
                {!isCustomerScope && (
                <button
                  type="button"
                  onClick={() => setTrendMetric("pcs")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-base sm:text-lg font-semibold transition",
                    trendMetric === "pcs"
                      ? "neu-button-primary font-semibold"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  )}
                >
                  Pcs
                </button>
                )}
              </div>
            </div>
          </div>

          {/* Chart Container */}
          <div className="mt-6 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.4} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 14, fill: "#94a3b8" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 14, fill: "#94a3b8" }} tickFormatter={getTrendYAxisTick} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-xl neu-popover p-3.5 shadow-xl">
                          <p className="text-base font-semibold text-slate-500">{item.fullDate}</p>
                          <p className="mt-1 text-base font-bold text-blue-600 dark:text-blue-400">
                            {trendMetric === "omzet" ? formatCurrency(item.omzet) : `${item[trendMetric]} ${trendMetric}`}
                          </p>
                          <p className="mt-1 text-base text-slate-400">
                            {item.orders} order · {item.leads} lead · {item.pcs} pcs
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey={trendMetric}
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 4, stroke: "#2563eb", strokeWidth: 2, fill: "#fff" }}
                  activeDot={{ r: 6, stroke: "#2563eb", strokeWidth: 2, fill: "#2563eb" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* List: Order Terbaru (5 Cols) - Zero Overlap, Spacious Layout */}
        <div className="flex flex-col justify-start rounded-2xl neu-card p-6 lg:col-span-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl neu-icon-soft text-blue-600 dark:text-blue-400">
                <Clock className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">Order Terbaru</h3>
                <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">Pesanan yang baru masuk</p>
              </div>
            </div>
            <Link
              href="/crm/sales-orders"
              className="shrink-0 whitespace-nowrap text-base font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Lihat Semua
            </Link>
          </div>

          <div className="mt-5 flex flex-col divide-y divide-slate-200/60 dark:divide-white/5 max-h-[300px] overflow-y-auto pr-1">
            {data.recentOrders.map((order) => (
              <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl neu-icon-soft text-blue-600 dark:text-blue-400 mt-0.5">
                    <ShoppingBag className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-100">
                        {order.orderNo}
                      </span>
                      <span className={cn(
                        "rounded-full px-2.5 py-0.5 text-base font-semibold shadow-xs",
                        order.status === "Selesai"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : order.status === "Diproses"
                          ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-400"
                          : "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400"
                      )}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-base font-medium text-slate-800 dark:text-slate-200 truncate mt-0.5">
                      {order.customerName}
                    </p>
                    <p className="text-base text-slate-500 dark:text-slate-400 truncate">
                      {order.productName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-13 sm:pl-0">
                  <div className="text-left sm:text-right">
                    <p className="text-base sm:text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                      {canViewFinancialData ? order.total : `${order.totalQty} pcs`}
                    </p>
                    <p className="text-base text-slate-400">
                      {order.formattedDate}
                    </p>
                  </div>
                  <Link
                    href={`/crm/sales-orders`}
                    className="flex size-8 items-center justify-center rounded-lg neu-button text-slate-400 hover:text-blue-600 transition"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 3: KOMPARASI KINERJA TIM SALES (PIC) & KATEGORI PRODUK (GRAFIK BATANG)
          ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Card 1: Grafik Komparasi Kinerja Tim Sales (PIC) - 6 Cols */}
        {!isProductionScope && (
        <div className={cn("flex flex-col justify-start rounded-2xl neu-card p-6", isCustomerScope ? "lg:col-span-12" : "lg:col-span-6")}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 items-center justify-center rounded-xl neu-icon-blue text-white shrink-0">
                <Briefcase className="size-6" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                  Komparasi Kinerja Tim Sales (PIC)
                </h3>
                <p className="text-base text-slate-500 dark:text-slate-400">
                  {canViewFinancialData
                    ? "Peringkat dan selisih pencapaian omzet serta closing deal staf sales"
                    : "Peringkat pencapaian closing deal staf sales"}
                </p>
              </div>
            </div>

            {/* Metric Switcher */}
            <div className="flex items-center rounded-xl neu-inset p-1 shrink-0 self-start sm:self-auto">
              {canViewFinancialData && (
                <button
                  type="button"
                  onClick={() => setPicMetric("revenue")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm sm:text-base font-semibold transition",
                    picMetric === "revenue"
                      ? "neu-button-primary text-white"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  )}
                >
                  Omzet
                </button>
              )}
              <button
                type="button"
                onClick={() => setPicMetric("deal")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm sm:text-base font-semibold transition",
                  picMetric === "deal"
                    ? "neu-button-primary text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                )}
              >
                Deal Closed
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="mt-5 grid grid-cols-3 gap-2.5 rounded-2xl neu-inset p-3.5 text-center">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Top Producer</p>
              <p className="mt-0.5 text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 truncate" title={picChartData[0]?.picName ?? "-"}>
                {picChartData[0]?.picName ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Deal Tim</p>
              <p className="mt-0.5 text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {picChartData.reduce((acc, p) => acc + p.dealCount, 0)} deal
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Rata-rata Win Rate</p>
              <p className="mt-0.5 text-xl font-mono font-bold text-slate-900 dark:text-slate-100">
                {picChartData.length > 0 ? Math.round(picChartData.reduce((acc, p) => acc + p.winRate, 0) / picChartData.length) : 0}%
              </p>
            </div>
          </div>

          {/* Horizontal Bar Chart for PIC Comparison */}
          <div className="mt-5 h-64 w-full">
            {picChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={picChartData}
                  layout="vertical"
                  margin={{ top: 10, right: 25, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" strokeOpacity={0.4} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 13, fill: "#94a3b8" }}
                    tickFormatter={(val) => picMetric === "revenue" ? `Rp ${(val / 1000000).toFixed(0)}Jt` : `${val}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="picName"
                    tickLine={false}
                    axisLine={false}
                    width={95}
                    tick={{ fontSize: 13, fill: "currentColor" }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="rounded-xl neu-popover p-3.5 shadow-xl text-sm space-y-1">
                            <p className="font-bold text-slate-900 dark:text-slate-100">{item.picName}</p>
                            {canViewFinancialData && (
                              <p className="text-blue-600 dark:text-blue-400 font-bold font-mono">
                                Total Omzet: {item.revenue}
                              </p>
                            )}
                            <p className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                              Deal Closed: {item.dealCount} ({item.winRate}% Win Rate)
                            </p>
                            <p className="text-slate-400 text-xs">
                              Lead Ditangani: {item.leadCount} prospek
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey={picMetric === "revenue" ? "revenueNum" : "dealCount"}
                    name={picMetric === "revenue" ? "Omzet" : "Deal Closed"}
                    fill="#3b82f6"
                    radius={[0, 6, 6, 0]}
                  >
                    {picChartData.map((_, index) => (
                      <Cell
                        key={`cell-pic-${index}`}
                        fill={index === 0 ? "#2563eb" : index === 1 ? "#3b82f6" : index === 2 ? "#60a5fa" : "#93c5fd"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400 text-base">
                Belum ada data aktivitas sales pada rentang ini.
              </div>
            )}
          </div>
        </div>
        )}

        {/* Card 2: Omzet & Performa Kategori Produk (Grafik Batang Komparatif) - 6 Cols */}
        {!isCustomerScope && (
        <div className={cn("flex flex-col justify-start rounded-2xl neu-card p-6", isProductionScope ? "lg:col-span-12" : "lg:col-span-6")}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 items-center justify-center rounded-xl neu-icon-purple text-white shrink-0">
                <Layers className="size-6" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                  {canViewFinancialData ? "Komparasi Omzet Kategori Produk" : "Komparasi Kategori Produk"}
                </h3>
                <p className="text-base text-slate-500 dark:text-slate-400">
                  {canViewFinancialData
                    ? "Perbandingan visual kontribusi produk terlaris berdasarkan omzet dan kuantitas"
                    : "Perbandingan visual volume produksi tiap kategori produk"}
                </p>
              </div>
            </div>

            {/* Metric Switcher */}
            <div className="flex items-center rounded-xl neu-inset p-1 shrink-0 self-start sm:self-auto">
              {canViewFinancialData && (
                <button
                  type="button"
                  onClick={() => setCategoryMetric("revenue")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm sm:text-base font-semibold transition",
                    categoryMetric === "revenue"
                      ? "neu-button-primary text-white"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  )}
                >
                  Omzet (Rp)
                </button>
              )}
              <button
                type="button"
                onClick={() => setCategoryMetric("pcs")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm sm:text-base font-semibold transition",
                  categoryMetric === "pcs"
                    ? "neu-button-primary text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                )}
              >
                Volume (Pcs)
              </button>
            </div>
          </div>

          {/* Highlight Banner (memuat omzet — khusus Keuangan) */}
          {canViewFinancialData && (
          <div className="mt-5 rounded-2xl neu-inset p-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Total Omzet Kategori
                </span>
                <p className="mt-0.5 font-mono text-2xl font-black text-slate-900 dark:text-slate-100">
                  {data.summary.totalOmzet}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs font-semibold text-slate-400">Total Produksi</span>
                <p className="mt-0.5 text-base font-bold text-purple-600 dark:text-purple-400 font-mono">
                  {data.summary.totalVolumePcs} pcs ({data.summary.totalOrder} order)
                </p>
              </div>
            </div>
          </div>
          )}

          {/* Bar Chart: Komparasi Kategori Terlaris */}
          <div className="mt-5 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topCategoriesChartData}
                margin={{ top: 10, right: 15, left: -10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.4} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "currentColor" }}
                  interval={0}
                  angle={-12}
                  textAnchor="end"
                  height={35}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 13, fill: "#94a3b8" }}
                  tickFormatter={(val) => categoryMetric === "revenue" ? `Rp ${(val / 1000000).toFixed(0)}Jt` : `${val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-xl neu-popover p-3.5 shadow-xl text-sm space-y-1">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
                          {canViewFinancialData && (
                            <p className="text-purple-600 dark:text-purple-400 font-bold font-mono">
                              Omzet: {item.revenue} ({item.percentage}%)
                            </p>
                          )}
                          <p className="text-slate-500 text-xs">
                            Volume: <span className="font-mono font-semibold">{item.pcs} pcs</span> dari <span className="font-mono font-semibold">{item.orderCount} order</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey={categoryMetric === "revenue" ? "revenueNum" : "pcs"}
                  radius={[6, 6, 0, 0]}
                >
                  {topCategoriesChartData.map((cat, index) => (
                    <Cell key={`cell-cat-${index}`} fill={cat.color || "#8b5cf6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Rincian Semua Kategori dalam List Scrollable */}
          <div className="mt-4 flex flex-col divide-y divide-slate-200/60 dark:divide-white/5 max-h-[160px] overflow-y-auto pr-1">
            {categoryMergedList.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="size-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: cat.color }} />
                  <span className={cn(
                    "truncate font-semibold",
                    cat.revenueNum > 0 ? "text-slate-900 dark:text-slate-100" : "text-slate-500"
                  )}>
                    {cat.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({cat.pcs} pcs)
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canViewFinancialData && (
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                    {cat.revenue}
                  </span>
                  )}
                  <span className="rounded-md px-1.5 py-0.5 text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400">
                    {cat.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* =========================================================================
          ROW 4: ANALISA & INSIGHTS (1:1 Reference Match)
          ========================================================================= */}
      {!isProductionScope && (
      <div className="flex flex-col rounded-2xl neu-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl neu-icon-soft text-blue-600 dark:text-blue-400">
            <Lightbulb className="size-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Analisa & Insights</h3>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Insight 1: Omzet */}
          {canViewFinancialData && (
          <div className="flex items-start gap-3.5 rounded-2xl neu-inset p-4.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl neu-icon-emerald text-white">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">{data.insights.omzetStatus.title}</p>
              <p className="mt-1 text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                {data.insights.omzetStatus.description}
              </p>
            </div>
          </div>
          )}

          {/* Insight 2: Sumber Lead */}
          <div className="flex items-start gap-3.5 rounded-2xl neu-inset p-4.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl neu-icon-blue text-white">
              <Radio className="size-5" />
            </div>
            <div>
              <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">{data.insights.topLeadSource.title}</p>
              <p className="mt-1 text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                {data.insights.topLeadSource.description}
              </p>
            </div>
          </div>

          {/* Insight 3: Kategori Terlaris (berbasis omzet — khusus Keuangan) */}
          {canViewFinancialData && (
          <div className="flex items-start gap-3.5 rounded-2xl neu-inset p-4.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl neu-icon-purple text-white">
              <Award className="size-5" />
            </div>
            <div>
              <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">{data.insights.bestSellingCategory.title}</p>
              <p className="mt-1 text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                {data.insights.bestSellingCategory.description}
              </p>
            </div>
          </div>
          )}

          {/* Insight 4: Rekomendasi */}
          <div className="flex items-start gap-3.5 rounded-2xl neu-inset p-4.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl neu-icon-amber text-white">
              <Target className="size-5" />
            </div>
            <div>
              <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">{data.insights.recommendation.title}</p>
              <p className="mt-1 text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                {data.insights.recommendation.description}
              </p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* =========================================================================
          EXTENDED SECTION 5: SALES & MARKETING CONVERSION FUNNEL
          ========================================================================= */}
      {!isProductionScope && (
      <div className="flex flex-col rounded-2xl neu-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 items-center justify-center rounded-xl neu-icon-soft text-purple-600 dark:text-purple-400">
              <Sparkles className="size-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Sales & Marketing Conversion Funnel
              </h3>
              <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">
                Analisa alur konversi dari prospek awal hingga sales order aktif dan titik hambat (drop-off)
              </p>
            </div>
          </div>
        </div>

        {/* Funnel Progress Bars */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-5">
          {data.conversionFunnel.map((step, idx) => (
            <div
              key={step.stage}
              className="relative flex flex-col justify-between rounded-xl neu-inset p-4.5"
            >
              <div>
                <span className="text-base font-bold uppercase tracking-wider text-slate-400">Tahap {idx + 1}</span>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">{step.label}</p>
                <p className="mt-2 text-3xl font-black text-blue-600 dark:text-blue-400">{step.count}</p>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-base font-semibold text-slate-500">
                  <span>Konversi</span>
                  <span>{step.percentage}%</span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full neu-inset">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${step.percentage}%` }} />
                </div>
                {step.dropOffRate > 0 && (
                  <p className="mt-1.5 text-base font-medium text-rose-500">
                    Drop-off: {step.dropOffRate}%
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* =========================================================================
          EXTENDED SECTION 6: SEGMENTASI PELANGGAN & MATRIKS RETENSI (NO AOV)
          ========================================================================= */}
      {!isProductionScope && (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Customer Segmentation by Type - 5 Cols */}
        <div className="flex flex-col justify-start rounded-2xl neu-card p-6 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 items-center justify-center rounded-xl neu-icon-soft text-cyan-600 dark:text-cyan-400">
                <UsersRound className="size-6" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">Segmentasi Tipe Pelanggan</h3>
                <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">Kontribusi penjualan berdasarkan instansi dan segmen</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3.5">
            {data.customerSegmentation.map((seg) => (
              <div key={seg.type} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-base">
                  <span className={cn(
                    seg.orderCount > 0 ? "font-bold text-slate-900 dark:text-slate-100" : "font-medium text-slate-600 dark:text-slate-300"
                  )}>
                    {seg.type}
                  </span>
                  <span className="text-slate-900 font-mono text-base dark:text-slate-100">
                    {canViewFinancialData && <span className="font-bold">{seg.revenue}</span>}{" "}
                    <span className="text-base text-slate-400 font-normal">({seg.orderCount} order)</span>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full neu-inset">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      seg.percentage > 0 ? "bg-cyan-600" : "bg-transparent"
                    )}
                    style={{ width: `${Math.max(seg.percentage, seg.orderCount > 0 ? 3 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Retention Stats (Customer Baru vs Repeat) */}
          <div className="mt-6 grid grid-cols-3 gap-2.5 border-t border-slate-200/60 pt-4 text-center dark:border-white/5">
            <div className="rounded-xl neu-inset p-3">
              <p className="text-base font-medium text-slate-500 dark:text-slate-400">Customer Baru</p>
              <p className="mt-1 text-2xl font-mono font-bold text-slate-900 dark:text-slate-100">{data.retention.newCustomerCount}</p>
            </div>
            <div className="rounded-xl neu-inset p-3">
              <p className="text-base font-medium text-slate-500 dark:text-slate-400">Repeat Customer</p>
              <p className="mt-1 text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">{data.retention.repeatCustomerCount}</p>
            </div>
            <div className="rounded-xl neu-inset p-3">
              <p className="text-base font-medium text-slate-500 dark:text-slate-400">Repeat Rate</p>
              <p className="mt-1 text-2xl font-mono font-bold text-blue-600 dark:text-blue-400">{data.retention.repeatRate}%</p>
            </div>
          </div>
        </div>

        {/* Top 5 High-Value Loyal Customers - 7 Cols */}
        <div className="flex flex-col justify-start rounded-2xl neu-card p-6 lg:col-span-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl neu-icon-soft text-amber-600 dark:text-amber-400">
                <UserCheck className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                  Top 5 Pelanggan Paling Berharga
                </h3>
                <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">
                  {canViewFinancialData
                    ? "Customer dengan kontribusi omzet dan frekuensi repeat order tertinggi"
                    : "Customer dengan frekuensi order dan repeat order tertinggi"}
                </p>
              </div>
            </div>
            <Link href="/customers" className="shrink-0 whitespace-nowrap text-base font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Semua Customer
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-base">
              <thead>
                <tr className="border-b border-slate-200/80 text-base font-bold text-slate-700 dark:border-white/10 dark:text-slate-200">
                  <th className="py-3.5 pr-4 pl-1">Customer</th>
                  <th className="py-3.5 px-4">Tipe</th>
                  <th className="py-3.5 px-4 text-center">Order</th>
                  {canViewFinancialData && <th className="py-3.5 px-4 text-right">Total Belanja</th>}
                  <th className="py-3.5 pl-4 pr-1 text-center">Hubungi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50 dark:divide-white/5">
                {data.topCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-slate-200/30 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3.5 pr-4 pl-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{cust.name}</p>
                      {cust.companyName && (
                        <p className="text-base text-slate-400">{cust.companyName}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{cust.customerType}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-blue-600 dark:text-blue-400">{cust.orderCount}x</td>
                    {canViewFinancialData && (
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {cust.revenue}
                    </td>
                    )}
                    <td className="py-3.5 pl-4 pr-1 text-center">
                      {cust.whatsapp ? (
                        <a
                          href={`https://wa.me/${cust.whatsapp.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg neu-button px-3 py-1.5 text-base font-semibold text-emerald-700 dark:text-emerald-400"
                        >
                          <MessageCircle className="size-4" />
                          Chat
                        </a>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* =========================================================================
          EXTENDED SECTION 7: EFEKTIVITAS KANAL MARKETING & KINERJA TIM PIC
          ========================================================================= */}
      {!isProductionScope && (
      <div className={cn("grid grid-cols-1 gap-6", canViewFinancialData && "lg:grid-cols-2")}>
        {/* Grafik Komparasi Likuiditas Kas vs Sisa Piutang (khusus Keuangan) */}
        {canViewFinancialData && (
        <div className="flex flex-col justify-between rounded-2xl neu-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl neu-icon-soft text-emerald-600 dark:text-emerald-400">
                <Wallet className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                  Komparasi Likuiditas Kas & Piutang
                </h3>
                <p className="text-base text-slate-500 dark:text-slate-400">
                  Perbandingan selisih uang masuk kas dengan tagihan piutang aktif customer
                </p>
              </div>
            </div>
            <Link
              href="/keuangan/laporan"
              className="shrink-0 whitespace-nowrap text-sm sm:text-base font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Detail Kas
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl neu-inset p-3.5 border-l-4 border-emerald-500">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Realisasi Kas Masuk</span>
              <p className="mt-1 font-mono text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {data.cashflow.moneyInThisMonth}
              </p>
            </div>
            <div className="rounded-xl neu-inset p-3.5 border-l-4 border-amber-500">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Sisa Piutang ({data.cashflow.outstandingOrderCount} Order)</span>
              <p className="mt-1 font-mono text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                {data.cashflow.outstandingAmount}
              </p>
            </div>
          </div>

          {/* Bar Chart: Kas vs Piutang */}
          <div className="mt-5 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowChartData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.4} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 13, fill: "currentColor" }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 13, fill: "#94a3b8" }}
                  tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(0)}Jt`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-xl neu-popover p-3.5 shadow-xl text-sm space-y-1">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
                          <p className="font-bold font-mono text-base" style={{ color: item.fill }}>
                            {item.nominalFormatted}
                          </p>
                          <p className="text-slate-400 text-xs">{item.label}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="nominal" radius={[8, 8, 0, 0]}>
                  {cashflowChartData.map((entry, index) => (
                    <Cell key={`cell-cf-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between text-xs text-slate-500">
            <span>Rasio Piutang terhadap Kas Masuk:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {(data.cashflow.moneyInNum ?? 0) > 0
                ? `${Math.round(((data.cashflow.outstandingNum ?? 0) / ((data.cashflow.moneyInNum ?? 0) + (data.cashflow.outstandingNum ?? 0))) * 100)}% Saldo Tertahan`
                : "100% Tertahan"}
            </span>
          </div>
        </div>
        )}

        {/* Sales PIC Team Performance */}
        <div className="flex flex-col justify-start rounded-2xl neu-card p-6">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 items-center justify-center rounded-xl neu-icon-soft text-indigo-600 dark:text-indigo-400">
              <Briefcase className="size-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">Kinerja Tim Sales / PIC</h3>
              <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">
                {canViewFinancialData ? "Kontribusi closing dan pendapatan per staf sales" : "Kontribusi closing dan konversi per staf sales"}
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-base">
              <thead>
                <tr className="border-b border-slate-200/80 text-base font-bold text-slate-700 dark:border-white/10 dark:text-slate-200">
                  <th className="py-3.5 pr-4 pl-1">Sales PIC</th>
                  <th className="py-3.5 px-4 text-center">Lead Ditangani</th>
                  <th className="py-3.5 px-4 text-center">Deal Closed</th>
                  <th className="py-3.5 px-4 text-center">Closing Rate</th>
                  {canViewFinancialData && <th className="py-3.5 pl-4 pr-1 text-right">Total Omzet</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50 dark:divide-white/5">
                {data.picPerformance.length > 0 ? (
                  data.picPerformance.map((p) => (
                    <tr key={p.picId} className="hover:bg-slate-200/30 dark:hover:bg-slate-800/30 transition">
                      <td className="py-3.5 pr-4 pl-1 font-semibold text-slate-900 dark:text-slate-100">{p.picName}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">{p.leadCount}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">{p.dealCount}</td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-blue-600 dark:text-blue-400">{p.winRate}%</td>
                      {canViewFinancialData && (
                      <td className="py-3.5 pl-4 pr-1 text-right font-mono font-bold text-slate-900 dark:text-slate-100">{p.revenue}</td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={canViewFinancialData ? 5 : 4} className="py-6 text-center text-base text-slate-400">
                      Belum ada penugasan PIC pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* =========================================================================
          EXTENDED SECTION 8: MENARA KONTROL OPERASIONAL PRODUKSI KONVEKSI
          ========================================================================= */}
      {!isCustomerScope && (
      <div className="flex flex-col rounded-2xl neu-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl neu-icon-soft text-orange-600 dark:text-orange-400">
              <Factory className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Menara Kontrol Operasional Produksi Konveksi
              </h3>
              <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">
                Pantau antrean Surat Perintah Kerja (SPK) di setiap divisi dan peringatan deadline
              </p>
            </div>
          </div>
          <Link href="/produksi" className="shrink-0 whitespace-nowrap text-base font-semibold text-blue-600 hover:underline dark:text-blue-400">
            Buka Produksi Kanban
          </Link>
        </div>

        {/* Visual Bar Chart: Beban Kerja SPK per Divisi */}
        <div className="mt-5 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={operationalStagesData} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.4} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 13, fill: "#64748b" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 13, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="rounded-xl neu-popover p-3 shadow-xl">
                        <p className="font-bold text-slate-900 dark:text-slate-100">{item.fullName}</p>
                        <p className="text-orange-600 dark:text-orange-400 font-bold font-mono text-base mt-1">
                          {item.count} SPK Aktif
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" name="SPK Aktif" radius={[6, 6, 0, 0]}>
                {operationalStagesData.map((entry, idx) => (
                  <Cell
                    key={`cell-op-${idx}`}
                    fill={entry.count >= 5 ? "#dc2626" : entry.count >= 3 ? "#ea580c" : "#f59e0b"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Division Stage Grid */}
        <div className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
          {data.operational.stages.map((st) => (
            <div
              key={st.stage}
              className="flex flex-col justify-between rounded-xl neu-inset p-4"
            >
              <p className="text-base font-medium text-slate-600 dark:text-slate-400">{st.label}</p>
              <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">
                {st.count} <span className="text-base font-normal text-slate-400">SPK</span>
              </p>
            </div>
          ))}
        </div>

        {/* Warning Alerts (Deadline mepet & Overdue) */}
        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className={cn(
            "flex items-center justify-between rounded-xl p-4 transition",
            data.operational.approachingDeadlineCount > 0
              ? "neu-card border border-amber-500/30 text-amber-900 dark:text-amber-200"
              : "neu-inset text-slate-600 dark:text-slate-400"
          )}>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl neu-icon-amber text-white">
                <Clock className="size-5" />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold">Mendekati Deadline (&lt; 3 Hari)</p>
                <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">Perlu diprioritaskan bagian finishing</p>
              </div>
            </div>
            <span className="text-2xl font-black">{data.operational.approachingDeadlineCount} SPK</span>
          </div>

          <div className={cn(
            "flex items-center justify-between rounded-xl p-4 transition",
            data.operational.overdueCount > 0
              ? "neu-card border border-rose-500/30 text-rose-900 dark:text-rose-200"
              : "neu-inset text-slate-600 dark:text-slate-400"
          )}>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl neu-button text-rose-600">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold">Pesanan Terlambat (Overdue)</p>
                <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">Memerlukan tindakan segera supervisor</p>
              </div>
            </div>
            <span className="text-2xl font-black text-rose-600">{data.operational.overdueCount} SPK</span>
          </div>
        </div>
      </div>
      )}

      {/* =========================================================================
          EXTENDED SECTION 9: ARUS KAS & TINDAK LANJUT CRM HARI INI
          ========================================================================= */}
      {!isProductionScope && (
      <div className={cn("grid grid-cols-1 gap-6", canViewFinancialData && "lg:grid-cols-2")}>
        {/* Cashflow Summary (khusus Keuangan) */}
        {canViewFinancialData && (
        <div className="flex flex-col justify-start rounded-2xl neu-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl neu-icon-soft text-emerald-600 dark:text-emerald-400">
                <Wallet className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">Kesehatan Arus Kas & Piutang</h3>
                <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">Uang masuk kas vs sisa piutang aktif customer</p>
              </div>
            </div>
            <Link href="/keuangan/laporan" className="shrink-0 whitespace-nowrap text-base font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Detail Kas
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-xl neu-inset p-4.5 border border-emerald-500/20">
              <p className="text-base font-semibold text-emerald-700 dark:text-emerald-300">Uang Masuk Kas Bulan Ini</p>
              <p className="mt-1 text-2xl sm:text-3xl font-mono font-extrabold text-emerald-900 dark:text-emerald-100">
                {data.cashflow.moneyInThisMonth}
              </p>
              <p className="mt-1.5 text-base text-emerald-600">Realisasi pembayaran DP &amp; pelunasan</p>
            </div>

            <div className="rounded-xl neu-inset p-4.5 border border-amber-500/20">
              <p className="text-base font-semibold text-amber-700 dark:text-amber-300">Sisa Piutang Aktif</p>
              <p className="mt-1 text-2xl sm:text-3xl font-mono font-extrabold text-amber-900 dark:text-amber-100">
                {data.cashflow.outstandingAmount}
              </p>
              <p className="mt-1.5 text-base text-amber-600">
                {data.cashflow.outstandingOrderCount} order belum lunas
              </p>
            </div>
          </div>
        </div>
        )}

        {/* CRM Urgent Actions Due Today */}
        <div className="flex flex-col justify-start rounded-2xl neu-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl neu-icon-soft text-blue-600 dark:text-blue-400">
                <CalendarClock className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">Tindak Lanjut CRM Hari Ini</h3>
                <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">Jadwal follow-up dan negosiasi agar prospek tidak lepas</p>
              </div>
            </div>
            <Link href="/crm/follow-up" className="shrink-0 whitespace-nowrap text-base font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Buka CRM
            </Link>
          </div>

          <div className="mt-4 flex flex-col divide-y divide-slate-200/60 dark:divide-white/5">
            {data.urgentActions.length > 0 ? (
              data.urgentActions.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-slate-900 dark:text-slate-100">
                      {item.nextAction}
                    </p>
                    <p className="truncate text-base sm:text-lg text-slate-500">
                      {item.customerName} · {item.title}
                    </p>
                  </div>
                  <span className={cn(
                    "ml-2 shrink-0 rounded-lg px-2.5 py-1 text-base font-semibold",
                    item.isOverdue
                      ? "neu-button text-rose-700 dark:text-rose-400"
                      : "neu-inset text-slate-700 dark:text-slate-300"
                  )}>
                    {item.nextActionAt}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-base text-slate-400">
                Semua tindak lanjut CRM telah diselesaikan!
              </p>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
