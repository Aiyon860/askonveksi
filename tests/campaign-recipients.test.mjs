import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";

import {
  CAMPAIGN_ORDER_CATEGORIES,
  MAX_CAMPAIGN_RECIPIENTS,
  campaignRecipientFilterSchema,
  campaignRecipientSelectionSchema,
} from "../lib/whatsapp/campaigns.ts";
import { ALL_PAGE_SIZE, RECIPIENT_PAGE_SIZES, paginate } from "../lib/pagination.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const campaignId = "cmu0wrmdz0002ulij36mpwbb3";

test("filter penerima campaign hanya menerima kategori order yang dikenal", () => {
  assert.deepEqual(CAMPAIGN_ORDER_CATEGORIES, ["JERSEY", "NON_JERSEY"]);
  assert.equal(campaignRecipientFilterSchema.safeParse({ campaignId }).success, true);
  assert.equal(campaignRecipientFilterSchema.safeParse({ campaignId, orderCategory: "JERSEY", query: "Budi" }).success, true);
  assert.equal(campaignRecipientFilterSchema.safeParse({ campaignId, orderCategory: "KAOS" }).success, false);
  assert.equal(campaignRecipientFilterSchema.safeParse({ campaignId: "short", orderCategory: "JERSEY" }).success, false);
});

test("pilihan penerima campaign dibatasi jumlahnya", () => {
  assert.equal(campaignRecipientSelectionSchema.safeParse({ campaignId, customerIds: [] }).success, true);
  assert.equal(campaignRecipientSelectionSchema.safeParse({ campaignId, customerIds: ["customer-01"] }).success, true);
  const tooMany = Array.from({ length: MAX_CAMPAIGN_RECIPIENTS + 1 }, (_, index) => `customer-${index}`);
  assert.equal(campaignRecipientSelectionSchema.safeParse({ campaignId, customerIds: tooMany }).success, false);
});

test("dialog Pilih Customer memuat search, filter, tabel, dan footer terpilih", async () => {
  const dialog = await read("components/campaigns/campaign-recipient-dialog.tsx");

  assert.match(dialog, />Pilih Customer</);
  assert.match(dialog, /Cari nama customer/);
  assert.match(dialog, /Tanggal dari/);
  assert.match(dialog, /Tanggal ke/);
  assert.match(dialog, /Kategori Customer/);
  assert.match(dialog, /Kategori Order/);
  assert.match(dialog, /Tanggal Terakhir Order/);
  assert.match(dialog, /Customer Terpilih/);
  assert.match(dialog, /Hapus Semua Pilihan/);
  assert.match(dialog, /Batal/);
  assert.match(dialog, /Terapkan/);
  assert.match(dialog, /disabled=\{!canEdit/);
});

test("tabel penerima dan Broadcast memakai paginasi 10, 25, 100, Semuanya", async () => {
  const [dialog, broadcast, pagination] = await Promise.all([
    read("components/campaigns/campaign-recipient-dialog.tsx"),
    read("components/crm/broadcast-workspace.tsx"),
    read("components/recipient-pagination.tsx"),
  ]);

  assert.deepEqual(RECIPIENT_PAGE_SIZES, [10, 25, 100]);
  assert.equal(ALL_PAGE_SIZE, 0);

  for (const source of [dialog, broadcast]) {
    assert.match(source, /RecipientPagination/);
    assert.match(source, /changePageSize/);
    assert.match(source, /paginate\(/);
  }

  assert.match(pagination, /Baris per halaman/);
  assert.match(pagination, /Semuanya/);
  assert.match(pagination, /Ke halaman sebelumnya/);
  assert.match(pagination, /Ke halaman berikutnya/);
});

test("paginate memotong baris per halaman dan mematikan paginasi untuk Semuanya", () => {
  const items = Array.from({ length: 25 }, (_, index) => index);
  const firstPage = paginate(items, 1, 10);
  assert.equal(firstPage.pageCount, 3);
  assert.equal(firstPage.start, 0);
  assert.equal(firstPage.last, 10);
  assert.deepEqual(firstPage.items, items.slice(0, 10));

  const lastPage = paginate(items, 3, 10);
  assert.equal(lastPage.items.length, 5);
  assert.equal(lastPage.first, 21);
  assert.equal(lastPage.last, 25);

  assert.equal(paginate(items, 99, 10).page, 3);

  const all = paginate(items, 5, ALL_PAGE_SIZE);
  assert.equal(all.pageCount, 1);
  assert.equal(all.page, 1);
  assert.equal(all.items.length, 25);
  assert.equal(all.first, 1);
  assert.equal(all.last, 25);
});

test("halaman campaign menyediakan input, aksi, dan ringkasan penerima", async () => {
  const page = await read("app/(app)/campaigns/page.tsx");

  assert.match(page, /CampaignRecipientDialog/);
  assert.match(page, /_count: \{ select: \{ recipients: true \} \}/);
  assert.match(page, /penerima dipilih/);
});

test("pilihan penerima disimpan per campaign dengan audit dan guard status", async () => {
  const [actions, data] = await Promise.all([
    read("app/actions/campaigns.ts"),
    read("lib/whatsapp/data.ts"),
  ]);

  assert.match(actions, /export async function getCampaignRecipientDialogAction/);
  assert.match(actions, /export async function saveCampaignRecipientsAction/);
  assert.match(actions, /deleteMany\(\{ where: \{ campaignId: campaign\.id \} \}\)/);
  assert.match(actions, /CAMPAIGN_RECIPIENTS_UPDATED/);
  assert.match(actions, /Penerima hanya bisa diubah sebelum campaign mulai dikirim/);
  assert.match(data, /export async function getCampaignRecipientOptions/);
  assert.match(data, /!== "OPTED_OUT"/);
});

test("worker hanya mengirim campaign ke customer terpilih dan melewati campaign kosong", async () => {
  const worker = await read("worker/whatsapp.mjs");

  assert.match(worker, /prisma\.whatsAppCampaignRecipient\.count/);
  assert.match(worker, /dilewati: belum ada customer yang dipilih/);
  assert.ok(worker.includes('data: { status: "SKIPPED", recipientCursor: null }'));
  assert.ok(worker.includes('where: { campaignId: campaign.id, ...(cursor ? { customerId: { gt: cursor } } : {}) }'));
  assert.ok(!worker.includes("createdAt: { lte: startedAt }"));
  assert.match(worker, /idempotencyKey: `campaign:\$\{campaign\.id\}:\$\{item\.id\}`/);
  assert.match(worker, /campaignRecipientAllowlist/);
});

test("tabel penerima campaign tersimpan sebagai relasi campaign ke customer", async () => {
  const [sql, schema] = await Promise.all([
    read("prisma/migrations/20260927030000_campaign_recipient_selection/migration.sql"),
    read("prisma/schema.prisma"),
  ]);

  assert.match(sql, /CREATE TABLE "WhatsAppCampaignRecipient"/);
  assert.match(sql, /CREATE UNIQUE INDEX "WhatsAppCampaignRecipient_campaignId_customerId_key"/);
  assert.match(sql, /ON DELETE CASCADE/);
  assert.match(schema, /model WhatsAppCampaignRecipient \{/);
  assert.match(schema, /@@unique\(\[campaignId, customerId\]\)/);
});
