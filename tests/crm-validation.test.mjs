import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  bulkUpdateMasterDataSchema,
  createCustomerSchema,
  createOpportunitySchema,
  sortableMasterDataFieldsSchema,
  masterDataFieldsSchema,
  moveOpportunitySchema,
  publicLeadSchema,
  quotationDraftSchema,
  recordFollowUpResultSchema,
  strongPasswordSchema,
  updateUserSchema,
} from "../lib/crm/validation.ts";
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
    moveOpportunitySchema.safeParse({ ...base, stage: "PENAWARAN", cancelReason: null }).success,
    true,
  );
});

test("hasil follow-up mewajibkan next action untuk opportunity terbuka", () => {
  const base = {
    opportunityId: "cm123456789012",
    version: "1",
    content: "Customer meminta revisi harga.",
    contactedAt: "2026-08-31T10:00",
    stage: "NEGOSIASI",
  };
  assert.equal(recordFollowUpResultSchema.safeParse(base).success, false);
  assert.equal(recordFollowUpResultSchema.safeParse({ ...base, nextAction: "Kirim revisi", nextActionAt: "2026-09-01T09:00" }).success, true);
  assert.equal(recordFollowUpResultSchema.safeParse({ ...base, stage: "LOST", cancelReason: "Budget tidak cocok" }).success, true);
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

test("password kuat dan item quotation divalidasi pada boundary", () => {
  assert.equal(strongPasswordSchema.safeParse("password123").success, false);
  assert.equal(strongPasswordSchema.safeParse("Valid-Password-123!").success, true);

  const invalidQuotation = quotationDraftSchema.safeParse({
    opportunityId: "cm123456789012",
    discountType: "PERCENTAGE",
    discountValue: "10",
    items: [{ description: "Kaos", quantity: 0, unitPrice: "50000" }],
  });
  assert.equal(invalidQuotation.success, false);
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

test("flash message tidak membocorkan isi notifikasi ke URL", async () => {
  const responseSource = await readFile(new URL("../lib/actions/response.ts", import.meta.url), "utf8");
  assert.doesNotMatch(responseSource, /encodeURIComponent\(message\)/);
  assert.match(responseSource, /httpOnly:\s*true/);
  assert.match(responseSource, /sameSite:\s*"lax"/);
});

test("bukti persetujuan memakai bucket privat dengan batas file", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20260827120000_quotation_acceptance_proof/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /quotation-acceptance-proofs/);
  assert.match(sql, /public, file_size_limit, allowed_mime_types/);
  assert.match(sql, /false,[\s\S]+5242880/);
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
