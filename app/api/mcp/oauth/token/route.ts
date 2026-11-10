import { exchangeToken } from "@/lib/ai/mcp-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readTokenParams(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await request.json()) as Record<string, string>;
    return json;
  }
  const text = await request.text();
  return new URLSearchParams(text);
}

export async function POST(request: Request) {
  let params: URLSearchParams | Record<string, string>;
  try {
    params = await readTokenParams(request);
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = exchangeToken(params);
  return Response.json(result.body, {
    status: result.status,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}
