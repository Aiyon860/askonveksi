import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { aiBaseUrl } from "@/lib/ai/catalog";
import { authenticateAiToken } from "@/lib/ai/auth";

/**
 * OAuth 2.1 tipuan untuk konektor Claude/ChatGPT: user menempel token `askai_…`,
 * lalu access_token yang dikeluarkan adalah token itu sendiri. Cursor/Gemini
 * tetap bisa memakai Bearer langsung tanpa alur ini.
 */

const CODE_TTL_SEC = 5 * 60;
const REFRESH_TTL_SEC = 90 * 24 * 60 * 60;

type SignedEnvelope<T> = { v: 1; exp: number; payload: T; sig: string };

function signingKey() {
  const explicit =
    process.env.AI_MCP_OAUTH_SECRET?.trim() || process.env.AI_TOKEN_PEPPER?.trim();
  if (explicit && explicit.length >= 16) return explicit;
  const db = process.env.DATABASE_URL?.trim();
  if (db) return createHash("sha256").update(`askonveksi-mcp-oauth:${db}`).digest("hex");
  // shortcut: lokal tanpa secret; ganti AI_MCP_OAUTH_SECRET di produksi bila DATABASE_URL tidak stabil
  return "askonveksi-mcp-oauth-dev-only";
}

function b64url(buf: Buffer | string) {
  return Buffer.from(buf)
    .toString("base64url");
}

function signPayload<T>(payload: T, ttlSec: number) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const body = b64url(JSON.stringify({ v: 1, exp, payload }));
  const sig = createHmac("sha256", signingKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyPayload<T>(token: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", signingKey()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedEnvelope<T>;
    if (parsed.v !== 1 || typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function mcpResourceUrl() {
  return `${aiBaseUrl()}/api/mcp`;
}

export function mcpIssuerUrl() {
  return aiBaseUrl();
}

export function mcpWwwAuthenticate() {
  const metadata = `${aiBaseUrl()}/.well-known/oauth-protected-resource/api/mcp`;
  return `Bearer FAKESECRET_g3h4i5j6k7l8m9n0o1p2="${metadata}", scope="ai:read"`;
}

export function protectedResourceMetadata() {
  return {
    resource: mcpResourceUrl(),
    authorization_servers: [mcpIssuerUrl()],
    scopes_supported: ["ai:read"],
    bearer_methods_supported: ["header"],
    resource_documentation: `${aiBaseUrl()}/admin/ai-access`,
  };
}

export function authorizationServerMetadata() {
  const base = aiBaseUrl();
  return {
    issuer: mcpIssuerUrl(),
    authorization_endpoint: `${base}/api/mcp/oauth/authorize`,
    token_endpoint: `${base}/api/mcp/oauth/token`,
    registration_endpoint: `${base}/api/mcp/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["ai:read"],
    client_id_metadata_document_supported: true,
    // ChatGPT/Codex: RFC 9207 — wajib agar redirect stabil + validasi iss.
    authorization_response_iss_parameter_supported: true,
  };
}

function isAllowedRedirectUri(uri: string) {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") return true;
  // Claude Code / Cursor / Gemini lokal: http://127.0.0.1:<port>/... atau localhost
  if (parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")) {
    return true;
  }
  return false;
}

/** Claude Code: redirect CIMD tanpa port harus cocok dengan http://localhost:<ephemeral>/callback. */
function redirectUriMatches(registered: string, actual: string) {
  if (registered === actual) return true;
  let a: URL;
  let b: URL;
  try {
    a = new URL(registered);
    b = new URL(actual);
  } catch {
    return false;
  }
  const loopback =
    (a.hostname === "localhost" || a.hostname === "127.0.0.1") &&
    (b.hostname === "localhost" || b.hostname === "127.0.0.1");
  if (!loopback) return false;
  return a.protocol === b.protocol && a.pathname === b.pathname && a.search === b.search;
}

export type RegisteredClient = {
  redirect_uris: string[];
  client_name?: string;
};

export function registerClient(input: {
  redirect_uris?: string[];
  client_name?: string;
  token_endpoint_auth_method?: string;
}) {
  const redirect_uris = (input.redirect_uris ?? []).filter((u) => typeof u === "string" && isAllowedRedirectUri(u));
  if (redirect_uris.length === 0) {
    return { error: "invalid_client_metadata", error_description: "redirect_uris https (atau localhost) wajib." };
  }
  const client_id = signPayload<RegisteredClient>(
    { redirect_uris, client_name: input.client_name?.slice(0, 120) },
    365 * 24 * 60 * 60,
  );
  return {
    client_id,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    token_endpoint_auth_method: "none",
    redirect_uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    client_name: input.client_name?.slice(0, 120),
  };
}

function resolveClient(clientId: string): RegisteredClient | null {
  // CIMD: client_id adalah URL metadata
  if (/^https:\/\//i.test(clientId)) {
    return { redirect_uris: [] }; // redirect dicek longgar lewat isAllowedRedirectUri saja
  }
  return verifyPayload<RegisteredClient>(clientId);
}

function pkceS256(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export type AuthorizeQuery = {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  state?: string;
  code_challenge: string;
  code_challenge_method: string;
  scope?: string;
};

export function parseAuthorizeQuery(url: URL): { ok: true; data: AuthorizeQuery } | { ok: false; message: string } {
  const response_type = url.searchParams.get("response_type") ?? "";
  const client_id = url.searchParams.get("client_id") ?? "";
  const redirect_uri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state") ?? undefined;
  const code_challenge = url.searchParams.get("code_challenge") ?? "";
  const code_challenge_method = url.searchParams.get("code_challenge_method") ?? "";
  const scope = url.searchParams.get("scope") ?? undefined;

  if (response_type !== "code") return { ok: false, message: "response_type harus code." };
  if (!client_id) return { ok: false, message: "client_id wajib." };
  if (!redirect_uri || !isAllowedRedirectUri(redirect_uri)) {
    return { ok: false, message: "redirect_uri tidak diizinkan." };
  }
  if (!code_challenge || code_challenge_method !== "S256") {
    return { ok: false, message: "PKCE S256 wajib (code_challenge + code_challenge_method=S256)." };
  }

  const client = resolveClient(client_id);
  if (!client) return { ok: false, message: "client_id tidak valid." };
  if (
    client.redirect_uris.length > 0 &&
    !client.redirect_uris.some((registered) => redirectUriMatches(registered, redirect_uri))
  ) {
    return { ok: false, message: "redirect_uri tidak terdaftar untuk klien ini." };
  }

  return {
    ok: true,
    data: { response_type, client_id, redirect_uri, state, code_challenge, code_challenge_method, scope },
  };
}

const pageCss = `
    body{font-family:ui-sans-serif,system-ui,sans-serif;background:#0f1419;color:#e7ecf1;margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
    main{width:min(420px,100%);background:#1a222c;border:1px solid #2c3642;border-radius:12px;padding:24px}
    h1{font-size:1.15rem;margin:0 0 8px}
    p{margin:0 0 16px;color:#9aa7b5;font-size:.95rem;line-height:1.45}
    label{display:block;font-size:.85rem;margin-bottom:6px}
    input[type=password],input[type=text]{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #3a4654;background:#0f1419;color:#e7ecf1}
    button{margin-top:14px;width:100%;padding:11px 14px;border:0;border-radius:8px;background:#e8c07a;color:#1a1408;font-weight:600;cursor:pointer}
    button:disabled{opacity:.7;cursor:wait}
    a{color:#e8c07a}
    .err{background:#3a1d1d;color:#ffb4b4;border:1px solid #5c2b2b;padding:10px 12px;border-radius:8px;margin-bottom:14px;font-size:.9rem}
    .meta{font-size:.8rem;color:#7d8b99;word-break:break-all}
`;

export function renderAuthorizePage(query: AuthorizeQuery, error?: string) {
  const fields = [
    ["response_type", query.response_type],
    ["client_id", query.client_id],
    ["redirect_uri", query.redirect_uri],
    ["code_challenge", query.code_challenge],
    ["code_challenge_method", query.code_challenge_method],
    ...(query.state ? [["state", query.state] as const] : []),
    ...(query.scope ? [["scope", query.scope] as const] : []),
  ];
  const hidden = fields
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`,
    )
    .join("\n");
  const action = `${aiBaseUrl()}/api/mcp/oauth/authorize`;

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hubungkan Askonveksi MCP</title>
  <style>${pageCss}</style>
</head>
<body>
  <main>
    <h1>Askonveksi Sales Analytics</h1>
    <p>Tempel token AI (<code>askai_…</code>) dari Pengaturan → Akses AI. Setelah diizinkan, jendela ini mengembalikan ke Cursor/Claude.</p>
    <p class="meta">Kembali ke: ${escapeHtml(query.redirect_uri)}</p>
    ${error ? `<div class="err">${escapeHtml(error)}</div>` : ""}
    <form method="post" action="${escapeHtml(action)}" autocomplete="off"
      onsubmit="var b=this.querySelector('button'); b.disabled=true; b.textContent='Menghubungkan…';">
      ${hidden}
      <label for="api_key">Token AI</label>
      <input id="api_key" name="api_key" type="password" required minlength="20" placeholder="askai_…" autofocus />
      <button type="submit">Izinkan akses baca</button>
    </form>
  </main>
</body>
</html>`;
}

/**
 * Jangan pakai 302 mentah ke http://localhost: browser sering menelan
 * redirect HTTPS→HTTP tanpa pesan. Halaman ini + JS + tautan manual lebih andal.
 */
export function renderAuthorizeSuccessPage(redirectUrl: string) {
  const safe = escapeHtml(redirectUrl);
  const jsUrl = JSON.stringify(redirectUrl);
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0;url=${safe}" />
  <title>Mengembalikan ke klien</title>
  <style>${pageCss}</style>
  <script>location.replace(${jsUrl});</script>
</head>
<body>
  <main>
    <h1>Token diterima</h1>
    <p>Mengembalikan ke Cursor/Claude… Jika jendela tidak berpindah, klik tautan di bawah (biarkan Cursor tetap terbuka).</p>
    <p><a href="${safe}">Lanjutkan sambungan MCP</a></p>
  </main>
</body>
</html>`;
}

type AuthCodePayload = {
  token: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
};

type RefreshPayload = { token: string };

export async function completeAuthorize(form: URLSearchParams) {
  const url = new URL("https://local.invalid/api/mcp/oauth/authorize");
  for (const key of [
    "response_type",
    "client_id",
    "redirect_uri",
    "state",
    "code_challenge",
    "code_challenge_method",
    "scope",
  ]) {
    const value = form.get(key);
    if (value) url.searchParams.set(key, value);
  }
  const parsed = parseAuthorizeQuery(url);
  if (!parsed.ok) return { ok: false as const, message: parsed.message };

  const apiKey = form.get("api_key")?.trim() ?? "";
  if (!apiKey) return { ok: false as const, message: "Token wajib diisi.", query: parsed.data };

  const auth = await authenticateAiToken(
    new Request(mcpResourceUrl(), { headers: { authorization: `Bearer ${apiKey}` } }),
  );
  if (!auth.ok) {
    return { ok: false as const, message: auth.message, query: parsed.data };
  }

  const code = signPayload<AuthCodePayload>(
    {
      token: apiKey,
      client_id: parsed.data.client_id,
      redirect_uri: parsed.data.redirect_uri,
      code_challenge: parsed.data.code_challenge,
    },
    CODE_TTL_SEC,
  );

  const redirect = new URL(parsed.data.redirect_uri);
  redirect.searchParams.set("code", code);
  if (parsed.data.state) redirect.searchParams.set("state", parsed.data.state);
  // Exact string match dengan metadata `issuer` (tanpa slash di akhir).
  redirect.searchParams.set("iss", mcpIssuerUrl());
  return { ok: true as const, redirect: redirect.toString() };
}

export function exchangeToken(body: URLSearchParams | Record<string, string>) {
  const get = (key: string) =>
    body instanceof URLSearchParams ? body.get(key) ?? "" : String(body[key] ?? "");

  const grantType = get("grant_type");
  if (grantType === "refresh_token") {
    const refresh = verifyPayload<RefreshPayload>(get("refresh_token"));
    if (!refresh?.token) {
      return { status: 400, body: { error: "invalid_grant", error_description: "refresh_token tidak valid." } };
    }
    return {
      status: 200,
      body: {
        access_token: refresh.token,
        token_type: "Bearer",
        expires_in: REFRESH_TTL_SEC,
        refresh_token: signPayload<RefreshPayload>({ token: refresh.token }, REFRESH_TTL_SEC),
        scope: "ai:read",
      },
    };
  }

  if (grantType !== "authorization_code") {
    return { status: 400, body: { error: "unsupported_grant_type" } };
  }

  const code = get("code");
  const redirectUri = get("redirect_uri");
  const clientId = get("client_id");
  const verifier = get("code_verifier");
  const payload = verifyPayload<AuthCodePayload>(code);
  if (!payload) {
    return { status: 400, body: { error: "invalid_grant", error_description: "code tidak valid atau kedaluwarsa." } };
  }
  if (payload.redirect_uri !== redirectUri || payload.client_id !== clientId) {
    return { status: 400, body: { error: "invalid_grant", error_description: "Parameter token tidak cocok." } };
  }
  if (!verifier || pkceS256(verifier) !== payload.code_challenge) {
    return { status: 400, body: { error: "invalid_grant", error_description: "PKCE gagal." } };
  }

  return {
    status: 200,
    body: {
      access_token: payload.token,
      token_type: "Bearer",
      expires_in: REFRESH_TTL_SEC,
      refresh_token: signPayload<RefreshPayload>({ token: payload.token }, REFRESH_TTL_SEC),
      scope: "ai:read",
    },
  };
}
