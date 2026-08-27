"use client";

import { useState } from "react";
import {
  ArrowRight,
  BanknoteArrowDown,
  Box,
  CircleDollarSign,
  Clock3,
  Factory,
  HandCoins,
  PackageCheck,
  Scissors,
  Shirt,
  Sparkles,
  Target,
  Truck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

const metrics = [
  { label: "Omzet bulan ini", value: "Rp 185.500.000", note: "Pendapatan berjalan", icon: CircleDollarSign, issue: false },
  { label: "Piutang", value: "Rp 42.500.000", note: "Perlu ditagihkan", icon: HandCoins, issue: false },
  { label: "Hutang", value: "Rp 28.750.000", note: "Kewajiban berjalan", icon: BanknoteArrowDown, issue: false },
  { label: "Pengeluaran", value: "Rp 96.250.000", note: "Bulan berjalan", icon: WalletCards, issue: false },
  { label: "Order aktif", value: "37", note: "Sedang diproses", icon: PackageCheck, issue: false },
  { label: "Produksi", value: "21", note: "Order produksi aktif", icon: Factory, issue: false },
  { label: "Order terlambat", value: "4", note: "Butuh perhatian", icon: Clock3, issue: true },
  { label: "Lead baru", value: "32", note: "Potensi pelanggan", icon: UsersRound, issue: false },
] as const;

const production = [
  { label: "Menunggu desain", value: 5, icon: Sparkles, busiest: false },
  { label: "Menunggu bahan", value: 3, icon: Shirt, busiest: false },
  { label: "Cutting", value: 4, icon: Scissors, busiest: false },
  { label: "Printing", value: 6, icon: Box, busiest: false },
  { label: "Jahit", value: 8, icon: Factory, busiest: true },
  { label: "QC", value: 5, icon: PackageCheck, busiest: false },
  { label: "Packing", value: 3, icon: Box, busiest: false },
  { label: "Pengiriman", value: 7, icon: Truck, busiest: false },
] as const;

const highestProductionCount = Math.max(...production.map((stage) => stage.value));

const funnel = [
  { label: "Lead", value: 100, width: "100%" },
  { label: "Follow up", value: 45, width: "45%" },
  { label: "Penawaran", value: 20, width: "20%" },
  { label: "Deal", value: 12, width: "12%" },
] as const;

const trendYears = ["2024", "2025", "2026"] as const;

type TrendYear = (typeof trendYears)[number];

type TrendDatum = {
  month: string;
  revenue: number;
  completedOrders: number;
};

const businessTrendData: Record<TrendYear, TrendDatum[]> = {
  "2024": [
    { month: "Jan", revenue: 96000000, completedOrders: 9 },
    { month: "Feb", revenue: 112000000, completedOrders: 11 },
    { month: "Mar", revenue: 104500000, completedOrders: 10 },
    { month: "Apr", revenue: 126000000, completedOrders: 13 },
    { month: "Mei", revenue: 119500000, completedOrders: 12 },
    { month: "Jun", revenue: 138000000, completedOrders: 15 },
    { month: "Jul", revenue: 131500000, completedOrders: 14 },
    { month: "Agu", revenue: 146000000, completedOrders: 16 },
    { month: "Sep", revenue: 152500000, completedOrders: 17 },
    { month: "Okt", revenue: 149000000, completedOrders: 15 },
    { month: "Nov", revenue: 161500000, completedOrders: 18 },
    { month: "Des", revenue: 174000000, completedOrders: 20 },
  ],
  "2025": [
    { month: "Jan", revenue: 124000000, completedOrders: 12 },
    { month: "Feb", revenue: 132500000, completedOrders: 14 },
    { month: "Mar", revenue: 141000000, completedOrders: 15 },
    { month: "Apr", revenue: 136000000, completedOrders: 14 },
    { month: "Mei", revenue: 154500000, completedOrders: 17 },
    { month: "Jun", revenue: 163000000, completedOrders: 19 },
    { month: "Jul", revenue: 158500000, completedOrders: 18 },
    { month: "Agu", revenue: 171000000, completedOrders: 20 },
    { month: "Sep", revenue: 168000000, completedOrders: 19 },
    { month: "Okt", revenue: 182500000, completedOrders: 22 },
    { month: "Nov", revenue: 176000000, completedOrders: 21 },
    { month: "Des", revenue: 195500000, completedOrders: 24 },
  ],
  "2026": [
    { month: "Jan", revenue: 142500000, completedOrders: 15 },
    { month: "Feb", revenue: 151000000, completedOrders: 16 },
    { month: "Mar", revenue: 165500000, completedOrders: 18 },
    { month: "Apr", revenue: 158000000, completedOrders: 17 },
    { month: "Mei", revenue: 177500000, completedOrders: 20 },
    { month: "Jun", revenue: 184000000, completedOrders: 22 },
    { month: "Jul", revenue: 172500000, completedOrders: 19 },
    { month: "Agu", revenue: 191000000, completedOrders: 23 },
  ],
};

const revenueChartConfig = {
  revenue: {
    label: "Kas masuk",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

const completedOrdersChartConfig = {
  completedOrders: {
    label: "Order selesai & lunas",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const compactNumberFormatter = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 0,
});

function formatRupiah(value: number) {
  return rupiahFormatter.format(value).replace(/\u00a0/g, " ");
}

function formatCompactRupiah(value: number) {
  return `Rp ${compactNumberFormatter.format(value)}`;
}

export default function DashboardPage() {
  const [selectedYear, setSelectedYear] = useState<TrendYear>("2026");
  const trendData = businessTrendData[selectedYear];
  const totalRevenue = trendData.reduce((total, item) => total + item.revenue, 0);
  const totalCompletedOrders = trendData.reduce(
    (total, item) => total + item.completedOrders,
    0,
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ringkasan kondisi bisnis dan operasional."
        action={(
          <div className="text-right">
            <p className="text-sm font-medium">Data dummy · Agustus 2026</p>
            <p className="mt-1 text-xs text-muted-foreground">Ringkasan bulanan</p>
          </div>
        )}
      />

      <div className="flex flex-col gap-6">
        <section aria-labelledby="ringkasan-title">
          <div className="mb-4">
            <h2 id="ringkasan-title" className="text-base font-semibold">Ringkasan bisnis</h2>
            <p className="mt-1 text-sm text-muted-foreground">Status utama yang perlu dipantau hari ini.</p>
          </div>

          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <article key={metric.label} className="flex min-w-0 items-start justify-between gap-4 bg-card p-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                    <p className={cn("mt-3 truncate font-mono text-xl font-semibold tabular-nums", metric.issue ? "text-destructive" : "text-card-foreground")}>
                      {metric.value}
                    </p>
                    <p className={cn("mt-1 text-xs", metric.issue ? "text-destructive" : "text-muted-foreground")}>{metric.note}</p>
                  </div>
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", metric.issue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
                    <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="tren-bisnis-title">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="tren-bisnis-title" className="text-base font-semibold">Tren bisnis</h2>
              <p className="mt-1 text-sm text-muted-foreground">Kas masuk serta order yang telah selesai dan dibayar lunas.</p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="trend-year" className="text-sm font-medium">Tahun</label>
              <NativeSelect
                id="trend-year"
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value as TrendYear)}
                aria-label="Pilih tahun tren bisnis"
              >
                {trendYears.map((year) => (
                  <NativeSelectOption key={year} value={year}>{year}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <article className="rounded-lg border bg-card xl:col-span-3">
              <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Pendapatan per bulan</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Kas masuk aktual · data dummy {selectedYear}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs font-medium text-muted-foreground">Total {selectedYear}</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatRupiah(totalRevenue)}</p>
                </div>
              </div>

              <div className="p-4">
                <ChartContainer
                  config={revenueChartConfig}
                  className="h-64 w-full aspect-auto"
                  initialDimension={{ width: 720, height: 256 }}
                  aria-label={`Grafik pendapatan bulanan tahun ${selectedYear}`}
                >
                  <LineChart accessibilityLayer data={trendData} margin={{ left: 4, right: 12, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tickMargin={8}
                      width={66}
                      tickFormatter={(value: number) => formatCompactRupiah(value)}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          indicator="line"
                          labelFormatter={(label) => `${label} ${selectedYear}`}
                          formatter={(value) => (
                            <div className="flex min-w-40 items-center justify-between gap-4">
                              <span className="text-muted-foreground">Kas masuk</span>
                              <span className="font-mono font-medium tabular-nums">{formatRupiah(Number(value))}</span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Line
                      dataKey="revenue"
                      type="monotone"
                      stroke="var(--color-revenue)"
                      strokeWidth={2}
                      dot={{ fill: "var(--color-revenue)", r: 3 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ChartContainer>
                <p className="sr-only">
                  {trendData.map((item) => `${item.month}: ${formatRupiah(item.revenue)}`).join("; ")}.
                </p>
              </div>
            </article>

            <article className="rounded-lg border bg-card xl:col-span-2">
              <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Order selesai &amp; lunas</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Produksi selesai dan seluruh invoice paid.</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs font-medium text-muted-foreground">Total {selectedYear}</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{totalCompletedOrders} order</p>
                </div>
              </div>

              <div className="p-4">
                <ChartContainer
                  config={completedOrdersChartConfig}
                  className="h-64 w-full aspect-auto"
                  initialDimension={{ width: 480, height: 256 }}
                  aria-label={`Grafik order selesai dan lunas tahun ${selectedYear}`}
                >
                  <BarChart accessibilityLayer data={trendData} margin={{ left: -16, right: 4, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} />
                    <YAxis axisLine={false} tickLine={false} tickMargin={8} allowDecimals={false} />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          hideIndicator
                          labelFormatter={(label) => `${label} ${selectedYear}`}
                          formatter={(value) => (
                            <div className="flex min-w-40 items-center justify-between gap-4">
                              <span className="text-muted-foreground">Selesai &amp; lunas</span>
                              <span className="font-mono font-medium tabular-nums">{Number(value)} order</span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar
                      dataKey="completedOrders"
                      fill="var(--color-completedOrders)"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ChartContainer>
                <p className="sr-only">
                  {trendData.map((item) => `${item.month}: ${item.completedOrders} order`).join("; ")}.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2" aria-label="Ruang kerja detail">
          <article className="rounded-lg border bg-card">
            <div className="flex items-start justify-between gap-5 border-b p-4">
              <div>
                <h2 className="text-base font-semibold">Dashboard produksi</h2>
                <p className="mt-1 text-sm text-muted-foreground">Order produksi · jumlah job/item aktif per tahap.</p>
              </div>
              <div className="rounded-md bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground">Jahit terpadat</div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-5 p-4 sm:grid-cols-4">
              {production.map((stage, index) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.label} className="min-w-0">
                    <div className="mb-3 flex items-center">
                      <div className={cn("flex size-8 items-center justify-center rounded-md", stage.busiest ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                        <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
                      </div>
                      {index < production.length - 1 && <ArrowRight className="ml-2 hidden size-4 text-muted-foreground/40 sm:block" aria-hidden="true" />}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{stage.label}</p>
                    <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{stage.value}</p>
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-foreground" style={{ width: `${(stage.value / highestProductionCount) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="m-4 mt-2 flex items-center gap-3 rounded-md border bg-muted/50 p-3">
              <Clock3 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm"><span className="font-medium">Tahap terpadat:</span> Jahit memiliki 8 job/item aktif.</p>
            </div>
          </article>

          <article className="rounded-lg border bg-card">
            <div className="flex items-start justify-between gap-5 border-b p-4">
              <div>
                <h2 className="text-base font-semibold">Dashboard sales</h2>
                <p className="mt-1 text-sm text-muted-foreground">Pergerakan lead menuju deal.</p>
              </div>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Target className="size-4" aria-hidden="true" />
              </div>
            </div>

            <div className="flex flex-col gap-4 p-4">
              {funnel.map((step) => (
                <div key={step.label}>
                  <div className="mb-2 flex items-baseline justify-between gap-4">
                    <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
                    <p className="font-mono text-sm font-medium tabular-nums">{step.value}</p>
                  </div>
                  <div className="h-8 overflow-hidden rounded-md bg-muted">
                    <div className="flex h-full min-w-12 items-center justify-end rounded-md bg-foreground px-2 font-mono text-xs text-background" style={{ width: step.width }}>
                      {step.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="m-4 mt-2 flex items-center justify-between gap-5 rounded-md bg-secondary p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Konversi</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">12%</p>
              </div>
              <p className="text-right text-xs text-muted-foreground">12 deal dari 100 lead</p>
            </div>
          </article>
        </section>
      </div>
    </>
  );
}
