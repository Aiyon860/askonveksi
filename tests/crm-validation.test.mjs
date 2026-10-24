import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  addCommunicationActivitySchema,
  bulkUpdateMasterDataSchema,
  createCustomerSchema,
  createProspectCustomerSchema,
  createOpportunitySchema,
  createUserSchema,
  cancelInvoiceSchema,
  cancelPurchaseOrderSchema,
  sortableMasterDataFieldsSchema,
  masterDataFieldsSchema,
  moveOpportunitySchema,
  publicLeadSchema,
  invoiceDraftSchema,
  purchaseOrderDraftSchema,
  invoiceScheduleSchema,
  paymentDeadlineUpdateSchema,
  editPaymentTransactionSchema,
  payInvoicePaymentTermSchema,
  payPaymentTermSchema,
  recordInitialPaymentSchema,
  purchaseOrderDepositSchema,
  recordFollowUpResultSchema,
  strongPasswordSchema,
  updateUserSchema,
  updateCustomerSchema,
  validateOpenOpportunitySchedule,
} from "../lib/crm/validation.ts";
import { downloadFilename } from "../lib/download-filename.ts";
import {
  parseAnalyticsDateRange,
  parseAnalyticsReportMode,
} from "../lib/analytics/report-period.ts";
import { parseFinanceDateRange, parseFinanceReportMode } from "../lib/finance/date-range.ts";
import { calculateConversionRate } from "../lib/analytics/conversion-rate.ts";
import { decorationMethodLabel, parseOpportunityDetailTab } from "../lib/crm/constants.ts";
import { formatPercentage } from "../lib/crm/format.ts";
import {
  CUSTOM_PRODUCTION_DEADLINE_VALUE,
  isProductionDeadlinePreset,
  productionDeadlineOptions,
} from "../lib/crm/production-deadline.ts";
import {
  activityStatusFromSchedule,
  addCalendarMonthsJakarta,
} from "../lib/crm/reminder-types.ts";
import {
  findImportCustomer,
  importCustomerLookupKeys,
  indexCustomers,
  upsertImportCustomerIndex,
} from "../lib/crm/customer-import.ts";
import { DATA_PAGE_SIZE, parsePageParam, parsePageSizeParam } from "../lib/pagination.ts";
import {
  CRM_OPERATOR_ROLES,
  DEAL_ROLES,
  ARCHIVE_ROLES,
  REVERSE_DEAL_ROLES,
  hasRole,
} from "../lib/auth/permissions.ts";
import { formatPurchaseOrderNo, formatPurchaseOrderRevisionNo, purchaseOrderCustomerCodeBase } from "../lib/crm/numbers.ts";

const userDataSource = await readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8");
const userActionsSource = await readFile(new URL("../app/actions/users.ts", import.meta.url), "utf8");
const crmActionsSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");

test("akun Developer tersembunyi dan tidak dapat dikelola role lain", () => {
  assert.match(userDataSource, /role: \{ not: "DEVELOPER" \}/);
  assert.match(userActionsSource, /assertCanManageDeveloper/);
  assert.match(userActionsSource, /actor\.role !== "DEVELOPER"/);
});

test("Sales/PIC lama tetap dapat dipertahankan saat customer diedit", () => {
  assert.match(crmActionsSource, /OR: \[\{ role: "ADMIN_CUSTOMER", isActive: true \}, \{ id: current\.salesPicId \?\? "" \}\]/);
});

test("kode PO customer mengikuti nama dan format Jakarta", () => {
  assert.equal(purchaseOrderCustomerCodeBase("Abyan"), "ABY");
  assert.equal(purchaseOrderCustomerCodeBase("PT Abdul Khamid"), "ABK");
  assert.equal(purchaseOrderCustomerCodeBase("Berkah Jaya Mandiri"), "BJM");
  assert.equal(purchaseOrderCustomerCodeBase("Sumber Rejeki Makmur Abadi"), "SRM");
  assert.equal(formatPurchaseOrderNo("BJM", 2, new Date("2026-09-13T02:00:00.000Z")), "PO-BJM130926-2");
  assert.equal(formatPurchaseOrderRevisionNo("PO-BJM130926-1-R2", 3), "PO-BJM130926-1-R3");
});

test("opportunity hanya menerima field peluang yang masih digunakan", () => {
  const inlineCustomer = createOpportunitySchema.safeParse({
    title: "Seragam panitia",
    name: "Customer inline",
    whatsapp: "08123456789",
  });
  assert.equal(inlineCustomer.success, false);

  const valid = createOpportunitySchema.safeParse({
    customerId: "cm123456789012",
    title: "Seragam panitia",
    estimatedQuantity: "150",
    estimatedValue: "15000000",
    deadline: "2026-12-01",
    nextAction: "Hubungi customer",
    nextActionAt: "2026-09-09T09:00",
  });
  assert.equal(valid.success, true);
  assert.equal("estimatedQuantity" in valid.data, false);
  assert.equal("estimatedValue" in valid.data, false);
  assert.equal("deadline" in valid.data, false);
  assert.equal(
    validateOpenOpportunitySchedule({
      nextAction: "Hubungi customer",
      nextActionAt: "2026-09-09T09:00",
    }),
    null,
  );
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

test("edit customer menerima status reminder repeat order", () => {
  const base = {
    customerId: "cm123456789012",
    version: "1",
    name: "Budi",
    companyName: "",
    whatsapp: "08123456789",
    email: "",
    instagram: "",
    address: "",
    city: "Bandung",
    notes: "",
    customerTypeId: "master-ct-personal",
    leadSourceId: "",
    salesPicId: "",
  };
  assert.equal(updateCustomerSchema.safeParse({ ...base, orderReminderEnabled: "true" }).success, true);
  assert.equal(updateCustomerSchema.safeParse({ ...base, orderReminderEnabled: "false" }).success, true);
  assert.equal(updateCustomerSchema.safeParse({ ...base, orderReminderEnabled: "invalid" }).success, false);
});

test("prospek baru mewajibkan kota dan asal", () => {
  const base = { name: "Budi", whatsapp: "08123456789", customerTypeId: "master-ct-personal", city: "Bandung", address: "Cimahi" };
  assert.equal(createProspectCustomerSchema.safeParse(base).success, true);
  assert.equal(createProspectCustomerSchema.safeParse({ ...base, city: "" }).success, false);
  assert.equal(createProspectCustomerSchema.safeParse({ ...base, address: "" }).success, false);
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
  const parsed = publicLeadSchema.safeParse(valid);
  assert.equal(parsed.success, true);
  assert.equal("estimatedQuantity" in parsed.data, false);
  assert.equal("deadline" in parsed.data, false);
  assert.equal(publicLeadSchema.safeParse({ ...valid, whatsapp: "123" }).success, false);
});

test("field penugasan opportunity tidak tertukar dengan profil customer", async () => {
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  assert.match(actionSource, /leadSourceId: formData\.has\("opportunityLeadSourceId"\)/);
  assert.match(actionSource, /salesPicId: formData\.has\("opportunitySalesPicId"\)/);
  assert.match(actionSource, /function customerFields[\s\S]+leadSourceId: formValue\(formData, "leadSourceId"\),[\s\S]+salesPicId: formValue\(formData, "salesPicId"\),/);
});

test("password tidak dibatasi kompleksitas dan item invoice divalidasi pada boundary", async () => {
  assert.equal(strongPasswordSchema.safeParse("").success, false);
  assert.equal(strongPasswordSchema.safeParse("a").success, true);
  assert.equal(createUserSchema.safeParse({ name: "Budi", email: "budi@example.com", role: "ADMIN_CUSTOMER", password: "a" }).success, true);
  assert.equal(createUserSchema.safeParse({ name: "Budi", email: "budi@example.com", role: "ADMIN_CUSTOMER", temporaryPassword: "a" }).success, false);

  const invalidInvoice = invoiceDraftSchema.safeParse({
    opportunityId: "cm123456789012",
    discountType: "PERCENTAGE",
    discountValue: "10",
    items: [{ productName: "", description: "Kaos", unitPrice: "50000" }],
  });
  assert.equal(invalidInvoice.success, false);

  const invoiceFormSource = await readFile(new URL("../components/crm/invoice-form.tsx", import.meta.url), "utf8");
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  assert.match(invoiceFormSource, /name="itemDiscountPercent"/);
  assert.match(invoiceFormSource, /name="taxPercent"/);
  assert.match(invoiceFormSource, /name="itemProductName"/);
  assert.match(invoiceFormSource, /name="itemDescription"/);
  assert.doesNotMatch(invoiceFormSource, /profitPercent/);
  assert.doesNotMatch(actionSource, /profitPercent: formValue/);
  assert.match(actionSource, /discountPercent/);
  assert.match(actionSource, /taxPercent: formValue\(formData, "taxPercent"\)/);
});

test("Add On invoice berdiri sendiri: parse form, validasi, dan UI global", async () => {
  const itemBase = {
    purchaseOrderItemId: "cm123456789012",
    productName: "Jaket Polirevo",
    description: "",
    unitPrice: "100000",
    discountPercent: "0",
  };
  const valid = invoiceDraftSchema.safeParse({
    opportunityId: "cm123456789012",
    purchaseOrderId: "cm123456789013",
    dueAt: "2026-11-15",
    discountPercent: "0",
    taxPercent: "0",
    items: [itemBase],
    addons: [{ label: "Kerah", unitAmount: "10000" }],
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.addons.length, 1);
  assert.equal(valid.data.addons[0].qty, 1);
  assert.equal("addons" in valid.data.items[0], false);

  const withoutAddons = invoiceDraftSchema.safeParse({
    opportunityId: "cm123456789012",
    purchaseOrderId: "cm123456789013",
    dueAt: "2026-11-15",
    discountPercent: "0",
    taxPercent: "0",
    items: [itemBase],
  });
  assert.equal(withoutAddons.success, true);
  assert.deepEqual(withoutAddons.data.addons, []);

  const tooMany = invoiceDraftSchema.safeParse({
    opportunityId: "cm123456789012",
    purchaseOrderId: "cm123456789013",
    dueAt: "2026-11-15",
    discountPercent: "0",
    taxPercent: "0",
    items: [itemBase],
    addons: Array.from({ length: 21 }, (_, index) => ({ label: `Add ${index}`, unitAmount: "1000" })),
  });
  assert.equal(tooMany.success, false);

  const badLabel = invoiceDraftSchema.safeParse({
    opportunityId: "cm123456789012",
    purchaseOrderId: "cm123456789013",
    dueAt: "2026-11-15",
    discountPercent: "0",
    taxPercent: "0",
    items: [itemBase],
    addons: [{ label: "X", unitAmount: "1000" }],
  });
  assert.equal(badLabel.success, false);

  const badAmount = invoiceDraftSchema.safeParse({
    opportunityId: "cm123456789012",
    purchaseOrderId: "cm123456789013",
    dueAt: "2026-11-15",
    discountPercent: "0",
    taxPercent: "0",
    items: [itemBase],
    addons: [{ label: "Kerah", unitAmount: "-5" }],
  });
  assert.equal(badAmount.success, false);

  const [invoiceFormSource, actionSource, pdfSource, detailSource, pageSource] = await Promise.all([
    readFile(new URL("../components/crm/invoice-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/invoice-pdf.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/invoice-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(invoiceFormSource, /groupPurchaseOrderInvoiceItems/);
  assert.match(invoiceFormSource, /name="itemPurchaseOrderItemId"/);
  assert.match(invoiceFormSource, /name="addonLabel"/);
  assert.match(invoiceFormSource, /name="addonAmount"/);
  assert.match(invoiceFormSource, /MAX_ADDONS/);
  assert.doesNotMatch(invoiceFormSource, /name="itemQuantity"/);
  assert.doesNotMatch(invoiceFormSource, /name="itemSleeveLength"/);
  assert.doesNotMatch(invoiceFormSource, /item-\$\{rowIndex\}-addon/);
  assert.match(actionSource, /formData\.getAll\("addonLabel"\)/);
  assert.match(actionSource, /parsed\.data\.addons/);
  assert.match(actionSource, /tx\.invoiceAddon\.deleteMany/);
  assert.doesNotMatch(pdfSource, /section: "Add On"/, "PDF tidak memakai pembatas teks Add On");
  assert.match(pdfSource, /for \(const addon of addonRows\)/);
  assert.ok(pdfSource.indexOf("for (const item of invoice.items)") < pdfSource.indexOf("for (const addon of addonRows)"), "baris produk harus dicetak sebelum baris Add On");
  assert.match(detailSource, /detail\.addons/);
  // Detail invoice memakai satu tabel dengan lebar kolom tetap agar Add On sejajar produk.
  assert.match(detailSource, /className="min-w-\[42rem\] table-fixed"/);
  assert.match(detailSource, /<colgroup>/);
  // Add On diberi penanda visual yang konsisten dengan form.
  assert.match(detailSource, /<Badge variant="info">Add On<\/Badge>/);
  assert.match(detailSource, /className="bg-info-surface\/40 hover:bg-info-surface\/60"/);
  assert.match(pageSource, /invoice\.addons/);
  // Snapshot invoice di halaman peluang juga memakai satu tabel berlebar tetap.
  assert.match(pageSource, /className="min-w-\[42rem\] table-fixed"/);
  assert.match(pageSource, /<colgroup>/);
  assert.match(pageSource, /<Badge variant="info">Add On<\/Badge>/);
  assert.match(pageSource, /className="bg-info-surface\/40 hover:bg-info-surface\/60"/);
});

test("migrasi Add On global tidak menghapus Add On invoice lama", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20261024010000_invoice_global_addon/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "InvoiceAddon"/);
  assert.match(sql, /InvoiceAddon_invoiceId_position_key/);
  assert.match(sql, /ON DELETE CASCADE/);
  assert.doesNotMatch(sql, /DROP TABLE "InvoiceItemAddon"/);
});

test("constraint gross invoice mengizinkan add on sebagai batas bawah", async () => {
  const migrationSource = await readFile(new URL("../prisma/migrations/20261014010000_invoice_addon_gross/migration.sql", import.meta.url), "utf8");
  assert.match(migrationSource, /"grossAmount" >= round\(quantity::numeric \* "unitPrice", 2\)/);
  assert.match(migrationSource, /"total" = "grossAmount" - "discountAmount"/);
  assert.match(migrationSource, /SalesOrderItem_values_valid/);
});

test("PO memakai jenis pakaian, master ukuran, matriks lengan, dan roster", () => {
  const itemBase = {
    key: "item-1",
    name: "Jersey home",
    pola: "Jersey home",
    decorationMethods: ["NONE"],
    sizes: [
      { sizeId: "garment-size-m", sleeveLength: "PENDEK", quantity: 0 },
      { sizeId: "garment-size-m", sleeveLength: "PANJANG", quantity: 2 },
    ],
    rosterMode: "manual",
    roster: [
      { memberId: "G-1", name: "Budi", sizeId: "garment-size-m", sleeveLength: "PANJANG" },
      { memberId: "G-2", name: "Siti", sizeId: "garment-size-m", sleeveLength: "PANJANG" },
    ],
  };
  const valid = {
    opportunityId: "cm123456789012",
    garmentType: "JERSEY",
    instansi: "SMA Negeri 1",
    productName: "Jersey tim",
    material: "Dry fit",
    deadline: "2026-09-30",
    designDeadline: "2026-09-20",
    depositRequired: false,
    items: [itemBase],
  };
  assert.equal(purchaseOrderDraftSchema.safeParse(valid).success, true);
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, orderDate: "2026-03-15", designDeadline: "2026-03-15" }).success, true);
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, orderDate: "2026-03-15", designDeadline: "2026-03-14" }).success, false);
  const missingDeadline = purchaseOrderDraftSchema.safeParse({ ...valid, deadline: "" });
  assert.equal(missingDeadline.success, false);
  assert.equal(missingDeadline.error.issues[0]?.message, "Deadline produksi wajib dipilih.");
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, designDeadline: "" }).success, false);
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, material: "" }).success, false);
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, instansi: "" }).success, false);
  // Revisi: isian global "Nama Produk" dihapus dari schema/form — key asing diabaikan zod
  // (kolom DB productName diisi server dari nama produk item pertama).
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, productName: "" }).success, true);
  // Revisi: pola per produk wajib terisi di tiap item (bukan lagi di header).
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, items: [{ ...itemBase, pola: "" }] }).success, false);
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, items: [{ ...itemBase, pola: "Pola B" }] }).success, true);
  const dupSizes = { ...itemBase, sizes: [{ sizeId: "garment-size-m", sleeveLength: "PANJANG", quantity: 2 }, { sizeId: "garment-size-m", sleeveLength: "PANJANG", quantity: 1 }] };
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, items: [dupSizes] }).success, false);
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, items: [{ ...itemBase, rosterMode: "none", roster: [] }] }).success, true);
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, items: [{ ...itemBase, rosterMode: "excel", roster: [] }] }).success, true);
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, items: [{ ...itemBase, rosterMode: "excel" }] }).success, false);
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, items: [] }).success, false);
});

test("opsi deadline produksi dihitung dari tanggal Jakarta dan mempertahankan tanggal tersimpan", () => {
  const options = productionDeadlineOptions(new Date("2026-09-09T06:00:00.000Z"));

  assert.deepEqual(options, [
    { label: "1 minggu (16 September 2026)", value: "2026-09-16" },
    { label: "2 minggu (23 September 2026)", value: "2026-09-23" },
    { label: "3 minggu (30 September 2026)", value: "2026-09-30" },
    { label: "1 bulan (9 Oktober 2026)", value: "2026-10-09" },
  ]);

  assert.deepEqual(productionDeadlineOptions(new Date("2026-09-09T06:00:00.000Z"), "2026-09-30"), options);
  assert.deepEqual(productionDeadlineOptions(new Date("2026-09-09T06:00:00.000Z"), "2026-10-01")[0], {
    label: "Tanggal tersimpan (1 Oktober 2026)",
    value: "2026-10-01",
    isStoredValue: true,
  });
  assert.deepEqual(productionDeadlineOptions("2026-03-15"), [
    { label: "1 minggu (22 Maret 2026)", value: "2026-03-22" },
    { label: "2 minggu (29 Maret 2026)", value: "2026-03-29" },
    { label: "3 minggu (5 April 2026)", value: "2026-04-05" },
    { label: "1 bulan (15 April 2026)", value: "2026-04-15" },
  ]);
});

test("skema pembatalan PO dan invoice mewajibkan alasan yang jelas", () => {
  assert.equal(cancelPurchaseOrderSchema.safeParse({ purchaseOrderId: "cm123456789012", version: 1, cancelReason: "Salah input customer" }).success, true);
  assert.equal(cancelPurchaseOrderSchema.safeParse({ purchaseOrderId: "cm123456789012", version: 1, cancelReason: "" }).success, false);
  assert.equal(cancelInvoiceSchema.safeParse({ invoiceId: "cm123456789012", version: 1, cancelReason: "Harga salah" }).success, true);
  assert.equal(cancelInvoiceSchema.safeParse({ invoiceId: "cm123456789012", version: 1, cancelReason: "xx" }).success, false);
});

test("membatalkan invoice draft tidak lagi diblokir CHECK issuedAt", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20260928010000_relax_invoice_issued_at_required/migration.sql", import.meta.url), "utf8");
  const actions = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  const responseSource = await readFile(new URL("../lib/actions/response.ts", import.meta.url), "utf8");

  assert.match(sql, /DROP CONSTRAINT IF EXISTS "Invoice_issued_at_required"/);
  assert.match(sql, /"status" <> 'ISSUED' OR "issuedAt" IS NOT NULL/);
  // Klausa lama harus hilang, kalau tidak migrasi tidak mengubah perilaku apa pun.
  assert.doesNotMatch(sql, /status = 'DRAFT' OR "issuedAt" IS NOT NULL/);

  // PO dan invoice memakai guard yang sama; kegagalan sebelumnya murni dari constraint DB.
  assert.match(actions, /cancelInvoiceAction[\s\S]{0,1200}requireActor\(OWNER_ACTION_ROLES\)/);
  assert.match(actions, /cancelPurchaseOrderAction[\s\S]{0,1200}requireActor\(OWNER_ACTION_ROLES\)/);
  assert.match(actions, /data: \{ status: "CANCELLED", version: \{ increment: 1 \} \}/);

  // Error tak terduga harus meninggalkan jejak di log, bukan hanya toast generik.
  assert.match(responseSource, /console\.error\("\[redirecting-action\]"/);
});

test("deadline produksi mengenali preset dan nilai kustom", () => {
  const reference = new Date("2026-09-09T06:00:00.000Z");
  const presets = productionDeadlineOptions(reference);

  assert.equal(presets.every((option) => isProductionDeadlinePreset(option.value, reference)), true);
  assert.equal(isProductionDeadlinePreset("2026-10-01", reference), false);
  assert.equal(CUSTOM_PRODUCTION_DEADLINE_VALUE, "CUSTOM");
  assert.equal(purchaseOrderDraftSchema.shape.deadline.safeParse("2026-09-16").success, true);
  assert.equal(purchaseOrderDraftSchema.shape.deadline.safeParse("CUSTOM").success, false);
});

test("matriks PO mewajibkan bilangan bulat nol atau lebih dan minimal satu pesanan", () => {
  const baseItem = {
    key: "item-1",
    name: "Kaos home",
    pola: "Kaos komunitas",
    decorationMethods: ["SABLON_PLASTISOL"],
    rosterMode: "none",
    roster: [],
  };
  const base = {
    opportunityId: "cm123456789012",
    garmentType: "NON_JERSEY",
    instansi: "Komunitas Lari",
    productName: "Kaos komunitas",
    material: "Cotton combed",
    deadline: "2026-09-30",
    designDeadline: "2026-09-20",
    depositRequired: false,
    items: [{ ...baseItem }],
  };
  const withSizes = (sizes) => ({ ...base, items: [{ ...baseItem, sizes }] });
  const size = { sizeId: "garment-size-m", sleeveLength: "PENDEK" };

  assert.equal(purchaseOrderDraftSchema.safeParse(withSizes([{ ...size, quantity: 1 }])).success, true);
  assert.equal(purchaseOrderDraftSchema.safeParse(withSizes([{ ...size, quantity: "" }])).success, false);
  assert.equal(purchaseOrderDraftSchema.safeParse(withSizes([{ ...size, quantity: -1 }])).success, false);
  assert.equal(purchaseOrderDraftSchema.safeParse(withSizes([{ ...size, quantity: 1.5 }])).success, false);
  assert.equal(purchaseOrderDraftSchema.safeParse(withSizes([{ ...size, quantity: "1.5" }])).success, false);
  assert.equal(purchaseOrderDraftSchema.safeParse(withSizes([{ ...size, quantity: "1e3" }])).success, false);
  assert.equal(purchaseOrderDraftSchema.safeParse(withSizes([{ ...size, quantity: "abc" }])).success, false);
  assert.equal(purchaseOrderDraftSchema.safeParse(withSizes([{ ...size, quantity: 0 }])).success, false);
});

test("PO hanya menerima metode dekorasi yang tersedia", () => {
  const itemBase = {
    key: "item-1",
    name: "Jersey tim",
    pola: "Jersey tim",
    sizes: [{ sizeId: "garment-size-m", sleeveLength: "PANJANG", quantity: 2 }],
    rosterMode: "none",
    roster: [],
  };
  const base = {
    opportunityId: "cm123456789012",
    garmentType: "JERSEY",
    instansi: "SMA Negeri 1",
    productName: "Jersey tim",
    material: "Dry fit",
    deadline: "2026-09-30",
    designDeadline: "2026-09-20",
    depositRequired: false,
    items: [{ ...itemBase, decorationMethods: ["NONE"] }],
  };
  const withMethods = (decorationMethods) => ({ ...base, items: [{ ...itemBase, decorationMethods }] });

  for (const decorationMethods of [["NONE"], ["PRINTING"], ["SABLON_DTF", "SABLON_RUBBER"], ["BORDIR"], ["PRINTING", "BORDIR"]]) {
    assert.equal(purchaseOrderDraftSchema.safeParse(withMethods(decorationMethods)).success, true);
  }
  // Tinta dihapus dari opsi (data lama tetap terbaca lewat label lawas).
  assert.equal(purchaseOrderDraftSchema.safeParse(withMethods(["TINTA"])).success, false);
  assert.equal(purchaseOrderDraftSchema.safeParse(withMethods(["SABLON"])).success, false);
  assert.equal(purchaseOrderDraftSchema.safeParse(withMethods(["Bordir komputer bebas"])).success, false);
  assert.equal(purchaseOrderDraftSchema.safeParse(withMethods([])).success, false);
});

test("owner menjadi role tertinggi pada permission aplikasi", () => {
  for (const roles of [CRM_OPERATOR_ROLES, DEAL_ROLES, ARCHIVE_ROLES, REVERSE_DEAL_ROLES]) {
    assert.equal(hasRole("OWNER", roles), true);
    assert.equal(hasRole("DEVELOPER", roles), true);
  }
  assert.equal(hasRole("OWNER", ["ADMIN_CUSTOMER"]), true);
  assert.equal(hasRole("ADMIN_CUSTOMER", DEAL_ROLES), true);
});

test("tab detail peluang dimulai dari PO dan label dekorasi memiliki fallback yang aman", () => {
  assert.equal(parseOpportunityDetailTab(undefined), "po");
  assert.equal(parseOpportunityDetailTab("invoice"), "invoice");
  assert.equal(parseOpportunityDetailTab(["aktivitas", "po"]), "aktivitas");
  // Halaman detail peluang dimulai dari PO; tautan lama ?tab=peluang ikut jatuh ke PO.
  assert.equal(parseOpportunityDetailTab("peluang"), "po");
  assert.equal(parseOpportunityDetailTab("tidak-valid"), "po");
  assert.equal(decorationMethodLabel("BORDIR"), "Bordir");
  assert.equal(decorationMethodLabel("Nilai lama"), "Nilai lama");
});

test("kartu Follow Up tidak bisa dibuka: hanya Negosiasi dan seterusnya", async () => {
  const constantsSource = await readFile(new URL("../lib/crm/constants.ts", import.meta.url), "utf8");
  const boardSource = await readFile(new URL("../components/crm/pipeline-board.tsx", import.meta.url), "utf8");
  const detailPageSource = await readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8");
  const tabsSource = await readFile(new URL("../components/crm/opportunity-process-tabs.tsx", import.meta.url), "utf8");
  // Aturan tunggal dipakai semua daftar: hanya Follow Up yang terkunci.
  assert.match(constantsSource, /export function canOpenOpportunityDetail\(stage: string\) \{\s*return stage !== "FOLLOW_UP";\s*\}/);
  // Judul hanya menjadi tautan saat kartu boleh dibuka; Follow Up memakai teks redup.
  assert.match(boardSource, /const canOpenDetail = canOpenOpportunityDetail\(opportunity\.stage\)/);
  assert.match(boardSource, /canOpenDetail \? \(/);
  assert.match(boardSource, /"border-muted-foreground\/25 bg-muted\/60"/);
  // Tab Peluang dihapus: panel kualifikasi tidak lagi dirender, daftar tab mulai dari PO.
  assert.doesNotMatch(detailPageSource, /OpportunityProcessPanel value="peluang"/);
  assert.doesNotMatch(detailPageSource, /Kualifikasi dan next action/);
  assert.match(tabsSource, /\["po", "PO"\]/);
  assert.doesNotMatch(tabsSource, /\["peluang", "Peluang"\]/);
});

test("jalur lain ke detail peluang Follow Up juga terkunci", async () => {
  const [prospectsSource, timelineSource, historiesSource, customerDetailSource, dataSource] = await Promise.all([
    readFile(new URL("../app/(app)/crm/prospek/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/communication-history.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/customer-histories.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/customer-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8"),
  ]);
  // Tiap daftar memutuskan lewat helper yang sama sebelum merender tautan.
  assert.match(prospectsSource, /\{canOpenOpportunityDetail\(item\.stage\) \? <Link/);
  assert.match(timelineSource, /canOpenOpportunityDetail\(activity\.opportunity\.stage\) \? \(/);
  assert.match(historiesSource, /canOpenOpportunityDetail\(item\.opportunity\.stage\) \? <Link/);
  assert.match(historiesSource, /canOpenOpportunityDetail\(opportunity\.stage\) \? <Link/);
  assert.match(customerDetailSource, /canOpenOpportunityDetail\(opportunity\.stage\) \? \(/);
  // Payload riwayat & dashboard ikut membawa tahap agar klien bisa memutuskan.
  assert.match(dataSource, /select: \{ id: true, title: true, nextAction: true, nextActionAt: true, stage: true, customer: \{ select: \{ name: true \} \} \}/);
  assert.match(dataSource, /opportunity: \{ select: \{ id: true, opportunityNo: true, title: true, stage: true \} \},\s*\} satisfies Prisma\.CommunicationActivitySelect;/);
});

test("menu analytics hanya menyalakan satu item sidebar", async () => {
  const navSource = await readFile(new URL("../components/app-nav.tsx", import.meta.url), "utf8");
  assert.match(navSource, /if \(href === "\/analytics"\) return pathname === href;/);
});

test("lead baru dapat divalidasi untuk langsung masuk negosiasi", () => {
  assert.equal(moveOpportunitySchema.safeParse({ opportunityId: "cm123456789012", version: "1", stage: "NEGOSIASI", cancelReason: "" }).success, true);
});

test("aksi pindah status dari detail peluang tidak fallback ke board", async () => {
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  const detailPageSource = await readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(actionSource, /function opportunityRedirectPath[\s\S]+const fallback = opportunityTabFallback\(formData, "po"\)/);
  assert.match(actionSource, /export async function moveOpportunityStageAction[\s\S]+const redirectPath = opportunityRedirectPath\(formData\)/);
  // Panel Status pipeline dihapus dari semua tab detail peluang; pindah status hanya via board.
  assert.doesNotMatch(detailPageSource, /Status pipeline/);
  assert.doesNotMatch(detailPageSource, /OpportunityStageForm/);
});

test("R10: tab Deal dilebur ke Invoice & Deal dan tautan ?tab=deal diarahkan ke tab invoice", async () => {
  const [constantsSource, tabsSource, detailPageSource, actionSource, invoiceDetailSource] = await Promise.all([
    readFile(new URL("../lib/crm/constants.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/opportunity-process-tabs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/invoice-detail.tsx", import.meta.url), "utf8"),
  ]);
  // Daftar tab resmi tidak lagi memuat "deal"; parser menampung tautan lama ke tab invoice.
  assert.equal(parseOpportunityDetailTab("deal"), "invoice");
  assert.equal(parseOpportunityDetailTab(["deal", "po"]), "invoice");
  assert.match(constantsSource, /export const OPPORTUNITY_DETAIL_TABS = \["po", "invoice", "aktivitas"\] as const;/);
  assert.match(tabsSource, /\["invoice", "Invoice & Deal"\]/);
  assert.doesNotMatch(tabsSource, /\["deal"/);
  // Panel Deal dilebur ke panel invoice: kartu lengkapi deal kini berada di dalamnya.
  assert.doesNotMatch(detailPageSource, /OpportunityProcessPanel value="deal"/);
  const invoicePanelAt = detailPageSource.indexOf('<OpportunityProcessPanel value="invoice">');
  const dealCardAt = detailPageSource.indexOf('<Card id="complete-deal">');
  assert.ok(invoicePanelAt >= 0 && dealCardAt > invoicePanelAt, "kartu lengkapi deal harus berada di dalam panel invoice");
  // Tidak ada tautan ?tab=deal tersisa di aplikasi (hanya komentar di parser).
  assert.doesNotMatch(actionSource, /\?tab=deal/);
  assert.doesNotMatch(detailPageSource, /\?tab=deal/);
  assert.doesNotMatch(invoiceDetailSource, /\?tab=deal/);
  // Flash simpan/revisi jadwal invoice dan Terbitkan (finalize) mengarahkan pengguna ke tab invoice.
  assert.match(actionSource, /flashMessagePath\(`\/crm\/peluang\/\$\{parsed\.data\.opportunityId\}\?tab=invoice`/);
  assert.match(actionSource, /flashMessagePath\(`\/crm\/peluang\/\$\{issuedInvoice\.opportunityId\}\?tab=invoice`/);
});

test("Jadwal invoice: LUNAS tanpa termin, DP memakai nominal, deadline opsional di skema", async () => {
  // Disimpan bersama draft; kewajiban termin DP dinilai server (buildPaymentSchedule) memakai sisa otoritatif.
  assert.equal(invoiceScheduleSchema.safeParse({ kind: "LUNAS", initialValueType: "PERCENTAGE", initialValue: "100", initialDueAt: "", terms: [] }).success, true);
  assert.equal(invoiceScheduleSchema.safeParse({ kind: "DP", initialValueType: "NOMINAL", initialValue: "200000", initialDueAt: "", terms: [{ valueType: "NOMINAL", value: "800000", dueAt: "" }] }).success, true);
  // Deadline DP dan termin boleh kosong (tanpa batas).
  assert.equal(invoiceScheduleSchema.safeParse({ kind: "DP", initialValueType: "NOMINAL", initialValue: "200000", initialDueAt: "", terms: [{ valueType: "NOMINAL", value: "800000", dueAt: "" }, { valueType: "NOMINAL", value: "1", dueAt: "2026-12-01" }] }).success, true);
  // LUNAS: tanpa termin dan tanpa deadline sendiri (mengikuti jatuh tempo).
  assert.equal(invoiceScheduleSchema.safeParse({ kind: "LUNAS", initialValueType: "PERCENTAGE", initialValue: "100", initialDueAt: "2026-12-01", terms: [] }).success, false);
  assert.equal(invoiceScheduleSchema.safeParse({ kind: "LUNAS", initialValueType: "PERCENTAGE", initialValue: "100", initialDueAt: "", terms: [{ valueType: "NOMINAL", value: "1", dueAt: "2026-12-01" }] }).success, false);
  // DP tanpa termin lolos skema; kewajiban termin ada di action setelah membaca total & deposit DB.
  assert.equal(invoiceScheduleSchema.safeParse({ kind: "DP", initialValueType: "NOMINAL", initialValue: "0", initialDueAt: "", terms: [] }).success, true);
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  assert.match(actionSource, /if \(kind === "DP" && schedule\.terms\.length === 0\) throw new UserFacingError\("DP wajib memiliki minimal satu termin\."\)/);
  assert.match(actionSource, /if \(kind === "DEPOSIT" && schedule\.terms\.length === 0\) throw new UserFacingError\("Deposit wajib memiliki minimal satu termin sisa\."\)/);
  assert.match(actionSource, /DP nominal yang menutup sisa tagihan \(setelah deposit\) dihitung Lunas/);
  assert.match(actionSource, /const coversCollectible = schedule\.kind === "DP" && schedule\.initialValueType === "NOMINAL" && requestedInitial\.gte\(collectibleTotal\)/);
});

test("Form invoice menyimpan jadwal DP/Lunas bersama draft lewat satu tombol", async () => {
  const source = await readFile(new URL("../components/crm/invoice-form.tsx", import.meta.url), "utf8");
  // Jatuh tempo diisi manual (tanpa paksa H+7 saat simpan maupun terbit).
  assert.match(source, /name="dueAt"/);
  assert.match(source, /Tgl\. jatuh tempo/);
  assert.doesNotMatch(source, /7 hari/);
  // Jenis pembayaran default "Belum diatur" — jadwal opsional saat simpan.
  assert.match(source, /name="kind"/);
  assert.match(source, /NativeSelectOption value="">Belum diatur</);
  assert.match(source, /Opsional saat simpan; wajib diatur sebelum invoice diterbitkan\./);
  // DP memakai nominal MoneyInput; termin punya nilai + deadline opsional.
  assert.match(source, /name="initialValue"/);
  assert.match(source, /MoneyInput id=\{`initial-value-\$\{fieldKey\}`\}/);
  assert.match(source, /name="termValue"/);
  assert.match(source, /name="termDueAt"/);
  assert.doesNotMatch(source, /min=\{50\}/);
  // Tombol simpan menunggu kesiapan jadwal (sisa termin tertutup + urutan deadline).
  assert.match(source, /disabled=\{!scheduleReady\}/);
  assert.match(source, /Isi sisa/);
  // Deposit PO mengurangi sisa yang dijadwalkan.
  assert.match(source, /const collectibleAmount = Math\.max\(0, previewTotal - depositAmountNumber\)/);
});

test("deadline termin harus sehari setelah deadline terisi atau jatuh tempo", async () => {
  const formSource = await readFile(new URL("../components/crm/invoice-form.tsx", import.meta.url), "utf8");
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  // Client: min tanggal = baseline (deadline DP / jatuh tempo) atau termin terisi sebelumnya; termin kosong dilewati.
  assert.match(formSource, /min=\{previous \? addJakartaDays\(previous, 1\) : undefined\}/);
  assert.match(formSource, /const previous = previousFilledDueAt\(index\) \|\| scheduleBaseline/);
  assert.match(actionSource, /dueAt <= previousDueAt/);
  assert.match(actionSource, /previousLabel = initialDueAt \? "deadline DP\." : "jatuh tempo\.";/);
});

test("Jatuh tempo diisi manual; Terbitkan menagih dueAt + jadwal; DP Rp 0 finalisasi saat Terbitkan", async () => {
  const [actionSource, validationSource, issueSource] = await Promise.all([
    readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/validation.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/issue-invoice-action.tsx", import.meta.url), "utf8"),
  ]);
  // dueAt wajib di skema (preprocess kosong → "") dan dijaga saat Terbitkan.
  assert.match(validationSource, /dueAt: z\.preprocess\(/);
  assert.match(validationSource, /"Tgl\. jatuh tempo wajib diisi\."\)/);
  assert.match(actionSource, /if \(!invoice\.dueAt\) throw new UserFacingError\("Tgl\. jatuh tempo wajib diisi sebelum invoice diterbitkan\."\)/);
  assert.match(actionSource, /if \(!invoice\.pendingPayment\) throw new UserFacingError\("Jadwal pembayaran belum diatur\. Lengkapi jadwal DP\/Lunas pada draft invoice terlebih dahulu\."\)/);
  // Tidak ada lagi penetapan otomatis H+7 di mana pun.
  assert.doesNotMatch(actionSource, /addJakartaDays\(issuedAt, 7\)/);
  assert.doesNotMatch(actionSource, /addJakartaDays\(invoice\.issuedAt, 7\)/);
  // DP Rp 0 finalisasi dalam transaksi penerbitan (deal + SO + deposit + WO sekaligus).
  assert.match(actionSource, /invoice\.pendingPayment\.kind === "DP" && invoice\.pendingPayment\.initialAmount\.isZero\(\)/);
  assert.match(actionSource, /\? await finalizeDeal\(tx, actor, parsed\.data\.invoiceId, null\)/);
  assert.match(actionSource, /dan Work Order langsung terbentuk karena DP Rp 0\./);
  // Konfirmasi Terbitkan memberi tahu prasyarat dueAt + jadwal.
  assert.match(issueSource, /Tgl\. jatuh tempo dan jadwal pembayaran wajib sudah diisi pada draft/);
});

test("invoice DP terbayar berstatus Menunggu Pelunasan, bukan Belum Terbayar", async () => {
  const dataSource = await readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8");
  const invoicesPageSource = await readFile(new URL("../app/(app)/crm/invoices/page.tsx", import.meta.url), "utf8");
  // Mapper membedakan sisa tagihan yang pembayaran awalnya sudah tercatat.
  assert.match(dataSource, /"PARTIAL" as const/);
  assert.match(dataSource, /transactions: \{ where: \{ paymentTermId: null, status: "ACTIVE" \}/);
  assert.match(invoicesPageSource, /Menunggu Pelunasan/);
  assert.match(invoicesPageSource, /status === "PARTIAL"/);
  // Tanpa pembayaran awal sama sekali tetap Belum Terbayar.
  assert.match(invoicesPageSource, /Belum Terbayar/);
});

test("Detail Desain disembunyikan: hanya DEVELOPER yang bisa akses", async () => {
  const productionActionSource = await readFile(new URL("../app/actions/production.ts", import.meta.url), "utf8");
  const designDetailSource = await readFile(new URL("../lib/production/design-detail.ts", import.meta.url), "utf8");
  const navSource = await readFile(new URL("../components/app-nav.tsx", import.meta.url), "utf8");
  const serviceSource = await readFile(new URL("../lib/production/service.ts", import.meta.url), "utf8");
  // 4 aksi desain (simpan/timpa/reset/kirim) khusus DEVELOPER; aksi kanban lain tidak ikut terkunci.
  assert.equal((productionActionSource.match(/requireDeveloperActor\(\)/g) ?? []).length, 4);
  assert.match(productionActionSource, /requireActor\(PRODUCTION_ROLES\)/);
  assert.match(designDetailSource, /requireDeveloperActor\(\)/);
  assert.doesNotMatch(designDetailSource, /DETAIL_DESIGN_VIEW_ROLES/);
  // Menu hilang untuk selain DEVELOPER, entri tetap ada untuk DEVELOPER.
  assert.match(navSource, /item\.href !== "\/detail-desain"/);
  assert.match(navSource, /href: "\/detail-desain"/);
  // WO langsung masuk Produksi saat dibuat agar kanban tetap terisi.
  assert.match(serviceSource, /designCompletedAt: new Date\(\)/);
});

test("prop form invoice disanitasi: tanpa Decimal untuk Client Component", async () => {
  const detailPageSource = await readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8");
  // Objek PO mentah mengandung Decimal (deposit.amount); form hanya menerima salinan field aman.
  assert.doesNotMatch(detailPageSource, /purchaseOrder=\{agreedPo\}/);
  assert.match(detailPageSource, /items: agreedPo\.items\.map\(\(item\) => \(\{/);
  assert.match(detailPageSource, /sizes: agreedPo\.sizes\.map\(\(size\) => \(\{/);
  assert.match(detailPageSource, /purchaseOrder=\{invoicePo\}/);
  assert.match(detailPageSource, /editableInvoicePo = invoice\.purchaseOrderId === agreedPo\?\.id \? \(invoicePo \?\? null\) : null/);
});

test("Deal mengganti form dengan notifikasi setelah jadwal pembayaran tersimpan", async () => {
  const dataSource = await readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(dataSource, /pendingPayment: \{ select: \{ kind: true, initialDueAt: true \} \}/);
  assert.match(pageSource, /const scheduledPayment = invoiceDraft \? undefined : issuedInvoice\?\.pendingPayment/);
  assert.match(pageSource, /Jadwal pembayaran sudah tersimpan/);
});

test("pencatatan pembayaran memvalidasi waktu, referensi, dan identitas transaksi", () => {
  const initial = { salesOrderId: "cm123456789012", paymentMethodId: "payment-method-tunai", paidAt: "2026-09-05T10:00", reference: "TRX-001", note: "Transfer bank" };
  assert.equal(recordInitialPaymentSchema.safeParse(initial).success, true);
  assert.equal(recordInitialPaymentSchema.safeParse({ ...initial, salesOrderId: "pendek" }).success, false);
  assert.equal(recordInitialPaymentSchema.safeParse({ ...initial, paymentMethodId: "" }).success, false);
  assert.equal(payPaymentTermSchema.safeParse({ ...initial, paymentTermId: "cm123456789013" }).success, true);
  assert.equal(payPaymentTermSchema.safeParse({ ...initial, paymentTermId: "" }).success, false);
  assert.equal(payInvoicePaymentTermSchema.safeParse({ salesOrderId: initial.salesOrderId, paymentTermId: "cm123456789013", paymentMethodId: initial.paymentMethodId }).success, true);
  assert.equal(payInvoicePaymentTermSchema.safeParse({ salesOrderId: initial.salesOrderId, paymentTermId: "", paymentMethodId: initial.paymentMethodId }).success, false);
  const edit = { ...initial, transactionId: "cm123456789013", version: "1", amount: "450000" };
  assert.equal(editPaymentTransactionSchema.safeParse(edit).success, true);
  assert.equal(editPaymentTransactionSchema.safeParse({ ...edit, amount: "-1" }).success, false);
});

test("edit pengguna memvalidasi identitas, waktu perubahan, email, dan role", () => {
  const valid = {
    userId: "cm123456789012",
    updatedAt: "2026-08-29T09:00:00.000Z",
    name: "Budi Santoso",
    email: "budi@example.com",
    role: "ADMIN_CUSTOMER",
    password: "",
    confirmPassword: "",
  };

  assert.equal(updateUserSchema.safeParse(valid).success, true);
  assert.equal(updateUserSchema.safeParse({ ...valid, updatedAt: "bukan-tanggal" }).success, false);
  assert.equal(updateUserSchema.safeParse({ ...valid, email: "bukan-email" }).success, false);
  assert.equal(updateUserSchema.safeParse({ ...valid, role: "FINANCE" }).success, false);
  assert.equal(updateUserSchema.safeParse({ ...valid, password: "a", confirmPassword: "berbeda" }).success, false);
  assert.equal(updateUserSchema.safeParse({ ...valid, password: "a", confirmPassword: "a" }).success, true);
});

test("aksi pengguna memakai password awal tanpa kewajiban ganti password", async () => {
  const source = await readFile(new URL("../app/actions/users.ts", import.meta.url), "utf8");
  assert.match(source, /password: formData\.get\("password"\)/);
  assert.doesNotMatch(source, /temporaryPassword/);
  assert.doesNotMatch(source, /mustChangePassword/);
  assert.match(source, /export async function updateUserAction[\s\S]+password: formData\.get\("password"\),[\s\S]+confirmPassword: formData\.get\("confirmPassword"\)/);
});

test("nama file download memakai subjek dan tanggal dd-mm-yyyy", () => {
  const fixedDate = new Date("2026-09-09T02:00:00.000Z");
  assert.equal(downloadFilename("Jenis Customer", "xlsx", fixedDate), "jenis-customer-09-09-2026.xlsx");
  assert.equal(downloadFilename("Invoice INV/001", ".PDF", fixedDate), "invoice-inv-001-09-09-2026.pdf");
  assert.equal(downloadFilename("   ", "x lsx", fixedDate), "export-09-09-2026.xlsx");
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

test("jadwal reminder order memakai bulan kalender Jakarta dan menangani akhir bulan", () => {
  const acceptedAt = new Date("2026-08-30T20:00:00.000Z");
  assert.equal(addCalendarMonthsJakarta(acceptedAt, 3).toISOString(), "2026-11-29T20:00:00.000Z");
  assert.equal(addCalendarMonthsJakarta(acceptedAt, 6).toISOString(), "2027-02-27T20:00:00.000Z");

  const januaryEnd = new Date("2026-01-30T20:00:00.000Z");
  assert.equal(addCalendarMonthsJakarta(januaryEnd, 3).toISOString(), "2026-04-29T20:00:00.000Z");
});

test("status aktivitas berubah pada bulan ke-6 serta ditahan oleh peluang terbuka", () => {
  const schedule = [
    { type: "REACTIVATION", dueAt: new Date("2027-02-27T20:00:00.000Z") },
  ];
  assert.equal(activityStatusFromSchedule([], new Date("2026-09-01T00:00:00.000Z")), "BELUM_ORDER");
  assert.equal(activityStatusFromSchedule(schedule, new Date("2026-11-01T00:00:00.000Z")), "AKTIF");
  assert.equal(activityStatusFromSchedule(schedule, new Date("2027-03-01T00:00:00.000Z")), "TIDAK_AKTIF");
  assert.equal(activityStatusFromSchedule(schedule, new Date("2027-03-01T00:00:00.000Z"), true), "AKTIF");
});

test("revisi invoice dapat dibuat dari draft atau invoice terbit tanpa Sales Order", async () => {
  const [actionSource, workflowSource, pageSource] = await Promise.all([
    readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/invoice-workflow-section.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8"),
  ]);
  // Sumber revisi: draft atau invoice terbit yang belum punya Sales Order.
  assert.match(actionSource, /source\.status !== "DRAFT" && source\.status !== "ISSUED"/);
  assert.match(actionSource, /source\.status === "ISSUED" && source\.salesOrder/);
  assert.match(actionSource, /Invoice terbit yang sudah memiliki Sales Order tidak dapat direvisi/);
  assert.match(actionSource, /source\.status === "ISSUED" && !parsed\.data\.schedule/);
  // Nomor revisi diambil dari revisi terbesar agar celah dokumen batal tidak bentrok.
  assert.match(actionSource, /const latestRevision = aggregate\._max\.revision \?\? source\.revision/);
  assert.match(actionSource, /if \(latestRevision >= 4\)/);
  // Invoice terbit lama tetap ISSUED sampai revisi baru diterbitkan, lalu digantikan.
  assert.match(actionSource, /const previousIssued = invoice\.opportunity\.invoices\.filter/);
  assert.match(actionSource, /data: \{ status: "SUPERSEDED", version: \{ increment: 1 \} \}/);
  // UI menampilkan revisi pada invoice terbit tanpa SO, tetapi tidak pada dokumen lama
  // yang sudah punya revisi lebih baru atau saat batas revisi tercapai.
  assert.match(workflowSource, /invoiceStatus === "DRAFT" \|\| \(invoiceStatus === "ISSUED" && !hasSalesOrder\)/);
  assert.match(workflowSource, /!hasNewerActiveRevision && !revisionLimitReached/);
  assert.match(pageSource, /hasSalesOrder=\{Boolean\(invoice\.salesOrder\)\}/);
  assert.match(pageSource, /hasNewerActiveRevision=\{hasNewerActiveRevision\}/);
  assert.match(pageSource, /revisionLimitReached=\{latestInvoiceRevision >= 4\}/);
});

test("migration follow up menyimpan tiga offset, switch customer, template bawaan, dan menutup job lama", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20260911090000_revision_follow_up_settings/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /invoiceReminderOffsets/);
  assert.match(sql, /orderReminderEnabled/);
  assert.match(sql, /triggerType" <> 'MANUAL'/);
  assert.match(sql, /Selamat datang customer baru/);
  assert.match(sql, /Fitur repeat order telah dinonaktifkan/);
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

test("rentang tanggal analytics default ke bulan berjalan Jakarta", () => {
  const reference = new Date("2026-08-31T18:00:00.000Z");

  const defaultRange = parseAnalyticsDateRange(undefined, undefined, reference);
  assert.equal(defaultRange.from, "2026-09-01");
  assert.equal(defaultRange.to, "2026-09-30");
  assert.equal(defaultRange.start.toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(defaultRange.end.toISOString(), "2026-09-30T17:00:00.000Z");
  assert.equal(defaultRange.label, "Bulan berjalan");

  const customRange = parseAnalyticsDateRange("2026-09-05", "2026-09-10", reference);
  assert.equal(customRange.from, "2026-09-05");
  assert.equal(customRange.to, "2026-09-10");
  assert.equal(customRange.start.toISOString(), "2026-09-04T17:00:00.000Z");
  assert.equal(customRange.end.toISOString(), "2026-09-10T17:00:00.000Z");
  assert.equal(customRange.label, "2026-09-05 sampai 2026-09-10");

  const invalidRange = parseAnalyticsDateRange("2026-09-30", "2026-09-01", reference);
  assert.equal(invalidRange.from, "2026-09-01");
  assert.equal(invalidRange.to, "2026-09-30");

  assert.equal(parseAnalyticsReportMode("all"), "all");
  assert.equal(parseAnalyticsReportMode("range"), "range");
  assert.equal(parseAnalyticsReportMode("invalid"), "range");
});

test("rentang tanggal finance default ke bulan berjalan Jakarta", () => {
  const reference = new Date("2026-08-31T18:00:00.000Z");
  const defaultRange = parseFinanceDateRange(undefined, undefined, reference);

  assert.equal(defaultRange.from, "2026-09-01");
  assert.equal(defaultRange.to, "2026-09-30");
  assert.equal(defaultRange.start.toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(defaultRange.end.toISOString(), "2026-09-30T17:00:00.000Z");
  assert.equal(defaultRange.label, "Bulan berjalan");
  assert.equal(defaultRange.isDefault, true);

  const custom = parseFinanceDateRange("2026-09-05", "2026-09-07", reference);
  assert.equal(custom.start.toISOString(), "2026-09-04T17:00:00.000Z");
  assert.equal(custom.end.toISOString(), "2026-09-07T17:00:00.000Z");
  assert.equal(custom.label, "2026-09-05 sampai 2026-09-07");
  assert.equal(custom.isDefault, false);

  const invalid = parseFinanceDateRange("2026-09-10", "2026-09-01", reference);
  assert.equal(invalid.from, "2026-09-01");
  assert.equal(invalid.to, "2026-09-30");
});

test("mode finance mendukung rekapan semua order", () => {
  assert.equal(parseFinanceReportMode("all"), "all");
  assert.equal(parseFinanceReportMode("range"), "range");
  assert.equal(parseFinanceReportMode(undefined), "range");
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
  const pageSource = await readFile(new URL("../app/(app)/analytics/lead-sources/page.tsx", import.meta.url), "utf8");
  const clientSource = await readFile(new URL("../components/analytics/lead-sources/lead-sources-content-client.tsx", import.meta.url), "utf8");
  assert.match(dataSource, /requireActor\(ANALYTICS_ROLES\)/);
  assert.match(dataSource, /mode === "range"/);
  assert.match(dataSource, /o\."leadSourceId"/);
  assert.match(dataSource, /COUNT\(DISTINCT so\."opportunityId"\)/);
  assert.match(dataSource, /so\."status" = 'ACTIVE'/);
  // Filter rentang tanggal pindah ke client component saat redesign analytics.
  assert.match(pageSource, /LeadSourcesContent/);
  assert.match(clientSource, /Dari Tanggal/);
  assert.match(clientSource, /Sampai Tanggal/);
  assert.match(clientSource, /Terapkan Rentang/);
  assert.match(clientSource, /id: "all", label: "Semua Data"/);
  assert.doesNotMatch(clientSource, /Terapkan periode/);
  assert.doesNotMatch(clientSource, /NativeSelect/);
});

test("laporan keuangan membaca transaksi aktif dan memakai sisa pembayaran", async () => {
  const dataSource = await readFile(new URL("../lib/finance/data.ts", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../app/(app)/keuangan/pemasukan/page.tsx", import.meta.url), "utf8");
  const exportSource = await readFile(new URL("../lib/export/datasets/finance.ts", import.meta.url), "utf8");

  assert.match(dataSource, /requireActor\(FINANCE_ROLES\)/);
  assert.match(dataSource, /mode === "range"/);
  assert.match(dataSource, /outstandingAmount/);
  assert.match(pageSource, /Total HPP/);
  assert.match(pageSource, /Status HPP/);
  assert.doesNotMatch(pageSource, /Status laporan/);
  assert.doesNotMatch(pageSource.toLocaleLowerCase("id-ID"), /piutang/);
  assert.match(pageSource, /getIncome/);
  // Default tanpa filter tanggal = tampilkan semua pemasukan (bukan bulan berjalan).
  assert.match(pageSource, /parseOptionalFinanceDateRange/);
  assert.doesNotMatch(pageSource, /parseFinanceDateRange/);
  assert.match(pageSource, /Sisa \$\{formatCurrency\(item\.remaining\)\}/);
  assert.match(pageSource, /Pajak/);
  // Ekspor mengikuti halaman: tanpa filter tanggal = semua data (bukan bulan berjalan),
  // dan tidak ada cap baris karena file dibuat bertahap di browser.
  assert.match(exportSource, /const from = exportDate\(searchParams\.get\("from"\)\)/);
  assert.doesNotMatch(exportSource, /parseFinanceDateRange/);
  assert.doesNotMatch(exportSource, /Data dipotong/);
  assert.match(exportSource, /getIncomeForExport\(/);
});

test("R7 keuangan: Deposit terpisah dari DP pada pemasukan, ekspor, dan mutasi", async () => {
  const [expenseSource, pageSource, exportSource, dataSource] = await Promise.all([
    readFile(new URL("../lib/finance/expense.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/(app)/keuangan/pemasukan/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/export/datasets/finance.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/finance/data.ts", import.meta.url), "utf8"),
  ]);
  // Kolom DP hanya memuat transaksi awal (tanpa termin dan tanpa deposit); deposit diukur sendiri.
  assert.match(expenseSource, /transactions\.filter\(\(item\) => !item\.paymentTermId && !item\.isDeposit\)/);
  assert.match(expenseSource, /const depositAmount = transactions\.filter\(\(item\) => item\.isDeposit\)/);
  assert.match(expenseSource, /isDeposit: true \} \} \} \},/);
  // Tabel & footer pemasukan punya kolom Deposit sebelum DP, kosong jadi "-".
  assert.match(pageSource, /"Margin %", "Deposit", "DP", "Lunas"/);
  assert.match(pageSource, /item\.deposit \? formatCurrency\(item\.deposit\) : "-"/);
  assert.match(pageSource, /const totalDeposit = sumMoney\(data\.items\.map\(\(item\) => item\.deposit\)\)/);
  assert.match(pageSource, /formatCurrency\(totalDeposit\)/);
  // Ekspor XLSX menyertakan kolom Deposit dengan nilai "-" bila nol; header Margin memakai "%" seperti tabel.
  assert.ok(exportSource.indexOf('header: "Margin %"') < exportSource.indexOf('header: "Deposit"') && exportSource.indexOf('header: "Deposit"') < exportSource.indexOf('header: "DP"') && exportSource.indexOf('header: "DP"') < exportSource.indexOf('header: "Lunas"'), "export: Margin %, Deposit, DP, Lunas berurutan");
  assert.match(exportSource, /item\.deposit \? Number\(item\.deposit\) : null/);
  // Mutasi pembayaran membedakan Termin / Deposit / Pembayaran awal untuk ditampilkan.
  assert.match(dataSource, /transactionKind: item\.paymentTermId \? "Termin" : item\.isDeposit \? "Deposit" : "Pembayaran awal"/);
});

test("flash message tidak membocorkan isi notifikasi ke URL", async () => {
  const responseSource = await readFile(new URL("../lib/actions/response.ts", import.meta.url), "utf8");
  assert.doesNotMatch(responseSource, /encodeURIComponent\(message\)/);
  assert.match(responseSource, /httpOnly:\s*true/);
  assert.match(responseSource, /sameSite:\s*"lax"/);
  assert.match(responseSource, /Proses menyimpan data melewati batas waktu/);
  assert.doesNotMatch(responseSource, /Proses menyimpan Deal melewati batas waktu/);
});

test("revisi CRM membuat PO, invoice, pembayaran, dan bucket desain privat", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20260902000000_crm_purchase_order_invoice/migration.sql", import.meta.url), "utf8");
  const storageScript = await readFile(new URL("../scripts/reset-crm-storage.mjs", import.meta.url), "utf8");
  const designActionSource = await readFile(new URL("../app/actions/design.ts", import.meta.url), "utf8");
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
  // Halaman persetujuan desain dihapus: unggahan langsung menjadi acuan produksi.
  assert.match(designActionSource, /erpStorage\(BUCKET\)/);
  assert.match(designActionSource, /storage\.upload\(attachment\.path/);
  assert.doesNotMatch(designActionSource, /reviewDesignRevisionAction|APPROVED/);
  const productionActionSource = await readFile(new URL("../app/actions/production.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionActionSource, /status: "APPROVED"/);
  assert.doesNotMatch(productionActionSource, /disetujui tidak ditemukan/);
});

test("upload desain menolak file lebih dari 5 MB sebelum dikirim", async () => {
  const actionSource = await readFile(new URL("../app/actions/design.ts", import.meta.url), "utf8");
  const configSource = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(actionSource, /MAX_BYTES = 5 \* 1024 \* 1024/);
  assert.match(actionSource, /Setiap file desain maksimal 5 MB/);
  assert.match(configSource, /bodySizeLimit: "28mb"/);
});

test("transaksi Deal memberi waktu cukup, retry konflik serializable, dan error yang dapat ditindaklanjuti", async () => {
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  const responseSource = await readFile(new URL("../lib/actions/response.ts", import.meta.url), "utf8");
  assert.match(actionSource, /maxWait:\s*15_000/);
  assert.match(actionSource, /timeout:\s*30_000/);
  assert.match(actionSource, /error\.code === "P2034"/);
  assert.match(responseSource, /error\.code === "P2028"/);
  assert.match(responseSource, /error\.code === "P2034"/);
});

test("migration dokumen CRM v2 menjaga nilai invoice dan relasi pembayaran", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20260904000000_crm_order_documents_v2/migration.sql", import.meta.url), "utf8");
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  const rosterSource = await readFile(new URL("../lib/crm/roster-import.ts", import.meta.url), "utf8");
  assert.match(sql, /InvoiceItem_charges_valid[\s\S]+"grossAmount" = ROUND\("quantity" \* "unitPrice", 2\)/);
  assert.match(sql, /PaymentTransaction_one_active_initial/);
  assert.match(sql, /FOREIGN KEY \("paymentTermId", "paymentId"\)[\s\S]+REFERENCES "PaymentTerm"\("id", "paymentId"\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]+FROM anon, authenticated/);
  assert.doesNotMatch(sql, /(?:DELETE|INSERT|UPDATE)\s+(?:FROM\s+)?storage\./i);
  assert.doesNotMatch(actionSource, /productionRoute/);
  assert.match(actionSource, /salesOrder:\s*\{ status: "ACTIVE" \}/);
  assert.match(actionSource, /item\.rosterMode === "excel" \? fileRoster : item\.rosterMode === "manual" \? manualRoster : \[\]/);
  assert.match(actionSource, /preparePoItems/);
  assert.match(actionSource, /legacyDecorationMethod/);
  assert.match(rosterSource, /XLSX_MAX_UNCOMPRESSED_BYTES/);
  assert.match(rosterSource, /Header roster harus memuat kolom ID, Nama, Ukuran, dan Panjang Lengan/);
  assert.match(rosterSource, /sleeveLength !== "PENDEK" && sleeveLength !== "PANJANG"/);
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

test("customer mendukung menu mandiri, halaman detail, dan import export XLSX yang dibatasi", async () => {
  const navSource = await readFile(new URL("../components/app-nav.tsx", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../app/(app)/customers/page.tsx", import.meta.url), "utf8");
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  const detailActionSource = await readFile(new URL("../app/actions/crm-details.ts", import.meta.url), "utf8");
  const excelSource = await readFile(new URL("../lib/crm/customer-excel.ts", import.meta.url), "utf8");
  const exportRouteSource = await readFile(new URL("../lib/export/datasets/crm.ts", import.meta.url), "utf8");
  const legacyPageSource = await readFile(new URL("../app/(app)/crm/pelanggan/page.tsx", import.meta.url), "utf8");

  assert.match(navSource, /href: "\/customers", label: "Customer"/);
  assert.doesNotMatch(navSource, /isPathWithin\(pathname, "\/crm\/pelanggan"\)/);
  assert.match(pageSource, /function customerDetailHref\(customerId: string, state: TableState\)/);
  assert.match(pageSource, /<CustomerTableRowLink key=\{customer\.id\} href=\{customerDetailHref\(customer\.id, state\)\}>/);
  assert.match(pageSource, /params=\{exportParams\(state\)\}/);
  assert.match(pageSource, /form action=\{importCustomersAction\}/);
  assert.match(actionSource, /requireActor\(MASTER_DATA_ROLES\)/);
  assert.match(actionSource, /parseCustomerWorkbook\(customerExcelFile\(formData\)\)/);
  assert.match(actionSource, /CUSTOMER_IMPORT_TRANSACTION_OPTIONS/);
  assert.doesNotMatch(actionSource, /assertNoDuplicateImportKeys\(rows\)/);
  assert.match(actionSource, /findImportCustomer\(row, customerIndexes\)/);
  assert.match(actionSource, /upsertImportCustomerIndex\(customerIndexes, current, nextCustomer\)/);
  assert.match(actionSource, /CUSTOMER_UPDATED/);
  assert.match(detailActionSource, /customerDetailAction/);
  assert.match(excelSource, /CUSTOMER_EXCEL_MAX_BYTES = 1 \* 1024 \* 1024/);
  assert.match(excelSource, /Excel Customer tidak boleh berisi formula/);
  assert.match(exportRouteSource, /getCustomersForExport/);
  assert.match(exportRouteSource, /CUSTOMER_COLUMNS/);
  assert.match(legacyPageSource, /redirect\(suffix \? `\/customers\?\$\{suffix\}` : "\/customers"\)/);
});

test("resolver import customer mengupdate duplikat dan memakai prioritas key", () => {
  const existing = {
    id: "customer-a",
    customerNo: "CUST-001",
    name: "Budi Lama",
    companyName: null,
    whatsapp: "0811111111",
    email: "lama@example.com",
    instagram: "budi_lama",
    address: null,
    city: null,
    notes: null,
    customerTypeId: "type-1",
    leadSourceId: null,
    salesPicId: null,
  };
  const other = {
    ...existing,
    id: "customer-b",
    customerNo: "CUST-002",
    name: "Nama Konflik",
    whatsapp: "0822222222",
    email: "baru@example.com",
    instagram: "konflik",
  };
  const indexes = indexCustomers([existing, other]);

  assert.equal(findImportCustomer({ customerNo: "", name: "Budi Baru", whatsapp: "62811111111", email: "", instagram: "" }, indexes)?.id, "customer-a");
  assert.equal(findImportCustomer({ customerNo: "", name: "Nama Konflik", whatsapp: "0811111111", email: "baru@example.com", instagram: "" }, indexes)?.id, "customer-a");
  assert.equal(findImportCustomer({ customerNo: "CUST-002", name: "Budi Lama", whatsapp: "0811111111", email: "", instagram: "" }, indexes)?.id, "customer-b");

  const updated = {
    ...existing,
    name: "Budi Terbaru",
    whatsapp: "0833333333",
    email: "terbaru@example.com",
  };
  upsertImportCustomerIndex(indexes, existing, updated);

  assert.equal(findImportCustomer({ customerNo: "", name: "Budi Terbaru", whatsapp: "", email: "", instagram: "" }, indexes)?.id, "customer-a");
  assert.equal(findImportCustomer({ customerNo: "", name: "Budi Lama", whatsapp: "", email: "", instagram: "" }, indexes), null);
  assert.equal(findImportCustomer({ customerNo: "", name: "Tidak Ada", whatsapp: "0833333333", email: "", instagram: "" }, indexes)?.name, "Budi Terbaru");

  const lookupKeys = importCustomerLookupKeys([{ customerNo: " CUS-001 ", name: "Budi Baru", whatsapp: "+62 811-111-111", email: "BUDI@example.com", instagram: "@budi" }]);
  assert.deepEqual(lookupKeys.customerNos, ["cus-001"]);
  assert.deepEqual(lookupKeys.names, ["Budi Baru"]);
  assert.deepEqual(lookupKeys.whatsapps, ["+62 811-111-111", "0811111111"]);
  assert.deepEqual(lookupKeys.emails, ["budi@example.com"]);
});

test("peluang memakai nama kategori produk sebagai jenis pakaian", async () => {
  const [fieldsSource, garmentFieldSource, actionSource, detailSource, validationSource, schema, migration] = await Promise.all([
    readFile(new URL("../components/crm/opportunity-fields.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/opportunity-garment-field.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/validation.ts", import.meta.url), "utf8"),
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260930010000_opportunity_product_category/migration.sql", import.meta.url), "utf8"),
  ]);

  // Opsi = nama kategori dari Master Data (PDH / PDL, Kaos Sablon, Polo Shirt, ...).
  assert.match(fieldsSource, /OpportunityGarmentField/);
  assert.match(fieldsSource, /categoryOptions\?:/);
  assert.match(garmentFieldSource, /name="productCategoryId"/);
  assert.match(garmentFieldSource, /options\.map\(\(item\) =>/);
  // Jenis Jersey/Non-jersey tetap ditampilkan sebagai info dan dipakai saat master data kosong.
  assert.match(garmentFieldSource, /GARMENT_TYPE_LABEL\[selected\.garmentType\]/);
  assert.match(garmentFieldSource, /value="NON_JERSEY"/);
  assert.match(detailSource, /categoryOptions=\{categoryOptions\}/);
  assert.match(validationSource, /productCategoryId: optionalEntityId/);
  assert.match(actionSource, /resolveOpportunityCategory/);
  assert.ok(actionSource.indexOf("productCategoryId: category?.id ?? null") !== -1, "kategori terpilih disimpan ke peluang");
  assert.match(schema, /model Opportunity \{[^}]*productCategoryId\s+String\?/s);
  assert.match(migration, /ADD COLUMN "productCategoryId" TEXT/);

  const parsed = createOpportunitySchema.safeParse({
    customerId: "cm123456789012",
    title: "Seragam panitia",
    productCategoryId: "prod-category-01",
    nextAction: "Hubungi customer",
    nextActionAt: "2026-09-09T09:00",
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.success ? parsed.data.productCategoryId : null, "prod-category-01");
});

test("tabel invoice auto refresh dan cache tag invoices dikosongkan setelah pembayaran", async () => {
  const page = await readFile(new URL("../app/(app)/crm/invoices/page.tsx", import.meta.url), "utf8");
  const shell = await readFile(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
  const autoRefresh = await readFile(new URL("../components/auto-refresh.tsx", import.meta.url), "utf8");
  const invoiceDetail = await readFile(new URL("../components/crm/invoice-detail.tsx", import.meta.url), "utf8");
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");

  // Auto refresh global dipasang sekali di AppShell untuk semua halaman aplikasi.
  assert.match(shell, /<AutoRefresh \/>/);
  assert.doesNotMatch(page, /<AutoRefresh \/>/, "halaman tidak memasang auto refresh ganda");
  assert.match(autoRefresh, /router\.refresh\(\)/);
  assert.match(autoRefresh, /document\.visibilityState === "visible"/);
  assert.match(autoRefresh, /document\.addEventListener\("visibilitychange", refresh\)/);

  // Catat pembayaran mengubah kolom status di tabel, bukan hanya isi dialog.
  assert.match(invoiceDetail, /const loadDetail = useCallback\(/);
  assert.match(invoiceDetail, /const reloadAfterMutation = useCallback\(/);
  assert.match(invoiceDetail, /await loadDetail\(\);\s*startTransition\(\(\) => router\.refresh\(\)\)/);
  assert.equal(invoiceDetail.match(/onRecorded=\{reloadAfterMutation\}/g)?.length, 2);

  // Kwitansi pindah ke footer dialog (sejajar aksi invoice), diletakkan sebelum tombol unduh invoice.
  const deliveryActions = await readFile(new URL("../components/crm/invoice-delivery-actions.tsx", import.meta.url), "utf8");
  assert.match(invoiceDetail, /receipts={receipts}/);
  assert.match(invoiceDetail, /label: "Lihat Kwitansi"/);
  assert.match(invoiceDetail, /label: `Lihat Kwitansi Termin \$\{term\.position \+ 1\}`/);
  // Kwitansi hanya ada di footer dialog (sebelum Lihat PDF, varian hijau); baris pembayaran hanya pratinjau bukti.
  assert.equal(invoiceDetail.match(/label: "Lihat Kwitansi"/g)?.length, 1);
  assert.doesNotMatch(invoiceDetail, /payment-transactions\/\$\{transaction\.id\}\/kwitansi/);
  assert.match(deliveryActions, /api\/crm\/payment-transactions\/\$\{receipt\.id\}\/kwitansi/);
  assert.match(deliveryActions, /variant={compact \? "ghost" : "success"}/);
  assert.match(deliveryActions, /Lihat PDF/);
  assert.doesNotMatch(deliveryActions, /Unduh PDF/);

  // Tab Invoice pada peluang memakai komponen yang sama: kwitansi tampil sebelah Lihat PDF.
  const workflowSection = await readFile(new URL("../components/crm/invoice-workflow-section.tsx", import.meta.url), "utf8");
  const opportunityPage = await readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8");
  const dataSource = await readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8");
  assert.match(workflowSection, /receipts={receipts}/);
  assert.match(opportunityPage, /receipts={invoiceReceipts}/);
  assert.match(opportunityPage, /label: "Lihat Kwitansi"/);
  // Id transaksi pembayaran (awal + termin) ikut ditarik oleh detail peluang; deposit tidak ikut dihitung awal.
  assert.match(dataSource, /paymentTermId: null, isDeposit: false \}, select: \{ id: true, amount: true \}/);
  assert.match(dataSource, /terms: \{ orderBy: \{ position: "asc" \}, select: \{ position: true, transactions/);

  // Daftar invoice di-cache bertag "invoices"; `revalidatePath` saja tidak mengosongkan cache itu.
  assert.match(actionSource, /function revalidateInvoiceList\(\) \{\s*revalidatePath\("\/crm\/invoices"\);\s*revalidateTag\("invoices", \{ expire: 0 \}\);/);
  const paymentPaths = actionSource.slice(actionSource.indexOf("function revalidatePaymentMutationPaths"), actionSource.indexOf("async function paymentProof"));
  assert.match(paymentPaths, /revalidateInvoiceList\(\)/);
});

test("PO multi-produk: instansi, pola per produk, dekorasi multi, dan item", () => {
  const base = {
    opportunityId: "cm123456789012",
    garmentType: "JERSEY",
    instansi: "SMA Negeri 1",
    productName: "Jersey tim",
    material: "Dry fit",
    deadline: "2026-09-30",
    designDeadline: "2026-09-20",
    depositRequired: false,
  };
  const item = (overrides = {}) => ({
    key: "item-1",
    name: "Jersey home",
    pola: "Jersey home",
    decorationMethods: ["SABLON_DTF"],
    sizes: [{ sizeId: "garment-size-m", sleeveLength: "PANJANG", quantity: 2 }],
    rosterMode: "none",
    roster: [],
    ...overrides,
  });
  // Dua produk satu warna dalam satu PO lolos; beda warna tetap beda PO (satu warna per form).
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...base, items: [item(), { ...item({ key: "item-2", name: "Jersey away", pola: "Jersey away" }) }] }).success, true);
  // Tiap produk boleh beda kategori (2 jenis produk berbeda dalam 1 PO).
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...base, items: [item(), { ...item({ key: "item-2", name: "Kemeja", pola: "Kemeja formal", productCategoryId: "cm123456789012" }) }] }).success, true);
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...base, items: [{ ...item(), productCategoryId: "x" }] }).success, false);
  // Tiap produk wajib ada isi matriks sendiri.
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...base, items: [{ ...item(), sizes: [{ sizeId: "garment-size-m", sleeveLength: "PANJANG", quantity: 0 }] }] }).success, false);
  // Tiap produk wajib punya pola sendiri (revisi: pola per produk, bukan global).
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...base, items: [item(), { ...item({ key: "item-2", name: "Jersey away", pola: "" }) }] }).success, false);
  // Kunci produk tidak boleh duplikat.
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...base, items: [item(), item()] }).success, false);
});

test("kesepakatan PO menunggu desain terunggah, tanpa langkah konfirmasi customer", async () => {
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  const detailPageSource = await readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8");
  const agreementSource = await readFile(new URL("../components/crm/purchase-order-agreement-action.tsx", import.meta.url), "utf8");
  assert.match(actionSource, /export async function markPurchaseOrderDesignSentAction/);
  // Action konfirmasi lama masih tersimpan untuk riwayat/audit, tetapi tidak lagi dipakai UI.
  assert.match(actionSource, /export async function confirmPurchaseOrderCustomerAction/);
  assert.match(actionSource, /PURCHASE_ORDER_DESIGN_SENT/);
  assert.match(actionSource, /PURCHASE_ORDER_CUSTOMER_CONFIRMED/);
  // Gate "customerConfirmedAt" diganti: semua desain harus terunggah dulu (kirim & sepakati).
  assert.match(actionSource, /Unggah desain terlebih dahulu sebelum menyepakati PO\./);
  assert.doesNotMatch(actionSource, /if \(!purchaseOrder\.customerConfirmedAt\) throw new UserFacingError/);
  assert.doesNotMatch(actionSource, /Desain harus diunggah dan disetujui Owner atau Admin sebelum PO disepakati/);
  // Sepakati PO dihitung dari desain terunggah — aktif bersama "Kirim 1 set PDF".
  assert.match(detailPageSource, /designUploadedCount === designItems\.length/);
  assert.doesNotMatch(detailPageSource, /customerConfirmedAt/);
  assert.match(agreementSource, /Kirim 1 set PDF/);
  assert.doesNotMatch(agreementSource, /Konfirmasi customer/);
  // Pengiriman PDF otomatis menandai customer tidak ada revisi (hidden input, tanpa checkbox).
  assert.match(agreementSource, /name="customerConfirmed" value="yes"/);
  // Revisi dari PO disepakati dibuka untuk mitigasi H-1.
  assert.match(actionSource, /source\.status !== "DRAFT" && source\.status !== "AGREED"/);
  assert.match(actionSource, /Batalkan Sales Order terlebih dahulu sebelum merevisi PO yang disepakati/);
});

test("PDF PO punya varian customer dan penjahit dengan deadline merah", async () => {
  const routeSource = await readFile(new URL("../app/api/crm/purchase-order/[id]/pdf/route.ts", import.meta.url), "utf8");
  const pdfSource = await readFile(new URL("../lib/crm/purchase-order-pdf.ts", import.meta.url), "utf8");
  const buttonSource = await readFile(new URL("../components/crm/purchase-order-pdf-download-button.tsx", import.meta.url), "utf8");
  assert.match(routeSource, /variant.*penjahit.*customer/);
  assert.match(pdfSource, /PurchaseOrderPdfVariant/);
  // Deadline selalu disorot merah + bold, bukan hanya saat lewat tanggal.
  assert.match(pdfSource, /DEADLINE_RED/);
  assert.match(pdfSource, /\{ label: "Deadline", value: formatDate\(data\.deadline\), highlight: true \}/);
  // Kop ringkas: sel logo + tabel dua kolom, dan judul POLA di tengah bar bergaris.
  assert.match(pdfSource, /HEADER_LOGO_CELL_WIDTH/);
  assert.match(pdfSource, /borderColor: BORDER/);
  assert.match(pdfSource, /x: \(A4\.width - bold\.widthOfTextAtSize\(polaText, 13\)\) \/ 2/);
  // Size chart menahan ruang di halaman gambar desainnya; desain penjahit dikecualikan (halaman penuh sendiri).
  assert.match(pdfSource, /drawAssets\(embeddedAssets\.filter\(\(asset\) => asset\.itemId === item\.id && asset\.kind !== "PENJAHIT_DESIGN"\), item\.name, measureModelTable\(rows\)\)/);
  assert.match(pdfSource, /drawModelTable/);
  // Size chart selalu mencetak seluruh kolom ukuran baku (XS…5XL) + TOTAL/PENDEK/PANJANG/NOTE
  // walau PO tidak memesan ukuran tersebut; ukuran di luar daftar tetap ditambahkan.
  assert.match(pdfSource, /const SIZE_LADDER = \["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"\] as const/);
  assert.match(pdfSource, /return \[\.\.\.SIZE_LADDER, \.\.\.extras\]/);
  assert.match(pdfSource, /SIZE_CHART_NOTE_HEIGHT/);
  // Halaman yang tidak terpakai dibuang: PO tidak boleh menyisakan halaman berisi footer saja.
  assert.match(pdfSource, /const usedPages = new Set<PDFPage>\(\)/);
  assert.match(pdfSource, /usedPages\.add\(page\)/);
  assert.match(pdfSource, /document\.removePage\(document\.getPages\(\)\.indexOf\(candidate\)\)/);
  // Paragraf tidak menyisakan label sendirian di dasar halaman (penyebab halaman kosong lama).
  assert.match(pdfSource, /const blockHeight = 16 \+ lines\.length \* 16 \+ 6;\n\s*if \(y - blockHeight < margin\) addPage\(\);/);
  assert.match(buttonSource, /PDF Customer/);
  assert.match(buttonSource, /PDF Penjahit/);
  // Sprint 11 R3 + revisi: deadline penjahit satu baris "Deadline" (null → "-"),
  // desain penjahit dicetak di halaman penuh tersendiri setelah tiap lembar produk (tanpa judul),
  // bar POLA memakai pola milik produk di lembar itu; sel Deadline customer tetap persis (uji regex di atas).
  assert.match(pdfSource, /penjahitDeadline/);
  assert.match(pdfSource, /formatDate\(penjahitItem\?\.penjahitDeadline \?\? null\)/);
  assert.doesNotMatch(pdfSource, /label: "Deadline penjahit"/);
  assert.doesNotMatch(pdfSource, /label: "Deadline produksi"/);
  assert.match(pdfSource, /drawPenjahitDesignSheet/);
  assert.match(pdfSource, /item\?\.pola \|\| data\.pola \|\| data\.productName/);
  assert.match(routeSource, /Desain penjahit \$\{item\.name\}/);
  assert.match(routeSource, /penjahitDesignPath/);
});

test("Sprint 11 (R3): form Edit PDF Penjahit — skema, aksi, dialog, rute desain", async () => {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const migration = await readFile(new URL("../prisma/migrations/20261021010000_purchase_order_item_penjahit/migration.sql", import.meta.url), "utf8");
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  const dialogSource = await readFile(new URL("../components/crm/penjahit-plan-dialog.tsx", import.meta.url), "utf8");
  const buttonSource = await readFile(new URL("../components/crm/purchase-order-pdf-download-button.tsx", import.meta.url), "utf8");
  const serveSource = await readFile(new URL("../app/api/crm/purchase-order/[id]/items/[itemId]/penjahit-design/route.ts", import.meta.url), "utf8");
  // Skema per item: deadline penjahit + kolom desain (migrasi manual, tanpa backfill).
  assert.match(schema, /penjahitDeadline\s+DateTime\?\s+@db\.Date/);
  assert.match(schema, /penjahitDesignPath\s+String\?\s+@db\.VarChar\(500\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "penjahitDeadline" DATE/);
  // Aksi terpisah dari form PO: gate DRAFT/AGREED (developer/owner lolos), optimistic version, audit.
  assert.match(actionSource, /export async function savePenjahitPlanAction/);
  assert.match(actionSource, /purchaseOrder\.status !== "DRAFT" && purchaseOrder\.status !== "AGREED"/);
  assert.match(actionSource, /where: \{ id: purchaseOrder\.id, version: parsed\.data\.version \}/);
  assert.match(actionSource, /PENJAHIT_PLAN_UPDATED/);
  // Dialog khusus field penjahit (bukan form PO penuh) + tombol menempel di samping unduh.
  assert.match(dialogSource, /Edit PDF Penjahit/);
  assert.match(dialogSource, /savePenjahitPlanAction/);
  assert.match(dialogSource, /deadline-\$\{item\.id\}/);
  assert.match(dialogSource, /design-\$\{item\.id\}/);
  // Notifikasi proses simpan: toast loading saat upload/aksi berjalan, lalu sukses/gagal.
  assert.match(dialogSource, /toast\.add\(\{\s*type: "loading",\s*title: "Menyimpan perubahan penjahit…"/);
  assert.match(dialogSource, /toast\.update\(toastId, \{[\s\S]*?type: "success"/);
  assert.match(dialogSource, /toast\.update\(toastId, \{[\s\S]*?type: "error"/);
  assert.match(buttonSource, /PenjahitPlanDialog/);
  // Rute preview desain penjahit per item (hanya pemilik PO yang boleh).
  assert.match(serveSource, /penjahitDesignPath/);
  assert.match(serveSource, /CRM_VIEW_ROLES/);
});

test("pratinjau roster mengisi matriks otomatis", async () => {
  const routeSource = await readFile(new URL("../app/api/crm/roster-preview/route.ts", import.meta.url), "utf8");
  const rosterSource = await readFile(new URL("../lib/crm/roster-import.ts", import.meta.url), "utf8");
  const formSource = await readFile(new URL("../components/crm/purchase-order-form.tsx", import.meta.url), "utf8");
  assert.match(routeSource, /aggregateRosterToMatrix/);
  assert.match(rosterSource, /export function aggregateRosterToMatrix/);
  assert.match(formSource, /\/api\/crm\/roster-preview/);
  assert.match(formSource, /po-draft-v2/);
  assert.match(formSource, /Tambah produk/);
});

test("upload desain per produk menunggu deposit hanya bila PO memerlukannya", async () => {
  const designSource = await readFile(new URL("../app/actions/design.ts", import.meta.url), "utf8");
  const agreementSource = await readFile(new URL("../components/crm/purchase-order-agreement-action.tsx", import.meta.url), "utf8");
  // Dropdown jenis pembayaran kini pada form invoice: Lunas/DP; Deposit hanya untuk prefill data lama.
  const invoiceFormSource = await readFile(new URL("../components/crm/invoice-form.tsx", import.meta.url), "utf8");
  assert.match(invoiceFormSource, /NativeSelectOption value="DP">DP</);
  assert.match(invoiceFormSource, /scheduleKind === "DEPOSIT" \? <NativeSelectOption value="DEPOSIT">Deposit \(data lama\)</);
  // Upload desain hanya menunggu deposit bila PO mencentang "Perlu deposit".
  assert.match(designSource, /assertDepositSettled\(task\.purchaseOrder, actor\.role\)/);
  assert.match(designSource, /if \(!purchaseOrder\.depositRequired \|\| purchaseOrder\.deposit \|\| hasRole\(role, GATE_OVERRIDE_ROLES\)\) return;/);
  assert.match(designSource, /Deposit desain belum dibayar\. Isi Deposit pada tab PO terlebih dahulu\./);
  // Tombol Upload Desain di tab PO ikut menunggu deposit selama PO memerlukannya.
  assert.match(agreementSource, /const depositSettled = !depositRequired \|\| depositPaid/);
  assert.match(agreementSource, /!everyItemAtLimit && depositSettled/);
  assert.match(agreementSource, /Menunggu deposit dibayar\. Klik Isi Deposit\./);
  // Satu form unggah memuat field file dan catatan per produk PO.
  assert.match(designSource, /designFiles-\$\{itemId\}/);
  assert.match(designSource, /notes-\$\{itemId\}/);
  assert.match(agreementSource, /name=\{`designFiles-\$\{item\.id\}`\}/);
  assert.match(agreementSource, /name=\{`notes-\$\{item\.id\}`\}/);
  // Tab PO: tombol Upload Desain sejajar Kirim 1 set PDF dan Sepakati.
  assert.match(agreementSource, /Upload Desain/);
  assert.match(agreementSource, /Kirim 1 set PDF/);
  assert.match(agreementSource, /Sepakati PO terbaru/);
  // PDF boleh dikirim berulang: tombol kirim tidak disembunyikan setelah terkirim.
  assert.doesNotMatch(agreementSource, /\!designSentAt \?/);
  assert.match(agreementSource, /name="customerConfirmed" value="yes"/);
});

test("checkbox Deposit menjadi gate tombol Isi Deposit dan desain disimpan per produk", async () => {
  const formSource = await readFile(new URL("../components/crm/purchase-order-form.tsx", import.meta.url), "utf8");
  const agreementSource = await readFile(new URL("../components/crm/purchase-order-agreement-action.tsx", import.meta.url), "utf8");
  const designSource = await readFile(new URL("../app/actions/design.ts", import.meta.url), "utf8");
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  const detailPageSource = await readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8");
  const listPageSource = await readFile(new URL("../app/(app)/crm/purchase-orders/page.tsx", import.meta.url), "utf8");
  const dataSource = await readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8");
  const uploadStatusSource = await readFile(new URL("../components/crm/design-upload-status.tsx", import.meta.url), "utf8");
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const migration = await readFile(new URL("../prisma/migrations/20261012120000_po_deposit_gate_design_per_item/migration.sql", import.meta.url), "utf8");

  // Checkbox Deposit diisi pada form PO (sebelum draft terbuat) dan ikut tersimpan.
  assert.match(formSource, /name="depositRequired"/);
  assert.match(formSource, /Perlu deposit/);
  assert.match(detailPageSource, /depositRequired: purchaseOrder\.depositRequired,/);
  assert.match(schema, /depositRequired\s+Boolean\s+@default\(false\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "depositRequired" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(actionSource, /depositRequired: formData\.get\("depositRequired"\) === "on"/);
  assert.equal(actionSource.match(/depositRequired: parsed\.data\.depositRequired/g)?.length, 3);

  // Tombol Isi Deposit hanya dirender untuk PO yang dicentang (DEV/OWNER tetap bisa mengisi).
  assert.match(agreementSource, /const showDepositAction = depositRequired \|\| depositPaid/);
  assert.match(agreementSource, /\{showDepositAction \? \(/);
  assert.match(actionSource, /if \(!purchaseOrder\.depositRequired && !purchaseOrder\.deposit && !hasRole\(actor\.role, GATE_OVERRIDE_ROLES\)\) throw new UserFacingError/);
  assert.match(detailPageSource, /Deposit<\/dt><dd className="mt-1">\{purchaseOrder\.depositRequired \? "Perlu deposit" : "Tanpa deposit"\}/);

  // Revisi desain terpisah per produk (itemId) dan nomor versinya per produk.
  assert.match(schema, /itemId\s+String\s+@default\(""\) @db\.VarChar\(40\)/);
  assert.match(schema, /@@unique\(\[designTaskId, itemId, revision\]\)/);
  assert.match(migration, /UPDATE "DesignRevision" rev[\s\S]+item\."position" = 0/);
  assert.match(designSource, /MAX_REVISIONS = DESIGN_REVISION_LIMIT/);
  assert.match(designSource, /const designItems = task\.purchaseOrder\.items\.length/);
  assert.match(designSource, /designFiles-\$\{itemId\}/);
  assert.match(designSource, /itemId: upload\.itemId/);

  // Kirim 1 set PDF menunggu desain SEMUA produk; kolom Desain menampilkan progresnya.
  assert.match(actionSource, /const designUploaded = purchaseOrder\.items\.length > 0 && purchaseOrder\.items\.every\(\(item\) => uploadedItemIds\.has\(item\.id\)\)/);
  assert.match(agreementSource, /const canSendPdf = designUploaded;/);
  assert.match(dataSource, /designUploadedCount,/);
  assert.match(dataSource, /designItemCount: designItemIds\.length,/);
  assert.match(listPageSource, /<DesignUploadStatus uploadedCount=\{item\.designUploadedCount\} itemCount=\{item\.designItemCount\} revisionCount=\{item\.designRevisionCount\} \/>/);
  assert.match(uploadStatusSource, /"Sebagian Didesain"/);
  assert.match(uploadStatusSource, /\$\{uploadedCount\}\/\$\{itemCount\} produk/);
});

test("snapshot PO dipecah per produk bila multi-item", async () => {
  const detailPageSource = await readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(detailPageSource, /purchaseOrder\.items\.length > 1/);
  assert.match(detailPageSource, /purchaseOrder\.items\.map\(\(poItem\)/);
  // Item berjenis aksesoris (mis. totebag) tampil total saja, tanpa baris Pendek/Panjang.
  assert.match(detailPageSource, /itemIsAccessory/);
  assert.match(detailPageSource, /Jumlah produk:/);
});

test("pembatas per produk konsisten di form, snapshot, dan detail PO", async () => {
  const formSource = await readFile(new URL("../components/crm/purchase-order-form.tsx", import.meta.url), "utf8");
  const detailPageSource = await readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8");
  const popupSource = await readFile(new URL("../components/crm/purchase-order-detail.tsx", import.meta.url), "utf8");
  // Kartu pembatas per produk memakai border primary yang sama di ketiga tempat.
  assert.match(formSource, /border-2 border-primary\/25 bg-primary\/\[0\.04\]/);
  assert.match(detailPageSource, /rounded-lg border-2 border-primary\/25 bg-primary\/\[0\.04\] p-3/);
  assert.match(popupSource, /rounded-lg border-2 border-primary\/25 bg-primary\/\[0\.04\] p-3/);
  // Nama produk ditandai label pil yang sama dengan legend form PO.
  const pillLabel = /rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground/;
  assert.match(detailPageSource, pillLabel);
  assert.match(popupSource, pillLabel);
});

test("deposit PO: kolom tabel, tombol Isi Deposit, dan alur Upload Desain lalu Kirim PDF", async () => {
  const listPageSource = await readFile(new URL("../app/(app)/crm/purchase-orders/page.tsx", import.meta.url), "utf8");
  const dataSource = await readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8");
  const agreementSource = await readFile(new URL("../components/crm/purchase-order-agreement-action.tsx", import.meta.url), "utf8");
  const depositFormSource = await readFile(new URL("../components/crm/purchase-order-deposit-form.tsx", import.meta.url), "utf8");
  const depositStatusSource = await readFile(new URL("../components/crm/deposit-status.tsx", import.meta.url), "utf8");
  const popupSource = await readFile(new URL("../components/crm/purchase-order-detail.tsx", import.meta.url), "utf8");
  const invoiceFormSource = await readFile(new URL("../components/crm/invoice-form.tsx", import.meta.url), "utf8");
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

  // Tabel PO: kolom Deposit (pills + nominal kecil) dan kolom Tanggal Deposit di sebelahnya.
  assert.match(listPageSource, /<TableHead>Deposit<\/TableHead><TableHead>Desain<\/TableHead><TableHead>Tanggal Deposit<\/TableHead>/);
  assert.match(listPageSource, /<DepositStatus paid=\{item\.depositPaid\} amount=\{item\.depositPaidAmount\} required=\{item\.depositRequired\} \/>/);
  assert.match(listPageSource, /item\.depositPaidAt \? formatDate\(item\.depositPaidAt\)/);
  assert.match(depositStatusSource, /"Sudah Depo"/);
  assert.match(depositStatusSource, /"Belum Depo"/);
  assert.match(depositStatusSource, /formatCurrency\(amount\)/);

  // Deposit disimpan per PO; data layer mengirim nominal + tanggalnya ke tabel.
  assert.match(schema, /model PurchaseOrderDeposit \{/);
  assert.match(dataSource, /deposit: \{ select: \{ amount: true, paidAt: true \} \}/);
  assert.match(dataSource, /depositPaidAt: deposit \? deposit\.paidAt\.toISOString\(\) : null/);

  // Popup Detail PO ikut menampilkan deposit, tanggal, dan metodenya.
  assert.match(popupSource, /<DepositStatus paid=\{detail\.deposit !== null\}/);
  assert.match(popupSource, /label="Tanggal deposit"/);

  // Tombol Isi Deposit di baris aksi PO membuka dialog pencatatan deposit.
  assert.match(depositFormSource, /Isi Deposit/);
  assert.match(depositFormSource, /recordPurchaseOrderDepositAction/);
  assert.match(depositFormSource, /Nominal deposit \(Rp\)/);
  assert.match(agreementSource, /<PurchaseOrderDepositAction purchaseOrderId=\{purchaseOrderId\} deposit=\{deposit\}/);
  assert.match(actionSource, /export async function recordPurchaseOrderDepositAction/);
  assert.match(actionSource, /Deposit hanya dapat diubah saat PO masih draft/);

  // Alur berurutan: tombol aktif satu per satu; Upload Desain tidak lagi menunggu deposit.
  assert.match(agreementSource, /const canCreateRevision = canUploadDesign && designTaskId !== null && !everyItemAtLimit && depositSettled/);
  assert.match(agreementSource, /const designUploaded = designItemCount > 0 && designUploadedCount === designItemCount/);
  assert.match(agreementSource, /const canSendPdf = designUploaded;/);
  assert.match(agreementSource, /disabled=\{!canSendPdf \|\| undefined\}/);
  assert.match(agreementSource, /Unggah desain dulu sebelum mengirim 1 set PDF/);
  // Status pills "Belum Depo" dihapus dari baris aksi; tombol Isi Deposit pengendali awal.
  assert.doesNotMatch(agreementSource, /DepositStatus/);
  assert.match(agreementSource, /Isi Deposit/);

  // Gate server: deposit hanya untuk PO yang dicentang (DEVELOPER/OWNER selalu lolos) dan desain wajib ada sebelum kirim PDF.
  assert.match(actionSource, /if \(!purchaseOrder\.depositRequired && !purchaseOrder\.deposit && !hasRole\(actor\.role, GATE_OVERRIDE_ROLES\)\) throw new UserFacingError/);
  assert.match(actionSource, /Unggah desain terlebih dahulu sebelum mengirim 1 set PDF/);

  // Deposit mengurangi sisa tagihan: jadwal Deal dan pembentukan Sales Order memakai sisa setelah deposit.
  assert.match(actionSource, /const collectibleTotal = invoiceTotal\.sub\(depositAmount\)/);
  assert.match(actionSource, /Jadwal pembayaran tidak sama dengan sisa setelah deposit/);
  // R7: deposit tidak lagi dilipat ke pembayaran awal — dicatat terpisah sebagai transaksi isDeposit.
  assert.match(actionSource, /const initialAmount = invoice\.pendingPayment\.initialAmount;/);
  assert.match(actionSource, /const outstandingAmount = invoice\.total\.sub\(depositAmount\)\.sub\(initialAmount\)/);
  assert.match(actionSource, /isDeposit: true/);
  assert.doesNotMatch(actionSource, /initialAmount\.add\(depositAmount\)/);
  assert.match(invoiceFormSource, /const collectibleAmount = Math\.max\(0, previewTotal - depositAmountNumber\)/);

  // Nominal deposit wajib lebih dari nol.
  const depositInput = { purchaseOrderId: "cm123456789012", paymentMethodId: "cm123456789013", paidAt: "2026-10-11T09:00", amount: "50000" };
  assert.equal(purchaseOrderDepositSchema.safeParse(depositInput).success, true);
  assert.equal(purchaseOrderDepositSchema.safeParse({ ...depositInput, amount: "0" }).success, false);
});

test("R1/R2: dialog deposit pakai useActionState, error inline, dan bukti punya route sendiri", async () => {
  const depositFormSource = await readFile(new URL("../components/crm/purchase-order-deposit-form.tsx", import.meta.url), "utf8");
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  const routeSource = await readFile(new URL("../app/api/crm/purchase-order/[id]/deposit/proof/route.ts", import.meta.url), "utf8");
  const detailSource = await readFile(new URL("../components/crm/purchase-order-detail.tsx", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8");
  const dataSource = await readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8");

  // Gagal simpan → error tampil inline & dialog tetap terbuka; tidak ada tutup prematur saat submit.
  assert.match(depositFormSource, /useActionState\(async \(prevState/);
  assert.match(depositFormSource, /await recordPurchaseOrderDepositAction\(prevState, formData\)/);
  assert.doesNotMatch(depositFormSource, /onSubmit=\{\(\) => setOpen\(false\)\}/);
  assert.match(depositFormSource, /state\.error/);
  assert.match(depositFormSource, /Deposit belum tersimpan/);
  // Field memakai state terkendali — defaultValue yang berubah antar render memicu warning Base UI.
  assert.doesNotMatch(depositFormSource, /defaultValue=/);
  // Tombol Lihat Deposit di sebelah kiri Ubah Deposit; isi pratinjau mengikuti data terbaru.
  assert.match(depositFormSource, /Lihat Deposit/);
  assert.match(depositFormSource, /Bukti terbaru sesuai Isi \/ Ubah Deposit/);
  // Action tidak redirect: sukses/gagal dikembalikan sebagai state form.
  assert.match(actionSource, /export async function recordPurchaseOrderDepositAction\(_prevState: CrmActionState, formData: FormData\): Promise<CrmActionState>/);
  // Route bukti deposit membaca PurchaseOrderDeposit dari bucket pembayaran yang sama.
  assert.match(routeSource, /purchaseOrderDeposit\.findUnique/);
  assert.match(routeSource, /PAYMENT_PROOF_BUCKET/);
  assert.match(routeSource, /CRM_VIEW_ROLES/);
  // Detail PO menampilkan pratinjau bukti + mime type ikut ditransfer ke client.
  assert.match(detailSource, /deposit\/proof/);
  assert.match(detailSource, /PaymentProofPreview/);
  assert.match(pageSource, /proofMimeType: poDraft\.deposit\.proofMimeType/);
  assert.match(dataSource, /proofFileName: true, proofMimeType: true, paymentMethod/);
});

test("R9: termin/DP terlambat diwarnai merah utuh di detail invoice", async () => {
  const invoiceDetail = await readFile(new URL("../components/crm/invoice-detail.tsx", import.meta.url), "utf8");

  // Helper telat memakai ambang hari yang sama dengan peringatan deadline yang sudah ada.
  assert.match(invoiceDetail, /function isOverdue\(dueAt: Date \| string \| null \| undefined, unpaid: boolean\)/);
  assert.match(invoiceDetail, /overdueRowClass = "border-destructive bg-destructive\/10"/);
  // Baris termin (sudah deal) dan jadwal (belum deal) memakai badge Terlambat + latar merah.
  assert.match(invoiceDetail, /overdue \? "Terlambat" : "Belum dibayar"/);
  assert.match(invoiceDetail, /termOverdue \? "Terlambat" : "Belum dibayar"/);
  assert.match(invoiceDetail, /variant=\{overdue \? "destructive" : "secondary"\}/);
  assert.match(invoiceDetail, /tone=\{overdue \? "destructive" : undefined\}/);
  // Baris awal di PaymentSummary ikut aturan serupa lewat prop overdue.
  assert.match(invoiceDetail, /overdue=\{initialOverdue\}/);
});

test("R7: DP Rp 0 auto-finalize saat Terbitkan, deposit jadi transaksi terpisah, dan WO menunggu Payment", async () => {
  const [actionSource, serviceSource, formSource, invoiceDetailSource] = await Promise.all([
    readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/production/service.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/invoice-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/invoice-detail.tsx", import.meta.url), "utf8"),
  ]);
  // Terbitkan invoice dengan jadwal DP Rp 0 mem-finalize deal dalam transaksi yang sama.
  assert.match(actionSource, /const finalized = invoice\.pendingPayment\.kind === "DP" && invoice\.pendingPayment\.initialAmount\.isZero\(\)\s*\? await finalizeDeal\(tx, actor, parsed\.data\.invoiceId, null\)/);
  assert.match(actionSource, /dan Work Order langsung terbentuk karena DP Rp 0\./);
  assert.match(actionSource, /revalidatePaymentMutationPaths\(issuedInvoice\.finalized\.id\)/);
  // Jalur "Catat pembayaran awal" memakai finalizeDeal dan tipe pembayaran yang sama.
  assert.match(actionSource, /type DealFinalizePayment = \{[\s\S]{0,200}paidAt: Date;[\s\S]{0,200}proof: PaymentProof \| null;\s*\};/);
  assert.match(actionSource, /\(tx\) => finalizeDeal\(tx, actor, parsed\.data\.invoiceId, payment\)/);
  // Guard: pembayaran awal > 0 wajib disertakan; DP Rp 0 lolos tanpa payment.
  assert.match(actionSource, /if \(initialAmount\.gt\(0\) && !initialPayment\) throw new UserFacingError\("Pembayaran awal wajib dicatat\."\)/);
  assert.match(actionSource, /const payment = initialAmount\.gt\(0\) \? initialPayment : null;/);
  // Deposit PO dicatat terpisah sebagai transaksi isDeposit (tanpa bukti unggahan).
  assert.match(actionSource, /await tx\.paymentTransaction\.create\(\{\s*data: \{\s*paymentId,\s*isDeposit: true,/);
  assert.match(actionSource, /paymentKind: "DEPOSIT"/);
  // Catat pembayaran awal mengabaikan transaksi deposit dan menolak DP Rp 0.
  assert.match(actionSource, /transactions: \{ where: \{ paymentTermId: null, isDeposit: false, status: "ACTIVE" \}/);
  assert.match(actionSource, /if \(payment\.initialAmount\.lte\(0\)\) throw new UserFacingError\("Tidak ada pembayaran awal yang perlu dicatat\."\)/);
  // Work Order hanya dibentuk bila Sales Order sudah punya Payment terkait.
  assert.match(serviceSource, /if \(!order \|\| order\.status !== "ACTIVE" \|\| !order\.payment\) return null;/);
  // Form invoice mengizinkan nominal pembayaran awal Rp 0 (DP Rp 0 disimpan saat draft).
  assert.match(formSource, /name="initialValue" required min=\{0\}/);
  // Detail invoice: baris deposit read-only dan DP Rp 0 memakai badge netral.
  assert.match(invoiceDetailSource, /function DepositRow\(/);
  assert.match(invoiceDetailSource, /neutral=\{initialZero \? "Tidak ada DP" : undefined\}/);
  assert.match(invoiceDetailSource, /isOverdue\(initialDueAt, !initialPaid && !initialZero\)/);
  // Constraint DB lama melarang initialAmount = 0; migrasi R7 melonggarkannya agar jalur DP Rp 0 tembus.
  const migrationSource = await readFile(new URL("../prisma/migrations/20261018020000_dealpayment_allow_zero_dp/migration.sql", import.meta.url), "utf8");
  assert.match(migrationSource, /ALTER TABLE "DealPayment" DROP CONSTRAINT "DealPayment_values_valid"/);
  assert.match(migrationSource, /"initialValue" >= 0 AND "initialAmount" >= 0 AND "outstandingAmount" >= 0/);
});

test("R4: add on invoice punya qty sendiri (bisa kurang dari qty baris)", async () => {
  const [schema, validation, form, pdf, detail, data, page] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/validation.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/invoice-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/invoice-pdf.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/invoice-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8"),
  ]);

  // Kolom qty pada InvoiceAddon global (InvoiceItemAddon lama tetap ada).
  assert.match(schema, /model InvoiceAddon[\s\S]+?qty\s+Int\s+@default\(1\)/);
  // Validasi: minimal 1, default 1 supaya data lama (tanpa qty) tetap valid.
  assert.match(validation, /qty: z\.coerce\.number\(\)\.int\(\)\.min\(1, "Qty add on minimal 1\."\)\.default\(1\)/);
  // Form: input qty Add On global.
  assert.match(form, /name="addonQty"/);
  assert.doesNotMatch(form, /item-\$\{rowIndex\}-addon-qty/);
  // PDF & detail mencetak qty add on, bukan qty baris.
  assert.match(pdf, /const addonQty = addon\.qty \?\? 1/);
  assert.match(detail, /addon\.qty/);
  // Select Prisma menyertakan qty Add On global (form & detail).
  assert.match(data, /qty: true/);
  assert.match(page, /qty: addon\.qty/);
});

test("R5: keterangan & S&K multi-baris (kolom TEXT, batas 1000, format kaya)", async () => {
  const [schema, validation, editor, richEditor, pdf] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/validation.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/invoice-settings-editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/invoice-setting-rich-editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/invoice-pdf.ts", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /text\s+String\s+@db\.Text/);
  assert.match(validation, /INVOICE_SETTING_POINT_TEXT_MAX = 1000/);
  assert.match(validation, /sanitizeInvoicePointHtml/);
  assert.match(editor, /InvoiceSettingRichEditor/);
  assert.match(editor, /name="points"/);
  assert.doesNotMatch(editor, /Tambah poin/);
  assert.match(richEditor, /toggleBold\(\)/);
  assert.match(richEditor, /toggleItalic\(\)/);
  assert.match(richEditor, /toggleUnderline\(\)/);
  assert.match(pdf, /parseInvoicePointRuns/);
});

test("R6: diskon dua level (per baris & total) bisa nominal atau persen, tersimpan terpisah", async () => {
  const [schema, validation, form, crm, detail, workflow] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/validation.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/invoice-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/invoice-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/invoice-workflow-section.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /discountNominal\s+Decimal\s+@default\(0\) @db\.Decimal\(18, 2\)/);
  assert.match(validation, /invoiceDiscountTypeSchema = z\.enum\(\["NONE", "NOMINAL", "PERCENTAGE"\]\)/);
  assert.match(validation, /discountNominal: z\.preprocess\(/);
  // Form menyediakan pemilih tipe + input nominal di kedua level.
  assert.match(form, /name="itemDiscountType"/);
  assert.match(form, /name="discountType"/);
  assert.match(form, /name="itemDiscountNominal"/);
  assert.match(form, /name="discountNominal"/);
  // Server menyimpan tipe + nilai diskon hasil kalkulasi (order terpisah dari item).
  assert.match(crm, /discountType: calculated\.discountType/);
  assert.match(crm, /discountNominal: calculated\.discountNominal/);
  // Draft prefill membawa tipe/nominal diskon.
  assert.match(workflow, /discountNominal\?: string/);
  // Detail menampilkan nominal & persen otomatis.
  assert.match(detail, /function discountCellText/);
});

test("diskon nominal per baris dan total memakai input Rupiah berformat", async () => {
  const [form, money] = await Promise.all([
    readFile(new URL("../components/crm/invoice-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/money-input.tsx", import.meta.url), "utf8"),
  ]);

  // Mode Rp memakai MoneyInput: prefiks Rp + ribuan "10.000", dengan toggle di ujung kanan.
  assert.match(money, /endAddon\?: ReactNode/);
  assert.match(money, /\{endAddon\}/);
  assert.match(form, /<MoneyInput[\s\S]{0,260}value=\{row\.discountNominal\}[\s\S]{0,260}endAddon=\{<DiscountToggle/);
  assert.match(form, /<MoneyInput[\s\S]{0,260}value=\{orderDiscountNominal\}[\s\S]{0,260}endAddon=\{<DiscountToggle/);
  // Nilai mentah tetap dikirim lewat field tersembunyi, bukan teks berformat.
  assert.match(form, /name="itemDiscountNominal" value=\{row\.discountType === "NOMINAL" \? row\.discountNominal : "0"\}/);
  assert.match(form, /name="discountNominal" value=\{orderDiscountType === "NOMINAL" \? orderDiscountNominal : "0"\}/);
});

test("R8: nominal rupiah invoice memakai format id-ID dua desimal (Rp 4.330.000,00)", async () => {
  const [format, pdf, receipt, detail] = await Promise.all([
    readFile(new URL("../lib/crm/format.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/invoice-pdf.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/receipt-pdf.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/invoice-detail.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(format, /export function formatInvoiceCurrency/);
  assert.match(format, /minimumFractionDigits: 2,\s*maximumFractionDigits: 2/);
  // Format global lama tetap tanpa desimal (halaman lain tidak berubah).
  assert.match(format, /export function formatCurrency[\s\S]*?maximumFractionDigits: 0/);
  assert.match(pdf, /new Intl\.NumberFormat\("id-ID", \{ minimumFractionDigits: 2, maximumFractionDigits: 2 \}\)/);
  assert.match(receipt, /new Intl\.NumberFormat\("id-ID", \{ minimumFractionDigits: 2, maximumFractionDigits: 2 \}\)/);
  // Detail invoice memakai format khusus invoice.
  assert.match(detail, /import \{ formatInvoiceCurrency/);
  assert.doesNotMatch(detail, /formatCurrency\(/, "detail invoice tidak memakai format lama");
});

test("R11-R13: deposit selalu tampil, pajak ber-keterangan, tanpa Pajak Inclusive/Keuntungan", async () => {
  const [detail, pdf] = await Promise.all([
    readFile(new URL("../components/crm/invoice-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/invoice-pdf.ts", import.meta.url), "utf8"),
  ]);

  // R11: baris Deposit selalu dirender (Rp 0 bila belum ada).
  assert.match(detail, /label="Deposit"/);
  assert.match(detail, /detail\.purchaseOrder\.depositAmount \?\? "0"/);
  // R12: keterangan Pajak memuat persen dari setting + nominal.
  assert.match(detail, /Number\(detail\.taxPercent\)/);
  assert.match(detail, /detail\.taxAmount/);
  // R12: baris Keuntungan diganti Deposit.
  assert.doesNotMatch(detail, /Keuntungan/);
  assert.doesNotMatch(pdf, /Keuntungan/);
  // R13: Pajak Inclusive dihapus dari PDF.
  assert.doesNotMatch(pdf, /Pajak Inclusive/);
  // R13: label Lunas tetap, nominal dibungkus tanda kurung.
  assert.match(pdf, /\{ label: "Lunas", value: totalPaid > 0 \? `Rp \(\$\{templateNumber\(totalPaid\)\}\)`/);
});

test("R4/R5/R6: migrasi Sprint 8 aman untuk data lama", async () => {
  const [sql, textSql] = await Promise.all([
    readFile(new URL("../prisma/migrations/20261017020000_invoice_discount_and_addon_qty/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20261017030000_invoice_setting_point_text/migration.sql", import.meta.url), "utf8"),
  ]);

  assert.match(sql, /ADD COLUMN IF NOT EXISTS "qty" INTEGER NOT NULL DEFAULT 1/);
  assert.match(sql, /SET "qty" = i\."quantity"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "discountType" "DiscountType" NOT NULL DEFAULT 'NONE'/);
  assert.match(sql, /UPDATE "Invoice" SET "discountType" = 'NONE', "discountValue" = 0, "discountNominal" = 0/);
  assert.match(sql, /UPDATE "SalesOrder" SET "discountType" = 'NONE'/);
  assert.match(textSql, /ALTER COLUMN "text" TYPE TEXT/);
});

test("R4/R6: form invoice pakai toggle Rp/%, default 0 lewat placeholder, add on sejajar kolom", async () => {
  const form = await readFile(new URL("../components/crm/invoice-form.tsx", import.meta.url), "utf8");

  // Diskon & diskon total memakai toggle segmen Rp/% (bukan dropdown).
  assert.match(form, /function DiscountToggle/);
  assert.match(form, /aria-pressed=\{type === mode\}/);
  assert.match(form, /\[\["PERCENTAGE", "%"\], \["NOMINAL", "Rp"\]\]/);
  // NativeSelect hanya untuk pilihan jenis jadwal pembayaran, bukan untuk diskon.
  assert.match(form, /<NativeSelect[\s\S]{0,300}name="kind"/);
  assert.doesNotMatch(form, /<NativeSelect[\s\S]{0,300}name="(itemDiscount|discount)/);

  // Diskon, diskon total, dan pajak default kosong → placeholder "0", nilai kosong = 0.
  assert.match(form, /function initNumber/);
  assert.match(form, /placeholder="0"/);
  assert.match(form, /placeholder="0" value=\{taxPercent\}/);
  assert.match(form, /useState\(\(\) => initNumber\(values\?\.taxPercent\)\)/);

  // Nilai tetap terkirim lewat field tersembunyi (satu nilai per field).
  assert.match(form, /name="itemDiscountType"/);
  assert.match(form, /name="itemDiscountPercent"/);
  assert.match(form, /name="itemDiscountNominal"/);
  assert.match(form, /name="discountType"/);
  assert.match(form, /name="discountPercent"/);
  assert.match(form, /name="discountNominal"/);

  // Add On global sejajar kolom atas dan berada setelah seluruh produk: keterangan
  // (Produk), deskripsi (Deskripsi), qty, harga; tanpa diskon.
  assert.match(form, /name="addonLabel"/);
  assert.match(form, /name="addonDescription"/);
  assert.match(form, /name="addonQty"/);
  assert.match(form, /variant="destructive"[\s\S]{0,160}Hapus add on/);
  assert.match(form, /className="w-16 text-center">Qty<\/TableHead>/);
  assert.ok(form.indexOf("<p className=\"text-sm font-medium\">Add On</p>") < form.indexOf('name="addonLabel"'));
  // Blok Add On dibedakan dari produk: tint info, badge Opsional, dan baris berwarna.
  assert.match(form, /<Badge variant="info">Opsional<\/Badge>/);
  assert.match(form, /bg-info-surface\/40 hover:bg-info-surface\/60/);
  assert.match(form, /text-info-surface-foreground/);
  // Qty produk dan Add On memakai garis kanan yang sama; spinner bawaan browser dihilangkan.
  assert.match(form, /<div className="flex h-9 items-center justify-center font-mono tabular-nums">\{group\.quantity\}<\/div>/);
  assert.match(form, /name="addonQty"[\s\S]{0,100}type="number"/);
  assert.match(form, /inputMode="numeric"/);
  assert.match(form, /function preventNonIntegerQtyKeys/);
  assert.match(form, /onKeyDown=\{preventNonIntegerQtyKeys\}/);
  assert.match(form, /className="text-center font-mono tabular-nums \[appearance:textfield\]/);
  assert.match(form, /\[&::-webkit-inner-spin-button\]:appearance-none/);
  assert.match(form, /\[&::-webkit-outer-spin-button\]:appearance-none/);
});

test("R4 lanjutan: add on punya deskripsi opsional, tersimpan & tampil", async () => {
  const [schema, validation, calc, crm, form, pdf, detail, data, page, workflow] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/validation.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/invoice-calculation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/invoice-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/invoice-pdf.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/invoice-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/invoice-workflow-section.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /description\s+String\?\s+@db\.VarChar\(240\)/);
  assert.match(validation, /description: optionalText\(240\)/);
  assert.match(calc, /description: addon\.description\?\.trim\(\) \|\| null/);
  assert.match(crm, /formData\.getAll\("addonDescription"\)/);
  // Deskripsi Add On global dibawa sampai objek create Prisma.
  assert.match(crm, /description: addonDescriptions\[index\] \|\| undefined/);
  assert.match(crm, /addons: \{ create: calculated\.addons \}/);
  assert.match(form, /name="addonDescription"/);
  assert.match(form, /placeholder="Deskripsi add on \(opsional\)\.\.\."/);
  assert.match(pdf, /const addonDescLines = wrapCell\(addon\.description\?\.trim\(\) \|\| "-", 1\)/);
  assert.match(detail, /addon\.description\?\.trim\(\) \|\|/);
  // Snapshot panel invoice: kolom Deskripsi memakai isi form (atau "-"), bukan caption qty × harga.
  assert.match(page, /item\.description \|\| "-"/);
  assert.match(page, /addon\.description\?\.trim\(\) \|\| "-"/);
  assert.doesNotMatch(page, /\{addon\.qty\} × \{formatCurrency\(addon\.unitAmount\)\}/);
  assert.match(detail, /item\.description \|\| "-"/);
  assert.match(data, /label: true, description: true, unitAmount: true, qty: true/);
  assert.match(page, /description: addon\.description \?\? ""/);
  assert.match(workflow, /addons\?: Array<\{ label\?: string; description\?: string;/);

  const migration = await readFile(new URL("../prisma/migrations/20261017040000_invoice_addon_description/migration.sql", import.meta.url), "utf8");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "description" VARCHAR\(240\)/);
});

test("R13 revisi: PDF Disc memakai nominal, deskripsi kosong jadi '-'", async () => {
  const [pdf, detail, crm] = await Promise.all([
    readFile(new URL("../lib/crm/invoice-pdf.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/crm/invoice-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8"),
  ]);

  // Disc selalu nominal (bukan persen), mengikuti gaya kolom Harga.
  assert.match(pdf, /\[templateNumber\(item\.discountAmount\?\.toString\(\) \?\? "0"\)\]/);
  assert.doesNotMatch(pdf, /\[String\(Number\(item\.discountPercent/);
  // Deskripsi kosong produk & add on → "-".
  assert.match(pdf, /wrapCell\(item\.description \|\| "-", 1\)/);
  assert.match(pdf, /const addonDescLines = wrapCell\(addon\.description\?\.trim\(\) \|\| "-", 1\)/);
  assert.match(detail, /item\.description \|\| "-"/);
  assert.match(detail, /addon\.description\?\.trim\(\) \|\| "-"/);
  // Deskripsi produk tidak lagi diisi otomatis oleh server.
  assert.match(crm, /const description = String\(submitted\.description \|\| ""\)\.trim\(\);/);
  assert.doesNotMatch(crm, /defaultInvoiceItemDescription/);
});

test("Decimal tidak dilempar ke Client Component dari getInvoiceDetail", async () => {
  const data = await readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8");
  assert.doesNotMatch(data, /\.\.\.invoice\.purchaseOrder/, "deposit Decimal tidak boleh ikut di-spread");
  assert.match(data, /depositAmount: invoice\.purchaseOrder\.deposit\?\.amount\.toString\(\) \?\? null/);
});

test("Draft & revisi invoice menyimpan jadwal bersama transaksi dan diaudit PAYMENT_SCHEDULED", async () => {
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  // Simpan draft & buat revisi: pending payment dibuat dalam transaksi yang sama dengan invoice.
  assert.match(actionSource, /await tx\.pendingDealPayment\.create\(\{ data: \{ invoiceId: created\.id, createdById: actor\.id, \.\.\.scheduleData, terms: \{ create: scheduleTerms \} \} \}\);/);
  const audits = actionSource.match(/"PAYMENT_SCHEDULED"/g) || [];
  assert.equal(audits.length, 2, "audit PAYMENT_SCHEDULED ada di simpan draft dan buat revisi");
  assert.match(actionSource, /await audit\(tx, actor, "Invoice", created\.id, "PAYMENT_SCHEDULED", \["paymentSchedule"\], \{ kind: scheduleData\.kind, initialDueAt: scheduleData\.initialDueAt, terms: scheduleTerms\.length \}\);/);
  // Baseline urutan termin butuh tanggal sumber yang jelas: dueAt wajib saat jadwal disusun.
  assert.equal((actionSource.match(/if \(!dueAtDate\) throw new UserFacingError\("Tgl\. jatuh tempo wajib diisi\."\);/g) || []).length, 2);
});

test("Deadline termin opsional, aman-null setelah terbit, dan bisa diubah lewat dialog terpisah", async () => {
  const [detailSource, actionSource, validationSource] = await Promise.all([
    readFile(new URL("../components/crm/invoice-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm/validation.ts", import.meta.url), "utf8"),
  ]);
  // Aksi khusus deadline: tanggal saja, hanya invoice terbit, urutan divalidasi, diaudit.
  assert.match(actionSource, /export async function updateInvoicePaymentDeadlinesAction/);
  assert.match(actionSource, /Hanya invoice terbit yang deadline pembayarannya dapat diubah\./);
  assert.match(actionSource, /Jumlah deadline termin berubah\. Muat ulang halaman\./);
  assert.match(actionSource, /if \(dueAt <= previousDueAt\) throw new UserFacingError\(`Deadline Termin \$\{position \+ 1\} minimal satu hari setelah \$\{previousLabel\}`\)/);
  assert.match(actionSource, /"PAYMENT_DEADLINES_UPDATED"/);
  assert.match(actionSource, /revalidatePaymentMutationPaths\(result\.salesOrderId\)/);
  assert.match(validationSource, /export const paymentDeadlineUpdateSchema = z\.object\(\{/);
  assert.match(validationSource, /initialDueAt: optionalDateText/);
  // Skema: tanggal deadline opsional per termin, maksimal 12 termin.
  assert.equal(paymentDeadlineUpdateSchema.safeParse({ invoiceId: "cm123456789013", initialDueAt: "", termDueAt: ["2026-12-01", ""] }).success, true);
  assert.equal(paymentDeadlineUpdateSchema.safeParse({ invoiceId: "cm123456789013", initialDueAt: "2026-12-01", termDueAt: [] }).success, true);
  assert.equal(paymentDeadlineUpdateSchema.safeParse({ invoiceId: "cm123456789013", initialDueAt: "", termDueAt: Array(13).fill("") }).success, false);
  // UI null-safe: tanggal kosong = "Belum diatur"/"Ikut jatuh tempo", tanpa crash & tanpa "Terlambat" keliru.
  assert.match(detailSource, /deadline \? formatDate\(deadline\) : detail\.dueAt \? `Ikut jatuh tempo \(\$\{formatDate\(detail\.dueAt\)\}\)` : "Belum diatur"/);
  assert.match(detailSource, /issued && isOverdue\(payment\.initialDueAt, true\)/);
  assert.match(detailSource, /issued && isOverdue\(term\.dueAt, true\)/);
  assert.match(detailSource, /issued \? `Menunggu \$\{label\}` : "Jadwal tersimpan"/);
  assert.match(detailSource, /initialDueAt=\{detail\.salesOrder\.initialDueAt\}/);
  assert.match(detailSource, /payment\.initialDueAt \? formatDate\(payment\.initialDueAt\) : "Belum diatur"/);
  // Dialog di-unmount saat ditutup agar state form reset; nominal tidak bisa diubah dari sini.
  assert.match(detailSource, /Ubah deadline pembayaran/);
  assert.match(detailSource, /\{open \? <DeadlineEditDialog/);
  assert.match(detailSource, /if \(state\.success\) \{ onClose\(\); void onSaved\(\); \}/);
  assert.match(detailSource, /Hanya tanggal yang diubah; nominal jadwal tetap\. Kosongkan tanggal untuk tanpa batas\./);
});

test("Migrasi deadline fleksibel: kolom nullable, salinan initialDueAt, backfill Lunas", async () => {
  const [migration, schema] = await Promise.all([
    readFile(new URL("../prisma/migrations/20261019010000_payment_deadlines_flexible/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  ]);
  // Deadline nullable: tanggal kosong = tanpa batas, tanpa peringatan terlambat.
  assert.match(migration, /ALTER TABLE "PendingDealPayment" ALTER COLUMN "initialDueAt" DROP NOT NULL;/);
  assert.match(migration, /ALTER TABLE "PendingPaymentTerm" ALTER COLUMN "dueAt" DROP NOT NULL;/);
  assert.match(migration, /ALTER TABLE "PaymentTerm" ALTER COLUMN "dueAt" DROP NOT NULL;/);
  // DealPayment menyimpan salinan jatuh tempo invoice terbit.
  assert.match(migration, /ALTER TABLE "DealPayment" ADD COLUMN "initialDueAt" DATE;/);
  assert.match(migration, /SET "initialDueAt" = i\."dueAt"/);
  // Backfill: invoice terbit tanpa SO & tanpa jadwal → Lunas 100% sisa tagihan.
  assert.match(migration, /INSERT INTO "PendingDealPayment"/);
  assert.match(migration, /AND i\.total > COALESCE\(d\.amount, 0\)/);
  assert.match(migration, /AND NOT EXISTS \(SELECT 1 FROM "SalesOrder" s WHERE s\."invoiceId" = i\.id\)/);
  assert.match(migration, /AND NOT EXISTS \(SELECT 1 FROM "PendingDealPayment" p WHERE p\."invoiceId" = i\.id\)/);
  assert.match(migration, /BEGIN;/);
  assert.match(migration, /COMMIT;/);
  // Skema Prisma: kolom salinan nullable di DealPayment & PendingDealPayment.
  assert.match(schema, /initialDueAt\s+DateTime\?\s+@db\.Date/);
});

test("Jalur DealPaymentForm & completeDealAction dihapus; jadwal hanya lewat form invoice", async () => {
  await assert.rejects(
    readFile(new URL("../components/crm/deal-payment-form.tsx", import.meta.url), "utf8"),
    "form DealPaymentForm lama harus sudah dihapus",
  );
  const [pageSource, actionSource] = await Promise.all([
    readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(pageSource, /DealPaymentForm|deal-payment-form/);
  assert.doesNotMatch(actionSource, /completeDealAction/);
  // Pengelolaan jadwal kini lewat form invoice + aksi deadline terpisah.
  assert.match(actionSource, /export async function updateInvoicePaymentDeadlinesAction/);
});

test("LUNAS memakai total tagihan (collectible) sebagai pembayaran awal", async () => {
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  // Tanpa fix ini, deposit non-kelipatan Rp500 membuat Lunas gagal saat finalisasi.
  assert.match(actionSource, /const initialAmount = kind === "LUNAS" \? collectibleTotal : amountFor\(initialValueType, initialValue\.toString\(\)\);/);
  assert.match(actionSource, /const outstandingAmount = collectibleTotal\.sub\(initialAmount\);/);
  assert.match(actionSource, /if \(initialAmount\.lt\(0\) \|\| initialAmount\.gt\(collectibleTotal\)\) throw new UserFacingError\("Nilai pembayaran awal tidak valid\."\)/);
  assert.match(actionSource, /DP nominal yang menutup sisa tagihan \(setelah deposit\) dihitung Lunas/);
});
