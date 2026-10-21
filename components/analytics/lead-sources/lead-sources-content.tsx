import { getLeadSourceAnalyticsData } from "@/lib/crm/lead-sources-data";
import { LeadSourcesContentClient } from "./lead-sources-content-client";

function first(val: string | string[] | undefined) {
  return Array.isArray(val) ? val[0] : val;
}

export async function LeadSourcesContent({
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
  const params = await searchParams;
  const initialData = await getLeadSourceAnalyticsData({
    mode: first(params.mode),
    from: first(params.from),
    to: first(params.to),
    range: first(params.range),
    sourceId: first(params.sourceId),
  });

  return <LeadSourcesContentClient initialData={initialData} />;
}
