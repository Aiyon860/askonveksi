import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { aiBaseUrl } from "@/lib/ai/catalog";
import { withAiAccess, aiJsonResponse } from "@/lib/ai/http";
import { createAiMcpServer } from "@/lib/ai/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

      // Request asli sudah dibaca untuk audit; kirim ulang body yang sama ke transport.
      const replay = new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body,
      });

      try {
        return await transport.handleRequest(replay);
      } finally {
        await server.close().catch(() => undefined);
      }
    },
    { params: auditParams },
  );
}

export async function GET() {
  return aiJsonResponse(
    {
      error: {
        code: "method_not_allowed",
        message: "Endpoint MCP hanya menerima POST JSON-RPC (Streamable HTTP, tanpa sesi).",
      },
    },
    405,
  );
}

export async function DELETE() {
  return aiJsonResponse(
    { error: { code: "method_not_allowed", message: "Endpoint MCP stateless tidak menyimpan sesi." } },
    405,
  );
}
