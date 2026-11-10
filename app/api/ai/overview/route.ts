import { getAiOverview } from "@/lib/ai/analytics";
import { aiJsonResponse, parseAiQuery, withAiAccess } from "@/lib/ai/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAiAccess(request, "GET /api/ai/overview", async () => {
    const query = parseAiQuery(new URL(request.url).searchParams);
    return aiJsonResponse(await getAiOverview({ brand: query.brand, range: query.range }));
  });
}
