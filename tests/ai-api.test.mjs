import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { register } from "node:module";
import test from "node:test";

register(new URL("./helpers/cms-loader.mjs", import.meta.url));

const { aiTokenHint, generateAiToken, hashAiToken } = await import("../lib/ai/auth.ts");
const { AiRequestError, parseAiQuery } = await import("../lib/ai/query.ts");

test("token AI dibuat acak, berprefiks, dan hanya hash yang disimpan", () => {
  const first = generateAiToken();
  const second = generateAiToken();

  assert.match(first, /^askai_[A-Za-z0-9_-]{40,}$/);
  assert.notEqual(first, second);
  assert.equal(aiTokenHint(first), first.slice(0, 12));

  const hash = hashAiToken(first);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hashAiToken(first), hash, "hash harus deterministik agar lookup berhasil");
  assert.notEqual(hash, first);
  assert.notEqual(hash, hashAiToken(second));
});

test("pepper token mengubah hash sehingga env bocor saja tidak cukup", () => {
  const token = generateAiToken();
  const before = hashAiToken(token);
  process.env.AI_TOKEN_PEPPER = "rahasia-uji";
  const withPepper = hashAiToken(token);
  delete process.env.AI_TOKEN_PEPPER;

  assert.notEqual(before, withPepper);
  assert.equal(hashAiToken(token), before);
});

test("parameter API AI divalidasi dan limit dibatasi", () => {
  const defaults = parseAiQuery(new URLSearchParams());
  assert.equal(defaults.brand, "ASKONVEKSI");
  assert.equal(defaults.range.preset, "30d");
  assert.equal(defaults.limit, 10);
  assert.equal(defaults.granularity, "month");
  assert.equal(defaults.groupBy, "city");

  assert.equal(parseAiQuery(new URLSearchParams("brand=ALL")).brand, "ALL");
  assert.equal(parseAiQuery(new URLSearchParams("brand=saga")).brand, "SAGA");
  // Brand tak dikenal jatuh ke default, bukan membocorkan kedua brand.
  assert.equal(parseAiQuery(new URLSearchParams("brand=LAINNYA")).brand, "ASKONVEKSI");

  assert.equal(parseAiQuery(new URLSearchParams("limit=500")).limit, 50);
  assert.equal(parseAiQuery(new URLSearchParams("limit=0")).limit, 1);
  assert.equal(parseAiQuery(new URLSearchParams("granularity=week")).granularity, "week");
  assert.equal(parseAiQuery(new URLSearchParams("groupBy=source")).groupBy, "source");
});

test("periode API AI menolak input ambigu tanpa merusak permintaan valid", () => {
  assert.throws(() => parseAiQuery(new URLSearchParams("preset=kemarin")), AiRequestError);
  assert.throws(() => parseAiQuery(new URLSearchParams("from=2026-01-01")), AiRequestError);
  assert.throws(() => parseAiQuery(new URLSearchParams("from=01-01-2026&to=2026-02-01")), AiRequestError);
  assert.throws(() => parseAiQuery(new URLSearchParams("granularity=year")), AiRequestError);

  const custom = parseAiQuery(new URLSearchParams("from=2026-01-01&to=2026-03-31"));
  assert.equal(custom.range.start?.toISOString(), "2025-12-31T17:00:00.000Z");
  assert.equal(custom.range.preset, "custom");
});

test("seluruh endpoint AI memakai gerbang token dan hanya membaca", async () => {
  const entries = await readdir(new URL("../app/api/ai", import.meta.url), { recursive: true });
  const routes = entries.filter((entry) => entry.endsWith("route.ts"));
  assert.ok(routes.length >= 6, "katalog + lima endpoint analitik harus ada");

  for (const route of routes) {
    const source = await readFile(new URL(`../app/api/ai/${route}`, import.meta.url), "utf8");
    assert.match(source, /withAiAccess\(/, `${route} wajib melewati gerbang token`);
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/, `${route} tidak boleh menulis`);
  }

  const mcpRoute = await readFile(new URL("../app/api/mcp/route.ts", import.meta.url), "utf8");
  assert.match(mcpRoute, /withAiAccess\(/);
  assert.match(mcpRoute, /enableJsonResponse: true/);
  assert.match(mcpRoute, /sessionIdGenerator: undefined/);
});

test("tool MCP lengkap dan definisinya menyebut batas privasi", async () => {
  const [mcpSource, analyticsSource, catalogSource] = await Promise.all([
    readFile(new URL("../lib/ai/mcp.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/ai/analytics.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/ai/catalog.ts", import.meta.url), "utf8"),
  ]);

  for (const tool of [
    "analytics_catalog",
    "sales_overview",
    "top_products",
    "customer_breakdown",
    "revenue_trend",
    "pipeline_status",
  ]) {
    assert.match(mcpSource, new RegExp(`registerTool\\(\\s*"${tool}"`), `tool ${tool} harus terdaftar`);
  }

  // Nama customer disamarkan; tidak ada kolom pribadi yang ikut terkirim.
  assert.match(analyticsSource, /nameMasked/);
  assert.match(analyticsSource, /function maskName/);
  assert.doesNotMatch(analyticsSource, /snapshotWhatsapp|snapshotEmail|snapshotAddress/);
  assert.doesNotMatch(analyticsSource, /\.whatsapp\b/);

  // Katalog menjelaskan skema auth + batas privasi agar AI tidak salah pakai.
  assert.match(catalogSource, /nomor WhatsApp, email, alamat/);
  assert.match(catalogSource, /requestsPerMinute/);
});

test("audit dan rate limit tidak boleh menjatuhkan permintaan baca", async () => {
  const [httpSource, rateLimitSource] = await Promise.all([
    readFile(new URL("../lib/ai/http.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/ai/rate-limit.ts", import.meta.url), "utf8"),
  ]);

  assert.match(httpSource, /catch \(error\) \{\n\s+\/\/ Audit tidak boleh menjatuhkan permintaan baca\./);
  assert.match(httpSource, /code: "rate_limited"/);
  assert.match(httpSource, /\n\s+429,/);
  assert.match(httpSource, /"Retry-After": "60"/);
  assert.match(httpSource, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.match(rateLimitSource, /ai:\$\{tokenId\}/);
});
