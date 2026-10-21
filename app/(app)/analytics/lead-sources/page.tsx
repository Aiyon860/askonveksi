import { Suspense } from "react";
import type { Metadata } from "next";

import { LeadSourcesContent } from "@/components/analytics/lead-sources/lead-sources-content";
import { LeadSourcesSkeleton } from "@/components/analytics/lead-sources/lead-sources-skeleton";

export const metadata: Metadata = {
  title: "Analisis Sumber Lead & Efektivitas Kanal | Askonveksi",
  description:
    "Evaluasi kualitas prospek, rasio konversi closing, efisiensi akuisisi, dan kontribusi omzet nyata per kanal pemasaran konveksi.",
};

export default async function LeadSourceRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string | string[];
    from?: string | string[];
    to?: string | string[];
    range?: string | string[];
    sourceId?: string | string[];
  }>;
}) {
  return (
    <Suspense fallback={<LeadSourcesSkeleton />}>
      <LeadSourcesContent searchParams={searchParams} />
    </Suspense>
  );
}
