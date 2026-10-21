import { NextResponse } from "next/server";
import { getDashboardFullAnalyticsData } from "@/lib/crm/dashboard-data";

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
    const data = await getDashboardFullAnalyticsData(params);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(null, { status: 401 });
  }
}
