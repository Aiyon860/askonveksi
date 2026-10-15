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
  completeDealSchema,
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
    items: [{ description: "Kaos", quantity: 0, unitPrice: "50000" }],
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

test("add on invoice per baris: caption ukuran,parse form, dan batas validasi", async () => {
  const itemBase = {
    purchaseOrderSizeId: "cm123456789012",
    productName: "Jaket Polirevo",
    size: "XL",
    sleeveLength: "PANJANG",
    description: "",
    quantity: 2,
    unitPrice: "100000",
    discountPercent: "0",
  };
  const valid = invoiceDraftSchema.safeParse({
    opportunityId: "cm123456789012",
    purchaseOrderId: "cm123456789013",
    discountPercent: "0",
    taxPercent: "0",
    items: [{ ...itemBase, addons: [{ label: "Kerah", unitAmount: "10000" }] }],
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.items[0].addons.length, 1);

  const withoutAddons = invoiceDraftSchema.safeParse({
    opportunityId: "cm123456789012",
    purchaseOrderId: "cm123456789013",
    discountPercent: "0",
    taxPercent: "0",
    items: [{ ...itemBase }],
  });
  assert.equal(withoutAddons.success, true);
  assert.deepEqual(withoutAddons.data.items[0].addons, []);

  const tooMany = invoiceDraftSchema.safeParse({
    opportunityId: "cm123456789012",
    purchaseOrderId: "cm123456789013",
    discountPercent: "0",
    taxPercent: "0",
    items: [{ ...itemBase, addons: Array.from({ length: 6 }, (_, index) => ({ label: `Add ${index}`, unitAmount: "1000" })) }],
  });
  assert.equal(tooMany.success, false);

  const badLabel = invoiceDraftSchema.safeParse({
    opportunityId: "cm123456789012",
    purchaseOrderId: "cm123456789013",
    discountPercent: "0",
    taxPercent: "0",
    items: [{ ...itemBase, addons: [{ label: "X", unitAmount: "1000" }] }],
  });
  assert.equal(badLabel.success, false);

  const badAmount = invoiceDraftSchema.safeParse({
    opportunityId: "cm123456789012",
    purchaseOrderId: "cm123456789013",
    discountPercent: "0",
    taxPercent: "0",
    items: [{ ...itemBase, addons: [{ label: "Kerah", unitAmount: "-5" }] }],
  });
  assert.equal(badAmount.success, false);

  const invoiceFormSource = await readFile(new URL("../components/crm/invoice-form.tsx", import.meta.url), "utf8");
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  assert.match(invoiceFormSource, /"Panjang"\} · \$\{poItem\.size\}/);
  assert.match(invoiceFormSource, /item-\$\{rowIndex\}-addon-label/);
  assert.match(invoiceFormSource, /item-\$\{rowIndex\}-addon-amount/);
  assert.match(invoiceFormSource, /MAX_ADDONS_PER_ROW/);
  assert.match(actionSource, /item-\$\{index\}-addon-label/);
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
    pola: "Jersey tim",
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
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...valid, pola: "" }).success, false);
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
    decorationMethods: ["SABLON_PLASTISOL"],
    rosterMode: "none",
    roster: [],
  };
  const base = {
    opportunityId: "cm123456789012",
    garmentType: "NON_JERSEY",
    instansi: "Komunitas Lari",
    pola: "Kaos komunitas",
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
    sizes: [{ sizeId: "garment-size-m", sleeveLength: "PANJANG", quantity: 2 }],
    rosterMode: "none",
    roster: [],
  };
  const base = {
    opportunityId: "cm123456789012",
    garmentType: "JERSEY",
    instansi: "SMA Negeri 1",
    pola: "Jersey tim",
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

test("tab peluang dan label dekorasi memiliki fallback yang aman", () => {
  assert.equal(parseOpportunityDetailTab(undefined), "peluang");
  assert.equal(parseOpportunityDetailTab("invoice"), "invoice");
  assert.equal(parseOpportunityDetailTab(["aktivitas", "po"]), "aktivitas");
  assert.equal(parseOpportunityDetailTab("tidak-valid"), "peluang");
  assert.equal(decorationMethodLabel("BORDIR"), "Bordir");
  assert.equal(decorationMethodLabel("Nilai lama"), "Nilai lama");
});

test("lead baru dapat divalidasi untuk langsung masuk negosiasi", () => {
  assert.equal(moveOpportunitySchema.safeParse({ opportunityId: "cm123456789012", version: "1", stage: "NEGOSIASI", cancelReason: "" }).success, true);
});

test("aksi pindah status dari detail peluang tidak fallback ke board", async () => {
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  const detailPageSource = await readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(actionSource, /function opportunityRedirectPath[\s\S]+const fallback = opportunityTabFallback\(formData, "peluang"\)/);
  assert.match(actionSource, /export async function moveOpportunityStageAction[\s\S]+const redirectPath = opportunityRedirectPath\(formData\)/);
  // Panel Status pipeline dihapus dari semua tab detail peluang; pindah status hanya via board.
  assert.doesNotMatch(detailPageSource, /Status pipeline/);
  assert.doesNotMatch(detailPageSource, /OpportunityStageForm/);
});

test("Deal mewajibkan pembayaran lunas atau DP dengan termin", () => {
  const base = {
    opportunityId: "cm123456789012",
    opportunityVersion: "1",
    purchaseOrderId: "cm123456789013",
    invoiceId: "cm123456789014",
    invoiceVersion: "1",
    initialValueType: "PERCENTAGE",
    initialValue: "50",
  };
  assert.equal(completeDealSchema.safeParse({ ...base, kind: "LUNAS", terms: [] }).success, true);
  assert.equal(completeDealSchema.safeParse({ ...base, kind: "DP", terms: [] }).success, false);
  assert.equal(completeDealSchema.safeParse({ ...base, kind: "DP", terms: [{ valueType: "PERCENTAGE", value: "50", dueAt: "2026-09-30" }] }).success, true);
  assert.equal(completeDealSchema.safeParse({ ...base, kind: "DP", initialValue: "100", terms: [] }).success, true);
  assert.equal(completeDealSchema.safeParse({ ...base, kind: "LUNAS", terms: [{ valueType: "NOMINAL", value: "1", dueAt: "2026-09-30" }] }).success, false);
  // Deposit nominal bebas tetap butuh termin sisa.
  const depositBase = { ...base, kind: "DEPOSIT", initialValueType: "NOMINAL", initialValue: "50000" };
  assert.equal(completeDealSchema.safeParse({ ...depositBase, terms: [] }).success, false);
  assert.equal(completeDealSchema.safeParse({ ...depositBase, terms: [{ valueType: "NOMINAL", value: "100000", dueAt: "2026-09-30" }] }).success, true);
});

test("jadwal DP menampilkan nominal pecahan dan dapat mengisi sisa tepat", async () => {
  const source = await readFile(new URL("../components/crm/deal-payment-form.tsx", import.meta.url), "utf8");
  assert.match(source, /const totalAmount = Number\(total\)/);
  assert.match(source, /valueType === "PERCENTAGE" \? roundPaymentAmount/);
  assert.match(source, /function fillTermRemainder\(key: string\)/);
  assert.match(source, /onClick=\{\(\) => fillTermRemainder\(terms\[terms\.length - 1\]\.key\)\}/);
});

test("deadline termin harus sehari setelah pembayaran awal atau termin sebelumnya", async () => {
  const formSource = await readFile(new URL("../components/crm/deal-payment-form.tsx", import.meta.url), "utf8");
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  assert.match(formSource, /min=\{addJakartaDays\(index \? terms\[index - 1\]\.dueAt \|\| initialDueAt : initialDueAt, 1\)\}/);
  assert.match(actionSource, /dueAt <= previousDueAt/);
});

test("Invoice terbit menetapkan deadline awal H+7 dan Deal memakai deadline Invoice", async () => {
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  assert.match(actionSource, /const dueAt = addJakartaDays\(issuedAt, 7\)/);
  assert.match(actionSource, /issuedAt,\s*dueAt,/);
  assert.match(actionSource, /const initialDueAt = invoice\.dueAt \?\? addJakartaDays\(invoice\.issuedAt, 7\)/);
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
  assert.match(pageSource, /const scheduledPayment = issuedInvoice\?\.pendingPayment/);
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

test("revisi dokumen hanya berasal dari draft sampai revisi keempat dan final tidak ditimpa", async () => {
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  assert.match(actionSource, /source\.status !== "DRAFT"[\s\S]+source\.revision >= 4/);
  assert.match(actionSource, /revision: \{ lt: 4 \}/);
  assert.doesNotMatch(actionSource, /where: \{ opportunityId: invoice\.opportunityId, status: "ISSUED"/);
  assert.doesNotMatch(actionSource, /where: \{ opportunityId: purchaseOrder\.opportunityId, status: "AGREED"/);
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
  assert.match(dataSource, /requireActor\(ANALYTICS_ROLES\)/);
  assert.match(dataSource, /mode === "range"/);
  assert.match(dataSource, /o\."leadSourceId"/);
  assert.match(dataSource, /COUNT\(DISTINCT so\."opportunityId"\)/);
  assert.match(dataSource, /so\."status" = 'ACTIVE'/);
  assert.match(pageSource, /Dari tanggal/);
  assert.match(pageSource, /Sampai tanggal/);
  assert.match(pageSource, /Terapkan rentang/);
  assert.match(pageSource, /Rekapan semua order/);
  assert.doesNotMatch(pageSource, /Terapkan periode/);
  assert.doesNotMatch(pageSource, /NativeSelect/);
});

test("laporan keuangan membaca transaksi aktif dan memakai sisa pembayaran", async () => {
  const dataSource = await readFile(new URL("../lib/finance/data.ts", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../app/(app)/keuangan/pemasukan/page.tsx", import.meta.url), "utf8");

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
  assert.match(designActionSource, /storage\.from\(BUCKET\)/);
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
  assert.match(actionSource, /maxWait:\s*10_000/);
  assert.match(actionSource, /timeout:\s*20_000/);
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
  const exportRouteSource = await readFile(new URL("../app/api/customers/export/route.ts", import.meta.url), "utf8");
  const legacyPageSource = await readFile(new URL("../app/(app)/crm/pelanggan/page.tsx", import.meta.url), "utf8");

  assert.match(navSource, /href: "\/customers", label: "Customer"/);
  assert.doesNotMatch(navSource, /isPathWithin\(pathname, "\/crm\/pelanggan"\)/);
  assert.match(pageSource, /function customerDetailHref\(customerId: string, state: TableState\)/);
  assert.match(pageSource, /<CustomerTableRowLink key=\{customer\.id\} href=\{customerDetailHref\(customer\.id, state\)\}>/);
  assert.match(pageSource, /href=\{exportHref\(state\)\}/);
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
  assert.match(exportRouteSource, /downloadFilename\("customer", "xlsx"\)/);
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
  const autoRefresh = await readFile(new URL("../components/auto-refresh.tsx", import.meta.url), "utf8");
  const invoiceDetail = await readFile(new URL("../components/crm/invoice-detail.tsx", import.meta.url), "utf8");
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");

  // Halaman memantau perubahan: tabel disegarkan berkala dan saat tab kembali aktif.
  assert.match(page, /<AutoRefresh \/>/);
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
  assert.match(invoiceDetail, /label: "Unduh Kwitansi"/);
  assert.match(invoiceDetail, /label: `Kwitansi Termin \$\{term\.position \+ 1\}`/);
  // Kwitansi hanya ada di footer dialog (sebelum Unduh Invoice, varian hijau); baris pembayaran hanya pratinjau bukti.
  assert.equal(invoiceDetail.match(/Unduh Kwitansi/g)?.length, 1);
  assert.doesNotMatch(invoiceDetail, /payment-transactions\/\$\{transaction\.id\}\/kwitansi/);
  assert.match(deliveryActions, /api\/crm\/payment-transactions\/\$\{receipt\.id\}\/kwitansi/);
  assert.match(deliveryActions, /variant={compact \? "ghost" : "success"}/);
  assert.match(deliveryActions, /Unduh Invoice/);
  assert.doesNotMatch(deliveryActions, /Unduh PDF/);

  // Tab Invoice pada peluang memakai komponen yang sama: kwitansi tampil sebelah Unduh Invoice.
  const workflowSection = await readFile(new URL("../components/crm/invoice-workflow-section.tsx", import.meta.url), "utf8");
  const opportunityPage = await readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8");
  const dataSource = await readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8");
  assert.match(workflowSection, /receipts={receipts}/);
  assert.match(opportunityPage, /receipts={invoiceReceipts}/);
  assert.match(opportunityPage, /label: "Unduh Kwitansi"/);
  // Id transaksi pembayaran (awal + termin) ikut ditarik oleh detail peluang.
  assert.match(dataSource, /paymentTermId: null \}, select: \{ id: true, amount: true \}/);
  assert.match(dataSource, /terms: \{ orderBy: \{ position: "asc" \}, select: \{ position: true, transactions/);

  // Daftar invoice di-cache bertag "invoices"; `revalidatePath` saja tidak mengosongkan cache itu.
  assert.match(actionSource, /function revalidateInvoiceList\(\) \{\s*revalidatePath\("\/crm\/invoices"\);\s*revalidateTag\("invoices", \{ expire: 0 \}\);/);
  const paymentPaths = actionSource.slice(actionSource.indexOf("function revalidatePaymentMutationPaths"), actionSource.indexOf("async function paymentProof"));
  assert.match(paymentPaths, /revalidateInvoiceList\(\)/);
});

test("PO multi-produk: instansi, pola, dekorasi multi, dan item", () => {
  const base = {
    opportunityId: "cm123456789012",
    garmentType: "JERSEY",
    instansi: "SMA Negeri 1",
    pola: "Jersey tim",
    material: "Dry fit",
    deadline: "2026-09-30",
    designDeadline: "2026-09-20",
    depositRequired: false,
  };
  const item = (overrides = {}) => ({
    key: "item-1",
    name: "Jersey home",
    decorationMethods: ["SABLON_DTF"],
    sizes: [{ sizeId: "garment-size-m", sleeveLength: "PANJANG", quantity: 2 }],
    rosterMode: "none",
    roster: [],
    ...overrides,
  });
  // Dua produk satu warna dalam satu PO lolos; beda warna tetap beda PO (satu warna per form).
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...base, items: [item(), { ...item({ key: "item-2", name: "Jersey away" }) }] }).success, true);
  // Tiap produk boleh beda kategori (2 jenis produk berbeda dalam 1 PO).
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...base, items: [item(), { ...item({ key: "item-2", name: "Kemeja", productCategoryId: "cm123456789012" }) }] }).success, true);
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...base, items: [{ ...item(), productCategoryId: "x" }] }).success, false);
  // Tiap produk wajib ada isi matriks sendiri.
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...base, items: [{ ...item(), sizes: [{ sizeId: "garment-size-m", sleeveLength: "PANJANG", quantity: 0 }] }] }).success, false);
  // Kunci produk tidak boleh duplikat.
  assert.equal(purchaseOrderDraftSchema.safeParse({ ...base, items: [item(), item()] }).success, false);
});

test("kesepakatan PO memakai konfirmasi customer, bukan gate desain", async () => {
  const actionSource = await readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8");
  const detailPageSource = await readFile(new URL("../app/(app)/crm/peluang/[id]/page.tsx", import.meta.url), "utf8");
  const agreementSource = await readFile(new URL("../components/crm/purchase-order-agreement-action.tsx", import.meta.url), "utf8");
  assert.match(actionSource, /export async function markPurchaseOrderDesignSentAction/);
  assert.match(actionSource, /export async function confirmPurchaseOrderCustomerAction/);
  assert.match(actionSource, /PURCHASE_ORDER_DESIGN_SENT/);
  assert.match(actionSource, /PURCHASE_ORDER_CUSTOMER_CONFIRMED/);
  assert.match(actionSource, /if \(!purchaseOrder\.customerConfirmedAt\) throw new UserFacingError/);
  assert.doesNotMatch(actionSource, /Desain harus diunggah dan disetujui Owner atau Admin sebelum PO disepakati/);
  assert.match(detailPageSource, /poDraft\??\.customerConfirmedAt/);
  assert.match(agreementSource, /Kirim 1 set PDF/);
  assert.match(agreementSource, /Konfirmasi customer/);
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
  // Size chart menahan ruang di halaman gambar desainnya.
  assert.match(pdfSource, /drawAssets\(embeddedAssets\.filter\(\(asset\) => asset\.itemId === item\.id\), item\.name, measureModelTable\(rows\)\)/);
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
  const dealFormSource = await readFile(new URL("../components/crm/deal-payment-form.tsx", import.meta.url), "utf8");
  const agreementSource = await readFile(new URL("../components/crm/purchase-order-agreement-action.tsx", import.meta.url), "utf8");
  // Deposit dihapus dari dropdown jenis pembayaran Deal; jadwal deposit lama tetap valid di server.
  assert.doesNotMatch(dealFormSource, /value="DEPOSIT"/);
  assert.doesNotMatch(dealFormSource, /Nominal deposit/);
  assert.doesNotMatch(dealFormSource, /isDeposit/);
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
  assert.match(agreementSource, /designSentAt && !customerConfirmedAt/);
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
  const dealFormSource = await readFile(new URL("../components/crm/deal-payment-form.tsx", import.meta.url), "utf8");
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
  assert.match(actionSource, /const collectibleTotal = roundedTotal\.sub\(depositAmount\)/);
  assert.match(actionSource, /const initialAmount = invoice\.pendingPayment\.initialAmount\.add\(depositAmount\)/);
  assert.match(actionSource, /Jadwal pembayaran tidak sama dengan sisa setelah deposit/);
  assert.match(dealFormSource, /const collectibleAmount = Math\.max\(0, totalAmount - depositTotal\)/);

  // Nominal deposit wajib lebih dari nol.
  const depositInput = { purchaseOrderId: "cm123456789012", paymentMethodId: "cm123456789013", paidAt: "2026-10-11T09:00", amount: "50000" };
  assert.equal(purchaseOrderDepositSchema.safeParse(depositInput).success, true);
  assert.equal(purchaseOrderDepositSchema.safeParse({ ...depositInput, amount: "0" }).success, false);
});
