import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { aiBaseUrl } from "@/lib/ai/catalog";
import { withAiAccess, aiJsonResponse } from "@/lib/ai/http";
import { createAiMcpServer } from "@/lib/ai/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy Anthropic/OpenAI kadang hanya mengirim `Accept: text/event-stream`.
 * SDK menolak itu (406); normalisasi agar handshake konektor tetap jalan.
 */
function replayWithMcpAccept(request: Request, body: string) {
  const headers = new Headers(request.headers);
  const accept = headers.get("accept") ?? "";
  if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
    headers.set("accept", "application/json, text/event-stream");
  }
  return new Request(request.url, { method: "POST", headers, body });
}

/**
 * Endpoint MCP (Streamable HTTP, stateless) untuk ChatGPT / Claude / Gemini.
 *
 * Satu token Bearer dipakai bersama REST; rate limit dan audit log berlaku sama.
 * Karena stateless, server + transport dibuat per permintaan.
 */
export async function POST(request: Request) {
  // Salin body lebih dulu: nama tool dipakai untuk audit sebelum transport membaca body.
  const body = await request.text();
  let auditParams: string | null = "mcp";
  try {
    const parsed = JSON.parse(body) as { method?: string; params?: { name?: string } };
    auditParams = `mcp:${parsed.params?.name ?? parsed.method ?? "unknown"}`;
  } catch {
    auditParams = "mcp:invalid-json";
  }

  return withAiAccess(
    request,
    "POST /api/mcp",
    async () => {
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      const server = createAiMcpServer(aiBaseUrl());
      await server.connect(transport);

      const replay = replayWithMcpAccept(request, body);

      try {
        return await transport.handleRequest(replay);
      } finally {
        await server.close().catch(() => undefined);
      }
    },
    { params: auditParams },
  );
}

/**
 * Cursor (dan klien Streamable HTTP lain) membuka GET SSE setelah initialize.
 * Server kita stateless / tanpa server-push, tapi 405 di sini membuat
 * "MCP server failed to list its tools" / Status: error, 0 tools.
 */
export async function GET(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  if (!accept.includes("text/event-stream")) {
    return aiJsonResponse(
      {
        error: {
          code: "method_not_allowed",
          message: "GET /api/mcp hanya untuk SSE (Accept: text/event-stream). Pakai POST untuk JSON-RPC.",
        },
      },
      405,
    );
  }

  return withAiAccess(
    request,
    "GET /api/mcp",
    async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Komentar SSE: stream hidup singkat; tidak ada notifikasi server-push.
          controller.enqueue(encoder.encode(": ok\n\n"));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    },
    { params: "mcp:sse" },
  );
}

export async function DELETE(request: Request) {
  return withAiAccess(
    request,
    "DELETE /api/mcp",
    async () => new Response(null, { status: 204 }),
    { params: "mcp:delete" },
  );
}
