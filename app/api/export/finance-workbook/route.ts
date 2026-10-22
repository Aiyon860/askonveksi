import { FINANCE_ROLES, hasRole } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";
import { buildFinanceWorkbookSpec } from "@/lib/export/finance-workbook-spec";
import type { FinanceWorkbookScope } from "@/lib/export/workbook-types";
import { parseFinanceDateRange } from "@/lib/finance/date-range";
import { getFinanceWorkbookData } from "@/lib/finance/workbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseScope(value: string | null): FinanceWorkbookScope | null {
  return value === "laporan" || value === "pemasukan" || value === "pengeluaran" ? value : null;
}

export async function GET(request: Request) {
  const actor = await getCurrentActor();
  if (!actor) return Response.json({ error: "Sesi tidak valid." }, { status: 401 });
  if (!hasRole(actor.role, FINANCE_ROLES)) {
    return Response.json({ error: "Anda tidak berhak mengekspor data ini." }, { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const scope = parseScope(searchParams.get("scope"));
  if (!scope) return Response.json({ error: "Scope export tidak valid." }, { status: 400 });

  try {
    const range = parseFinanceDateRange(searchParams.get("from") ?? undefined, searchParams.get("to") ?? undefined);
    const data = await getFinanceWorkbookData({ scope, range });
    return Response.json(buildFinanceWorkbookSpec(data), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Anda tidak berhak mengekspor data ini." }, { status: 403 });
    }
    console.error("Export workbook keuangan gagal", scope, error);
    return Response.json({ error: "Data export gagal dimuat." }, { status: 500 });
  }
}
