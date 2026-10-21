import { NextResponse } from "next/server";
import { getLeadSourceAnalyticsData } from "@/lib/crm/lead-sources-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = {
      mode: searchParams.get("mode") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      range: searchParams.get("range") ?? undefined,
      sourceId: searchParams.get("sourceId") ?? undefined,
    };
    const data = await getLeadSourceAnalyticsData(params);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Lead Sources Analytics API Error:", error);
    return NextResponse.json(
      { error: "Unauthorized or failed to fetch lead source analytics" },
      { status: 401 },
    );
  }
}
