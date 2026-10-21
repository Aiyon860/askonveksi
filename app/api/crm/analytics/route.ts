import { NextResponse } from "next/server";
import { getExecutiveAnalyticsData } from "@/lib/crm/analytics-data";

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
      categoryId: searchParams.get("categoryId") ?? undefined,
    };
    const data = await getExecutiveAnalyticsData(params);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Analytics API Error:", error);
    return NextResponse.json({ error: "Unauthorized or failed to fetch analytics" }, { status: 401 });
  }
}
