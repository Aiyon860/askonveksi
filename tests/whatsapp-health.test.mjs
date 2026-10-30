import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";
import { classifyWhatsAppHealth, describeWhatsAppHealth, isWhatsAppConnected } from "../lib/whatsapp/health.ts";
import { canAccessWhatsAppInbox } from "../lib/whatsapp/access.ts";

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

test("hanya status HEALTHY yang dianggap terhubung", () => {
  assert.equal(isWhatsAppConnected("HEALTHY"), true);
  for (const state of ["NOT_CONFIGURED", "WORKER_OFFLINE", "DISCONNECTED", "LOGGED_OUT", "ERROR"]) {
    assert.equal(isWhatsAppConnected(state), false);
  }
});

test("DEVELOPER tetap melihat grup WhatsApp beserta statusnya", () => {
  assert.equal(canAccessWhatsAppInbox("DEVELOPER"), true);
  assert.equal(canAccessWhatsAppInbox("OWNER"), true);
  assert.equal(canAccessWhatsAppInbox("ADMIN_CUSTOMER"), true);
  assert.equal(canAccessWhatsAppInbox("DESIGNER"), false);
});

test("setiap kondisi punya penjelasan untuk tooltip status", () => {
  assert.match(describeWhatsAppHealth("HEALTHY"), /terhubung/);
  assert.match(describeWhatsAppHealth("NOT_CONFIGURED"), /Belum ada nomor/);
  assert.match(describeWhatsAppHealth("WORKER_OFFLINE"), /heartbeat/);
  assert.match(describeWhatsAppHealth("DISCONNECTED"), /terputus/);
  assert.match(describeWhatsAppHealth("LOGGED_OUT"), /logout/);
  assert.match(describeWhatsAppHealth("ERROR"), /kendala/);
});

test("endpoint membatasi data berdasarkan sesi dan pemilik job", async () => {
  const source = await readFile(new URL("../app/api/whatsapp/health/route.ts", import.meta.url), "utf8");
  assert.match(source, /if \(!actor\).*status: 401/);
  assert.match(source, /message: \{ is: \{ sentById: actor\.id \} \}/);
  assert.match(source, /manager \? safeError\(account\.lastError\) : null/);
  assert.match(source, /whatsAppAutomationJob\.count\(\{/);
});

test("status WhatsApp dipantau dari judul menu, bukan banner di setiap halaman", async () => {
  const [nav, monitor, shell] = await Promise.all([
    readFile(new URL("../components/app-nav.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/whatsapp-health-monitor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/app-shell.tsx", import.meta.url), "utf8"),
  ]);

  // Polling status hidup di navigasi dan hanya berjalan saat grup WhatsApp tampil.
  assert.match(nav, /const WHATSAPP_STATUS_POLL_MS = 10_000/);
  assert.match(nav, /enabled \? "\/api\/whatsapp\/health" : null/);
  assert.match(nav, /refreshInterval: WHATSAPP_STATUS_POLL_MS/);
  assert.match(nav, /connected \? "Connect" : "Disconnect"/);
  assert.match(nav, /text-nav-status-connected/);
  assert.match(nav, /text-nav-status-disconnected/);
  assert.match(nav, /<WhatsAppStatusChip enabled=\{canViewWhatsAppInbox\} \/>/);

  // Banner danger lama sudah tidak dirender, dan monitor hanya mengurus job manual.
  assert.doesNotMatch(monitor, /WhatsApp perlu perhatian/);
  assert.doesNotMatch(monitor, /<Alert/);
  assert.match(monitor, /Pesan WhatsApp terkirim/);
  assert.match(monitor, /timer = setTimeout\(schedule, 10_000\)/);
  assert.match(shell, /<WhatsAppHealthMonitor \/>/);
  assert.doesNotMatch(shell, /<WhatsAppHealthMonitor role=/);
});

test("Admin Customer mengelola akun WhatsApp tanpa mendapat akses Data Master", async () => {
  const [permissions, actions, data, nav] = await Promise.all([
    readFile(new URL("../lib/auth/permissions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/actions/whatsapp.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/whatsapp/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/app-nav.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(permissions, /WHATSAPP_ACCOUNT_MANAGER_ROLES = \["ADMIN_CUSTOMER"\]/);
  assert.equal(actions.match(/requireActor\(WHATSAPP_ACCOUNT_MANAGER_ROLES\)/g)?.length, 5);
  assert.match(data, /requireActor\(WHATSAPP_ACCOUNT_MANAGER_ROLES\)/);
  assert.match(nav, /<span>WhatsApp<\/span>/);
  assert.match(nav, /label: "Kotak Masuk"/);
  assert.match(nav, /label: "Template Pesan"/);
  assert.match(nav, /label: "Akun & Koneksi"/);
  assert.doesNotMatch(nav, /href: "\/master-data\/whatsapp\/accounts", label: "Account WhatsApp"/);
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
