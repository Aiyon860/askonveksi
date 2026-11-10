import { registerClient } from "@/lib/ai/mcp-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_client_metadata" }, { status: 400 });
  }

  const result = registerClient({
    redirect_uris: Array.isArray(body.redirect_uris)
      ? body.redirect_uris.filter((u): u is string => typeof u === "string")
      : undefined,
    client_name: typeof body.client_name === "string" ? body.client_name : undefined,
    token_endpoint_auth_method:
      typeof body.token_endpoint_auth_method === "string" ? body.token_endpoint_auth_method : undefined,
  });

  if ("error" in result) {
    return Response.json(result, { status: 400 });
  }
  return Response.json(result, { status: 201 });
}
