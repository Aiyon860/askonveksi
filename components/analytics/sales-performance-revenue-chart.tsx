"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/crm/format";

const chartConfig = {
  revenue: {
    label: "Omzet",
    theme: {
      light: "var(--success)",
      dark: "var(--success)",
    },
  },
} satisfies ChartConfig;

type RevenueRow = {
  salesId: string | null;
  salesName: string;
  revenue: string;
};

export function SalesPerformanceRevenueChart({ rows }: { rows: RevenueRow[] }) {
  const data = rows
    .filter((row) => Number(row.revenue) > 0)
    .map((row) => ({
      ...row,
      revenueValue: Number(row.revenue),
    }));
  const height = Math.max(288, data.length * 46);

  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-72 w-full aspect-auto"
      style={{ height }}
      role="img"
      aria-label="Perbandingan omzet Sales Order aktif untuk setiap sales"
    >
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
      >
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="salesName"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          width={128}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={
            <ChartTooltipContent
              hideLabel
              hideIndicator
              formatter={(value, _name, item) => (
                <div className="flex min-w-52 items-center justify-between gap-4">
                  <span className="text-muted-foreground">{item.payload.salesName}</span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatCurrency(typeof value === "number" ? value : String(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="revenueValue"
          name="revenue"
          fill="var(--color-revenue)"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
