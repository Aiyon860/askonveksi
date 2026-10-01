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

test("Admin Customer mengelola akun WhatsApp tanpa mendapat akses Data Master", async () => {
  const [permissions, actions, data, nav, monitor] = await Promise.all([
    readFile(new URL("../lib/auth/permissions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/actions/whatsapp.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/whatsapp/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/app-nav.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/whatsapp-health-monitor.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(permissions, /WHATSAPP_ACCOUNT_MANAGER_ROLES = \["ADMIN_CUSTOMER"\]/);
  assert.equal(actions.match(/requireActor\(WHATSAPP_ACCOUNT_MANAGER_ROLES\)/g)?.length, 5);
  assert.match(data, /requireActor\(WHATSAPP_ACCOUNT_MANAGER_ROLES\)/);
  assert.match(nav, /<span>WhatsApp<\/span>/);
  assert.match(nav, /label: "Kotak Masuk"/);
  assert.match(nav, /label: "Template Pesan"/);
  assert.match(nav, /label: "Akun & Koneksi"/);
  assert.doesNotMatch(nav, /href: "\/master-data\/whatsapp\/accounts", label: "Account WhatsApp"/);
  assert.match(monitor, /WHATSAPP_ACCOUNT_MANAGER_ROLES/);
});

test("logout membersihkan pemicu pairing agar status tidak mental kembali", async () => {
  const [actions, worker] = await Promise.all([
    readFile(new URL("../app/actions/whatsapp.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/whatsapp.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(actions, /disconnectWhatsAppAccountAction[\s\S]*?connectRequestedAt: null/);
  assert.match(worker, /status !== "LOGGED_OUT" && \(account\.connectRequestedAt/);
});

test("hapus nomor hanya menandai flag; worker menghapus bertahap di latar", async () => {
  const [actions, worker, monitor] = await Promise.all([
    readFile(new URL("../app/actions/whatsapp.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/whatsapp.mjs", import.meta.url), "utf8"),
    readFile(new URL("../components/whatsapp-deletion-monitor.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(actions, /deleteWhatsAppAccountAction[\s\S]*?deleteRequestedAt: new Date\(\)/);
  assert.doesNotMatch(actions, /whatsAppAccount\.delete\(/);
  assert.match(worker, /processAccountDeletion/);
  assert.match(worker, /take: 500/);
  assert.match(monitor, /toast\.add\(\{ title: "Penghapusan selesai"/);
});

test("toast flash dideduplikasi lintas pemasangan PageMessage", async () => {
  const source = await readFile(new URL("../components/flash-message-alert.tsx", import.meta.url), "utf8");
  assert.match(source, /sessionStorage\.getItem\(key\)/);
  assert.match(source, /sessionStorage\.setItem\(key, "shown"\)/);
});
