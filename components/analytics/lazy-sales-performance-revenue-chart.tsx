"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const SalesPerformanceRevenueChart = dynamic(
  () => import("@/components/analytics/sales-performance-revenue-chart").then((mod) => ({ default: mod.SalesPerformanceRevenueChart })),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> },
);

type RevenueRow = {
  salesId: string | null;
  salesName: string;
  isActive: boolean | null;
  leadCount: number;
  followUpCount: number;
  invoiceCount: number;
  dealCount: number;
  revenue: string;
};

export function LazySalesPerformanceRevenueChart({ rows }: { rows: RevenueRow[] }) {
  return <SalesPerformanceRevenueChart rows={rows} />;
}
