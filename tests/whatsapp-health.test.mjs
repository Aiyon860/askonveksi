import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";
import { classifyWhatsAppHealth, classifyWhatsAppHealthBanner, whatsappHealthChanged } from "../lib/whatsapp/health.ts";

const now = new Date("2026-09-10T12:00:00.000Z");
const account = (status, heartbeatAt = now) => ({ status, heartbeatAt });

test("health WhatsApp mengklasifikasikan seluruh kondisi akun", () => {
  assert.equal(classifyWhatsAppHealth(null, now), "NOT_CONFIGURED");
  assert.equal(classifyWhatsAppHealth({ ...account("CONNECTED"), sendEnabled: false }, now), "NOT_CONFIGURED");
  assert.equal(classifyWhatsAppHealth(account("CONNECTED", new Date(now.getTime() - 30_001)), now), "WORKER_OFFLINE");
  assert.equal(classifyWhatsAppHealth(account("DISCONNECTED"), now), "DISCONNECTED");
  assert.equal(classifyWhatsAppHealth(account("LOGGED_OUT"), now), "LOGGED_OUT");
  assert.equal(classifyWhatsAppHealth(account("ERROR"), now), "ERROR");
  assert.equal(classifyWhatsAppHealth(account("CONNECTED"), now), "HEALTHY");
  assert.equal(classifyWhatsAppHealth(account("PAIRING", null), now), "HEALTHY");
});

test("perubahan health hanya memberi notifikasi setelah status awal diketahui", () => {
  assert.equal(whatsappHealthChanged(null, "DISCONNECTED"), false);
  assert.equal(whatsappHealthChanged("DISCONNECTED", "DISCONNECTED"), false);
  assert.equal(whatsappHealthChanged("DISCONNECTED", "HEALTHY"), true);
});

test("banner hilang hanya ketika koneksi sehat dan tidak ada job gagal", () => {
  assert.equal(classifyWhatsAppHealthBanner("WORKER_OFFLINE", 0), "CONNECTION");
  assert.equal(classifyWhatsAppHealthBanner("DISCONNECTED", 2), "CONNECTION");
  assert.equal(classifyWhatsAppHealthBanner("HEALTHY", 2), "FAILED_JOBS");
  assert.equal(classifyWhatsAppHealthBanner("HEALTHY", 0), null);
});

test("endpoint membatasi data berdasarkan sesi dan pemilik job", async () => {
  const source = await readFile(new URL("../app/api/whatsapp/health/route.ts", import.meta.url), "utf8");
  assert.match(source, /if \(!actor\).*status: 401/);
  assert.match(source, /message: \{ is: \{ sentById: actor\.id \} \}/);
  assert.match(source, /manager \? safeError\(account\.lastError\) : null/);
});

test("toast flash dideduplikasi lintas pemasangan PageMessage", async () => {
  const source = await readFile(new URL("../components/flash-message-alert.tsx", import.meta.url), "utf8");
  assert.match(source, /sessionStorage\.getItem\(key\)/);
  assert.match(source, /sessionStorage\.setItem\(key, "shown"\)/);
});
