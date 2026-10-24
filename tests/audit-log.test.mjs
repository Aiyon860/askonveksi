import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { AUDIT_ENTITY_LABEL, AUDIT_ACTION_LABEL, auditActionLabel, auditEntityLabel } from "../lib/audit/labels.ts";
import { AUDIT_VIEW_ROLES, hasRole } from "../lib/auth/permissions.ts";

// Daftar aksi yang sudah terbukti tertulis ke AuditEvent (union DB lokal + kode penulis audit).
// Kalau ada aksi baru, tambahkan ke registry supaya labelnya tetap rapi.
const KNOWN_ACTIONS = [
  "ATTENDANCE_CLOCKED_IN",
  "ATTENDANCE_CORRECTED",
  "ATTENDANCE_HOLIDAY_CREATED",
  "ATTENDANCE_HOLIDAY_DELETED",
  "ATTENDANCE_MANUAL_DELETED",
  "ATTENDANCE_MANUAL_RECORDED",
  "ATTENDANCE_SETTINGS_UPDATED",
  "BUSINESS_PROFILE_UPDATED",
  "CAMPAIGN_CREATED",
  "CAMPAIGN_DELETED",
  "CAMPAIGN_PAUSED",
  "CAMPAIGN_RECIPIENTS_UPDATED",
  "CAMPAIGN_RESUMED",
  "CAMPAIGN_SKIPPED",
  "CAMPAIGN_TEST_QUEUED",
  "CAMPAIGN_UPDATED",
  "COMMUNICATION_ACTIVITY_ADDED",
  "CUSTOMER_ARCHIVED",
  "CUSTOMER_CREATED",
  "CUSTOMER_RESTORED",
  "CUSTOMER_TYPE_CREATED",
  "CUSTOMER_TYPE_DELETED",
  "CUSTOMER_TYPE_UPDATED",
  "CUSTOMER_UPDATED",
  "DESIGN_REVISION_APPROVED",
  "DESIGN_REVISION_REJECTED",
  "DESIGN_REVISION_UPLOADED",
  "DEVELOPER_PROVISIONED",
  "EXPENSE_CREATED",
  "EXPENSE_DELETED",
  "EXPENSE_REIMBURSED",
  "EXPENSE_RESTORED",
  "EXPENSE_UPDATED",
  "FOLLOW_UP_BROADCAST_QUEUED",
  "FOLLOW_UP_RECORDED",
  "GARMENT_SIZE_CREATED",
  "GARMENT_SIZE_DELETED",
  "GARMENT_SIZE_UPDATED",
  "INVOICE_CANCELLED",
  "INVOICE_DRAFT_CREATED",
  "INVOICE_DRAFT_UPDATED",
  "INVOICE_ISSUED",
  "INVOICE_REMINDER_SETTINGS_UPDATED",
  "INVOICE_REVISION_CREATED",
  "INVOICE_SETTING_POINT_CREATED",
  "INVOICE_SETTING_POINT_DELETED",
  "INVOICE_SETTING_POINT_UPDATED",
  "LEAD_SOURCE_CREATED",
  "LEAD_SOURCE_DELETED",
  "LEAD_SOURCE_UPDATED",
  "NOTE_ADDED",
  "OPPORTUNITY_CREATED",
  "OPPORTUNITY_STAGE_CHANGED",
  "OPPORTUNITY_UPDATED",
  "ORDER_REMINDER_SETTING_UPDATED",
  "OWNER_BOOTSTRAPPED",
  "PASSWORD_CHANGED",
  "PAYMENT_METHOD_CREATED",
  "PAYMENT_METHOD_DELETED",
  "PAYMENT_METHOD_UPDATED",
  "PAYMENT_RECORDED",
  "PAYMENT_SCHEDULED",
  "PAYMENT_UPDATED",
  "PAYMENT_VOIDED",
  "PRODUCTION_DESIGN_ANNOTATED",
  "PRODUCTION_DESIGN_REPLACED",
  "PRODUCTION_DESIGN_RESET",
  "PRODUCTION_DESIGN_SENT",
  "PRODUCTION_DESIGN_VERSION_SAVED",
  "PRODUCTION_NOTE_ADDED",
  "PRODUCTION_OBSTACLE_UPDATED",
  "PRODUCTION_PIC_ASSIGNED",
  "PRODUCTION_REOPENED",
  "PRODUCTION_WORKFLOW_UPDATED",
  "PRODUCTION_WORK_ORDER_CANCELLED",
  "PRODUCTION_WORK_ORDER_CREATED",
  "PRODUCT_CATEGORY_CREATED",
  "PRODUCT_CATEGORY_DELETED",
  "PRODUCT_CATEGORY_UPDATED",
  "PURCHASE_ORDER_AGREED",
  "PURCHASE_ORDER_CANCELLED",
  "PURCHASE_ORDER_CUSTOMER_CONFIRMED",
  "PURCHASE_ORDER_DEPOSIT_RECORDED",
  "PURCHASE_ORDER_DEPOSIT_UPDATED",
  "PURCHASE_ORDER_DESIGN_SENT",
  "PURCHASE_ORDER_DRAFT_CANCELLED",
  "PURCHASE_ORDER_DRAFT_CREATED",
  "PURCHASE_ORDER_DRAFT_UPDATED",
  "PURCHASE_ORDER_REVISION_CREATED",
  "QC_REJECTED",
  "REPEAT_ORDER_SETTINGS_UPDATED",
  "REPEAT_ORDER_TEST_FORCED",
  "SALES_ORDER_CANCELLED",
  "SALES_ORDER_CREATED",
  "SALES_ORDER_HPP_UPDATED",
  "SAMPLE_REJECTED",
  "STAGE_MOVED",
  "STAGE_REVERTED",
  "STAGE_SKIPPED",
  "TESTING_DATA_RESET",
  "USER_ACTIVATED",
  "USER_CREATED",
  "USER_DEACTIVATED",
  "USER_UPDATED",
];

const KNOWN_ENTITY_TYPES = [
  "AppUser",
  "Attendance",
  "AttendanceHoliday",
  "AttendanceSetting",
  "BusinessProfile",
  "CRMNote",
  "Customer",
  "CustomerType",
  "DesignRevision",
  "Expense",
  "GarmentSize",
  "Invoice",
  "InvoiceSettingPoint",
  "LeadSource",
  "Opportunity",
  "PaymentMethod",
  "PaymentTransaction",
  "ProductCategory",
  "ProductionWorkOrder",
  "PurchaseOrder",
  "SalesOrder",
  "System",
  "WhatsAppBroadcast",
  "WhatsAppCampaign",
  "WhatsAppCampaignTest",
];

test("log aktivitas hanya untuk Owner, Keuangan, dan Developer", () => {
  assert.equal(hasRole("KEUANGAN", AUDIT_VIEW_ROLES), true);
  assert.equal(hasRole("OWNER", AUDIT_VIEW_ROLES), true);
  assert.equal(hasRole("DEVELOPER", AUDIT_VIEW_ROLES), true);
  assert.equal(hasRole("ADMIN_CUSTOMER", AUDIT_VIEW_ROLES), false);
  assert.equal(hasRole("ADMIN_PO", AUDIT_VIEW_ROLES), false);
  assert.equal(hasRole("DESIGNER", AUDIT_VIEW_ROLES), false);
});

test("semua aksi yang tercatat punya label eksplisit bahasa Indonesia", () => {
  for (const action of KNOWN_ACTIONS) {
    assert.ok(Object.hasOwn(AUDIT_ACTION_LABEL, action), `label aksi ${action} belum ada di registry`);
  }
  for (const action of KNOWN_ACTIONS) {
    const label = auditActionLabel(action);
    assert.ok(label.length > 0, `label ${action} kosong`);
    assert.doesNotMatch(label, /_/, `label ${action} masih mengandung kode mentah`);
  }
});

test("semua jenis entitas yang tercatat punya label Indonesia", () => {
  for (const entityType of KNOWN_ENTITY_TYPES) {
    assert.ok(Object.hasOwn(AUDIT_ENTITY_LABEL, entityType), `label entitas ${entityType} belum ada di registry`);
  }
  for (const entityType of KNOWN_ENTITY_TYPES) {
    const label = auditEntityLabel(entityType);
    assert.ok(label.length > 0, `label ${entityType} kosong`);
  }
});

test("label aksi penting memakai frasa yang jelas", () => {
  assert.equal(auditActionLabel("OPPORTUNITY_STAGE_CHANGED"), "Pindah tahap peluang");
  assert.equal(auditActionLabel("PURCHASE_ORDER_AGREED"), "Setujui PO");
  assert.equal(auditActionLabel("PAYMENT_RECORDED"), "Catat pembayaran");
  assert.equal(auditActionLabel("INVOICE_ISSUED"), "Terbitkan invoice");
  assert.equal(auditActionLabel("PRODUCTION_WORK_ORDER_CREATED"), "Buat work order");
  assert.equal(auditActionLabel("SALES_ORDER_HPP_UPDATED"), "Ubah HPP Sales Order");
  assert.equal(auditActionLabel("SAMPLE_REJECTED"), "Tolak sampel");
  assert.equal(auditActionLabel("STAGE_MOVED"), "Pindah tahap produksi");
});

test("aksi & entitas baru tetap tampil lewat fallback yang dirapikan", () => {
  assert.equal(auditActionLabel("SOMETHING_NEW_HERE"), "Something new here");
  assert.equal(auditEntityLabel("NewThing"), "New thing");
  assert.equal(auditActionLabel(""), "");
  assert.equal(auditActionLabel("OPPORTUNITY_STAGE_CHANGED"), "Pindah tahap peluang");
});

test("data layer log aktivitas ter-gate role dan memakai filter yang benar", async () => {
  const source = await readFile(new URL("../lib/audit/data.ts", import.meta.url), "utf8");
  assert.match(source, /requireActor\(AUDIT_VIEW_ROLES\)/);
  assert.match(source, /orderBy: \{ createdAt: "desc" \}/);
  assert.match(source, /mode: "insensitive" as const/);
  assert.match(source, /actor: \{ select: \{ name: true, email: true, role: true \} \}/);
});

test("halaman /log-aktivitas menampilkan daftar, filter, dan detail", async () => {
  const page = await readFile(new URL("../app/(app)/log-aktivitas/page.tsx", import.meta.url), "utf8");
  assert.match(page, /getAuditEventPage/);
  assert.match(page, /getAuditLogFilterOptions/);
  assert.match(page, /parseOpenDateRange/);
  assert.match(page, /AuditEventDetailDialog/);
  assert.match(page, /pathname="\/log-aktivitas"/);
  assert.match(page, /DebouncedSearchInput/);
});

test("menu sidebar menampilkan Log aktivitas hanya untuk role yang berhak", async () => {
  const nav = await readFile(new URL("../components/app-nav.tsx", import.meta.url), "utf8");
  // Owner, Developer, dan Keuangan lolos lewat hasRole (Keuangan setara Owner).
  assert.match(nav, /const isOwnerEquivalent = hasRole\(role, OWNER_ACTION_ROLES\);/);
  assert.match(nav, /const canViewAudit = isOwnerEquivalent;/);
  assert.match(nav, /canViewAudit \? <NavLink[^>]*href: "\/log-aktivitas", label: "Log aktivitas"/);
});

test("dialog detail menampilkan field yang berubah dan metadata", async () => {
  const dialog = await readFile(new URL("../components/audit-event-detail.tsx", import.meta.url), "utf8");
  assert.match(dialog, /Field yang berubah/);
  assert.match(dialog, /JSON\.stringify\(event\.metadata, null, 2\)/);
  assert.match(dialog, /ROLE_LABEL\[event\.actor\.role\]/);
});
