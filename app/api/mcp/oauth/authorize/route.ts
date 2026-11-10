import {
  completeAuthorize,
  parseAuthorizeQuery,
  renderAuthorizePage,
} from "@/lib/ai/mcp-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsed = parseAuthorizeQuery(new URL(request.url));
  if (!parsed.ok) {
    const safe = parsed.message.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    return new Response(`<!doctype html><meta charset="utf-8"><title>OAuth error</title><p>${safe}</p>`, {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return new Response(renderAuthorizePage(parsed.data), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const params = new URLSearchParams();
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params.set(key, value);
  }

  const result = await completeAuthorize(params);
  if (!result.ok) {
    const query = result.query ?? {
      response_type: params.get("response_type") ?? "code",
      client_id: params.get("client_id") ?? "",
      redirect_uri: params.get("redirect_uri") ?? "https://invalid.example/",
      state: params.get("state") ?? undefined,
      code_challenge: params.get("code_challenge") ?? "",
      code_challenge_method: params.get("code_challenge_method") ?? "S256",
      scope: params.get("scope") ?? undefined,
    };
    return new Response(renderAuthorizePage(query, result.message), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  return Response.redirect(result.redirect, 302);
}
