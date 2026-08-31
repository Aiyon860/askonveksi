"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Card, CardAction, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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

function formatRupiah(value: number) {
  return rupiahFormatter.format(value).replace(/\u00a0/g, " ");
}

function formatCompactRupiah(value: number) {
  return `Rp ${compactNumberFormatter.format(value)}`;
}

export function BusinessTrendChart() {
  const [selectedYear, setSelectedYear] = useState<TrendYear>("2026");
  const trendData = businessTrendData[selectedYear];
  const totalRevenue = trendData.reduce((total, item) => total + item.revenue, 0);
  const totalCompletedOrders = trendData.reduce(
    (total, item) => total + item.completedOrders,
    0,
  );

  return (
    <section aria-labelledby="tren-bisnis-title" className="grid gap-4 xl:grid-cols-5">
      <div className="mb-4 xl:col-span-5">
        <h2 id="tren-bisnis-title" className="text-base font-semibold">Tren bisnis</h2>
        <p className="mt-1 text-sm text-muted-foreground">Kas masuk serta order yang telah selesai dan dibayar lunas.</p>
      </div>

      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Pendapatan per bulan</CardTitle>
          <CardDescription>Kas masuk aktual · data dummy {selectedYear}.</CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <label htmlFor="trend-year" className="text-sm font-medium">Tahun</label>
              <NativeSelect
                id="trend-year"
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value as TrendYear)}
                aria-label="Pilih tahun data tren"
              >
                {trendYears.map((year) => (
                  <NativeSelectOption key={year} value={year}>{year}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="flex items-baseline justify-between border-t pt-4">
            <span className="text-xs font-medium text-muted-foreground">Total {selectedYear}</span>
            <span className="font-mono text-lg font-semibold tabular-nums">{formatRupiah(totalRevenue)}</span>
          </p>

          <ChartContainer
            config={revenueChartConfig}
            className="mt-2 h-64 w-full aspect-auto"
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
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Order selesai &amp; lunas</CardTitle>
          <CardDescription>Produksi selesai dan seluruh invoice sudah dibayar.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="flex items-baseline justify-between border-t pt-4">
            <span className="text-xs font-medium text-muted-foreground">Total {selectedYear}</span>
            <span className="font-mono text-lg font-semibold tabular-nums">{totalCompletedOrders} order</span>
          </p>

          <ChartContainer
            config={completedOrdersChartConfig}
            className="mt-2 h-64 w-full aspect-auto"
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
        </CardContent>
      </Card>
    </section>
  );
}
