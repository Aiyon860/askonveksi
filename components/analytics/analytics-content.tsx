import { getExecutiveAnalyticsData, type AnalyticsQueryParams } from "@/lib/crm/analytics-data";
import { AnalyticsContentClient } from "@/components/analytics/analytics-content-client";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function AnalyticsContent({
  searchParams,
}: {
  searchParams?: Promise<{
    mode?: string | string[];
    from?: string | string[];
    to?: string | string[];
    range?: string | string[];
    sourceId?: string | string[];
    categoryId?: string | string[];
  }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const queryParams: AnalyticsQueryParams = {
    mode: first(resolvedParams.mode),
    from: first(resolvedParams.from),
    to: first(resolvedParams.to),
    range: first(resolvedParams.range),
    sourceId: first(resolvedParams.sourceId),
    categoryId: first(resolvedParams.categoryId),
  };

  const initialData = await getExecutiveAnalyticsData(queryParams);
  return <AnalyticsContentClient initialData={initialData} />;
}
