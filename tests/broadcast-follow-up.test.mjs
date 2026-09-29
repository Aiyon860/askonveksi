import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("halaman Broadcast menggantikan UI follow-up lama dengan tabel pilihan customer", async () => {
  const [page, table, nav] = await Promise.all([
    read("app/(app)/crm/follow-up/page.tsx"),
    read("components/crm/broadcast-table.tsx"),
    read("components/app-nav.tsx"),
  ]);

  assert.match(page, /title="Broadcast"/);
  assert.doesNotMatch(page, /bucket/i);
  assert.doesNotMatch(page, /Follow-up/);
  assert.match(nav, /\{ href: "\/crm\/follow-up", label: "Broadcast", icon: CalendarClock \}/);

  assert.match(table, /aria-label="Pilih semua customer/);
  assert.match(table, /indeterminate=\{someSelected\}/);
  assert.match(table, /Tanggal Terakhir Order/);
  assert.match(table, /Memuat customer/);
});

test("kartu Follow Up Hari Ini memuat filter ala dialog Pilih Customer dan pesan kustom", async () => {
  const [workspace, content, table] = await Promise.all([
    read("components/crm/broadcast-workspace.tsx"),
    read("components/crm/broadcast-content.tsx"),
    read("components/crm/broadcast-table.tsx"),
  ]);

  assert.match(content, /getBroadcastRecipientOptions\(\{\}\)/);
  assert.match(content, /getFollowUpTemplateBody/);

  assert.match(workspace, /xl:grid-cols-\[minmax\(0,1fr\)/);
  assert.match(workspace, /<CardTitle>Follow Up Hari Ini<\/CardTitle>/);
  assert.match(workspace, /name="customerIds"/);
  assert.match(workspace, /name="message"/);
  assert.match(workspace, /maxLength=\{4000\}/);
  assert.match(workspace, /Kirim Pesan/);
  assert.match(workspace, /Hapus semua pilihan/);
  assert.match(workspace, /getBroadcastRecipientsAction/);
  assert.match(workspace, /sendTodayFollowUpBroadcastAction/);
  assert.match(workspace, /Tanggal dari/);
  assert.match(workspace, /Tanggal ke/);
  assert.match(workspace, /Kategori Customer/);
  assert.match(workspace, /Kategori Order/);
  assert.match(workspace, /RecipientPagination/);
  assert.match(workspace, /allRows=\{rows\}/);
  assert.doesNotMatch(workspace, /Kategori Produk/);

  assert.doesNotMatch(table, /name="customerIds"/);
});

test("komponen follow-up lama sudah tidak ada lagi", async () => {
  await assert.rejects(read("components/crm/follow-up-content.tsx"));
  await assert.rejects(read("components/crm/follow-up-result-form.tsx"));
});

test("Follow Up Hari Ini hanya mengirim ke customer terpilih dengan guard WhatsApp", async () => {
  const action = await read("app/actions/broadcast.ts");

  assert.match(action, /requireActor\(WHATSAPP_ACCOUNT_MANAGER_ROLES\)/);
  assert.match(action, /getAll\("customerIds"\)/);
  assert.match(action, /Pilih minimal satu customer/);
  assert.match(action, /archivedAt: null/);
  assert.match(action, /whatsapp: \{ not: null \}/);
  assert.match(action, /whatsappConsentStatus: \{ not: "OPTED_OUT" \}/);
  assert.match(action, /enqueueManualWhatsAppMessage/);
  assert.match(action, /FOLLOW_UP_BROADCAST_QUEUED/);
  assert.match(action, /MAX_BROADCAST_RECIPIENTS/);
  assert.doesNotMatch(action, /orderReminderEnabled: true/);
});

test("pesan broadcast memakai isi form, fallback ke template bawaan bila kosong", async () => {
  const action = await read("app/actions/broadcast.ts");

  assert.match(action, /formData\.get\("message"\)/);
  assert.match(action, /MAX_BROADCAST_MESSAGE_LENGTH/);
  assert.match(action, /unknownTemplateVariables/);
  assert.match(action, /Variabel template tidak dikenal/);
  assert.match(action, /const templateBody = message \|\| followUpTemplateBody/);
  assert.match(action, /getFollowUpTemplateBody/);
  assert.match(action, /recipientFilterSchema\.safeParse/);
  assert.match(action, /getBroadcastRecipientOptions\(parsed\.data\)/);
  assert.match(action, /changedFields: \["customerIds", "message"\]/);
});

test("default Repeat Order customer baru Off dan migrasi mematikan customer lama", async () => {
  const [schema, migration] = await Promise.all([
    read("prisma/schema.prisma"),
    read("prisma/migrations/20260927020000_repeat_order_default_off/migration.sql"),
  ]);

  assert.match(schema, /orderReminderEnabled\s+Boolean\s+@default\(false\)/);
  assert.match(migration, /ALTER TABLE "Customer" ALTER COLUMN "orderReminderEnabled" SET DEFAULT false;/);
  assert.match(migration, /UPDATE "Customer" SET "orderReminderEnabled" = false WHERE "orderReminderEnabled" = true;/);
});

test("worker tetap memblokir reminder otomatis untuk customer Repeat Order Off", async () => {
  const worker = await read("worker/whatsapp.mjs");

  assert.match(worker, /whatsappConsentStatus: \{ not: "OPTED_OUT" \}, orderReminderEnabled: true/);
  assert.match(worker, /reminder\.customer\.orderReminderEnabled/);
});
