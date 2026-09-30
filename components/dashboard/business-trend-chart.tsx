"use client";

import { useMemo, useState } from "react";
import { Coins, PackageCheck, type LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import useSWR from "swr";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DASH_CARD_CLASS, DashSectionHeading } from "@/components/dashboard/dashboard-ui";
import { Card, CardAction, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";

type TrendMonth = {
  month: number;
  label: string;
  revenue: string;
  transactionCount: number;
  completedOrders: number;
};

type TrendResponse = {
  year: number;
  months: TrendMonth[];
  availableYears: number[];
  totalRevenue: string;
  totalTransactions: number;
  totalCompletedOrders: number;
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"] as const;

function emptyMonths(): TrendMonth[] {
  return MONTH_LABELS.map((label, index) => ({
    month: index + 1,
    label,
    revenue: "0",
    transactionCount: 0,
    completedOrders: 0,
  }));
}

const revenueChartConfig = {
  revenue: {
    label: "Kas masuk",
    color: "var(--chart-revenue)",
  },
} satisfies ChartConfig;

const completedOrdersChartConfig = {
  completedOrders: {
    label: "Order selesai & lunas",
    color: "var(--chart-orders)",
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

/** Sumbu dan kisi memakai token palet, bukan abu-abu bawaan pustaka grafik. */
const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 } as const;
const yearControlClass =
  "[&>select]:h-7 [&>select]:rounded-full [&>select]:border-0 [&>select]:bg-card [&>select]:pr-8 [&>select]:pl-3 [&>select]:text-xs [&>select]:font-semibold [&>select]:shadow-none";

function formatRupiah(value: number) {
  return rupiahFormatter.format(value).replace(/\u00a0/g, " ");
}

function formatCompact(value: number) {
  return compactNumberFormatter.format(value);
}

function TotalStrip({
  icon: Icon,
  chipClassName,
  label,
  value,
}: {
  icon: LucideIcon;
  chipClassName: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-muted px-3 py-2.5">
      <span className="flex min-w-0 items-center gap-2.5 text-xs font-medium text-muted-foreground">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", chipClassName)}>
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 font-mono text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function YearSelect({
  id,
  label,
  selectAriaLabel,
  value,
  years,
  onChange,
}: {
  id: string;
  label: string;
  selectAriaLabel: string;
  value: number;
  years: number[];
  onChange: (year: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-muted p-0.5 pl-3">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <NativeSelect
        id={id}
        className={yearControlClass}
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={selectAriaLabel}
      >
        {years.map((year) => (
          <NativeSelectOption key={year} value={String(year)}>{year}</NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

function useTrend(year: number) {
  const { data, isLoading } = useSWR<TrendResponse>(`/api/crm/dashboard/trends?year=${year}`, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 30000,
    dedupingInterval: 5000,
  });
  return { data, isLoading };
}

export function BusinessTrendChart() {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [revenueYear, setRevenueYear] = useState<number>(currentYear);
  const [ordersYear, setOrdersYear] = useState<number>(currentYear);
  const { data: revenueTrend, isLoading: revenueLoading } = useTrend(revenueYear);
  const { data: ordersTrend, isLoading: ordersLoading } = useTrend(ordersYear);

  const availableYears = useMemo(() => {
    const merged = new Set<number>([currentYear, revenueYear, ordersYear]);
    for (const year of revenueTrend?.availableYears ?? []) merged.add(year);
    for (const year of ordersTrend?.availableYears ?? []) merged.add(year);
    return [...merged].sort((a, b) => b - a);
  }, [currentYear, revenueYear, ordersYear, revenueTrend, ordersTrend]);

  const revenueMonths = revenueTrend?.months ?? emptyMonths();
  const ordersMonths = ordersTrend?.months ?? emptyMonths();

  const trendData = revenueMonths.map((item) => ({ month: item.label, revenue: Number(item.revenue) }));
  const ordersTrendData = ordersMonths.map((item) => ({ month: item.label, completedOrders: item.completedOrders }));

  const totalRevenue = revenueTrend ? Number(revenueTrend.totalRevenue) : 0;
  const totalTransactions = revenueTrend?.totalTransactions ?? 0;
  const totalCompletedOrders = ordersTrend?.totalCompletedOrders ?? 0;
  const hasRevenue = (revenueTrend != null) && (totalTransactions > 0 || totalRevenue > 0);
  const hasCompletedOrders = (ordersTrend != null) && totalCompletedOrders > 0;

  return (
    <section aria-labelledby="tren-bisnis-title" className="flex flex-col">
      <DashSectionHeading
        id="tren-bisnis-title"
        title="Tren bisnis"
        description="Kas masuk serta order yang telah selesai dan dibayar lunas."
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className={cn(DASH_CARD_CLASS, "xl:col-span-3")}>
          <CardHeader>
            <CardTitle className="font-semibold">Pendapatan per bulan</CardTitle>
            <CardDescription>
              {revenueLoading && !revenueTrend ? "Memuat kas masuk aktual…" : `Kas masuk aktual · ${totalTransactions} transaksi tahun ${revenueYear}.`}
            </CardDescription>
            <CardAction>
              <YearSelect
                id="revenue-year"
                label="Tahun"
                selectAriaLabel="Pilih tahun pendapatan per bulan"
                value={revenueYear}
                years={availableYears}
                onChange={setRevenueYear}
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            <TotalStrip
              icon={Coins}
              chipClassName="bg-success-surface text-success-surface-foreground"
              label={`Total ${revenueYear}`}
              value={revenueLoading && !revenueTrend ? "…" : formatRupiah(totalRevenue)}
            />
            {!revenueLoading && revenueTrend && !hasRevenue ? (
              <p className="mt-3 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                Belum ada kas masuk tahun {revenueYear}. Grafik menampilkan 12 bulan nol dari data PaymentTransaction aktual.
              </p>
            ) : null}

            <ChartContainer
              config={revenueChartConfig}
              className="mt-1 h-64 w-full aspect-auto"
              initialDimension={{ width: 720, height: 256 }}
              aria-label={`Grafik pendapatan bulanan tahun ${revenueYear}`}
            >
              <LineChart accessibilityLayer data={trendData} margin={{ left: 4, right: 12, top: 20 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} tick={axisTick} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                  width={66}
                  tick={axisTick}
                  tickFormatter={(value: number) => formatCompact(value)}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      labelFormatter={(label) => `${label} ${revenueYear}`}
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
          </CardContent>
        </Card>

        <Card className={cn(DASH_CARD_CLASS, "xl:col-span-2")}>
          <CardHeader>
            <CardTitle className="font-semibold">Order selesai &amp; lunas</CardTitle>
            <CardDescription>
              {ordersLoading && !ordersTrend ? "Memuat order selesai dan lunas…" : `Produksi selesai dan invoice lunas · ${totalCompletedOrders} order tahun ${ordersYear}.`}
            </CardDescription>
            <CardAction>
              <YearSelect
                id="orders-year"
                label="Tahun"
                selectAriaLabel="Pilih tahun order selesai dan lunas"
                value={ordersYear}
                years={availableYears}
                onChange={setOrdersYear}
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            <TotalStrip
              icon={PackageCheck}
              chipClassName="bg-highlight-surface text-highlight-surface-foreground"
              label={`Total ${ordersYear}`}
              value={ordersLoading && !ordersTrend ? "…" : `${totalCompletedOrders} order`}
            />
            {!ordersLoading && ordersTrend && !hasCompletedOrders ? (
              <p className="mt-3 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                Belum ada order selesai dan lunas tahun {ordersYear}. Grafik menampilkan 12 bulan nol dari data Sales Order aktual.
              </p>
            ) : null}

            <ChartContainer
              config={completedOrdersChartConfig}
              className="mt-1 h-64 w-full aspect-auto"
              initialDimension={{ width: 480, height: 256 }}
              aria-label={`Grafik order selesai dan lunas tahun ${ordersYear}`}
            >
              <BarChart accessibilityLayer data={ordersTrendData} margin={{ left: -16, right: 4, top: 20 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} tick={axisTick} />
                <YAxis axisLine={false} tickLine={false} tickMargin={8} allowDecimals={false} tick={axisTick} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideIndicator
                      labelFormatter={(label) => `${label} ${ordersYear}`}
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
              {ordersTrendData.map((item) => `${item.month}: ${item.completedOrders} order`).join("; ")}.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
