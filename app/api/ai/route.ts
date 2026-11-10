import { aiBaseUrl, buildAiCatalog } from "@/lib/ai/catalog";
import { aiJsonResponse, withAiAccess } from "@/lib/ai/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Katalog metrik + konfirmasi token valid. */
export async function GET(request: Request) {
  return withAiAccess(request, "GET /api/ai", async () => {
    return aiJsonResponse({ ...buildAiCatalog(aiBaseUrl()), authenticated: true });
  });
}
