import { NextResponse } from "next/server";

import { getBusinessTrendData } from "@/lib/crm/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getBusinessTrendData(searchParams.get("year") ?? String(new Date().getFullYear()));
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHORIZED";
    if (message === "INVALID_YEAR") {
      return NextResponse.json({ error: "Tahun tidak valid." }, { status: 400 });
    }
    return NextResponse.json(null, { status: 401 });
  }
}
