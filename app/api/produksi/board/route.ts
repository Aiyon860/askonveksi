import { NextResponse } from "next/server";

import { entityIdSchema } from "@/lib/crm/validation";
import { parseProductionBoardFilters } from "@/lib/production/board-filters";
import { getProductionBoard } from "@/lib/production/data";
import { parseProductionBoardGroup } from "@/lib/production/workflow";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const group = parseProductionBoardGroup(params.get("jalur") ?? undefined);
  const rawKategori = params.get("kategori");
  const productCategoryId = rawKategori && entityIdSchema.safeParse(rawKategori).success ? rawKategori : null;
  // Polling 60 detik harus memakai filter yang sama dengan halaman, kalau tidak
  // kartu hasil filter kembali muncul sendiri.
  const filters = parseProductionBoardFilters(Object.fromEntries(params.entries()));
  try {
    const data = await getProductionBoard({ group, productCategoryId, filters });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null, { status: 401 });
  }
}
