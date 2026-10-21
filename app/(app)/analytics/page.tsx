import { Suspense } from "react";
import type { Metadata } from "next";

import { AnalyticsContent } from "@/components/analytics/analytics-content";
import { AnalyticsSkeleton } from "@/components/analytics/analytics-skeleton";

export const metadata: Metadata = {
  title: "Executive Business Analytics | Askonveksi",
  description: "Pemantauan menyeluruh profitabilitas, funnel closing, unit economics, dan efisiensi operasional bisnis konveksi.",
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string | string[];
    from?: string | string[];
    to?: string | string[];
    range?: string | string[];
    sourceId?: string | string[];
    categoryId?: string | string[];
  }>;
}) {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsContent searchParams={searchParams} />
    </Suspense>
  );
}
