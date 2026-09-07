import { NextResponse } from "next/server";

import { getSalesDashboardData } from "@/lib/crm/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getSalesDashboardData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null, { status: 401 });
  }
}
