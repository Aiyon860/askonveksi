import { NextResponse } from "next/server";

import { getProductionBoard } from "@/lib/production/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const route = new URL(request.url).searchParams.get("jalur") === "NON_JERSEY" ? "NON_JERSEY" : "JERSEY";
  try {
    const data = await getProductionBoard(route);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null, { status: 401 });
  }
}
