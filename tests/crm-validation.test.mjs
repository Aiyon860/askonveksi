import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  addCommunicationActivitySchema,
  bulkUpdateMasterDataSchema,
  createCustomerSchema,
  createOpportunitySchema,
  sortableMasterDataFieldsSchema,
  masterDataFieldsSchema,
  moveOpportunitySchema,
  publicLeadSchema,
  invoiceDraftSchema,
  purchaseOrderDraftSchema,
  completeDealSchema,
  recordFollowUpResultSchema,
  strongPasswordSchema,
  updateUserSchema,
} from "../lib/crm/validation.ts";
import {
  getAnalyticsPeriodBounds,
  parseAnalyticsPeriod,
} from "../lib/analytics/report-period.ts";
import { calculateConversionRate } from "../lib/analytics/conversion-rate.ts";
import { finalizeSalesPerformanceRows } from "../lib/analytics/sales-performance.ts";
import { formatPercentage } from "../lib/crm/format.ts";
import {
  activityStatusFromSchedule,
  addCalendarMonthsJakarta,
} from "../lib/crm/reminder-types.ts";
import { DATA_PAGE_SIZE, parsePageParam, parsePageSizeParam } from "../lib/pagination.ts";

test("opportunity tervalidasi dengan customer tersimpan dan field CRM V1", () => {
  const inlineCustomer = createOpportunitySchema.safeParse({
    title: "Seragam panitia",
    leadScore: "80",
    name: "Customer inline",
    whatsapp: "08123456789",
  });
  assert.equal(inlineCustomer.success, false);

  const valid = createOpportunitySchema.safeParse({
    customerId: "cm123456789012",
    title: "Seragam panitia",
    leadScore: "80",
    estimatedQuantity: "150",
    estimatedValue: "15000000",
    deadline: "2026-12-01",
  });
  assert.equal(valid.success, true);
});

test("customer membutuhkan nama dan minimal satu kontak", () => {
  const missingContact = createCustomerSchema.safeParse({ name: "Budi", companyName: "", whatsapp: "", email: "", instagram: "", address: "", city: "", notes: "", customerTypeId: "master-ct-personal", leadSourceId: "", salesPicId: "" });
  assert.equal(missingContact.success, false);

  const valid = createCustomerSchema.safeParse({ name: "Budi", companyName: "", whatsapp: "08123456789", email: "", instagram: "", address: "", city: "Bandung", notes: "Customer prioritas", customerTypeId: "master-ct-personal", leadSourceId: "", salesPicId: "" });
  assert.equal(valid.success, true);
});

test("customer wajib memiliki jenis customer yang valid secara bentuk", () => {
  const withoutType = createCustomerSchema.safeParse({ name: "Budi", whatsapp: "08123456789" });
  assert.equal(withoutType.success, false);
});

test("master data membatasi nama, deskripsi, dan urutan", () => {
  assert.equal(masterDataFieldsSchema.safeParse({ name: "Perusahaan", description: "Badan usaha", position: "10" }).success, true);
  assert.equal(masterDataFieldsSchema.safeParse({ name: " ", description: "", position: "-1" }).success, false);
});

test("jenis customer dibuat tanpa urutan manual dan edit massal membatasi payload", () => {
  assert.equal(sortableMasterDataFieldsSchema.safeParse({ name: "Perusahaan", description: "Badan usaha" }).success, true);
  assert.equal(sortableMasterDataFieldsSchema.safeParse({ name: " ", description: "" }).success, false);
  assert.equal(
    bulkUpdateMasterDataSchema.safeParse([
      { id: "cm123456789012", name: "Personal", description: "Perorangan" },
      { id: "cm123456789013", name: "Perusahaan", description: "Badan usaha" },
    ]).success,
    true,
  );
  assert.equal(bulkUpdateMasterDataSchema.safeParse([]).success, false);
  assert.equal(
    bulkUpdateMasterDataSchema.safeParse([{ id: "id-pendek", name: "Personal", description: "" }]).success,
    false,
  );
});

test("pipeline menolak Deal manual dan Lost tanpa alasan", () => {
  const base = { opportunityId: "cm123456789012", version: "1" };
  assert.equal(moveOpportunitySchema.safeParse({ ...base, stage: "FOLLOW_UP", cancelReason: "" }).success, true);
  assert.equal(moveOpportunitySchema.safeParse({ ...base, stage: "LOST", cancelReason: "" }).success, false);
  assert.equal(moveOpportunitySchema.safeParse({ ...base, stage: "DEAL", cancelReason: "" }).success, false);
});

test("field status yang tidak dirender boleh bernilai null dari FormData", () => {
  const base = { opportunityId: "cm123456789012", version: "1" };
  assert.equal(
    moveOpportunitySchema.safeParse({
      ...base,
      stage: "FOLLOW_UP",
      cancelReason: null,
    }).success,
    true,
  );
  assert.equal(
    moveOpportunitySchema.safeParse({ ...base, stage: "NEGOSIASI", cancelReason: null }).success,
    true,
  );
});

test("hasil follow-up mewajibkan next action untuk opportunity terbuka", () => {
  const base = {
    opportunityId: "cm123456789012",
    version: "1",
    content: "Customer meminta revisi harga.",
    contactedAt: "2026-08-31T10:00",
    channel: "WHATSAPP",
    direction: "OUTBOUND",
    stage: "NEGOSIASI",
  };
  assert.equal(recordFollowUpResultSchema.safeParse(base).success, false);
  assert.equal(recordFollowUpResultSchema.safeParse({ ...base, nextAction: "Kirim revisi", nextActionAt: "2026-09-01T09:00" }).success, true);
  assert.equal(recordFollowUpResultSchema.safeParse({ ...base, stage: "LOST", cancelReason: "Budget tidak cocok" }).success, true);
});

test("aktivitas komunikasi membedakan komunikasi eksternal dan catatan internal", () => {
  const base = {
    context: "customer",
    customerId: "cm123456789012",
    opportunityId: "",
    occurredAt: "2026-08-31T10:00",
    content: "Customer meminta informasi bahan.",
  };

  assert.equal(addCommunicationActivitySchema.safeParse({ ...base, channel: "WHATSAPP", direction: "INBOUND" }).success, true);
  assert.equal(addCommunicationActivitySchema.safeParse({ ...base, channel: "WHATSAPP", direction: "" }).success, false);
  assert.equal(addCommunicationActivitySchema.safeParse({ ...base, channel: "INTERNAL_NOTE", direction: "" }).success, true);
  assert.equal(addCommunicationActivitySchema.safeParse({ ...base, channel: "INTERNAL_NOTE", direction: "OUTBOUND" }).success, false);
  assert.equal(addCommunicationActivitySchema.safeParse({ ...base, context: "opportunity", channel: "INTERNAL_NOTE" }).success, false);
});

test("lead publik hanya menerima field intake minimum", () => {
  const valid = { submissionKey: "9d414d3c-1e40-4ad4-944b-74f8cba7a723", name: "Budi", whatsapp: "08123456789", productName: "Jersey", estimatedQuantity: "100", deadline: "2026-09-15", city: "Semarang", website: "" };
  assert.equal(publicLeadSchema.safeParse(valid).success, true);
  assert.equal(publicLeadSchema.safeParse({ ...valid, whatsapp: "123" }).success, false);
});

test("field penugasan opportunity tidak tertukar dengan profil customer", async () => {
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  assert.match(actionSource, /leadSourceId: formData\.has\("opportunityLeadSourceId"\)/);
  assert.match(actionSource, /salesPicId: formData\.has\("opportunitySalesPicId"\)/);
  assert.match(actionSource, /function customerFields[\s\S]+leadSourceId: formValue\(formData, "leadSourceId"\),[\s\S]+salesPicId: formValue\(formData, "salesPicId"\),/);
});

test("password kuat dan item invoice divalidasi pada boundary", () => {
  assert.equal(strongPasswordSchema.safeParse("password123").success, false);
  assert.equal(strongPasswordSchema.safeParse("Valid-Password-123!").success, true);

  const invalidInvoice = invoiceDraftSchema.safeParse({
    opportunityId: "cm123456789012",
    discountType: "PERCENTAGE",
    discountValue: "10",
    items: [{ description: "Kaos", quantity: 0, unitPrice: "50000" }],
  });
  assert.equal(invalidInvoice.success, false);
});

test("PO mewajibkan satu bahan dan jumlah per ukuran yang unik", () => {
  const valid = {
    opportunityId: "cm123456789012",
    productName: "Jersey tim",
    material: "Dry fit",
    sizes: [{ size: "M", quantity: 12 }, { size: "L", quantity: 18 }],
  };
  assert.equal(purchaseOrderDraftSchema.safeParse(valid).success, true);
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, material: "" }).success, false);
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, sizes: [{ size: "M", quantity: 12 }, { size: "m", quantity: 2 }] }).success, false);
});

test("Deal mewajibkan pembayaran lunas atau DP dengan termin", () => {
  const base = {
    opportunityId: "cm123456789012",
    opportunityVersion: "1",
    purchaseOrderId: "cm123456789013",
    invoiceId: "cm123456789014",
    invoiceVersion: "1",
    paidAt: "2026-09-03T10:00",
    initialValueType: "NOMINAL",
    initialValue: "500000",
  };
  assert.equal(completeDealSchema.safeParse({ ...base, kind: "LUNAS", terms: [] }).success, true);
  assert.equal(completeDealSchema.safeParse({ ...base, kind: "DP", terms: [] }).success, false);
  assert.equal(completeDealSchema.safeParse({ ...base, kind: "DP", terms: [{ valueType: "PERCENTAGE", value: "50", dueAt: "2026-09-30" }] }).success, true);
  assert.equal(completeDealSchema.safeParse({ ...base, kind: "LUNAS", terms: [{ valueType: "NOMINAL", value: "1", dueAt: "2026-09-30" }] }).success, false);
});

test("edit pengguna memvalidasi identitas, waktu perubahan, email, dan role", () => {
  const valid = {
    userId: "cm123456789012",
    updatedAt: "2026-08-29T09:00:00.000Z",
    name: "Budi Santoso",
    email: "budi@example.com",
    role: "ADMIN",
  };

  assert.equal(updateUserSchema.safeParse(valid).success, true);
  assert.equal(updateUserSchema.safeParse({ ...valid, updatedAt: "bukan-tanggal" }).success, false);
  assert.equal(updateUserSchema.safeParse({ ...valid, email: "bukan-email" }).success, false);
  assert.equal(updateUserSchema.safeParse({ ...valid, role: "FINANCE" }).success, false);
});

test("migration memegang invariant concurrency dan menutup Data API", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20260827000000_crm_v1/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /SalesOrder_one_active_per_opportunity/);
  assert.match(sql, /Customer_contact_required/);
  assert.match(sql, /Opportunity_follow_up_date_required/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]+FROM anon, authenticated/);
});

test("migration klasifikasi customer melakukan seed dan backfill aman", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20260828000000_customer_classification/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE "CustomerType"/);
  assert.match(sql, /CREATE TABLE "LeadSource"/);
  assert.match(sql, /Belum diklasifikasikan/);
  assert.match(sql, /UPDATE "Customer" SET "customerTypeId"/);
  assert.match(sql, /ON DELETE RESTRICT/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
});

test("migration gap CRM menambah pipeline, next action, scoring, dan rate limit", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20260831000000_crm_v1_gap/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /LEAD_BARU/);
  assert.match(sql, /KEBUTUHAN_TERGALI/);
  assert.match(sql, /Opportunity_next_action_pair/);
  assert.match(sql, /Opportunity_lead_score_range/);
  assert.match(sql, /PublicRateLimitBucket/);
  assert.match(sql, /Landing Page/);
  assert.match(sql, /REVOKE ALL ON TABLE "PublicRateLimitBucket" FROM anon, authenticated/);
});

test("migration riwayat komunikasi menjaga catatan lama dan menutup Data API", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20260831120000_communication_history/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /ALTER TABLE "CRMNote" RENAME TO "CommunicationActivity"/);
  assert.match(sql, /UPDATE "CommunicationActivity"[\s\S]+"customerId"/);
  assert.match(sql, /CommunicationActivity_shape_valid/);
  assert.match(sql, /OPPORTUNITY_STAGE_CHANGED/);
  assert.match(sql, /QUOTATION_ISSUED/);
  assert.match(sql, /SALES_ORDER_CREATED/);
  assert.match(sql, /SALES_ORDER_CANCELLED/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE "CommunicationActivity" FROM anon, authenticated/);
});

test("jadwal repeat order memakai bulan kalender Jakarta dan menangani akhir bulan", () => {
  const acceptedAt = new Date("2026-08-30T20:00:00.000Z");
  assert.equal(addCalendarMonthsJakarta(acceptedAt, 3).toISOString(), "2026-11-29T20:00:00.000Z");
  assert.equal(addCalendarMonthsJakarta(acceptedAt, 6).toISOString(), "2027-02-27T20:00:00.000Z");

  const januaryEnd = new Date("2026-01-30T20:00:00.000Z");
  assert.equal(addCalendarMonthsJakarta(januaryEnd, 3).toISOString(), "2026-04-29T20:00:00.000Z");
});

test("status aktivitas berubah pada bulan ke-3 dan ke-6 serta ditahan oleh peluang terbuka", () => {
  const schedule = [
    { type: "REPEAT_ORDER", dueAt: new Date("2026-11-29T20:00:00.000Z") },
    { type: "REACTIVATION", dueAt: new Date("2027-02-27T20:00:00.000Z") },
  ];
  assert.equal(activityStatusFromSchedule([], new Date("2026-09-01T00:00:00.000Z")), "BELUM_ORDER");
  assert.equal(activityStatusFromSchedule(schedule, new Date("2026-11-01T00:00:00.000Z")), "AKTIF");
  assert.equal(activityStatusFromSchedule(schedule, new Date("2026-12-01T00:00:00.000Z")), "POTENSI_REPEAT");
  assert.equal(activityStatusFromSchedule(schedule, new Date("2027-03-01T00:00:00.000Z")), "TIDAK_AKTIF");
  assert.equal(activityStatusFromSchedule(schedule, new Date("2027-03-01T00:00:00.000Z"), true), "AKTIF");
});

test("migration reminder membackfill order terakhir dan menutup Data API", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20260831150000_customer_repeat_reminders/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /DISTINCT ON \(opportunity\."customerId"\)/);
  assert.match(sql, /sales_order\."status" = 'ACTIVE'/);
  assert.match(sql, /INTERVAL '3 months'/);
  assert.match(sql, /INTERVAL '6 months'/);
  assert.match(sql, /AT TIME ZONE 'Asia\/Jakarta'/);
  assert.match(sql, /CustomerReminder_pending_dueAt_idx/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE "CustomerReminder", "CustomerReminderReceipt" FROM anon, authenticated/);
});

test("lifecycle Sales Order mengatur ulang reminder tanpa cron per customer", async () => {
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  const reminderSource = await readFile(new URL("../lib/crm/reminders.ts", import.meta.url), "utf8");
  assert.match(actionSource, /scheduleCustomerReminders\(tx/);
  assert.match(actionSource, /restoreCustomerRemindersAfterCancellation\(tx/);
  assert.match(actionSource, /rearmCustomerRemindersAfterLost\(tx/);
  assert.match(reminderSource, /sourceSalesOrderId: data\.sourceSalesOrderId/);
  assert.doesNotMatch(reminderSource, /cron/i);
});

test("periode analytics dibatasi dan mengikuti awal hari Jakarta", () => {
  const reference = new Date("2026-08-31T18:00:00.000Z");
  assert.equal(parseAnalyticsPeriod("month"), "month");
  assert.equal(parseAnalyticsPeriod("year"), "year");
  assert.equal(parseAnalyticsPeriod("invalid"), "month");
  assert.equal(parseAnalyticsPeriod(["all"]), "month");

  const month = getAnalyticsPeriodBounds("month", reference);
  assert.equal(month?.start.toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(month?.end.toISOString(), "2026-09-30T17:00:00.000Z");

  const year = getAnalyticsPeriodBounds("year", reference);
  assert.equal(year?.start.toISOString(), "2025-12-31T17:00:00.000Z");
  assert.equal(year?.end.toISOString(), "2026-12-31T17:00:00.000Z");
  assert.equal(getAnalyticsPeriodBounds("all", reference), null);

  const december = getAnalyticsPeriodBounds("month", new Date("2026-12-15T05:00:00.000Z"));
  assert.equal(december?.start.toISOString(), "2026-11-30T17:00:00.000Z");
  assert.equal(december?.end.toISOString(), "2026-12-31T17:00:00.000Z");
});

test("conversion rate menghitung Deal dari seluruh lead dan memakai format Indonesia", () => {
  const conversionRate = calculateConversionRate(14, 125);

  assert.equal(conversionRate, 0.112);
  assert.equal(formatPercentage(conversionRate), "11,2%");
  assert.equal(calculateConversionRate(0, 125), 0);
  assert.equal(calculateConversionRate(125, 125), 1);
  assert.equal(calculateConversionRate(0, 0), 0);
  assert.equal(formatPercentage(calculateConversionRate(0, 0)), "0,0%");
});

test("laporan omzet memakai atribusi opportunity dan Sales Order aktif", async () => {
  const dataSource = await readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8");
  assert.match(dataSource, /requireActor\(ANALYTICS_ROLES\)/);
  assert.match(dataSource, /o\."leadSourceId"/);
  assert.match(dataSource, /COUNT\(DISTINCT so\."opportunityId"\)/);
  assert.match(dataSource, /so\."status" = 'ACTIVE'/);
});

test("normalisasi performa sales mempertahankan sales aktif dan data historis", () => {
  const result = finalizeSalesPerformanceRows([
    { salesId: "andi", salesName: "Andi", isActive: true, leadCount: 0, followUpCount: 0, invoiceCount: 0, dealCount: 0, revenue: "0" },
    { salesId: "budi", salesName: "Budi", isActive: false, leadCount: 0, followUpCount: 0, invoiceCount: 0, dealCount: 0, revenue: "0" },
    { salesId: "cici", salesName: "Cici", isActive: false, leadCount: 1, followUpCount: 2, invoiceCount: 1, dealCount: 1, revenue: "50.25" },
    { salesId: "dodi", salesName: "Dodi", isActive: true, leadCount: 10, followUpCount: 3, invoiceCount: 2, dealCount: 0, revenue: "0" },
    { salesId: null, salesName: "Belum ada PIC", isActive: null, leadCount: 2, followUpCount: 0, invoiceCount: 0, dealCount: 1, revenue: "100" },
  ]);

  assert.deepEqual(result.rows.map((row) => row.salesId), [null, "cici", "dodi", "andi"]);
  assert.deepEqual(result.totals, {
    leadCount: 13,
    followUpCount: 5,
    invoiceCount: 3,
    dealCount: 2,
    revenue: "150.25",
  });
});

test("laporan performa sales memakai PIC opportunity dan tanggal aktivitas masing-masing", async () => {
  const dataSource = await readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8");
  assert.match(dataSource, /getSalesPerformanceData/);
  assert.match(dataSource, /o\."salesPicId"/);
  assert.match(dataSource, /ae\.action = 'FOLLOW_UP_RECORDED'/);
  assert.match(dataSource, /COUNT\(DISTINCT q\."opportunityId"\)/);
  assert.match(dataSource, /q\."issuedAt" IS NOT NULL/);
  assert.match(dataSource, /COUNT\(DISTINCT so\."opportunityId"\)/);
  assert.match(dataSource, /so\.status = 'ACTIVE'/);
});

test("flash message tidak membocorkan isi notifikasi ke URL", async () => {
  const responseSource = await readFile(new URL("../lib/actions/response.ts", import.meta.url), "utf8");
  assert.doesNotMatch(responseSource, /encodeURIComponent\(message\)/);
  assert.match(responseSource, /httpOnly:\s*true/);
  assert.match(responseSource, /sameSite:\s*"lax"/);
});

test("revisi CRM membuat PO, invoice, pembayaran, dan bucket desain privat", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20260902000000_crm_purchase_order_invoice/migration.sql", import.meta.url), "utf8");
  const storageScript = await readFile(new URL("../scripts/reset-crm-storage.mjs", import.meta.url), "utf8");
  assert.match(sql, /CREATE TYPE "OpportunityStage" AS ENUM \('LEAD_BARU', 'FOLLOW_UP', 'NEGOSIASI', 'DEAL', 'LOST'\)/);
  assert.match(sql, /CREATE TABLE "PurchaseOrder"/);
  assert.match(sql, /CREATE TABLE "Invoice"/);
  assert.match(sql, /CREATE TABLE "DealPayment"/);
  assert.match(sql, /CREATE TABLE "PaymentTerm"/);
  assert.match(sql, /PurchaseOrder_one_agreed_per_opportunity/);
  assert.match(sql, /Invoice_one_issued_per_opportunity/);
  assert.match(sql, /BEGIN;[\s\S]+COMMIT;/);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS "Opportunity_lost_reason_required"/);
  assert.doesNotMatch(sql, /DELETE FROM storage\./);
  assert.doesNotMatch(sql, /INSERT INTO storage\./);
  assert.match(storageScript, /emptyBucket\(bucketId\)/);
  assert.match(storageScript, /deleteBucket\(bucketId\)/);
  assert.match(storageScript, /crm-po-designs/);
  assert.match(storageScript, /public: false/);
  assert.match(storageScript, /fileSizeLimit: 5 \* 1024 \* 1024/);
  assert.match(sql, /REVOKE ALL ON TABLE "PurchaseOrder"[\s\S]+FROM anon, authenticated/);
});

test("parameter pagination dibatasi pada nilai aman", () => {
  assert.equal(DATA_PAGE_SIZE, 20);
  assert.equal(parsePageParam(undefined), 1);
  assert.equal(parsePageParam("abc"), 1);
  assert.equal(parsePageParam("0"), 1);
  assert.equal(parsePageParam(["3", "9"]), 3);
  assert.equal(parsePageParam("999999999999999999999"), 10_000);
  assert.equal(parsePageSizeParam(undefined), DATA_PAGE_SIZE);
  assert.equal(parsePageSizeParam("10"), 10);
  assert.equal(parsePageSizeParam(["50", "10"]), 50);
  assert.equal(parsePageSizeParam("5000"), DATA_PAGE_SIZE);
});
