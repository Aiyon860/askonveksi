"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const LeadSourceRevenueChart = dynamic(
  () => import("@/components/analytics/lead-source-revenue-chart").then((mod) => ({ default: mod.LeadSourceRevenueChart })),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> },
);

export function LazyLeadSourceRevenueChart({ rows }: { rows: { sourceId: string | null; sourceName: string; revenue: string }[] }) {
  return <LeadSourceRevenueChart rows={rows} />;
}
