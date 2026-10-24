import { ANALYTICS_ROLES, DASHBOARD_ROLES, hasRole } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";
import {
  buildDashboardWorkbookSpec,
  buildExecutiveAnalyticsWorkbookSpec,
  buildLeadSourceWorkbookSpec,
} from "@/lib/export/analysis-workbook-spec";
import type { AnalysisWorkbookScope, WorkbookPayload } from "@/lib/export/workbook-types";
import { getExecutiveAnalyticsData } from "@/lib/crm/analytics-data";
import { getDashboardFullAnalyticsData } from "@/lib/crm/dashboard-data";
import { getLeadSourceAnalyticsData } from "@/lib/crm/lead-sources-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseScope(value: string | null): AnalysisWorkbookScope | null {
  return value === "dashboard" || value === "analytics" || value === "lead-sources" ? value : null;
}

function queryParams(searchParams: URLSearchParams) {
  return {
    mode: searchParams.get("mode") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    range: searchParams.get("range") ?? undefined,
    sourceId: searchParams.get("sourceId") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
  };
}

export async function GET(request: Request) {
  const actor = await getCurrentActor();
  if (!actor) return Response.json({ error: "Sesi tidak valid." }, { status: 401 });

  const searchParams = new URL(request.url).searchParams;
  const scope = parseScope(searchParams.get("scope"));
  if (!scope) return Response.json({ error: "Scope export tidak valid." }, { status: 400 });

  const allowedRoles = scope === "dashboard" ? DASHBOARD_ROLES : ANALYTICS_ROLES;
  if (!hasRole(actor.role, allowedRoles)) {
    return Response.json({ error: "Anda tidak berhak mengekspor data ini." }, { status: 403 });
  }

  const params = queryParams(searchParams);

  try {
    let payload: WorkbookPayload;
    if (scope === "dashboard") {
      payload = buildDashboardWorkbookSpec(await getDashboardFullAnalyticsData(params));
    } else if (scope === "analytics") {
      payload = buildExecutiveAnalyticsWorkbookSpec(await getExecutiveAnalyticsData(params));
    } else {
      payload = buildLeadSourceWorkbookSpec(
        await getLeadSourceAnalyticsData({
          mode: params.mode,
          from: params.from,
          to: params.to,
          range: params.range,
          sourceId: params.sourceId,
        }),
      );
    }

    return Response.json(payload, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Anda tidak berhak mengekspor data ini." }, { status: 403 });
    }
    console.error("Export workbook analisis gagal", scope, error);
    return Response.json({ error: "Data export gagal dimuat." }, { status: 500 });
  }
}
