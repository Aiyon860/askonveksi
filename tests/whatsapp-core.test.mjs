import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  nextWhatsAppSendAt,
  normalizeWhatsAppNumber,
  DEFAULT_INVOICE_ISSUED_TEMPLATE,
  renderInvoiceIssuedTemplate,
  renderWhatsAppTemplate,
  unknownTemplateVariables,
} from "../lib/whatsapp/core.ts";
import { repeatOrderDueAt, repeatOrderOccurrenceMonths } from "../lib/crm/reminder-types.ts";
import { campaignFieldsSchema, deleteCampaignSchema, parseJakartaDateTime, renderCampaignMessage, toggleCampaignSchema } from "../lib/whatsapp/campaigns.ts";
import { parsePageParam, parsePageSizeParam } from "../lib/pagination.ts";

const jobsSource = await readFile(new URL("../lib/whatsapp/jobs.ts", import.meta.url), "utf8");
const workerSource = await readFile(new URL("../worker/whatsapp.mjs", import.meta.url), "utf8");
const whatsappDataSource = await readFile(new URL("../lib/whatsapp/data.ts", import.meta.url), "utf8");
const campaignActionsSource = await readFile(new URL("../app/actions/campaigns.ts", import.meta.url), "utf8");
const campaignPageSource = await readFile(new URL("../app/(app)/campaigns/page.tsx", import.meta.url), "utf8");

test("nomor WhatsApp Indonesia dinormalisasi ke kode negara", () => {
  assert.equal(normalizeWhatsAppNumber("0812-3456-7890"), "6281234567890");
  assert.equal(normalizeWhatsAppNumber("+62 812 3456 7890"), "6281234567890");
  assert.equal(normalizeWhatsAppNumber("123"), null);
});

test("pesan invoice menyertakan template dan menghapus kalimat deadline saat tanggal kosong", () => {
  const values = { customer_name: "Budi", invoice_no: "INV-1", business_name: "ASK", invoice_total: "Rp100.000", invoice_due_date: "" };
  const message = renderInvoiceIssuedTemplate(DEFAULT_INVOICE_ISSUED_TEMPLATE, values);
  assert.match(message, /Halo Budi, invoice INV-1/);
  assert.match(message, /Dokumen invoice terlampir/);
  assert.doesNotMatch(message, /Batas pembayaran/);
});

test("worker memproyeksikan hanya field akun dan job yang dipakai saat memproses", () => {
  const reloadAccounts = workerSource.slice(workerSource.indexOf("async function reloadAccounts()"), workerSource.indexOf("async function scheduleAutomations()"));
  const processOneJob = workerSource.slice(workerSource.indexOf("async function processOneJob()"), workerSource.indexOf("async function tick()"));

  assert.match(reloadAccounts, /whatsAppAccount\.findMany\(\{\s*select:/);
  const accountData = whatsappDataSource.slice(whatsappDataSource.indexOf("export async function getWhatsAppAccounts()"), whatsappDataSource.indexOf("export type WhatsAppTemplateSort"));
  assert.match(accountData, /whatsAppAccount\.findMany\(\{\s*select:/);
  assert.match(accountData, /requireActor\(WHATSAPP_ACCOUNT_MANAGER_ROLES\)/);
  for (const field of ["id", "label", "phoneNumber", "status", "sendEnabled", "connectRequestedAt", "disconnectRequestedAt", "deleteRequestedAt", "pairingCode", "pairingCodeExpiresAt", "connectedAt", "disconnectedAt", "heartbeatAt", "lastError"]) {
    assert.match(accountData, new RegExp(`\\b${field}: true`));
  }
  assert.match(workerSource, /whatsAppTemplate\.findMany\(\{\s*where: \{ isActive: true \},\s*select: \{ id: true, triggerType: true, body: true \}/);
  assert.match(workerSource, /whatsAppCampaign\.findMany\(\{[\s\S]*?select: \{[\s\S]*?recipientCursor: true[\s\S]*?imageSizeBytes: true/);
  assert.match(workerSource, /whatsAppAutomationJob\.groupBy\(\{[\s\S]*?campaignId: \{ in: running\.map\(\(campaign\) => campaign\.id\) \}/);
  assert.match(workerSource, /whatsAppCampaignRecipient\.findFirst\(\{\s*where: \{ campaignId: campaign\.id \},\s*select: \{ id: true \}/);
  assert.match(workerSource, /whatsAppMessage\.upsert\([\s\S]*?select: \{ id: true \}/);
  assert.match(jobsSource, /whatsAppConversation\.upsert\([\s\S]*?select: \{ id: true \}/);
  assert.match(jobsSource, /whatsAppAutomationJob\.create\(\{ data: \{ idempotencyKey: `manual-invoice:/);
  assert.match(jobsSource, /whatsAppAutomationJob\.create\([\s\S]*?select: \{ id: true \}/);
  assert.match(jobsSource, /whatsAppMessage\.create\([\s\S]*?select: \{ id: true \}/);
  assert.match(jobsSource, /whatsAppConversation\.update\([\s\S]*?select: \{ id: true \}/);
  for (const field of ["id", "phoneNumber", "status", "connectRequestedAt", "disconnectRequestedAt", "disconnectedAt", "deleteRequestedAt", "pairingCodeExpiresAt"]) {
    assert.match(reloadAccounts, new RegExp(`\\b${field}: true`));
  }
  assert.match(processOneJob, /whatsAppAutomationJob\.findUnique\(\{\s*where: \{ id \},\s*select:/);
  assert.match(processOneJob, /whatsAppAccount\.findUnique\(\{ where: \{ id: job\.accountId \}, select:/);
  assert.match(processOneJob, /whatsAppAccount\.findFirst\(\{ where: \{ sendEnabled: true, status: "CONNECTED" \}, select:/);
  assert.match(processOneJob, /whatsAppConversation\.upsert\([\s\S]*?select: \{ id: true \}/);
  assert.match(processOneJob, /whatsAppMessage\.update\(\{ where: \{ id: job\.message\.id \}, data: \{[\s\S]*?select: \{ id: true, sentById: true \}/);
  assert.match(processOneJob, /const message = await tx\.whatsAppMessage\.update\([\s\S]*?select: \{ sentById: true \}/);
  const invoiceIssuedStart = workerSource.indexOf('if (job.type === "INVOICE_ISSUED")');
  const invoiceIssuedEnd = workerSource.indexOf("const invoice = await prisma.invoice.findUnique", workerSource.indexOf("return Boolean(invoice?.status", invoiceIssuedStart));
  const invoiceIssuedValidation = workerSource.slice(invoiceIssuedStart, invoiceIssuedEnd);
  assert.match(invoiceIssuedValidation, /select: \{[\s\S]*?status: true,[\s\S]*?customer: \{ select: \{ archivedAt: true, whatsappConsentStatus: true \} \}/);
  assert.doesNotMatch(processOneJob, /include: \{ customer: true/);
  for (const field of ["idempotencyKey", "type", "accountId", "customerId", "opportunityId", "invoiceId", "reminderId", "campaignId", "payload", "attempts"]) {
    assert.match(processOneJob, new RegExp(`\\b${field}: true`));
  }
});

test("worker menagih pembayaran per target dan menjadwalkan reminder order berikutnya", () => {
  assert.match(workerSource, /pending-initial:/);
  assert.match(workerSource, /pending-term:/);
  assert.match(workerSource, /deal-term:/);
  assert.match(workerSource, /invoiceReminderOffsets/);
  assert.match(workerSource, /repeatOrderDueAt/);
  assert.match(workerSource, /orderReminderEnabled/);
});

test("pola repeat order 6, 5 berulang dari tanggal order, termasuk akhir bulan", () => {
  const acceptedAt = new Date("2026-01-31T03:00:00.000Z");
  assert.deepEqual([1, 2, 3, 4].map((n) => repeatOrderOccurrenceMonths([6, 5], n)), [6, 11, 17, 22]);
  assert.equal(repeatOrderDueAt(acceptedAt, [6, 5], 1).toISOString(), "2026-07-31T02:00:00.000Z");
  assert.equal(repeatOrderDueAt(acceptedAt, [6, 5], 2).toISOString(), "2026-12-31T02:00:00.000Z");
  assert.equal(repeatOrderDueAt(new Date("2026-08-31T03:00:00.000Z"), [6], 1).toISOString(), "2027-02-28T02:00:00.000Z");
});

test("campaign memvalidasi tanggal WIB dan variabel penerima", () => {
  assert.equal(parseJakartaDateTime("2026-08-03T09:30")?.toISOString(), "2026-08-03T02:30:00.000Z");
  assert.equal(parseJakartaDateTime("2026-02-30T09:30"), null);
  assert.equal(campaignFieldsSchema.safeParse({ name: "Promo Agustus", body: "Halo {{customer_name}}", scheduledAt: "2026-08-03T09:30" }).success, true);
  assert.equal(campaignFieldsSchema.safeParse({ name: "Promo Agustus", body: "Halo {{secret}}", scheduledAt: "2026-08-03T09:30" }).success, false);
  assert.equal(renderCampaignMessage("Halo {{customer_name}}", { customer_name: "Budi", company_name: "", business_name: "ASK" }), "Halo Budi");
  assert.match(workerSource, /idempotencyKey: `campaign:\$\{campaign\.id\}:\$\{item\.id\}`/);
  assert.match(workerSource, /scheduledAt: campaign\.scheduledAt/);
  assert.match(workerSource, /status: "PAUSED", scheduledAt: \{ lte: now \}/);
  assert.match(workerSource, /status: "SKIPPED"/);
});

test("pagination campaign membatasi parameter URL yang tidak valid", () => {
  assert.equal(parsePageParam("3"), 3);
  assert.equal(parsePageParam("invalid"), 1);
  assert.equal(parsePageParam("999999"), 10_000);
  assert.equal(parsePageSizeParam("10"), 10);
  assert.equal(parsePageSizeParam("50"), 50);
  assert.equal(parsePageSizeParam("25"), 20);
});

test("switch campaign hanya menerima nilai boolean dan versi yang valid", () => {
  assert.equal(toggleCampaignSchema.safeParse({ campaignId: "cmu0wrmdz0002ulij36mpwbb3", version: 1, enabled: "true" }).success, true);
  assert.equal(toggleCampaignSchema.safeParse({ campaignId: "cmu0wrmdz0002ulij36mpwbb3", version: 1, enabled: "false" }).success, true);
  assert.equal(toggleCampaignSchema.safeParse({ campaignId: "cmu0wrmdz0002ulij36mpwbb3", version: 0, enabled: "true" }).success, false);
  assert.equal(toggleCampaignSchema.safeParse({ campaignId: "cmu0wrmdz0002ulij36mpwbb3", version: 1, enabled: "yes" }).success, false);
});

test("campaign hanya dikendalikan oleh switch, tanpa pembatalan permanen", () => {
  assert.doesNotMatch(campaignActionsSource, /cancelCampaignAction|CAMPAIGN_CANCELLED/);
  assert.doesNotMatch(campaignPageSource, /Batalkan|cancelCampaignAction/);
});

test("edit campaign diambil per id agar tidak jatuh ke formulir campaign baru", () => {
  // Target edit tidak boleh dicari dari baris tabel yang sedang tampil: campaign bisa berubah
  // status/halaman sejak halaman dirender sehingga dulu formulir "Campaign baru" yang muncul.
  assert.match(campaignPageSource, /whatsAppCampaign\.findUnique\(\{ where: \{ id: editId \}/);
  assert.doesNotMatch(campaignPageSource, /campaigns\.find\(/);
  assert.match(campaignPageSource, /Campaign tidak bisa diedit/);
  assert.match(campaignPageSource, /key=\{edit\?\.id \?\? "new"\}/);
});

test("penghapusan campaign memerlukan versi valid dan menjaga riwayat job", () => {
  assert.equal(deleteCampaignSchema.safeParse({ campaignId: "cmu0wrmdz0002ulij36mpwbb3", version: 1 }).success, true);
  assert.equal(deleteCampaignSchema.safeParse({ campaignId: "cmu0wrmdz0002ulij36mpwbb3", version: 0 }).success, false);
  assert.match(campaignActionsSource, /export async function deleteCampaignAction/);
  assert.match(campaignActionsSource, /campaignId: null/);
  assert.match(campaignActionsSource, /CAMPAIGN_DELETED/);
  assert.match(campaignPageSource, /Hapus campaign\?/);
});

test("template hanya menerima variabel yang diizinkan", () => {
  assert.deepEqual(unknownTemplateVariables("Halo {{customer_name}}, {{unknown}}"), ["unknown"]);
  assert.equal(renderWhatsAppTemplate("Halo {{ customer_name }}", { customer_name: "Budi" }), "Halo Budi");
  assert.throws(() => renderWhatsAppTemplate("{{unknown}}", {}));
});

test("pengiriman menunggu jam operasional Jakarta", () => {
  assert.equal(nextWhatsAppSendAt(new Date("2026-09-10T00:00:00Z")).toISOString(), "2026-09-10T02:00:00.000Z");
  assert.equal(nextWhatsAppSendAt(new Date("2026-09-10T04:00:00Z")).toISOString(), "2026-09-10T04:00:00.000Z");
  assert.equal(nextWhatsAppSendAt(new Date("2026-09-10T10:00:00Z")).toISOString(), "2026-09-11T02:00:00.000Z");
});

test("pesan manual dikirim segera tanpa aturan jam automasi", () => {
  const manualJobs = jobsSource.slice(
    jobsSource.indexOf("export async function enqueueInvoiceWhatsAppMessage"),
    jobsSource.indexOf("export async function enqueueWhatsAppJob"),
  );

  assert.equal(manualJobs.match(/scheduledAt: new Date\(\)/g)?.length, 3);
  assert.doesNotMatch(manualJobs, /scheduledAt: nextWhatsAppSendAt/);
});

test("campaign test memakai job terpisah tanpa customer", async () => {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  assert.match(schema, /CAMPAIGN_TEST/);
  assert.match(schema, /customerId\s+String\?/);
  assert.match(jobsSource, /type: "CAMPAIGN_TEST"/);
  assert.match(workerSource, /job\.type === "MANUAL" \|\| job\.type === "CAMPAIGN_TEST"/);
  assert.match(whatsappDataSource, /type: \{ not: "CAMPAIGN_TEST" \}/);
});

test("penerbitan invoice menjadwalkan PDF dan pesan pada saat transaksi diterbitkan", () => {
  const issueJob = jobsSource.slice(
    jobsSource.indexOf("export async function enqueueIssuedInvoiceWhatsAppJob"),
    jobsSource.indexOf("export async function ensureCustomerWhatsAppConversation"),
  );
  assert.match(issueJob, /scheduledAt: new Date\(\)/);
  assert.match(issueJob, /attachment: \{ type: "invoice"/);
  assert.doesNotMatch(issueJob, /nextWhatsAppSendAt/);
});

test("pairing ulang meminta kode baru pada socket worker yang masih aktif", () => {
  assert.match(workerSource, /account\.status === "PAIRING".*!account\.pairingCodeExpiresAt.*socket/s);
  assert.match(workerSource, /await issuePairingCode\(socket, account\)/);
  assert.match(workerSource, /setInterval\(\(\) => void tick\(\), 2_000\)/);
});
