import { getAiTimeseries } from "@/lib/ai/analytics";
import { aiJsonResponse, parseAiQuery, withAiAccess } from "@/lib/ai/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAiAccess(request, "GET /api/ai/timeseries", async () => {
    // Tren default satu tahun berjalan supaya langsung terbaca sebagai grafik.
    const query = parseAiQuery(new URL(request.url).searchParams, { defaultPreset: "this-year" });
    return aiJsonResponse(
      await getAiTimeseries({ brand: query.brand, range: query.range, granularity: query.granularity }),
    );
  });
}
