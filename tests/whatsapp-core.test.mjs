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

const jobsSource = await readFile(new URL("../lib/whatsapp/jobs.ts", import.meta.url), "utf8");
const workerSource = await readFile(new URL("../worker/whatsapp.mjs", import.meta.url), "utf8");

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

test("worker menagih pembayaran per target dan menjadwalkan reminder order berikutnya", () => {
  assert.match(workerSource, /pending-initial:/);
  assert.match(workerSource, /pending-term:/);
  assert.match(workerSource, /deal-term:/);
  assert.match(workerSource, /invoiceReminderOffsets/);
  assert.match(workerSource, /addSixCalendarMonthsJakarta/);
  assert.match(workerSource, /orderReminderEnabled/);
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

  assert.equal(manualJobs.match(/scheduledAt: new Date\(\)/g)?.length, 2);
  assert.doesNotMatch(manualJobs, /scheduledAt: nextWhatsAppSendAt/);
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
