import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { AiApiToken } from "@prisma/client";

import { getPrismaClient } from "@/lib/prisma";

/**
 * Token akses AI.
 *
 * Token asli hanya muncul sekali saat dibuat; database menyimpan hash SHA-256
 * (opsional dicampur `AI_TOKEN_PEPPER`). Panjang 32 byte acak membuat tebakan
 * hash tidak mungkin, jadi pepper hanya lapisan tambahan bila env diisi.
 */
const TOKEN_PREFIX = "askai_";
const TOKEN_PATTERN = /^askai_[A-Za-z0-9_-]{20,120}$/;

export function hashAiToken(token: string) {
  const pepper = process.env.AI_TOKEN_PEPPER ?? "";
  return createHash("sha256").update(`${pepper}:${token}`).digest("hex");
}

export function generateAiToken() {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/** 8 karakter pertama setelah prefiks, untuk ditampilkan di daftar token. */
export function aiTokenHint(token: string) {
  return token.slice(0, TOKEN_PREFIX.length + 6);
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const [scheme, value] = authorization.split(" ");
    if (scheme?.toLowerCase() === "bearer" && value) return value.trim();
  }
  // Klien MCP/HTTP terkadang hanya mengirim header khusus.
  return request.headers.get("x-api-key")?.trim() ?? null;
}

export type AiAuthFailure = {
  ok: false;
  status: 401 | 403;
  code: "unauthorized" | "invalid_token" | "token_expired" | "token_revoked";
  message: string;
};

export type AiAuthSuccess = { ok: true; token: AiApiToken };

export type AiAuthResult = AiAuthSuccess | AiAuthFailure;

export async function authenticateAiToken(request: Request): Promise<AiAuthResult> {
  const raw = bearerToken(request);
  if (!raw) {
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      message: "Sertakan header Authorization: Bearer <token>.",
    };
  }
  if (!TOKEN_PATTERN.test(raw)) {
    return { ok: false, status: 401, code: "invalid_token", message: "Format token tidak dikenali." };
  }

  const prisma = getPrismaClient();
  const token = await prisma.aiApiToken.findUnique({ where: { tokenHash: hashAiToken(raw) } });
  if (!token) {
    return { ok: false, status: 401, code: "invalid_token", message: "Token tidak valid." };
  }
  if (token.revokedAt) {
    return { ok: false, status: 403, code: "token_revoked", message: "Token sudah dicabut." };
  }
  if (token.expiresAt && token.expiresAt.getTime() <= Date.now()) {
    return { ok: false, status: 403, code: "token_expired", message: "Token sudah kedaluwarsa." };
  }

  // Catat pemakaian terakhir tanpa menahan respons; kegagalan update tidak
  // boleh menggagalkan permintaan baca.
  void prisma.aiApiToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { ok: true, token };
}
