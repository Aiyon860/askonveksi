import "server-only";

import type { AiApiToken } from "@prisma/client";

import { getPrismaClient } from "@/lib/prisma";

import { authenticateAiToken } from "@/lib/ai/auth";
import { AiRequestError } from "@/lib/ai/query";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";

export { AiRequestError, parseAiQuery } from "@/lib/ai/query";
export type { AiPeriod, AiQuery } from "@/lib/ai/query";

function json(body: unknown, status: number, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      // Data bisnis: jangan pernah di-cache proxy bersama.
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      Vary: "Authorization",
      ...headers,
    },
  });
}

export async function aiErrorResponse(error: unknown) {
  if (error instanceof AiRequestError) {
    return json({ error: { code: "invalid_request", message: error.message } }, error.status);
  }
  console.error("[ai-api] unhandled error", error);
  return json(
    { error: { code: "internal_error", message: "Permintaan gagal diproses. Coba lagi atau hubungi admin." } },
    500,
  );
}

async function recordEvent(input: {
  tokenId: string | null;
  endpoint: string;
  params: string | null;
  statusCode: number;
  startedAt: number;
}) {
  try {
    await getPrismaClient().aiApiEvent.create({
      data: {
        tokenId: input.tokenId,
        endpoint: input.endpoint.slice(0, 120),
        params: input.params?.slice(0, 500) ?? null,
        statusCode: input.statusCode,
        durationMs: Math.max(Math.round(performance.now() - input.startedAt), 0),
      },
    });
  } catch (error) {
    // Audit tidak boleh menjatuhkan permintaan baca.
    console.error("[ai-api] gagal menulis audit", error);
  }
}

/**
 * Gerbang tunggal seluruh jalur AI: token → rate limit → handler → audit.
 * Semua jalur hanya membaca; tidak ada endpoint tulis di bawah /api/ai.
 */
export async function withAiAccess(
  request: Request,
  endpoint: string,
  handler: (context: { token: AiApiToken; params: string | null }) => Promise<Response>,
  options?: { params?: string | null },
): Promise<Response> {
  const startedAt = performance.now();
  const search = new URL(request.url).searchParams;
  // Parameter yang dicatat tidak memuat header/token, hanya kueri analitik.
  const params = options?.params ?? (search.toString() ? search.toString() : null);

  const auth = await authenticateAiToken(request);
  if (!auth.ok) {
    await recordEvent({ tokenId: null, endpoint, params, statusCode: auth.status, startedAt });
    return json(
      { error: { code: auth.code, message: auth.message } },
      auth.status,
      auth.status === 401 ? { "WWW-Authenticate": 'Bearer realm="askonveksi-ai"' } : undefined,
    );
  }

  const limit = await checkAiRateLimit(auth.token.id);
  if (!limit.ok) {
    await recordEvent({ tokenId: auth.token.id, endpoint, params, statusCode: 429, startedAt });
    return json(
      { error: { code: "rate_limited", message: "Terlalu banyak permintaan. Coba lagi dalam satu menit." } },
      429,
      { "Retry-After": "60" },
    );
  }

  let response: Response;
  try {
    response = await handler({ token: auth.token, params });
    response.headers.set("X-RateLimit-Remaining", String(limit.remaining));
  } catch (error) {
    response = await aiErrorResponse(error);
  }

  await recordEvent({
    tokenId: auth.token.id,
    endpoint,
    params,
    statusCode: response.status,
    startedAt,
  });
  return response;
}

export function aiJsonResponse(body: unknown, status = 200) {
  return json(body, status);
}
