import { getAiCustomers } from "@/lib/ai/analytics";
import { aiJsonResponse, parseAiQuery, withAiAccess } from "@/lib/ai/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withAiAccess(request, "GET /api/ai/customers", async () => {
    const searchParams = new URL(request.url).searchParams;
    const query = parseAiQuery(searchParams);
    const data = await getAiCustomers({ brand: query.brand, range: query.range });

    // groupBy mempersempit keluaran agar percakapan AI tetap ringkas.
    if (!searchParams.get("groupBy")) return aiJsonResponse(data);
    const only = {
      city: { byCity: data.byCity },
      source: { byLeadSource: data.byLeadSource },
      type: { byCustomerType: data.byCustomerType },
      lifecycle: { lifecycle: data.lifecycle },
    }[query.groupBy];

    return aiJsonResponse({
      meta: data.meta,
      ...only,
      repeat: data.repeat,
      topCustomers: data.topCustomers,
      quality: data.quality,
    });
  });
}
