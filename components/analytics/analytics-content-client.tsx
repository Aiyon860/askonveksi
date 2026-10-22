"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  Clock,
  Crown,
  Factory,
  Filter,
  Globe,
  Handshake,
  Layers,
  Lightbulb,
  MessageCircle,
  MousePointerClick,
  Package,
  Radio,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Shirt,
  Sparkles,
  Store,
  Tag,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import { formatCurrency } from "@/lib/crm/format";
import type { ExecutiveAnalyticsData } from "@/lib/crm/analytics-data";
import { ExportButton } from "@/components/export/export-button";
import { cn } from "@/lib/utils";

function getLeadSourceIcon(sourceName: string) {
  const s = sourceName.toLowerCase();
  if (s.includes("whatsapp")) {
    return <MessageCircle className="size-5 text-emerald-500 shrink-0" />;
  }
  if (s.includes("instagram")) {
    return (
      <svg className="size-5 text-pink-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </svg>
    );
  }
  if (s.includes("landing")) {
    return <MousePointerClick className="size-5 text-cyan-500 shrink-0" />;
  }
  if (s.includes("web")) {
    return <Globe className="size-5 text-blue-500 shrink-0" />;
  }
  if (s.includes("market") || s.includes("shopee") || s.includes("tokopedia")) {
    return <Store className="size-5 text-orange-500 shrink-0" />;
  }
  if (s.includes("referral") || s.includes("rekomendasi") || s.includes("teman")) {
    return <Share2 className="size-5 text-teal-500 shrink-0" />;
  }
  return <Tag className="size-5 text-slate-400 shrink-0" />;
}

const PRESET_OPTIONS = [
  { id: "today", label: "Hari Ini" },
  { id: "yesterday", label: "Kemarin" },
  { id: "7d", label: "7 Hari" },
  { id: "this-month", label: "Bulan Ini" },
  { id: "last-month", label: "Bulan Lalu" },
  { id: "30d", label: "30 Hari" },
  { id: "this-year", label: "Tahun Ini" },
  { id: "all", label: "Semua Waktu" },
];

export function AnalyticsContentClient({ initialData }: { initialData: ExecutiveAnalyticsData }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  const [customFrom, setCustomFrom] = useState(initialData.period.from || "");
  const [customTo, setCustomTo] = useState(initialData.period.to || "");
  const [chartMetric, setChartMetric] = useState<"revenue" | "profit" | "orders" | "pcs" | "leads">("revenue");
  const [productSearch, setProductSearch] = useState("");
  const [showInsightsDetail, setShowInsightsDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<"products" | "channels" | "sales" | "customers" | "operations">("products");

  const queryString = searchParams.toString();
  const swrKey = queryString ? `/api/crm/analytics?${queryString}` : "/api/crm/analytics";

  const { data, isValidating, mutate } = useSWR<ExecutiveAnalyticsData>(swrKey, fetcher, {
    fallbackData: initialData,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const activeData = data || initialData;

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setDateDropdownOpen(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setFilterDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelectPreset(presetId: string) {
    setDateDropdownOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", presetId);
    params.delete("from");
    params.delete("to");
    router.push(`/analytics?${params.toString()}`);
  }

  function handleApplyCustomDate(e: React.FormEvent) {
    e.preventDefault();
    if (!customFrom || !customTo) return;
    setDateDropdownOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("range");
    params.set("from", customFrom);
    params.set("to", customTo);
    router.push(`/analytics?${params.toString()}`);
  }

  function handleApplyFilter(type: "sourceId" | "categoryId", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(type, value);
    } else {
      params.delete(type);
    }
    router.push(`/analytics?${params.toString()}`);
  }

  function handleClearAllFilters() {
    setFilterDropdownOpen(false);
    const params = new URLSearchParams();
    if (activeData.period.preset && activeData.period.preset !== "custom") {
      params.set("range", activeData.period.preset);
    }
    router.push(`/analytics?${params.toString()}`);
  }

  // Filtered products list
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return activeData.products;
    const q = productSearch.toLowerCase();
    return activeData.products.filter(
      (p) => p.productName.toLowerCase().includes(q) || p.categoryName.toLowerCase().includes(q)
    );
  }, [activeData.products, productSearch]);

  const hasActiveFilters = Boolean(activeData.filters.sourceId || activeData.filters.categoryId);

  // Split funnel into Phase 1 (Top 4 stages) and Phase 2 (Bottom 4 stages)
  const funnelPhase1 = activeData.funnel.slice(0, 4);
  const funnelPhase2 = activeData.funnel.slice(4, 8);

  return (
    <div className="flex flex-col gap-6 text-base text-slate-800 dark:text-slate-100 w-full pb-16">
      {/* =========================================================================
          PAGE HEADER BANNER (1:1 Reference Match dengan Dashboard)
          ========================================================================= */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl neu-icon-soft text-blue-600 dark:text-blue-400">
            <BarChart3 className="size-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                Executive Business Analytics
              </h1>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-base font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                Owner Suite
              </span>
              {isValidating && (
                <span className="inline-flex items-center gap-1.5 text-base font-medium text-slate-500 animate-pulse">
                  <RefreshCw className="size-4 animate-spin text-blue-600" /> Memperbarui...
                </span>
              )}
            </div>
            <p className="mt-0.5 text-base text-slate-500 dark:text-slate-400 sm:text-lg">
              Analisis menyeluruh profitabilitas, HPP, alur closing pipeline, dan kontrol operasional konveksi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => mutate()}
            className="flex h-11 items-center gap-2 rounded-xl neu-button px-4 text-base font-semibold text-slate-700 hover:text-blue-600 dark:text-slate-200 transition"
            title="Refresh Data"
          >
            <RefreshCw className={cn("size-4.5", isValidating && "animate-spin text-blue-600")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Date Picker Button with Wide Popover */}
          <div className="relative" ref={dateDropdownRef}>
            <button
              type="button"
              onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
              className={cn(
                "flex h-11 items-center gap-2.5 rounded-xl neu-button px-4 text-base font-semibold text-slate-700 focus:outline-none dark:text-slate-200",
                activeData.period.preset === "custom" && "border-blue-500 ring-2 ring-blue-500/20"
              )}
            >
              <Calendar className="size-4.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="max-w-[200px] truncate">{activeData.period.label}</span>
              <ChevronDown className="size-4 text-slate-400 shrink-0" />
            </button>

            {/* Wide Date Picker Popover */}
            {dateDropdownOpen && (
              <div className="absolute right-0 top-13 z-50 w-96 rounded-2xl neu-popover p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 dark:border-white/5 mb-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-5 text-blue-600" />
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100">Pilih Periode Waktu</span>
                  </div>
                  <button onClick={() => setDateDropdownOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                    <X className="size-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {PRESET_OPTIONS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={cn(
                        "rounded-xl px-3 py-2 text-base font-medium transition",
                        activeData.period.preset === preset.id
                          ? "neu-button-primary text-white font-bold"
                          : "neu-button text-slate-700 hover:text-blue-600 dark:text-slate-200"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 border-t border-slate-200/60 pt-4 dark:border-white/5">
                  <p className="px-1 text-base font-bold uppercase tracking-wider text-slate-400">Custom Rentang Tanggal</p>
                  <form onSubmit={handleApplyCustomDate} className="mt-2.5 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-semibold text-slate-500 dark:text-slate-400 block mb-1">Dari Tanggal:</label>
                        <input
                          type="date"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          className="w-full rounded-xl neu-inset px-3 py-2 text-base text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-slate-500 dark:text-slate-400 block mb-1">Sampai Tanggal:</label>
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
                      className="mt-1 rounded-xl neu-button-primary py-2.5 text-base font-semibold text-white shadow-xs"
                    >
                      Terapkan Rentang
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Export laporan multi-sheet */}
          <ExportButton
            analysisScope="analytics"
            params={Object.fromEntries(searchParams.entries())}
            label="Export Excel"
            variant="default"
            className="h-11 rounded-xl px-4.5 text-base font-semibold"
          />
        </div>
      </div>

      {/* =========================================================================
          IMPROVISASI 1: SLEEK EXECUTIVE INTELLIGENCE RIBBON (BUKAN 4 CARD RAKSASA)
          ========================================================================= */}
      <div className="rounded-2xl neu-card p-4 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl neu-icon-soft flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Sparkles className="size-5" />
            </div>
            <div>
              <span className="text-sm font-bold uppercase tracking-wider text-slate-400 block">
                Executive Intelligence
              </span>
              <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Status Operasional & Finansial Terkini
              </span>
            </div>
          </div>

          {/* 4 Sleek Status Pills: Compact, Informative, No Clutter */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Pill 1: Margin */}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-bold shadow-xs",
                activeData.summary.marginStatus === "SANGAT SEHAT" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
                activeData.summary.marginStatus === "SEHAT" && "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
                activeData.summary.marginStatus === "MODERAT" && "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
                activeData.summary.marginStatus === "KRITIS" && "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
              )}
            >
              <span className="size-2 rounded-full bg-current" />
              Margin: {activeData.summary.grossMarginPercent}% ({activeData.summary.marginStatus})
            </span>

            {/* Pill 2: Piutang */}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-bold shadow-xs",
                activeData.summary.outstandingAr > 0
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              )}
            >
              <Wallet className="size-3.5" />
              {activeData.summary.outstandingAr > 0
                ? `Piutang: ${activeData.summary.outstandingArFormatted}`
                : "Piutang Lunas 100%"}
            </span>

            {/* Pill 3: Produksi */}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-bold shadow-xs",
                activeData.operations.overdueCount > 0
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                  : activeData.operations.approachingDeadlineCount > 0
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
              )}
            >
              <Factory className="size-3.5" />
              {activeData.operations.overdueCount > 0
                ? `${activeData.operations.overdueCount} SPK Overdue!`
                : `${activeData.operations.activeWorkOrders} SPK Berjalan`}
            </span>

            {/* Toggle Detailed Briefing Accordion */}
            <button
              type="button"
              onClick={() => setShowInsightsDetail(!showInsightsDetail)}
              className="neu-button px-3 py-1 rounded-full text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 flex items-center gap-1 transition"
            >
              <span>{showInsightsDetail ? "Tutup Ulasan" : "Ulasan Strategis"}</span>
              {showInsightsDetail ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Detailed Strategic Insights: Only when requested */}
        {showInsightsDetail && (
          <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-white/5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
            {activeData.insights.map((insight) => {
              const isPos = insight.type === "positive";
              const isWarn = insight.type === "warning";
              const isAction = insight.type === "action";
              return (
                <div key={insight.id} className="p-4 rounded-xl neu-inset flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={cn(
                          "size-2.5 rounded-full shrink-0",
                          isPos && "bg-emerald-500",
                          isWarn && "bg-amber-500",
                          isAction && "bg-blue-500",
                          insight.type === "opportunity" && "bg-purple-500"
                        )}
                      />
                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {insight.title}
                      </h4>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {insight.description}
                    </p>
                  </div>
                  {insight.actionHref && insight.actionText && (
                    <div className="mt-3 pt-2 border-t border-slate-200/40 dark:border-white/5 flex justify-end">
                      <Link
                        href={insight.actionHref}
                        className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <span>{insight.actionText}</span>
                        <ChevronRight className="size-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          TOP 4 EXECUTIVE METRIC CARDS (Color-Tinted Soft Neumorphic)
          ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Omzet (Emerald Tint) */}
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-emerald p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Total Omzet (Revenue)
            </span>
            <div className="size-10 rounded-xl neu-icon-emerald flex items-center justify-center text-white">
              <CircleDollarSign className="size-5.5" />
            </div>
          </div>
          <div className="my-4">
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
              {activeData.summary.totalRevenueFormatted}
            </div>
          </div>
          <div className="flex items-center justify-between text-base pt-3 border-t border-emerald-200/60 dark:border-emerald-900/30">
            <span className="text-slate-500 dark:text-slate-400">vs. periode lalu:</span>
            <span
              className={cn(
                "font-bold flex items-center gap-1",
                activeData.summary.revenueGrowth >= 0 ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {activeData.summary.revenueGrowth >= 0 ? <ArrowUpRight className="size-4.5" /> : <ArrowDownRight className="size-4.5" />}
              {Math.abs(activeData.summary.revenueGrowth)}%
            </span>
          </div>
        </div>

        {/* Card 2: Gross Profit & Margin (Blue Tint) */}
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-blue p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Gross Profit (Laba Kotor)
            </span>
            <div className="size-10 rounded-xl neu-icon-blue flex items-center justify-center text-white">
              <TrendingUp className="size-5.5" />
            </div>
          </div>
          <div className="my-4">
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400 font-mono">
              {activeData.summary.totalGrossProfitFormatted}
            </div>
          </div>
          <div className="flex items-center justify-between text-base pt-3 border-t border-blue-200/60 dark:border-blue-900/30">
            <span className="text-slate-500 dark:text-slate-400">Total HPP Riil:</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
              {activeData.summary.totalHppFormatted}
            </span>
          </div>
        </div>

        {/* Card 3: Orders & Pcs Volume (Purple Tint) */}
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-purple p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Total Order & Volume
            </span>
            <div className="size-10 rounded-xl neu-icon-purple flex items-center justify-center text-white">
              <Package className="size-5.5" />
            </div>
          </div>
          <div className="my-4 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
              {activeData.summary.totalOrders}
            </span>
            <span className="text-base text-slate-500 font-semibold">Sales Order</span>
          </div>
          <div className="flex items-center justify-between text-base pt-3 border-t border-purple-200/60 dark:border-purple-900/30">
            <span className="text-slate-500 dark:text-slate-400">Total Produksi:</span>
            <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
              {activeData.summary.totalPcs.toLocaleString("id-ID")} pcs
            </span>
          </div>
        </div>

        {/* Card 4: AOV & Win Rate (Orange Tint) */}
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-orange p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Average Order Value (AOV)
            </span>
            <div className="size-10 rounded-xl neu-icon-orange flex items-center justify-center text-white">
              <Target className="size-5.5" />
            </div>
          </div>
          <div className="my-4">
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
              {activeData.summary.aovFormatted}
            </div>
          </div>
          <div className="flex items-center justify-between text-base pt-3 border-t border-orange-200/60 dark:border-orange-900/30">
            <span className="text-slate-500 dark:text-slate-400">Closing Win Rate:</span>
            <span className="font-bold text-emerald-600 font-mono">
              {activeData.summary.winRate}% Closing
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          IMPROVISASI 3: CONNECTED SALES PIPELINE STEPPER (ALUR MENGALIR, BUKAN KOTAK TERPISAH)
          ========================================================================= */}
      <div className="flex flex-col justify-start rounded-2xl neu-card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-white/5 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 items-center justify-center rounded-xl neu-icon-blue text-white">
              <Radio className="size-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Connected Sales Pipeline & Conversion Flow
              </h3>
              <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">
                Aliran milestone terhubung dari prospek awal masuk hingga pencairan pelunasan order
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-blue-500" /> Fase 1: Akuisisi
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500" /> Fase 2: Closing & Kasir
            </span>
          </div>
        </div>

        {/* STEPPER TRACK: FASE 1 (AKUISISI & PENAWARAN: TAHAP 1 - 4) */}
        <div className="mt-6">
          <span className="text-sm font-bold uppercase tracking-wider text-slate-400 block mb-3">
            FASE 1: AKUISISI & PENAWARAN PROSPEK
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
            {funnelPhase1.map((stage, idx) => {
              const isFirst = idx === 0;
              const hasDrop = stage.dropOffRate > 25 && !isFirst;
              return (
                <div
                  key={stage.stage}
                  className="rounded-2xl neu-inset p-5 flex flex-col justify-between relative group hover:border-blue-400 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      Step #{idx + 1}
                    </span>
                    <span className="font-mono text-base font-extrabold text-blue-600 dark:text-blue-400">
                      {stage.conversion}% <span className="text-xs text-slate-400 font-normal">vs Lead</span>
                    </span>
                  </div>

                  <div className="my-3">
                    <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                      {stage.label}
                    </h4>
                    <div className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 dark:text-slate-100 mt-1">
                      {stage.count.toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between text-sm">
                    {!isFirst ? (
                      <>
                        <span className="text-slate-600 dark:text-slate-300 font-medium">
                          Lolos: <span className="font-mono font-bold">{stage.stepConversion}%</span>
                        </span>
                        {stage.dropOffRate > 0 && (
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded font-bold text-xs",
                              hasDrop
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                                : "text-slate-400"
                            )}
                          >
                            Drop: -{stage.dropOffRate}%
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">Titik Awal Pipeline</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PIPELINE CONNECTOR BRIDGE */}
        <div className="my-4 flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full neu-inset text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Alur Deal Disepakati</span>
            <ArrowRight className="size-4 text-emerald-500" />
            <span>Masuk Fase Closing & Produksi</span>
          </div>
        </div>

        {/* STEPPER TRACK: FASE 2 (CLOSING & EKSEKUSI PEMBAYARAN: TAHAP 5 - 8) */}
        <div>
          <span className="text-sm font-bold uppercase tracking-wider text-slate-400 block mb-3">
            FASE 2: NEGOSIASI, DEAL ORDER & PELUNASAN KASIR
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {funnelPhase2.map((stage, idx) => {
              const actualIdx = idx + 4;
              const isLast = actualIdx === 7;
              const hasDrop = stage.dropOffRate > 25;
              return (
                <div
                  key={stage.stage}
                  className={cn(
                    "rounded-2xl neu-inset p-5 flex flex-col justify-between relative transition hover:border-emerald-400",
                    isLast && "ring-2 ring-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/20"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-xs font-bold uppercase px-2.5 py-1 rounded-md",
                        isLast
                          ? "bg-emerald-500 text-white font-extrabold shadow-sm"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {isLast ? "GOAL TAHAP #8" : `Step #${actualIdx + 1}`}
                    </span>
                    <span className="font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                      {stage.conversion}% <span className="text-xs text-slate-400 font-normal">vs Lead</span>
                    </span>
                  </div>

                  <div className="my-3">
                    <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      {stage.label}
                      {isLast && <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />}
                    </h4>
                    <div className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 dark:text-slate-100 mt-1">
                      {stage.count.toLocaleString("id-ID")}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      Lolos: <span className="font-mono font-bold">{stage.stepConversion}%</span>
                    </span>
                    {stage.dropOffRate > 0 ? (
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded font-bold text-xs",
                          hasDrop
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                            : "text-slate-400"
                        )}
                      >
                        Drop: -{stage.dropOffRate}%
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-600 font-bold">100% Lunas</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          TREND CHART (FULL WIDTH: BESAR & LEGA)
          ========================================================================= */}
      <div className="flex flex-col justify-start rounded-2xl neu-card p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 items-center justify-center rounded-xl neu-icon-soft text-blue-600 dark:text-blue-400">
              <Activity className="size-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Tren Performa Harian ({activeData.period.label})
              </h3>
              <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400">
                Dinamika omzet, laba kotor, volume produksi, jumlah order, dan lead masuk
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl neu-inset p-1.5 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setChartMetric("revenue")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-base font-semibold transition",
                chartMetric === "revenue"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Omzet
            </button>
            <button
              type="button"
              onClick={() => setChartMetric("profit")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-base font-semibold transition",
                chartMetric === "profit"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Laba Kotor
            </button>
            <button
              type="button"
              onClick={() => setChartMetric("pcs")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-base font-semibold transition",
                chartMetric === "pcs"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Pcs
            </button>
            <button
              type="button"
              onClick={() => setChartMetric("orders")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-base font-semibold transition",
                chartMetric === "orders"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Order
            </button>
            <button
              type="button"
              onClick={() => setChartMetric("leads")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-base font-semibold transition",
                chartMetric === "leads"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Leads
            </button>
          </div>
        </div>

        <div className="mt-6 h-88 sm:h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activeData.trendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorPcs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9333ea" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#9333ea" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={14} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#94a3b8"
                fontSize={14}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => {
                  if (chartMetric === "revenue" || chartMetric === "profit") {
                    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}M`;
                    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(0)}jt`;
                    if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}rb`;
                    return `Rp ${val}`;
                  }
                  return `${val}`;
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const row = payload[0].payload;
                    return (
                      <div className="rounded-2xl neu-popover p-4.5 shadow-2xl text-base space-y-2">
                        <div className="font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200/60 dark:border-white/5 pb-2">
                          {row.fullDate} ({row.date})
                        </div>
                        <div className="flex justify-between gap-6 text-emerald-600 dark:text-emerald-400 font-bold">
                          <span>Omzet:</span>
                          <span className="font-mono">{formatCurrency(row.revenue)}</span>
                        </div>
                        <div className="flex justify-between gap-6 text-blue-600 dark:text-blue-400 font-bold">
                          <span>Gross Profit:</span>
                          <span className="font-mono">{formatCurrency(row.profit)}</span>
                        </div>
                        <div className="flex justify-between gap-6 text-purple-600 dark:text-purple-400 font-medium">
                          <span>Volume:</span>
                          <span className="font-mono font-bold">{row.pcs} pcs</span>
                        </div>
                        <div className="flex justify-between gap-6 text-amber-600 dark:text-amber-400 font-medium">
                          <span>Sales Order:</span>
                          <span className="font-mono font-bold">{row.orders} SO</span>
                        </div>
                        <div className="flex justify-between gap-6 text-cyan-600 dark:text-cyan-400 font-medium">
                          <span>Leads Masuk:</span>
                          <span className="font-mono font-bold">{row.leads} Leads</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {chartMetric === "revenue" && (
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              )}
              {chartMetric === "profit" && (
                <Area type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
              )}
              {chartMetric === "pcs" && (
                <Area type="monotone" dataKey="pcs" stroke="#9333ea" strokeWidth={3} fillOpacity={1} fill="url(#colorPcs)" />
              )}
              {chartMetric === "orders" && (
                <Area type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorOrders)" />
              )}
              {chartMetric === "leads" && (
                <Area type="monotone" dataKey="leads" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* =========================================================================
          IMPROVISASI 4: MASTER EXECUTIVE WORKTABLE (TABBED WORKSPACE - TIDAK SPAM TABEL)
          ========================================================================= */}
      <div className="flex flex-col justify-start rounded-2xl neu-card p-6 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-white/5 pb-5">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Analisis Operasional & Kinerja Bisnis
            </h3>
            <p className="text-base text-slate-500 dark:text-slate-400 mt-0.5">
              Pilih area kerja untuk mengeksplorasi data mendalam tanpa scrolling berlebih
            </p>
          </div>

          {/* Tab Navigation Pill Bar */}
          <div className="flex items-center gap-1.5 rounded-xl neu-inset p-1.5 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={cn(
                "rounded-lg px-3.5 py-2 text-base font-bold whitespace-nowrap transition flex items-center gap-2",
                activeTab === "products"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              )}
            >
              <Shirt className="size-4" />
              <span>Produk & HPP</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("channels")}
              className={cn(
                "rounded-lg px-3.5 py-2 text-base font-bold whitespace-nowrap transition flex items-center gap-2",
                activeTab === "channels"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              )}
            >
              <Globe className="size-4" />
              <span>Marketing ROI</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("sales")}
              className={cn(
                "rounded-lg px-3.5 py-2 text-base font-bold whitespace-nowrap transition flex items-center gap-2",
                activeTab === "sales"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              )}
            >
              <Award className="size-4" />
              <span>Tim Sales PIC</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("customers")}
              className={cn(
                "rounded-lg px-3.5 py-2 text-base font-bold whitespace-nowrap transition flex items-center gap-2",
                activeTab === "customers"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              )}
            >
              <Crown className="size-4" />
              <span>Pelanggan VIP</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("operations")}
              className={cn(
                "rounded-lg px-3.5 py-2 text-base font-bold whitespace-nowrap transition flex items-center gap-2",
                activeTab === "operations"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              )}
            >
              <Factory className="size-4" />
              <span>Radar Produksi</span>
            </button>
          </div>
        </div>

        {/* TAB 1: PRODUK & HPP UNIT ECONOMICS */}
        {activeTab === "products" && (
          <div className="mt-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-base font-bold text-slate-700 dark:text-slate-200">
                Daftar Profitabilitas Produk & Margin HPP Riil
              </span>
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari produk atau kategori..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="h-10.5 w-full rounded-xl neu-inset pl-11 pr-4 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-white/5">
              <table className="w-full text-left text-base">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase text-sm tracking-wider font-bold border-b border-slate-200/60 dark:border-white/5">
                  <tr>
                    <th className="py-4 px-4.5">Nama Produk & Kategori</th>
                    <th className="py-4 px-4.5 text-center">Order / Pcs</th>
                    <th className="py-4 px-4.5 text-right">Total Omzet</th>
                    <th className="py-4 px-4.5 text-right">Total HPP</th>
                    <th className="py-4 px-4.5 text-right">Laba Kotor</th>
                    <th className="py-4 px-4.5 text-right">Margin %</th>
                    <th className="py-4 px-4.5 text-right">ASP / ACP</th>
                    <th className="py-4 px-4.5 text-center">Status Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-300">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-lg text-slate-400">
                        Tidak ada data produk pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-4 px-4.5">
                          <div className="font-bold text-lg text-slate-900 dark:text-slate-100">
                            {p.productName}
                          </div>
                          <div className="text-sm text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <Tag className="size-3.5" />
                            <span>{p.categoryName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4.5 text-center">
                          <div className="font-mono font-bold text-base">{p.orderCount} SO</div>
                          <div className="text-sm text-slate-400">{p.quantity.toLocaleString("id-ID")} pcs</div>
                        </td>
                        <td className="py-4 px-4.5 text-right font-mono font-bold text-base text-slate-900 dark:text-slate-100">
                          {p.revenueFormatted}
                        </td>
                        <td className="py-4 px-4.5 text-right font-mono text-base text-slate-500">
                          {p.hppFormatted}
                        </td>
                        <td className="py-4 px-4.5 text-right font-mono font-extrabold text-lg text-blue-600 dark:text-blue-400">
                          {p.grossProfitFormatted}
                        </td>
                        <td className="py-4 px-4.5 text-right">
                          <span className="font-mono font-extrabold text-lg">{p.marginPercent}%</span>
                        </td>
                        <td className="py-4 px-4.5 text-right font-mono text-base">
                          <div className="font-semibold">{formatCurrency(p.asp)}</div>
                          <div className="text-sm text-slate-400">HPP: {formatCurrency(p.acp)}</div>
                        </td>
                        <td className="py-4 px-4.5 text-center">
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-base font-bold uppercase tracking-wider inline-block",
                              p.marginStatus === "Sangat Sehat" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
                              p.marginStatus === "Sehat" && "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
                              p.marginStatus === "Moderat" && "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
                              p.marginStatus === "Perlu Evaluasi" && "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                            )}
                          >
                            {p.marginStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: MARKETING CHANNELS & ROI */}
        {activeTab === "channels" && (
          <div className="mt-6 space-y-4 animate-in fade-in duration-150">
            <span className="text-base font-bold text-slate-700 dark:text-slate-200 block">
              Efektivitas Lead & Rasio Closing Per Saluran Pemasaran
            </span>
            <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-white/5">
              <table className="w-full text-left text-base">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase text-sm font-bold">
                  <tr>
                    <th className="py-3.5 px-4">Saluran Promosi</th>
                    <th className="py-3.5 px-4 text-center">Leads Masuk</th>
                    <th className="py-3.5 px-4 text-center">Deal Order</th>
                    <th className="py-3.5 px-4 text-right">Closing Win Rate</th>
                    <th className="py-3.5 px-4 text-right">Rata-rata Order (AOV)</th>
                    <th className="py-3.5 px-4 text-right">Total Pendapatan</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {activeData.channels.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Belum ada data saluran promosi pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    activeData.channels.map((c) => (
                      <tr key={c.sourceId} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            {getLeadSourceIcon(c.channelName)}
                            <span className="font-bold text-slate-900 dark:text-slate-100">{c.channelName}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                          {c.leadCount}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-600">
                          {c.dealCount}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-extrabold text-blue-600 dark:text-blue-400">
                          {c.winRate}%
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-500 font-semibold">
                          {c.avgDealValueFormatted}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900 dark:text-slate-100">
                          {c.revenueFormatted}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-sm font-bold",
                              c.efficiency === "Sangat Efektif" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
                              c.efficiency === "Potensial" && "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
                              c.efficiency === "Perlu Ditingkatkan" && "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            )}
                          >
                            {c.efficiency}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SALES TEAM & PIC LEADERBOARD */}
        {activeTab === "sales" && (
          <div className="mt-6 space-y-4 animate-in fade-in duration-150">
            <span className="text-base font-bold text-slate-700 dark:text-slate-200 block">
              Leaderboard Kinerja Tim Sales & PIC Closing
            </span>
            <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-white/5">
              <table className="w-full text-left text-base">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase text-sm font-bold">
                  <tr>
                    <th className="py-3.5 px-4">Nama PIC</th>
                    <th className="py-3.5 px-4 text-center">Leads Ditangani</th>
                    <th className="py-3.5 px-4 text-center">Deals Closing</th>
                    <th className="py-3.5 px-4 text-right">Win Rate</th>
                    <th className="py-3.5 px-4 text-right">Volume Pcs</th>
                    <th className="py-3.5 px-4 text-right">Rata-rata Order (AOV)</th>
                    <th className="py-3.5 px-4 text-right">Total Omzet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {activeData.pics.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Belum ada penugasan PIC aktif.
                      </td>
                    </tr>
                  ) : (
                    activeData.pics.map((pic, idx) => (
                      <tr key={pic.picId} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                          <span className="size-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                            {idx + 1}
                          </span>
                          {pic.picName}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-semibold">
                          {pic.leadCount}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-600">
                          {pic.dealCount}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                          {pic.winRate}%
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-500 font-semibold">
                          {pic.pcsCount.toLocaleString("id-ID")} pcs
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-500 font-semibold">
                          {pic.aovFormatted}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-extrabold text-blue-600 dark:text-blue-400">
                          {pic.revenueFormatted}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: RETENTION & VIP CUSTOMERS */}
        {activeTab === "customers" && (
          <div className="mt-6 space-y-6 animate-in fade-in duration-150">
            {/* Top Stat Ribbon for Customer Retention */}
            <div className="rounded-xl neu-inset p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl neu-icon-emerald flex items-center justify-center text-white shrink-0">
                  <Users className="size-5" />
                </div>
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400 block">Repeat Order Ratio</span>
                  <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {activeData.retention.repeatRate}% Repeat Rate
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-semibold block">Customer Baru</span>
                  <span className="text-lg font-bold font-mono text-slate-800 dark:text-white">
                    {activeData.retention.newCustomerCount} Pelanggan
                  </span>
                </div>
                <div className="border-l border-slate-200/60 dark:border-white/5 pl-6">
                  <span className="text-xs text-slate-400 uppercase font-semibold block">Repeat Customer</span>
                  <span className="text-lg font-bold font-mono text-emerald-600">
                    {activeData.retention.repeatCustomerCount} Pelanggan
                  </span>
                </div>
              </div>
            </div>

            {/* VIP Customers Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-white/5">
              <table className="w-full text-left text-base">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase text-sm font-bold">
                  <tr>
                    <th className="py-3.5 px-4">Customer & Instansi</th>
                    <th className="py-3.5 px-4 text-center">Total Order</th>
                    <th className="py-3.5 px-4 text-right">Total Belanja (LTV)</th>
                    <th className="py-3.5 px-4 text-right">Rata-rata Order (AOV)</th>
                    <th className="py-3.5 px-4 text-center">Kontak Langsung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {activeData.retention.topCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        Belum ada data pelanggan aktif pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    activeData.retention.topCustomers.map((cust) => (
                      <tr key={cust.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {cust.name}
                          </div>
                          {cust.companyName && (
                            <div className="text-sm text-slate-400">{cust.companyName}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold">
                          {cust.orderCount} Order
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                          {cust.totalSpendFormatted}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-500 font-semibold">
                          {cust.aovFormatted}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {cust.whatsapp ? (
                            <a
                              href={`https://wa.me/${cust.whatsapp.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="neu-button px-3.5 py-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 text-sm font-bold inline-flex items-center gap-1.5 transition"
                            >
                              <MessageCircle className="size-4" />
                              <span>Hubungi WhatsApp</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-sm">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: OPERATIONS & PRODUCTION RADAR */}
        {activeTab === "operations" && (
          <div className="mt-6 space-y-6 animate-in fade-in duration-150">
            {/* Operations Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="neu-inset p-4.5 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 uppercase font-bold">SPK Berjalan</div>
                  <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-slate-100 mt-1">
                    {activeData.operations.activeWorkOrders}
                  </div>
                </div>
                <div className="size-10 rounded-xl neu-icon-blue flex items-center justify-center text-white">
                  <Layers className="size-5" />
                </div>
              </div>

              <div className="neu-inset p-4.5 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 uppercase font-bold">Deadline Dekat (≤3 Hari)</div>
                  <div className="text-3xl font-extrabold font-mono text-amber-600 dark:text-amber-400 mt-1">
                    {activeData.operations.approachingDeadlineCount}
                  </div>
                </div>
                <div className="size-10 rounded-xl neu-icon-amber flex items-center justify-center text-white">
                  <Clock className="size-5" />
                </div>
              </div>

              <div className="neu-inset p-4.5 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 uppercase font-bold">SPK Lewat Deadline</div>
                  <div className="text-3xl font-extrabold font-mono text-rose-600 dark:text-rose-400 mt-1">
                    {activeData.operations.overdueCount}
                  </div>
                </div>
                <div className="size-10 rounded-xl neu-icon-orange flex items-center justify-center text-white">
                  <AlertTriangle className="size-5" />
                </div>
              </div>

              <div className="neu-inset p-4.5 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400 uppercase font-bold">Retur / Perbaikan</div>
                  <div className="text-3xl font-extrabold font-mono text-purple-600 dark:text-purple-400 mt-1">
                    {activeData.operations.returCount}
                  </div>
                </div>
                <div className="size-10 rounded-xl neu-icon-purple flex items-center justify-center text-white">
                  <ShieldCheck className="size-5" />
                </div>
              </div>
            </div>

            {/* Stage Distribution Breakdown */}
            <div className="space-y-3">
              <span className="text-base font-bold text-slate-700 dark:text-slate-200 block">
                Distribusi Kartu SPK Berdasarkan Tahapan Pengerjaan
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3.5">
                {activeData.operations.stageBreakdown.map((stg) => (
                  <div key={stg.stage} className="neu-inset p-4 rounded-xl flex flex-col justify-between">
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
                      {stg.label}
                    </div>
                    <div className="flex items-baseline justify-between mt-2.5">
                      <span className="text-2xl font-extrabold font-mono text-blue-600 dark:text-blue-400">
                        {stg.count}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">{stg.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Link
                href="/produksi"
                className="neu-button px-4 py-2 rounded-xl text-base font-bold text-blue-600 hover:text-blue-700 flex items-center gap-2"
              >
                <span>Buka Kanban Produksi &rarr;</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
