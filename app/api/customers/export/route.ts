import { createCustomerWorkbook } from "@/lib/crm/customer-excel";
import { getCustomersForExport, type CustomerSegment, type CustomerSort, type SortDirection } from "@/lib/crm/data";
import { downloadFilename } from "@/lib/download-filename";

const SORTS = ["customerNo", "name", "opportunities", "updatedAt"] as const satisfies readonly CustomerSort[];
const DIRECTIONS = ["asc", "desc"] as const satisfies readonly SortDirection[];

function defaultDirection(sort: CustomerSort): SortDirection {
  return sort === "updatedAt" ? "desc" : "asc";
}

function parseSegment(value: string | null): CustomerSegment {
  return value === "repeat" || value === "inactive" || value === "archived" ? value : "all";
}

function parseSort(value: string | null): CustomerSort {
  return SORTS.find((item) => item === value) ?? "updatedAt";
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 80);
  const segment = parseSegment(params.get("segment"));
  const sort = parseSort(params.get("sort"));
  const direction = DIRECTIONS.find((item) => item === params.get("order")) ?? defaultDirection(sort);
  const rows = await getCustomersForExport({ query, segment, sort, direction });
  const body = await createCustomerWorkbook(rows);

  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${downloadFilename("customer", "xlsx")}"`,
    },
  });
}
