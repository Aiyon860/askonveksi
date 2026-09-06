"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const BusinessTrendChart = dynamic(
  () => import("@/components/dashboard/business-trend-chart").then((mod) => ({ default: mod.BusinessTrendChart })),
  { ssr: false, loading: () => <Skeleton className="h-80 w-full" /> },
);

export function LazyBusinessTrendChart() {
  return <BusinessTrendChart />;
}
