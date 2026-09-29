"use client";

import { useState } from "react";
import { Coins, PackageCheck, type LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DASH_CARD_CLASS, DashSectionHeading } from "@/components/dashboard/dashboard-ui";
import { Card, CardAction, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  onChange,
}: {
  id: string;
  label: string;
  selectAriaLabel: string;
  value: TrendYear;
  onChange: (year: TrendYear) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-muted p-0.5 pl-3">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <NativeSelect
        id={id}
        className={yearControlClass}
        value={value}
        onChange={(event) => onChange(event.target.value as TrendYear)}
        aria-label={selectAriaLabel}
      >
        {trendYears.map((year) => (
          <NativeSelectOption key={year} value={year}>{year}</NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export function BusinessTrendChart() {
  const [revenueYear, setRevenueYear] = useState<TrendYear>("2026");
  const [ordersYear, setOrdersYear] = useState<TrendYear>("2026");
  const trendData = businessTrendData[revenueYear];
  const ordersTrendData = businessTrendData[ordersYear];
  const totalRevenue = trendData.reduce((total, item) => total + item.revenue, 0);
  const totalCompletedOrders = ordersTrendData.reduce(
    (total, item) => total + item.completedOrders,
    0,
  );

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
            <CardDescription>Kas masuk aktual · data dummy {revenueYear}.</CardDescription>
            <CardAction>
              <YearSelect
                id="revenue-year"
                label="Tahun"
                selectAriaLabel="Pilih tahun pendapatan per bulan"
                value={revenueYear}
                onChange={setRevenueYear}
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            <TotalStrip
              icon={Coins}
              chipClassName="bg-success-surface text-success-surface-foreground"
              label={`Total ${revenueYear}`}
              value={formatRupiah(totalRevenue)}
            />

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
            <CardDescription>Produksi selesai dan seluruh invoice sudah dibayar.</CardDescription>
            <CardAction>
              <YearSelect
                id="orders-year"
                label="Tahun"
                selectAriaLabel="Pilih tahun order selesai dan lunas"
                value={ordersYear}
                onChange={setOrdersYear}
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            <TotalStrip
              icon={PackageCheck}
              chipClassName="bg-highlight-surface text-highlight-surface-foreground"
              label={`Total ${ordersYear}`}
              value={`${totalCompletedOrders} order`}
            />

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
