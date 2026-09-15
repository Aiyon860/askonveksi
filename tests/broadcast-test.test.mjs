import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = await import("../scripts/broadcast-test-config.mjs");
const worker = await readFile(new URL("../worker/whatsapp.mjs", import.meta.url), "utf8");
const devScript = await readFile(new URL("../scripts/broadcast-test-dev.mjs", import.meta.url), "utf8");
const seedScript = await readFile(new URL("../scripts/seed-broadcast-test.mjs", import.meta.url), "utf8");

function withEnv(values, callback) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const localUrl = "postgresql://postgres:postgres@localhost:5432/askonveksi_broadcast_test";

test("broadcast test menolak database non-lokal dan daftar penerima yang tidak tepat", () => {
  withEnv({ DATABASE_URL: localUrl, DIRECT_URL: localUrl }, () => assert.doesNotThrow(config.assertBroadcastTestDatabase));
  withEnv({ DATABASE_URL: "postgresql://postgres:postgres@example.com:5432/askonveksi_broadcast_test", DIRECT_URL: localUrl }, () => assert.throws(config.assertBroadcastTestDatabase));
  withEnv({ DATABASE_URL: localUrl, DIRECT_URL: "postgresql://postgres:postgres@localhost:5432/askonveksi" }, () => assert.throws(config.assertBroadcastTestDatabase));
  withEnv({ BROADCAST_TEST_RECIPIENTS: "081234567890,6281234567891" }, () => assert.deepEqual(config.broadcastTestRecipients(), ["6281234567890", "6281234567891"]));
  withEnv({ BROADCAST_TEST_RECIPIENTS: "6281234567890,6281234567890" }, () => assert.throws(config.broadcastTestRecipients));
});

test("worker membatasi snapshot campaign ke allowlist broadcast test", () => {
  assert.match(worker, /BROADCAST_TEST_RECIPIENTS/);
  assert.match(worker, /campaignRecipientAllowlist\.has\(number\)/);
});

test("seed membuat peluang minimum agar prospek tampil di CRM", () => {
  assert.match(seedScript, /tx\.opportunity\.upsert/);
  assert.match(seedScript, /id: "broadcast-test-opportunity"/);
  assert.match(seedScript, /customerId: "broadcast-test-prospect"/);
  assert.match(seedScript, /stage: "LEAD_BARU"/);
});

test("launcher Next broadcast test memuat environment tanpa flag Node", () => {
  assert.match(devScript, /config\(\{ path: "\.env\.broadcast-test", override: true, quiet: true \}\)/);
  assert.match(devScript, /assertBroadcastTestDatabase\(\)/);
  assert.doesNotMatch(devScript, /--env-file|NODE_OPTIONS/);
});
