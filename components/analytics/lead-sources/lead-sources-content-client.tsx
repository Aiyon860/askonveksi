"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import {
  Users,
  Handshake,
  CircleDollarSign,
  Percent,
  Package,
  Shirt,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
  Target,
  Clock,
  Layers,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Radio,
  BarChart2,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend,
} from "recharts";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/crm/format";
import type {
  LeadSourceAnalyticsData,
  LeadSourceChannelDetail,
} from "@/lib/crm/lead-sources-data";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const PRESET_OPTIONS = [
  { id: "this-month", label: "Bulan Ini" },
  { id: "30d", label: "30 Hari" },
  { id: "7d", label: "7 Hari" },
  { id: "this-year", label: "Tahun Ini" },
  { id: "all", label: "Semua Data" },
];

export function LeadSourcesContentClient({
  initialData,
}: {
  initialData: LeadSourceAnalyticsData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Search & Filters state
  const currentRange = searchParams.get("range") || initialData.period.preset || "this-month";
  const currentMode = searchParams.get("mode") || initialData.period.mode || "range";
  const [customFrom, setCustomFrom] = useState(initialData.period.from || "");
  const [customTo, setCustomTo] = useState(initialData.period.to || "");
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [showInsightsDetail, setShowInsightsDetail] = useState(false);

  // Chart Metric Toggle
  const [chartMetric, setChartMetric] = useState<"revenue" | "conversion" | "volume">("revenue");

  // Tab View for Segment Analysis
  const [segmentTab, setSegmentTab] = useState<"customer" | "garment" | "velocity">("customer");

  // Table Search & Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"revenue" | "leadCount" | "dealCount" | "winRate" | "aov">("revenue");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Query Key for SWR
  const apiUrl = `/api/crm/analytics/lead-sources?${searchParams.toString()}`;
  const { data: swrData, mutate, isValidating } = useSWR<LeadSourceAnalyticsData>(
    apiUrl,
    fetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
    },
  );

  const data = swrData || initialData;

  // Handle preset change
  const handlePresetSelect = (preset: string) => {
    startTransition(() => {
      const params = new URLSearchParams();
      if (preset === "all") {
        params.set("mode", "all");
        params.set("range", "all");
      } else {
        params.set("range", preset);
      }
      router.push(`/analytics/lead-sources?${params.toString()}`);
    });
  };

  // Handle custom date apply
  const handleApplyCustomDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFrom || !customTo) return;
    startTransition(() => {
      const params = new URLSearchParams();
      params.set("from", customFrom);
      params.set("to", customTo);
      params.set("range", "custom");
      setShowCustomDateModal(false);
      router.push(`/analytics/lead-sources?${params.toString()}`);
    });
  };

  // Filtered & Sorted channels for the Master Worktable
  const filteredChannels = useMemo(() => {
    let list = [...data.channels];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.tier.toLowerCase().includes(q) ||
          c.topCustomerCategory.toLowerCase().includes(q) ||
          c.topGarmentType.toLowerCase().includes(q),
      );
    }

    list.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      return sortOrder === "asc" ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    return list;
  }, [data.channels, searchQuery, sortField, sortOrder]);

  // Chart data preparation
  const chartData = useMemo(() => {
    return data.channels.map((c) => ({
      name: c.name,
      revenue: c.revenue,
      revenueFormatted: c.revenueFormatted,
      leads: c.leadCount,
      deals: c.dealCount,
      winRate: c.winRate,
      aov: c.aov,
      aovFormatted: c.aovFormatted,
    }));
  }, [data.channels]);

  // Dedicated Marketing Channel & Acquisition KPIs (Distinct from general Dashboard)
  const marketingKpis = useMemo(() => {
    const totalLeads = data.summary.totalLeads;
    const totalRevenue = data.summary.totalRevenue;
    const totalDeals = data.summary.totalDeals;

    // Yield omzet per prospek
    const yieldPerLead = totalLeads > 0 ? Math.round(totalRevenue / totalLeads) : 0;

    // Weighted average cycle days
    const totalDealsWithCycle = data.channels.reduce((acc, c) => acc + (c.avgCycleDays > 0 ? c.dealCount : 0), 0);
    const weightedCycleDays = totalDealsWithCycle > 0
      ? Math.round(data.channels.reduce((acc, c) => acc + (c.avgCycleDays * c.dealCount), 0) / totalDealsWithCycle)
      : (data.channels.length > 0 ? Math.round(data.channels.reduce((acc, c) => acc + c.avgCycleDays, 0) / data.channels.length) : 0);

    // Repeat deals rate
    const totalRepeatDeals = data.channels.reduce((acc, c) => acc + c.repeatDealCount, 0);
    const overallRepeatRate = totalDeals > 0 ? Math.round((totalRepeatDeals / totalDeals) * 100) : 0;

    // Top city origin
    const topCity = data.channels.find((c) => c.topCity && c.topCity !== "Kota Belum Diisi")?.topCity || "Jabodetabek";

    return {
      yieldPerLeadFormatted: formatCurrency(yieldPerLead),
      avgCycleDays: weightedCycleDays,
      topRevenueChannel: data.summary.topRevenueChannel,
      topWinRateChannel: data.summary.topWinRateChannel,
      overallRepeatRate,
      topCity,
    };
  }, [data]);

  // Palette colors for charts
  const BAR_COLORS = [
    "#2563eb", // Blue
    "#10b981", // Emerald
    "#8b5cf6", // Purple
    "#f59e0b", // Amber
    "#06b6d4", // Cyan
    "#ec4899", // Pink
    "#f97316", // Orange
    "#64748b", // Slate
  ];

  return (
    <div className="flex flex-col gap-8 w-full max-w-full">
      {/* =========================================================================
          EXECUTIVE HEADER & CONTROLS (Full-Width, Modern Neumorphism)
          ========================================================================= */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Analisis Sumber Lead & Efektivitas Kanal
            </h1>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 shadow-xs">
              Marketing ROI
            </span>
          </div>
          <p className="mt-1 text-base sm:text-lg text-slate-500 dark:text-slate-400">
            Evaluasi kualitas prospek, rasio konversi closing, efisiensi akuisisi, dan kontribusi omzet nyata per kanal pemasaran.
          </p>
        </div>

        {/* Action Controls & Presets */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center rounded-xl neu-inset p-1">
            {PRESET_OPTIONS.map((opt) => {
              const active =
                opt.id === "all"
                  ? currentMode === "all" || currentRange === "all"
                  : currentRange === opt.id && currentMode !== "all";
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handlePresetSelect(opt.id)}
                  disabled={isPending}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm sm:text-base font-semibold transition",
                    active
                      ? "neu-button-primary text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Custom Date Range Popover Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCustomDateModal(!showCustomDateModal)}
              className={cn(
                "h-10 px-3.5 rounded-xl neu-button text-sm sm:text-base font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-200 transition",
                currentRange === "custom" && "border-blue-500 text-blue-600 dark:text-blue-400",
              )}
            >
              <Calendar className="size-4" />
              <span>{currentRange === "custom" ? data.period.label : "Custom"}</span>
              <ChevronDown className="size-3.5" />
            </button>

            {showCustomDateModal && (
              <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl neu-popover p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <form onSubmit={handleApplyCustomDate} className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
                    <span className="font-bold text-base text-slate-900 dark:text-slate-100">Pilih Rentang Tanggal</span>
                    <button
                      type="button"
                      onClick={() => setShowCustomDateModal(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Batal
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                        Dari Tanggal
                      </label>
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="w-full h-10 rounded-xl neu-inset px-3 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                        Sampai Tanggal
                      </label>
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="w-full h-10 rounded-xl neu-inset px-3 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-xl neu-button-primary py-2.5 text-sm font-semibold text-white shadow-xs"
                  >
                    Terapkan Rentang
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => mutate()}
            disabled={isValidating}
            title="Segarkan Data"
            className="flex size-10 items-center justify-center rounded-xl neu-button text-slate-600 hover:text-blue-600 dark:text-slate-300 transition"
          >
            <RefreshCw className={cn("size-4", isValidating && "animate-spin text-blue-600")} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          EXECUTIVE ACQUISITION INTELLIGENCE RIBBON
          ========================================================================= */}
      <div className="rounded-2xl neu-card p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl neu-icon-blue text-white shrink-0">
              <Sparkles className="size-5" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Ringkasan Intelijen Akuisisi
              </span>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                Periode Analisis: <span className="text-blue-600 dark:text-blue-400">{data.period.label}</span>
              </p>
            </div>
          </div>

          {/* Quick Indicator Pills */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Pill 1: Top Revenue */}
            <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs">
              <CircleDollarSign className="size-3.5" />
              Juara Omzet: {data.summary.topRevenueChannel}
            </span>

            {/* Pill 2: Top Win Rate */}
            <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 shadow-xs">
              <Percent className="size-3.5" />
              Closing Terbaik: {data.summary.topWinRateChannel}
            </span>

            {/* Pill 3: Repeat Order */}
            <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 shadow-xs">
              <Handshake className="size-3.5" />
              Loyalitas Repeat: {data.summary.repeatOrderChampion}
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

        {/* Collapsible Detailed Strategic Insights */}
        {showInsightsDetail && (
          <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-white/5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
            {data.insights.map((insight) => {
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
                          insight.type === "opportunity" && "bg-purple-500",
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
                        <ArrowUpRight className="size-3.5" />
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
          TOP 6 MARKETING ATTRIBUTION & ACQUISITION KPIS (Color-Tinted Soft Neumorphic ~12% Opacity)
          ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Yield Omzet per Prospek (Emerald Tint) */}
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-emerald p-6">
          <div className="flex items-center justify-between">
            <div className="flex size-14 items-center justify-center rounded-2xl neu-icon-emerald text-white">
              <CircleDollarSign className="size-7" />
            </div>
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold px-2.5 py-1">
              Revenue / Lead
            </span>
          </div>
          <div className="mt-5">
            <p className="flex h-5 items-center text-base font-semibold text-slate-600 dark:text-slate-300">
              Yield Omzet per Prospek
            </p>
            <div className="mt-1 flex h-11 items-baseline gap-1.5">
              <span
                className="truncate text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-mono"
                title={marketingKpis.yieldPerLeadFormatted}
              >
                {marketingKpis.yieldPerLeadFormatted}
              </span>
              <span className="text-base font-semibold text-slate-400">/lead</span>
            </div>
          </div>
          <div className="mt-4 border-t border-emerald-200/60 pt-3 dark:border-emerald-900/30">
            <p className="text-base text-slate-500 dark:text-slate-400">
              Nilai omzet bruto yang didapat per 1 prospek yang masuk
            </p>
          </div>
        </div>

        {/* Card 2: Kecepatan Konversi Closing (Blue Tint) */}
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-blue p-6">
          <div className="flex items-center justify-between">
            <div className="flex size-14 items-center justify-center rounded-2xl neu-icon-blue text-white">
              <Clock className="size-7" />
            </div>
            <span className="rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-xs font-bold px-2.5 py-1">
              Sales Velocity
            </span>
          </div>
          <div className="mt-5">
            <p className="flex h-5 items-center text-base font-semibold text-slate-600 dark:text-slate-300">
              Kecepatan Konversi Closing
            </p>
            <div className="mt-1 flex h-11 items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
                {marketingKpis.avgCycleDays}
              </span>
              <span className="text-base font-semibold text-slate-400">hari rata-rata</span>
            </div>
          </div>
          <div className="mt-4 border-t border-blue-200/60 pt-3 dark:border-blue-900/30">
            <p className="text-base text-slate-500 dark:text-slate-400">
              Rata-rata waktu dari lead baru masuk hingga closing deal
            </p>
          </div>
        </div>

        {/* Card 3: Kanal Omzet Terbesar (Indigo Tint) */}
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-indigo p-6">
          <div className="flex items-center justify-between">
            <div className="flex size-14 items-center justify-center rounded-2xl neu-icon-indigo text-white">
              <Radio className="size-7" />
            </div>
            <span className="rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 text-xs font-bold px-2.5 py-1">
              Top Contributor
            </span>
          </div>
          <div className="mt-5">
            <p className="flex h-5 items-center text-base font-semibold text-slate-600 dark:text-slate-300">
              Kanal Omzet Tertinggi
            </p>
            <div className="mt-1 flex h-11 items-baseline gap-1.5">
              <span
                className="truncate text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100"
                title={marketingKpis.topRevenueChannel}
              >
                {marketingKpis.topRevenueChannel}
              </span>
            </div>
          </div>
          <div className="mt-4 border-t border-indigo-200/60 pt-3 dark:border-indigo-900/30">
            <p className="text-base text-slate-500 dark:text-slate-400">
              Sumber lead penyumbang perolehan rupiah terbesar
            </p>
          </div>
        </div>

        {/* Card 4: Kanal Win Rate Terbaik (Amber Tint) */}
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-amber p-6">
          <div className="flex items-center justify-between">
            <div className="flex size-14 items-center justify-center rounded-2xl neu-icon-amber text-white">
              <Percent className="size-7" />
            </div>
            <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold px-2.5 py-1">
              Top Win Rate
            </span>
          </div>
          <div className="mt-5">
            <p className="flex h-5 items-center text-base font-semibold text-slate-600 dark:text-slate-300">
              Kanal Konversi Tertinggi
            </p>
            <div className="mt-1 flex h-11 items-baseline gap-1.5">
              <span
                className="truncate text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100"
                title={marketingKpis.topWinRateChannel}
              >
                {marketingKpis.topWinRateChannel}
              </span>
            </div>
          </div>
          <div className="mt-4 border-t border-amber-200/60 pt-3 dark:border-amber-900/30">
            <p className="text-base text-slate-500 dark:text-slate-400">
              Sumber lead dengan rasio efektivitas closing paling tinggi
            </p>
          </div>
        </div>

        {/* Card 5: Average Order Value / AOV (Purple Tint) */}
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-purple p-6">
          <div className="flex items-center justify-between">
            <div className="flex size-14 items-center justify-center rounded-2xl neu-icon-purple text-white">
              <Package className="size-7" />
            </div>
            <div className="flex items-center gap-1.5 text-right">
              <span
                className={cn(
                  "flex items-center text-base font-bold",
                  data.summary.aovGrowth >= 0 ? "text-emerald-600" : "text-rose-600",
                )}
              >
                {data.summary.aovGrowth >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                {Math.abs(data.summary.aovGrowth)}%
              </span>
              <span className="text-base font-medium text-slate-400">vs. lalu</span>
            </div>
          </div>
          <div className="mt-5">
            <p className="flex h-5 items-center text-base font-semibold text-slate-600 dark:text-slate-300">
              Rata-rata Nilai Order (AOV)
            </p>
            <div className="mt-1 flex h-11 items-baseline gap-1.5">
              <span
                className="truncate text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-mono"
                title={data.summary.aovFormatted}
              >
                {data.summary.aovFormatted}
              </span>
            </div>
          </div>
          <div className="mt-4 border-t border-purple-200/60 pt-3 dark:border-purple-900/30">
            <p className="text-base text-slate-500 dark:text-slate-400">
              Rata-rata rupiah per transaksi per kanal
            </p>
          </div>
        </div>

        {/* Card 6: Rasio Repeat Order Pelanggan (Cyan Tint) */}
        <div className="relative flex flex-col justify-between rounded-2xl neu-card neu-card-cyan p-6">
          <div className="flex items-center justify-between">
            <div className="flex size-14 items-center justify-center rounded-2xl neu-icon-cyan text-white">
              <Handshake className="size-7" />
            </div>
            <span className="rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 text-xs font-bold px-2.5 py-1">
              Retention Rate
            </span>
          </div>
          <div className="mt-5">
            <p className="flex h-5 items-center text-base font-semibold text-slate-600 dark:text-slate-300">
              Rasio Repeat Order Kanal
            </p>
            <div className="mt-1 flex h-11 items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
                {marketingKpis.overallRepeatRate}%
              </span>
              <span className="text-base font-semibold text-slate-400">dari total deals</span>
            </div>
          </div>
          <div className="mt-4 border-t border-cyan-200/60 pt-3 dark:border-cyan-900/30">
            <p className="text-base text-slate-500 dark:text-slate-400">
              Persentase pesanan closing dari pelanggan yang pesan kembali
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: INTERACTIVE CHANNEL COMPARISON CHART
          ========================================================================= */}
      <div className="flex flex-col justify-start rounded-2xl neu-card p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-white/5 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 items-center justify-center rounded-xl neu-icon-blue text-white">
              <BarChart2 className="size-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Komparasi Efektivitas Antar Kanal
              </h3>
              <p className="text-base text-slate-500 dark:text-slate-400">
                Perbandingan performa pendapatan, rasio konversi closing, dan volume per sumber
              </p>
            </div>
          </div>

          {/* Metric Switcher */}
          <div className="flex items-center gap-1 rounded-xl neu-inset p-1.5 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setChartMetric("revenue")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm sm:text-base font-bold transition",
                chartMetric === "revenue"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
              )}
            >
              Omzet Penjualan
            </button>
            <button
              type="button"
              onClick={() => setChartMetric("conversion")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm sm:text-base font-bold transition",
                chartMetric === "conversion"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
              )}
            >
              Lead vs Deal
            </button>
            <button
              type="button"
              onClick={() => setChartMetric("volume")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm sm:text-base font-bold transition",
                chartMetric === "volume"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
              )}
            >
              Win Rate (%)
            </button>
          </div>
        </div>

        {/* Chart View */}
        <div className="mt-6 h-80 sm:h-96 w-full">
          {chartMetric === "revenue" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 13, fill: "currentColor" }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 13, fill: "currentColor" }}
                  tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(0)}Jt`}
                />
                <Tooltip
                  cursor={{ fill: "rgba(59, 130, 246, 0.05)" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-2xl neu-popover p-4 shadow-xl text-sm space-y-1.5 min-w-[200px]">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
                          <p className="text-blue-600 dark:text-blue-400 font-bold font-mono text-base">
                            Omzet: {item.revenueFormatted}
                          </p>
                          <p className="text-slate-500 text-xs">
                            Rata-rata Order: <span className="font-mono font-semibold">{item.aovFormatted}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="revenue" name="Omzet Penjualan" radius={[8, 8, 0, 0]}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {chartMetric === "conversion" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 13, fill: "currentColor" }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fontSize: 13, fill: "currentColor" }} />
                <Tooltip
                  cursor={{ fill: "rgba(59, 130, 246, 0.05)" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-2xl neu-popover p-4 shadow-xl text-sm space-y-1.5 min-w-[200px]">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
                          <p className="text-blue-600 font-semibold font-mono">Total Lead: {item.leads}</p>
                          <p className="text-emerald-600 font-semibold font-mono">Deal Closed: {item.deals}</p>
                          <p className="text-slate-500 text-xs">
                            Closing Rate: <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{item.winRate}%</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="leads" name="Total Prospek (Lead)" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="deals" name="Deal Closing (SO)" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {chartMetric === "volume" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 13, fill: "currentColor" }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 13, fill: "currentColor" }}
                  tickFormatter={(val) => `${val}%`}
                  domain={[0, 100]}
                />
                <Tooltip
                  cursor={{ fill: "rgba(59, 130, 246, 0.05)" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-2xl neu-popover p-4 shadow-xl text-sm space-y-1.5 min-w-[200px]">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
                          <p className="text-amber-600 dark:text-amber-400 font-bold font-mono text-base">
                            Rasio Closing: {item.winRate}%
                          </p>
                          <p className="text-slate-500 text-xs">
                            Dari {item.leads} lead menjadi {item.deals} transaksi aktif
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="winRate" name="Closing Win Rate (%)" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-win-${index}`}
                      fill={entry.winRate >= 35 ? "#10b981" : entry.winRate >= 20 ? "#3b82f6" : "#f59e0b"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: CHANNEL EFFICIENCY MATRIX / STRATEGIC QUADRANT
          ========================================================================= */}
      <div className="flex flex-col justify-start rounded-2xl neu-card p-6 sm:p-7">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="flex size-12 items-center justify-center rounded-xl neu-icon-purple text-white">
            <Target className="size-6" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Matriks Kualitas & Klasifikasi Kanal
            </h3>
            <p className="text-base text-slate-500 dark:text-slate-400">
              Evaluasi tingkat efisiensi, volume, dan karakteristik hasil dari setiap sumber prospek
            </p>
          </div>
        </div>

        {/* Matrix Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {data.channels.map((ch) => (
            <div
              key={ch.id ?? "none"}
              className="rounded-2xl neu-inset p-5 flex flex-col justify-between relative group hover:border-blue-400 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h4 className="font-extrabold text-lg text-slate-900 dark:text-slate-100 truncate" title={ch.name}>
                    {ch.name}
                  </h4>
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider shrink-0", ch.badgeClass)}>
                    {ch.tier}
                  </span>
                </div>

                <div className="space-y-2.5 my-3">
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      <span>Pangsa Omzet ({ch.revenueShare}%)</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">{ch.revenueFormatted}</span>
                    </div>
                    <div className="h-2 w-full rounded-full neu-inset overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, ch.revenueShare)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      <span>Rasio Closing ({ch.winRate}%)</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">{ch.dealCount} / {ch.leadCount}</span>
                    </div>
                    <div className="h-2 w-full rounded-full neu-inset overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          ch.winRate >= 35 ? "bg-emerald-500" : ch.winRate >= 20 ? "bg-blue-500" : "bg-amber-500",
                        )}
                        style={{ width: `${Math.min(100, ch.winRate)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rata-rata Order (AOV):</span>
                    <span className="font-mono font-bold">{ch.aovFormatted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pola Produk Utama:</span>
                    <span className="font-medium truncate max-w-[140px] text-right" title={ch.topGarmentType}>
                      {ch.topGarmentType}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Repeat Order:</span>
                    <span className="font-mono font-semibold text-purple-600 dark:text-purple-400">
                      {ch.repeatDealCount} deal ({ch.repeatDealRate}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Filter Links */}
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400">
                <Link
                  href={ch.id ? `/crm/prospek?sourceId=${ch.id}` : `/crm/prospek`}
                  className="hover:underline flex items-center gap-1"
                >
                  <span>Prospek</span>
                  <ExternalLink className="size-3" />
                </Link>
                <Link
                  href={ch.id ? `/crm/sales-orders?sourceId=${ch.id}` : `/crm/sales-orders`}
                  className="hover:underline flex items-center gap-1"
                >
                  <span>Sales Order</span>
                  <ExternalLink className="size-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
          SECTION 4: CROSS-DIMENSIONAL ACQUISITION BREAKDOWN TABS
          ========================================================================= */}
      <div className="flex flex-col justify-start rounded-2xl neu-card p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-white/5 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 items-center justify-center rounded-xl neu-icon-emerald text-white">
              <Layers className="size-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Pola Pembelian & Profil Segmen per Kanal
              </h3>
              <p className="text-base text-slate-500 dark:text-slate-400">
                Karakteristik jenis pelanggan, jenis produk pesanan, dan kecepatan siklus transaksi
              </p>
            </div>
          </div>

          {/* Segment Tab Switcher */}
          <div className="flex items-center gap-1 rounded-xl neu-inset p-1.5 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSegmentTab("customer")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm sm:text-base font-bold transition",
                segmentTab === "customer"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
              )}
            >
              Segmen Customer
            </button>
            <button
              type="button"
              onClick={() => setSegmentTab("garment")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm sm:text-base font-bold transition",
                segmentTab === "garment"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
              )}
            >
              Kategori Produk
            </button>
            <button
              type="button"
              onClick={() => setSegmentTab("velocity")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm sm:text-base font-bold transition",
                segmentTab === "velocity"
                  ? "neu-button-primary text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
              )}
            >
              Kecepatan Closing
            </button>
          </div>
        </div>

        {/* Tab 1: Customer Type Distribution */}
        {segmentTab === "customer" && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.customerCategories.length > 0 ? (
              data.customerCategories.map((cat) => (
                <div key={cat.categoryName} className="p-5 rounded-2xl neu-inset flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4.5 text-blue-600" />
                        <h4 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                          {cat.categoryName}
                        </h4>
                      </div>
                      <span className="font-mono text-sm font-bold text-slate-500">
                        {cat.totalOrders} order
                      </span>
                    </div>

                    <div className="my-2">
                      <span className="text-xs text-slate-400">Total Omzet:</span>
                      <p className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400">
                        {cat.totalRevenueFormatted}
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Kanal Asal Terbesar:
                      </p>
                      {cat.channels.slice(0, 3).map((ch) => (
                        <div key={ch.sourceName} className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                            {ch.sourceName}
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(ch.revenue)} ({ch.sharePercent}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-200/40 dark:border-white/5 text-xs text-slate-400 flex justify-between">
                    <span>Sumber Dominan:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{cat.dominantSource}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 py-12 text-center text-slate-400 text-base">
                Belum ada data segmen customer pada periode ini.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Garment Type Distribution */}
        {segmentTab === "garment" && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.garmentCategories.length > 0 ? (
              data.garmentCategories.map((g) => (
                <div key={g.garmentType} className="p-5 rounded-2xl neu-inset flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Shirt className="size-4.5 text-purple-600" />
                        <h4 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                          {g.garmentType}
                        </h4>
                      </div>
                      <span className="font-mono text-sm font-bold text-purple-600">
                        {g.totalPcs.toLocaleString("id-ID")} pcs
                      </span>
                    </div>

                    <div className="my-2">
                      <span className="text-xs text-slate-400">Total Transaksi:</span>
                      <p className="font-mono text-xl font-black text-slate-900 dark:text-slate-100">
                        {g.totalOrders} <span className="text-sm font-semibold text-slate-400">Sales Order</span>
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Pangsa Kanal Paling Banyak:
                      </p>
                      {g.channels.slice(0, 3).map((ch) => (
                        <div key={ch.sourceName} className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                            {ch.sourceName}
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {ch.pcs.toLocaleString("id-ID")} pcs ({ch.sharePercent}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-200/40 dark:border-white/5 text-xs text-slate-400 flex justify-between">
                    <span>Sumber Dominan:</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">{g.dominantSource}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 py-12 text-center text-slate-400 text-base">
                Belum ada data kategori produk pada periode ini.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Lead Velocity & Cycle Time */}
        {segmentTab === "velocity" && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {data.channels.map((ch) => (
              <div key={ch.name} className="p-5 rounded-2xl neu-inset flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-base text-slate-900 dark:text-slate-100 truncate" title={ch.name}>
                      {ch.name}
                    </span>
                    <Clock className="size-4 text-blue-500" />
                  </div>
                  <div className="my-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Rata-rata Waktu Closing
                    </span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="font-mono text-3xl font-black text-blue-600 dark:text-blue-400">
                        {ch.avgCycleDays > 0 ? ch.avgCycleDays : "< 1"}
                      </span>
                      <span className="text-sm font-semibold text-slate-500">hari</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Waktu rata-rata dari sejak prospek pertama kali masuk hingga deal Sales Order resmi diterima.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/5 flex justify-between text-xs">
                  <span className="text-slate-400">Total Closing:</span>
                  <span className="font-mono font-bold text-emerald-600">{ch.dealCount} order</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTION 5: MASTER CHANNEL WORKTABLE (Interactive, Search, Sortable)
          ========================================================================= */}
      <div className="flex flex-col justify-start rounded-2xl neu-card p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-white/5 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 items-center justify-center rounded-xl neu-icon-blue text-white">
              <Radio className="size-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Tabel Kerja Master Sumber Lead
              </h3>
              <p className="text-base text-slate-500 dark:text-slate-400">
                Data komprehensif seluruh kanal dengan rincian omzet, rasio konversi, dan produk terlaris
              </p>
            </div>
          </div>

          {/* Table Search & Sort Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kanal / status..."
                className="h-10 w-full rounded-xl neu-inset pl-10 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-white/10 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Sumber Lead (Kanal)</th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:text-blue-600 transition"
                  onClick={() => {
                    setSortField("leadCount");
                    setSortOrder(sortField === "leadCount" && sortOrder === "desc" ? "asc" : "desc");
                  }}
                >
                  Leads Masuk {sortField === "leadCount" && (sortOrder === "desc" ? "↓" : "↑")}
                </th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:text-blue-600 transition"
                  onClick={() => {
                    setSortField("dealCount");
                    setSortOrder(sortField === "dealCount" && sortOrder === "desc" ? "asc" : "desc");
                  }}
                >
                  Deals Closed {sortField === "dealCount" && (sortOrder === "desc" ? "↓" : "↑")}
                </th>
                <th
                  className="py-3 px-3 text-center cursor-pointer hover:text-blue-600 transition"
                  onClick={() => {
                    setSortField("winRate");
                    setSortOrder(sortField === "winRate" && sortOrder === "desc" ? "asc" : "desc");
                  }}
                >
                  Closing Rate {sortField === "winRate" && (sortOrder === "desc" ? "↓" : "↑")}
                </th>
                <th
                  className="py-3 px-4 text-right cursor-pointer hover:text-blue-600 transition"
                  onClick={() => {
                    setSortField("revenue");
                    setSortOrder(sortField === "revenue" && sortOrder === "desc" ? "asc" : "desc");
                  }}
                >
                  Total Omzet {sortField === "revenue" && (sortOrder === "desc" ? "↓" : "↑")}
                </th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:text-blue-600 transition"
                  onClick={() => {
                    setSortField("aov");
                    setSortOrder(sortField === "aov" && sortOrder === "desc" ? "asc" : "desc");
                  }}
                >
                  Rata-rata Order {sortField === "aov" && (sortOrder === "desc" ? "↓" : "↑")}
                </th>
                <th className="py-3 px-3 text-right">Pcs</th>
                <th className="py-3 px-3 text-center">Status Efisiensi</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-white/5 text-sm">
              {filteredChannels.length > 0 ? (
                filteredChannels.map((c) => (
                  <tr key={c.id ?? "none"} className="hover:bg-slate-50/70 dark:hover:bg-white/2 transition">
                    <td className="py-4 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2.5">
                        <span className="size-2 rounded-full bg-blue-500" />
                        <div>
                          <p className="font-bold text-base">{c.name}</p>
                          <p className="text-xs text-slate-400">
                            Produk Terbanyak: <span className="font-semibold text-slate-600 dark:text-slate-300">{c.topGarmentType}</span>
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200 text-base">
                      {c.leadCount}
                    </td>

                    <td className="py-4 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base">
                      {c.dealCount}
                    </td>

                    <td className="py-4 px-3 text-center">
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-bold font-mono shadow-xs",
                          c.winRate >= 35
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : c.winRate >= 20
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
                        )}
                      >
                        {c.winRate}% Win
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-black text-slate-900 dark:text-slate-100 text-base">
                      {c.revenueFormatted}
                      <span className="block text-xs font-normal text-slate-400">
                        {c.revenueShare}% dari omzet
                      </span>
                    </td>

                    <td className="py-4 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300 text-base">
                      {c.aovFormatted}
                    </td>

                    <td className="py-4 px-3 text-right font-mono font-semibold text-purple-600 dark:text-purple-400 text-base">
                      {c.totalPcs.toLocaleString("id-ID")}
                    </td>

                    <td className="py-4 px-3 text-center">
                      <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider", c.badgeClass)}>
                        {c.tier}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={c.id ? `/crm/prospek?sourceId=${c.id}` : `/crm/prospek`}
                          className="neu-button px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 hover:text-blue-700 transition"
                          title="Lihat Prospek dari Kanal Ini"
                        >
                          Prospek
                        </Link>
                        <Link
                          href={c.id ? `/crm/sales-orders?sourceId=${c.id}` : `/crm/sales-orders`}
                          className="neu-button px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-600 hover:text-emerald-700 transition"
                          title="Lihat Sales Order dari Kanal Ini"
                        >
                          Order
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-base">
                    Tidak ada sumber lead yang sesuai dengan kata kunci "{searchQuery}".
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 dark:border-white/10 font-bold bg-slate-50/50 dark:bg-white/2 text-base">
              <tr>
                <td className="py-3 px-4">Total Keseluruhan</td>
                <td className="py-3 px-3 text-right font-mono">{data.summary.totalLeads}</td>
                <td className="py-3 px-3 text-right font-mono text-emerald-600">{data.summary.totalDeals}</td>
                <td className="py-3 px-3 text-center font-mono">{data.summary.overallWinRate}%</td>
                <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{data.summary.totalRevenueFormatted}</td>
                <td className="py-3 px-3 text-right font-mono">{data.summary.aovFormatted}</td>
                <td className="py-3 px-3 text-right font-mono text-purple-600">{data.summary.totalPcs.toLocaleString("id-ID")} pcs</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
