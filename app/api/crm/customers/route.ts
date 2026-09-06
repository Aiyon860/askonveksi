import { NextResponse } from "next/server";

import { getCustomers, type CustomerSegment, type CustomerSort, type SortDirection } from "@/lib/crm/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const segment = (searchParams.get("segment") ?? "all") as CustomerSegment;
    const sort = (searchParams.get("sort") ?? "name") as CustomerSort;
    const dir = (searchParams.get("dir") ?? "asc") as SortDirection;
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");

    const data = await getCustomers({ query: q, segment, sort, direction: dir, page, pageSize });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null, { status: 401 });
  }
}
