import { NextResponse } from "next/server";

import { getPipelineData } from "@/lib/crm/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getPipelineData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null, { status: 401 });
  }
}
