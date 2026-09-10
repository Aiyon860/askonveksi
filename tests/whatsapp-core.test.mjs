import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  nextWhatsAppSendAt,
  normalizeWhatsAppNumber,
  renderWhatsAppTemplate,
  unknownTemplateVariables,
} from "../lib/whatsapp/core.ts";

const jobsSource = await readFile(new URL("../lib/whatsapp/jobs.ts", import.meta.url), "utf8");

test("nomor WhatsApp Indonesia dinormalisasi ke kode negara", () => {
  assert.equal(normalizeWhatsAppNumber("0812-3456-7890"), "6281234567890");
  assert.equal(normalizeWhatsAppNumber("+62 812 3456 7890"), "6281234567890");
  assert.equal(normalizeWhatsAppNumber("123"), null);
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
