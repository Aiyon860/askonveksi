import { NextResponse } from "next/server";

import { entityIdSchema } from "@/lib/crm/validation";
import { getProductionBoard } from "@/lib/production/data";
import { parseProductionBoardGroup } from "@/lib/production/workflow";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const group = parseProductionBoardGroup(params.get("jalur") ?? undefined);
  const rawKategori = params.get("kategori");
  const productCategoryId = rawKategori && entityIdSchema.safeParse(rawKategori).success ? rawKategori : null;
  try {
    const data = await getProductionBoard({ group, productCategoryId });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null, { status: 401 });
  }
}
