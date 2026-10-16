"use server";

import { Prisma, type CommunicationSystemEvent } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { z } from "zod";

import { flashKindForError, flashMessagePath, messageForError, UserFacingError, runFormAction, runRedirectingAction, type FormActionState } from "@/lib/actions/response";
import { ARCHIVE_ROLES, CRM_OPERATOR_ROLES, CUSTOMER_REMINDER_SETTING_ROLES, DEAL_ROLES, GATE_OVERRIDE_ROLES, MASTER_DATA_ROLES, OWNER_ACTION_ROLES, REVERSE_DEAL_ROLES, hasRole } from "@/lib/auth/permissions";
import { requireActor, requireDeveloperActor, type Actor } from "@/lib/auth/session";
import { OPEN_STAGES, STAGE_LABEL, type OpportunityDetailTab } from "@/lib/crm/constants";
import { findImportCustomer, importCustomerLookupKeys, indexCustomers, normalizeImportText, upsertImportCustomerIndex } from "@/lib/crm/customer-import";
import { parseCustomerWorkbook } from "@/lib/crm/customer-excel";
import { calculateInvoiceLines, defaultInvoiceItemDescription, roundInvoiceTotal, type InvoicePricingInput } from "@/lib/crm/invoice-calculation";
import { formatPurchaseOrderRevisionNo, nextCustomerNo, nextOpportunityNo, nextInvoiceNo, nextPurchaseOrderNo, nextSalesOrderNo } from "@/lib/crm/numbers";
import { parseRosterFile, type ImportedRosterRow } from "@/lib/crm/roster-import";
import {
  rearmCustomerRemindersAfterLost,
  restoreCustomerRemindersAfterCancellation,
  scheduleCustomerReminders,
} from "@/lib/crm/reminders";
import {
  completeDealSchema,
  editPaymentTransactionSchema,
  addCommunicationActivitySchema,
  archiveCustomerSchema,
  cancelInvoiceSchema,
  cancelPurchaseOrderSchema,
  createCustomerSchema,
  createProspectCustomerSchema,
  createOpportunitySchema,
  entityIdSchema,
  firstValidationMessage,
  moveOpportunitySchema,
  invoiceDraftSchema,
  invoiceIdSchema,
  purchaseOrderDraftSchema,
  purchaseOrderIdSchema,
  payInvoicePaymentTermSchema,
  payPaymentTermSchema,
  purchaseOrderDepositSchema,
  payPendingInitialPaymentSchema,
  recordInitialPaymentSchema,
  recordFollowUpResultSchema,
  reverseSalesOrderSchema,
  updateCustomerSchema,
  updateOpportunitySchema,
  validateOpenOpportunitySchedule,
  voidPaymentTransactionSchema,
} from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { proofRequired, uploadPaymentProof } from "@/lib/payment-proof";
import { ensureProductionWorkOrder } from "@/lib/production/service";
import { enqueueIssuedInvoiceWhatsAppJob, enqueueManualWhatsAppMessage } from "@/lib/whatsapp/jobs";
import { DEFAULT_ORDER_REMINDER_TEMPLATE, renderWhatsAppTemplate } from "@/lib/whatsapp/core";

type Tx = Prisma.TransactionClient;
type CrmActionState = { error: string | null; success: boolean };

const DOCUMENT_DRAFT_TRANSACTION_OPTIONS = {
  maxWait: 20_000,
  timeout: 60_000,
} as const;
const CUSTOMER_IMPORT_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 20_000,
  timeout: 30_000,
} as const;
const DEAL_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  // 6 query berurutan × ±450ms RTT + akuisisi antrean pool saat burst.
  maxWait: 15_000,
  timeout: 30_000,
} as const;

function shouldLogDocumentTiming() {
  return process.env.CRM_DOCUMENT_TIMING === "1" || process.env.NODE_ENV !== "production";
}

function documentTimer(action: string) {
  const startedAt = performance.now();
  let lastMark = startedAt;

  return {
    mark(step: string) {
      if (!shouldLogDocumentTiming()) return;
      const now = performance.now();
      console.info(`[crm:${action}] ${step} ${Math.round(now - lastMark)}ms total=${Math.round(now - startedAt)}ms`);
      lastMark = now;
    },
  };
}

function revalidateCustomerReminders() {
  revalidatePath("/", "layout");
  updateTag("badge-counts");
}

function formValue(formData: FormData, key: string) {
  return formData.get(key);
}

function opportunityTabFallback(formData: FormData, tab: OpportunityDetailTab) {
  const opportunityId = entityIdSchema.safeParse(formValue(formData, "opportunityId"));
  return opportunityId.success ? `/crm/peluang/${opportunityId.data}?tab=${tab}` : "/crm";
}

function opportunityRedirectPath(formData: FormData) {
  const fallback = opportunityTabFallback(formData, "po");
  const opportunityId = entityIdSchema.safeParse(formValue(formData, "opportunityId"));
  const rawRedirectTo = formValue(formData, "redirectTo");
  if (!opportunityId.success || typeof rawRedirectTo !== "string") return fallback;

  try {
    const url = new URL(rawRedirectTo, "http://askonveksi.local");
    if (url.origin === "http://askonveksi.local" && url.pathname === `/crm/peluang/${opportunityId.data}`) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function optionalDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new UserFacingError("Tanggal tidak valid.");
  return date;
}

function jakartaDateTime(value?: string) {
  if (!value) return null;
  const zoned = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}:00+07:00`;
  const date = new Date(zoned);
  if (Number.isNaN(date.getTime())) throw new UserFacingError("Tanggal dan waktu tidak valid.");
  return date;
}

function addJakartaDays(date: Date, days: number) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day") + days));
}


async function audit(
  tx: Tx,
  actor: Actor,
  entityType: string,
  entityId: string,
  action: string,
  changedFields: string[],
  metadata?: Prisma.InputJsonValue,
) {
  return tx.auditEvent.create({
    data: { actorId: actor.id, entityType, entityId, action, changedFields, metadata },
    select: { id: true },
  });
}

async function addSystemActivity(
  tx: Tx,
  actor: Actor,
  data: {
    customerId: string;
    opportunityId: string;
    systemEvent: CommunicationSystemEvent;
    content: string;
    occurredAt?: Date;
    metadata?: Prisma.InputJsonValue;
    sourceAuditEventId: string;
  },
) {
  await tx.communicationActivity.create({
    data: {
      customerId: data.customerId,
      opportunityId: data.opportunityId,
      authorId: actor.id,
      kind: "SYSTEM",
      systemEvent: data.systemEvent,
      content: data.content,
      occurredAt: data.occurredAt ?? new Date(),
      metadata: data.metadata,
      sourceAuditEventId: data.sourceAuditEventId,
    },
  });
}

function customerFields(formData: FormData) {
  return {
    name: formValue(formData, "name"),
    companyName: formValue(formData, "companyName"),
    whatsapp: formValue(formData, "whatsapp"),
    email: formValue(formData, "email"),
    instagram: formValue(formData, "instagram"),
    address: formValue(formData, "address"),
    city: formValue(formData, "city"),
    notes: formValue(formData, "notes"),
    customerTypeId: formValue(formData, "customerTypeId"),
    leadSourceId: formValue(formData, "leadSourceId"),
    salesPicId: formValue(formData, "salesPicId"),
  };
}

function customerExcelFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new UserFacingError("Pilih file Excel customer terlebih dahulu.");
  return file;
}

function uniqueNameMap<T extends { name: string }>(items: T[], label: string) {
  const byName = new Map<string, T[]>();
  for (const item of items) {
    const key = normalizeImportText(item.name);
    if (!key) continue;
    byName.set(key, [...(byName.get(key) ?? []), item]);
  }
  for (const [name, matches] of byName) {
    if (matches.length > 1) throw new UserFacingError(`${label} "${name}" memiliki data duplikat. Rapikan data master sebelum import.`);
  }
  return new Map(Array.from(byName.entries()).map(([key, matches]) => [key, matches[0]]));
}

function invoiceInput(formData: FormData) {
  const purchaseOrderSizeIds = formData.getAll("itemPurchaseOrderSizeId");
  const productNames = formData.getAll("itemProductName");
  const sizes = formData.getAll("itemSize");
  const sleeveLengths = formData.getAll("itemSleeveLength");
  const descriptions = formData.getAll("itemDescription");
  const quantities = formData.getAll("itemQuantity");
  const unitPrices = formData.getAll("itemUnitPrice");
  const itemDiscounts = formData.getAll("itemDiscountPercent");
  const length = Math.max(purchaseOrderSizeIds.length, sizes.length, unitPrices.length);
  const fallbackDiscount = formValue(formData, "discountPercent") || "0";
  const items = Array.from({ length }, (_, index) => {
    const addonLabels = formData.getAll(`item-${index}-addon-label`);
    const addonAmounts = formData.getAll(`item-${index}-addon-amount`);
    const addons = Array.from({ length: Math.max(addonLabels.length, addonAmounts.length) }, (_, addonIndex) => ({
      label: addonLabels[addonIndex],
      unitAmount: addonAmounts[addonIndex],
    }));
    return {
      purchaseOrderSizeId: purchaseOrderSizeIds[index],
      productName: productNames[index],
      size: sizes[index],
      sleeveLength: sleeveLengths[index],
      description: descriptions[index],
      quantity: quantities[index],
      unitPrice: unitPrices[index],
      discountPercent: itemDiscounts[index] || fallbackDiscount,
      addons,
    };
  });

  return {
    opportunityId: formValue(formData, "opportunityId"),
    purchaseOrderId: formValue(formData, "purchaseOrderId"),
    invoiceId: formValue(formData, "invoiceId") || undefined,
    version: formValue(formData, "version") || undefined,
    dueAt: formValue(formData, "dueAt"),
    discountPercent: fallbackDiscount,
    taxPercent: formValue(formData, "taxPercent") || "0",
    notes: formValue(formData, "notes"),
    items,
  };
}

function purchaseOrderInput(formData: FormData) {
  const itemKeys = formData.getAll("itemKey").map((value) => String(value));
  const items = itemKeys.map((key, position) => {
    const prefix = `item-${position}-`;
    const sizeIds = formData.getAll(`${prefix}sizeId`);
    const sleeveLengths = formData.getAll(`${prefix}sleeveLength`);
    const quantities = formData.getAll(`${prefix}sizeQuantity`);
    const rosterMemberIds = formData.getAll(`${prefix}rosterMemberId`);
    const rosterNames = formData.getAll(`${prefix}rosterName`);
    const rosterSizeIds = formData.getAll(`${prefix}rosterSizeId`);
    const rosterSleeveLengths = formData.getAll(`${prefix}rosterSleeveLength`);
    return {
      key,
      name: formValue(formData, `${prefix}name`),
      productCategoryId: formValue(formData, `${prefix}productCategoryId`) || undefined,
      decorationMethods: formData.getAll(`${prefix}decorationMethod`).map((value) => String(value)),
      designNotes: formValue(formData, `${prefix}designNotes`),
      rosterMode: formValue(formData, `${prefix}rosterMode`),
      sizes: Array.from({ length: Math.max(sizeIds.length, quantities.length) }, (_, index) => ({
        sizeId: sizeIds[index],
        sleeveLength: sleeveLengths[index],
        quantity: quantities[index],
      })),
      roster: Array.from({ length: Math.max(rosterMemberIds.length, rosterNames.length, rosterSizeIds.length, rosterSleeveLengths.length) }, (_, index) => ({
        memberId: rosterMemberIds[index],
        name: rosterNames[index],
        sizeId: rosterSizeIds[index],
        sleeveLength: rosterSleeveLengths[index],
      })).filter((item) => item.memberId || item.name || item.sizeId || item.sleeveLength),
    };
  });
  return {
    opportunityId: formValue(formData, "opportunityId"),
    purchaseOrderId: formValue(formData, "purchaseOrderId") || undefined,
    version: formValue(formData, "version") || undefined,
    garmentType: formValue(formData, "garmentType"),
    productCategoryId: formValue(formData, "productCategoryId") || undefined,
    instansi: formValue(formData, "instansi"),
    pola: formValue(formData, "pola"),
    material: formValue(formData, "material"),
    baseColor: formValue(formData, "baseColor"),
    variationColor: formValue(formData, "variationColor"),
    orderDate: formValue(formData, "orderDate"),
    sampleSize: formValue(formData, "sampleSize"),
    designNotes: formValue(formData, "designNotes"),
    notes: formValue(formData, "notes"),
    deadline: formValue(formData, "deadline"),
    designDeadline: formValue(formData, "designDeadline"),
    // Checkbox Deposit pada form PO (dapat diisi sebelum draft terbuat).
    depositRequired: formData.get("depositRequired") === "on",
    items,
  };
}

async function resolveProductCategory(reader: Tx, productCategoryId: string | undefined, fallbackGarmentType: "JERSEY" | "NON_JERSEY" | "AKSESORI") {
  if (!productCategoryId) return { productCategoryId: null, garmentType: fallbackGarmentType };
  const category = await reader.productCategory.findUnique({ where: { id: productCategoryId }, select: { garmentType: true, isActive: true } });
  if (!category) throw new UserFacingError("Kategori produk tidak ditemukan. Pilih kategori lain.");
  if (!category.isActive) throw new UserFacingError("Kategori produk sudah tidak aktif. Pilih kategori lain.");
  return { productCategoryId, garmentType: category.garmentType };
}

// Peluang memilih nama kategori (PDH/PDL, Kaos, Polo, ...); jenis Jersey/Non-jersey ikut mengikuti kategori terpilih.
async function resolveOpportunityCategory(reader: Tx, productCategoryId: string | undefined) {
  if (!productCategoryId) return null;
  const category = await reader.productCategory.findUnique({ where: { id: productCategoryId }, select: { id: true, garmentType: true, isActive: true } });
  if (!category) throw new UserFacingError("Kategori produk tidak ditemukan. Pilih kategori lain.");
  if (!category.isActive) throw new UserFacingError("Kategori produk sudah tidak aktif. Pilih kategori lain.");
  return category;
}

async function importedPurchaseOrderRoster(formData: FormData, fieldName: string, mode: "none" | "manual" | "excel") {
  const file = formData.get(fieldName);
  if (mode !== "excel") {
    if (file instanceof File && file.size) throw new UserFacingError("File roster hanya boleh diunggah pada mode Impor Excel.");
    return [];
  }
  if (!(file instanceof File) || !file.size) throw new UserFacingError("Pilih file Excel roster.");
  const rows = await parseRosterFile(file);
  if (!rows.length) throw new UserFacingError("File Excel roster belum berisi pemakai.");
  return rows;
}

type ParsedPoItem = {
  key: string;
  name: string;
  productCategoryId?: string;
  decorationMethods: string[];
  designNotes?: string | null;
  sizes: Array<{ sizeId: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>;
  rosterMode: "none" | "manual" | "excel";
  roster: Array<{ memberId: string; name: string; sizeId: string; sleeveLength: "PENDEK" | "PANJANG" }>;
};

function legacyDecorationMethod(methods: string[]) {
  if (methods.length === 1 && methods[0] === "NONE") return "NONE";
  return methods.find((method) => method === "TINTA" || method === "BORDIR") ?? methods[0] ?? "NONE";
}

function completeDealInput(formData: FormData) {
  const valueTypes = formData.getAll("termValueType");
  const values = formData.getAll("termValue");
  const dueDates = formData.getAll("termDueAt");
  return {
    opportunityId: formValue(formData, "opportunityId"),
    opportunityVersion: formValue(formData, "opportunityVersion"),
    purchaseOrderId: formValue(formData, "purchaseOrderId"),
    invoiceId: formValue(formData, "invoiceId"),
    invoiceVersion: formValue(formData, "invoiceVersion"),
    kind: formValue(formData, "kind"),
    initialValueType: formValue(formData, "initialValueType"),
    initialValue: formValue(formData, "initialValue"),
    terms: Array.from({ length: Math.max(valueTypes.length, values.length, dueDates.length) }, (_, index) => ({
      valueType: valueTypes[index],
      value: values[index],
      dueAt: dueDates[index],
    })),
  };
}

async function runDealTransaction<T>(work: (tx: Tx) => Promise<T>) {
  const prisma = getPrismaClient();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(work, DEAL_TRANSACTION_OPTIONS);
    } catch (error) {
      const canRetry = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!canRetry || attempt === 1) throw error;
    }
  }

  throw new UserFacingError("Transaksi Deal belum dapat diselesaikan. Silakan coba lagi.");
}

function opportunityInput(formData: FormData) {
  return {
    title: formValue(formData, "title"),
    productCategoryId: formValue(formData, "productCategoryId") || undefined,
    leadSourceId: formData.has("opportunityLeadSourceId")
      ? formValue(formData, "opportunityLeadSourceId")
      : formValue(formData, "leadSourceId"),
    salesPicId: formData.has("opportunitySalesPicId")
      ? formValue(formData, "opportunitySalesPicId")
      : formValue(formData, "salesPicId"),
    productName: formValue(formData, "productName"),
    garmentType: formValue(formData, "garmentType"),
    needPurpose: formValue(formData, "needPurpose"),
    specification: formValue(formData, "specification"),
    nextAction: formValue(formData, "nextAction"),
    nextActionAt: formValue(formData, "nextActionAt"),
  };
}

type PurchaseOrderRowReader = {
  garmentSize: Tx["garmentSize"];
};

async function preparePurchaseOrderRows(
  db: PurchaseOrderRowReader,
  items: Array<ParsedPoItem & { itemId: string; fileRoster: ImportedRosterRow[] }>,
) {
  const requestedIds = new Set<string>();
  const importedNames = new Set<string>();
  for (const item of items) {
    item.sizes.forEach((size) => requestedIds.add(size.sizeId));
    item.roster.forEach((row) => requestedIds.add(row.sizeId));
    item.fileRoster.forEach((row) => importedNames.add(row.size));
  }
  const sizeMasters = await db.garmentSize.findMany({
    where: {
      isActive: true,
      OR: [
        ...(requestedIds.size ? [{ id: { in: [...requestedIds] } }] : []),
        ...(importedNames.size ? [{ name: { in: [...importedNames], mode: "insensitive" as const } }] : []),
      ],
    },
    select: { id: true, name: true },
  });
  const byId = new Map(sizeMasters.map((item) => [item.id, item]));
  const byName = new Map(sizeMasters.map((item) => [item.name.toLocaleLowerCase("id-ID"), item]));

  const sizes: Array<{ itemId: string; sizeId: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number; size: string; position: number }> = [];
  const roster: Array<{ itemId: string; memberId: string; name: string; sizeId: string; size: string; sleeveLength: "PENDEK" | "PANJANG"; position: number }> = [];
  for (const item of items) {
    const itemSizes = item.sizes.filter((size) => size.quantity > 0).map((size) => {
      const master = byId.get(size.sizeId);
      if (!master) throw new UserFacingError(`Salah satu ukuran matriks ${item.name} tidak aktif atau tidak ditemukan.`);
      const row = { itemId: item.itemId, sizeId: size.sizeId, sleeveLength: size.sleeveLength, quantity: size.quantity, size: master.name, position: sizes.length };
      sizes.push(row);
      return row;
    });
    const manualRoster = item.roster.map((row) => {
      const master = byId.get(row.sizeId);
      if (!master) throw new UserFacingError(`Salah satu ukuran roster ${item.name} tidak aktif atau tidak ditemukan.`);
      return { itemId: item.itemId, memberId: row.memberId, name: row.name, sizeId: row.sizeId, size: master.name, sleeveLength: row.sleeveLength };
    });
    const fileRoster = item.fileRoster.map((row, index) => {
      const master = byName.get(row.size.toLocaleLowerCase("id-ID"));
      if (!master) throw new UserFacingError(`Ukuran ${row.size} pada baris roster ${index + 2} (${item.name}) belum tersedia di Data Master.`);
      return { itemId: item.itemId, memberId: row.memberId, name: row.name, sizeId: master.id, size: master.name, sleeveLength: row.sleeveLength };
    });
    const itemRoster = item.rosterMode === "excel" ? fileRoster : item.rosterMode === "manual" ? manualRoster : [];
    const normalizedIds = itemRoster.map((row) => row.memberId.toLocaleLowerCase("id-ID"));
    if (new Set(normalizedIds).size !== normalizedIds.length) throw new UserFacingError(`ID anggota roster ${item.name} tidak boleh duplikat.`);

    if (itemRoster.length) {
      const matrixTotals = new Map<string, number>();
      for (const size of itemSizes) {
        const key = `${size.sizeId}:${size.sleeveLength}`;
        matrixTotals.set(key, (matrixTotals.get(key) ?? 0) + size.quantity);
      }
      const rosterTotals = new Map<string, number>();
      for (const row of itemRoster) {
        const key = `${row.sizeId}:${row.sleeveLength}`;
        rosterTotals.set(key, (rosterTotals.get(key) ?? 0) + 1);
      }
      const allKeys = new Set([...matrixTotals.keys(), ...rosterTotals.keys()]);
      for (const key of allKeys) {
        if ((matrixTotals.get(key) ?? 0) !== (rosterTotals.get(key) ?? 0)) {
          const [sizeId, sleeveLength] = key.split(":");
          const sizeName = byId.get(sizeId)?.name ?? "tidak dikenal";
          throw new UserFacingError(`Total roster ${item.name} ukuran ${sizeName} lengan ${sleeveLength.toLocaleLowerCase("id-ID")} harus sama dengan jumlah pada matriks.`);
        }
      }
    }
    itemRoster.forEach((row) => roster.push({ ...row, position: roster.length }));
  }

  return { sizes, roster };
}

async function preparePoItems(formData: FormData, items: ParsedPoItem[]) {
  return Promise.all(items.map(async (item, index) => ({
    ...item,
    itemId: randomUUID(),
    fileRoster: await importedPurchaseOrderRoster(formData, `item-${index}-rosterFile`, item.rosterMode),
  })));
}

function calculateInvoiceForPurchaseOrder(
  purchaseOrder: {
    productName: string;
    garmentType?: "JERSEY" | "NON_JERSEY" | "AKSESORI" | null;
    items?: Array<{ id: string; name: string; garmentType?: "JERSEY" | "NON_JERSEY" | "AKSESORI" | null }>;
    sizes: Array<{ id: string; itemId: string; sizeId: string | null; size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>;
  },
  submittedItems: InvoicePricingInput[],
  discountPercent: string,
  taxPercent = "0",
) {
  const submittedById = new Map(submittedItems.map((item) => [String(item.purchaseOrderSizeId), item]));
  if (submittedById.size !== purchaseOrder.sizes.length || submittedItems.length !== purchaseOrder.sizes.length) {
    throw new UserFacingError("Item invoice harus sama dengan seluruh baris matriks PO.");
  }
  const itemNameById = new Map((purchaseOrder.items ?? []).map((item) => [item.id, item.name]));
  const itemGarmentById = new Map((purchaseOrder.items ?? []).map((item) => [item.id, item.garmentType ?? purchaseOrder.garmentType]));
  const calculated = calculateInvoiceLines(purchaseOrder.sizes.map((poRow) => {
    const submitted = submittedById.get(poRow.id);
    if (!submitted) throw new UserFacingError("Salah satu baris PO tidak tersedia pada invoice.");
    const rowDefault = itemNameById.get(poRow.itemId) ?? purchaseOrder.productName;
    const productName = String(submitted.productName || rowDefault).trim() || rowDefault;
    const rowIsAccessory = (itemGarmentById.get(poRow.itemId) ?? purchaseOrder.garmentType) === "AKSESORI";
    const description = String(submitted.description || "").trim() || defaultInvoiceItemDescription(productName, poRow.sleeveLength, poRow.size, rowIsAccessory);
    return {
      purchaseOrderSizeId: poRow.id,
      productName,
      size: poRow.size,
      sleeveLength: poRow.sleeveLength,
      description,
      quantity: poRow.quantity,
      unitPrice: String(submitted.unitPrice),
      discountPercent: String((submitted as { discountPercent?: string }).discountPercent ?? discountPercent ?? "0"),
      addons: ((submitted as { addons?: Array<{ label: unknown; unitAmount: unknown }> }).addons ?? []).map((addon) => ({
        label: String(addon.label ?? ""),
        unitAmount: String(addon.unitAmount ?? ""),
      })),
    };
  }), discountPercent, taxPercent);
  return {
    ...calculated,
    items: calculated.items.map(({ purchaseOrderSizeId, addons, addonGross, ...item }) => ({
      ...item,
      sizeId: purchaseOrder.sizes.find((row) => row.id === purchaseOrderSizeId)?.sizeId ?? null,
      addons: { create: addons.map((addon) => ({ position: addon.position, label: addon.label, unitAmount: addon.unitAmount })) },
    })),
  };
}

export async function createCustomerAction(formData: FormData) {
  return runRedirectingAction("/customers", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = createCustomerSchema.safeParse(customerFields(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    await getPrismaClient().$transaction(
      async (tx) => {
        const rawLeadSourceCustom = formValue(formData, "leadSourceCustom");
        const leadSourceCustom = typeof rawLeadSourceCustom === "string" ? rawLeadSourceCustom.trim() : "";
        let resolvedLeadSourceId = parsed.data.leadSourceId;

        if (resolvedLeadSourceId === "custom_other" || (resolvedLeadSourceId && leadSourceCustom)) {
          if (leadSourceCustom) {
            const trimmedCustom = leadSourceCustom.slice(0, 80);
            let customSource = await tx.leadSource.findFirst({
              where: { name: { equals: trimmedCustom, mode: "insensitive" } },
              select: { id: true },
            });
            if (!customSource) {
              customSource = await tx.leadSource.create({
                data: {
                  name: trimmedCustom,
                  description: "Sumber lead kustom dari form Customer",
                  position: 99,
                  isActive: true,
                },
                select: { id: true },
              });
            }
            resolvedLeadSourceId = customSource.id;
          } else if (resolvedLeadSourceId === "custom_other") {
            let otherSource = await tx.leadSource.findFirst({
              where: { name: { equals: "Lainnya", mode: "insensitive" } },
              select: { id: true },
            });
            if (!otherSource) {
              otherSource = await tx.leadSource.create({
                data: { name: "Lainnya", description: "Sumber lead lainnya", position: 99, isActive: true },
                select: { id: true },
              });
            }
            resolvedLeadSourceId = otherSource.id;
          }
        }

        const [customerType, leadSource, salesPic] = await Promise.all([
          tx.customerType.findUnique({ where: { id: parsed.data.customerTypeId }, select: { id: true } }),
          resolvedLeadSourceId ? tx.leadSource.findUnique({ where: { id: resolvedLeadSourceId }, select: { id: true } }) : null,
          parsed.data.salesPicId ? tx.appUser.findFirst({ where: { id: parsed.data.salesPicId, role: "ADMIN_CUSTOMER", isActive: true }, select: { id: true } }) : null,
        ]);
        if (!customerType) throw new UserFacingError("Jenis customer tidak ditemukan.");
        if (resolvedLeadSourceId && !leadSource) throw new UserFacingError("Sumber lead tidak ditemukan.");
        if (parsed.data.salesPicId && !salesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");
        const created = await tx.customer.create({
          data: {
            ...parsed.data,
            leadSourceId: resolvedLeadSourceId,
            email: parsed.data.email?.toLowerCase(),
            customerNo: await nextCustomerNo(tx),
          },
          select: { id: true },
        });
        await audit(tx, actor, "Customer", created.id, "CUSTOMER_CREATED", [
          "name", "companyName", "whatsapp", "email", "instagram", "address", "city", "notes", "customerTypeId", "leadSourceId", "salesPicId",
        ]);
        return created;
      },
      CUSTOMER_IMPORT_TRANSACTION_OPTIONS,
    );

    revalidatePath("/crm");
    revalidatePath("/customers");
    return flashMessagePath("/customers", "notice", "Customer berhasil dibuat.");
  });
}

export async function importCustomersAction(formData: FormData) {
  return runRedirectingAction("/customers", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const rows = await parseCustomerWorkbook(customerExcelFile(formData));
    const lookupKeys = importCustomerLookupKeys(rows);
    const customerLookupWhere: Prisma.CustomerWhereInput[] = [];
    if (lookupKeys.customerNos.length) customerLookupWhere.push({ customerNo: { in: lookupKeys.customerNos } });
    if (lookupKeys.names.length) customerLookupWhere.push({ name: { in: lookupKeys.names, mode: Prisma.QueryMode.insensitive } });
    if (lookupKeys.whatsapps.length) customerLookupWhere.push({ whatsapp: { in: lookupKeys.whatsapps } });
    if (lookupKeys.emails.length) customerLookupWhere.push({ email: { in: lookupKeys.emails, mode: Prisma.QueryMode.insensitive } });
    if (lookupKeys.instagrams.length) customerLookupWhere.push({ instagram: { in: lookupKeys.instagrams, mode: Prisma.QueryMode.insensitive } });

    const result = await getPrismaClient().$transaction(
      async (tx) => {
        const [customerTypes, leadSources, salesUsers, currentCustomers] = await Promise.all([
          tx.customerType.findMany({ select: { id: true, name: true } }),
          tx.leadSource.findMany({ select: { id: true, name: true } }),
          tx.appUser.findMany({ where: { role: "ADMIN_CUSTOMER", isActive: true }, select: { id: true, name: true } }),
          tx.customer.findMany({
            where: {
              OR: customerLookupWhere,
            },
            select: {
              id: true,
              customerNo: true,
              name: true,
              companyName: true,
              whatsapp: true,
              email: true,
              instagram: true,
              address: true,
              city: true,
              notes: true,
              customerTypeId: true,
              leadSourceId: true,
              salesPicId: true,
            },
            orderBy: { id: "asc" },
          }),
        ]);
        const customerTypeByName = uniqueNameMap(customerTypes, "Jenis customer");
        const leadSourceByName = uniqueNameMap(leadSources, "Sumber lead");
        const salesUserByName = uniqueNameMap(salesUsers, "Sales/PIC");
        const customerIndexes = indexCustomers(currentCustomers);
        const createdCustomerIds = new Set<string>();
        const updatedCustomerIds = new Set<string>();
        let createdCount = 0;

        for (const row of rows) {
          const customerType = customerTypeByName.get(normalizeImportText(row.customerTypeName) ?? "");
          if (!customerType) throw new UserFacingError(`Jenis customer pada baris ${row.rowNumber} tidak ditemukan.`);
          const leadSource = row.leadSourceName ? leadSourceByName.get(normalizeImportText(row.leadSourceName) ?? "") : null;
          if (row.leadSourceName && !leadSource) throw new UserFacingError(`Sumber lead pada baris ${row.rowNumber} tidak ditemukan.`);
          const salesPic = row.salesPicName ? salesUserByName.get(normalizeImportText(row.salesPicName) ?? "") : null;
          if (row.salesPicName && !salesPic) throw new UserFacingError(`Sales/PIC pada baris ${row.rowNumber} tidak ditemukan atau tidak aktif.`);

          const parsed = createCustomerSchema.safeParse({
            name: row.name,
            companyName: row.companyName,
            whatsapp: row.whatsapp,
            email: row.email,
            instagram: row.instagram,
            address: row.address,
            city: row.city,
            notes: row.notes,
            customerTypeId: customerType.id,
            leadSourceId: leadSource?.id ?? "",
            salesPicId: salesPic?.id ?? "",
          });
          if (!parsed.success) throw new UserFacingError(`Baris ${row.rowNumber}: ${firstValidationMessage(parsed.error)}`);

          const data = {
            name: parsed.data.name,
            companyName: parsed.data.companyName ?? null,
            whatsapp: parsed.data.whatsapp ?? null,
            email: parsed.data.email?.toLowerCase() ?? null,
            instagram: parsed.data.instagram ?? null,
            address: parsed.data.address ?? null,
            city: parsed.data.city ?? null,
            notes: parsed.data.notes ?? null,
            customerTypeId: parsed.data.customerTypeId,
            leadSourceId: parsed.data.leadSourceId ?? null,
            salesPicId: parsed.data.salesPicId ?? null,
          };
          const current = findImportCustomer(row, customerIndexes);

          if (!current) {
            const customerNo = await nextCustomerNo(tx);
            const created = await tx.customer.create({
              data: { ...data, customerNo },
              select: { id: true },
            });
            upsertImportCustomerIndex(customerIndexes, null, { id: created.id, customerNo, ...data });
            createdCustomerIds.add(created.id);
            await audit(tx, actor, "Customer", created.id, "CUSTOMER_CREATED", [
              "name", "companyName", "whatsapp", "email", "instagram", "address", "city", "notes", "customerTypeId", "leadSourceId", "salesPicId",
            ], { source: "xlsx-import", rowNumber: row.rowNumber });
            createdCount += 1;
            continue;
          }

          const changedFields = [
            current.name !== data.name ? "name" : null,
            current.companyName !== data.companyName ? "companyName" : null,
            current.whatsapp !== data.whatsapp ? "whatsapp" : null,
            current.email !== data.email ? "email" : null,
            current.instagram !== data.instagram ? "instagram" : null,
            current.address !== data.address ? "address" : null,
            current.city !== data.city ? "city" : null,
            current.notes !== data.notes ? "notes" : null,
            current.customerTypeId !== data.customerTypeId ? "customerTypeId" : null,
            current.leadSourceId !== data.leadSourceId ? "leadSourceId" : null,
            current.salesPicId !== data.salesPicId ? "salesPicId" : null,
          ].filter((field): field is string => field !== null);

          const nextCustomer = { id: current.id, customerNo: current.customerNo, ...data };
          upsertImportCustomerIndex(customerIndexes, current, nextCustomer);

          if (!changedFields.length) continue;

          await tx.customer.update({
            where: { id: current.id },
            data: { ...data, version: { increment: 1 } },
          });
          await audit(tx, actor, "Customer", current.id, "CUSTOMER_UPDATED", changedFields, {
            source: "xlsx-import",
            rowNumber: row.rowNumber,
          });
          if (!createdCustomerIds.has(current.id)) updatedCustomerIds.add(current.id);
        }

        return { createdCount, updatedCount: updatedCustomerIds.size };
      },
      CUSTOMER_IMPORT_TRANSACTION_OPTIONS,
    );

    revalidatePath("/crm");
    revalidatePath("/customers");
    revalidateCustomerReminders();
    return flashMessagePath(
      "/customers",
      "notice",
      `Import customer berhasil: ${result.createdCount.toLocaleString("id-ID")} baru, ${result.updatedCount.toLocaleString("id-ID")} diperbarui.`,
    );
  });
}

async function resetCustomerOrderReminderDelivery(tx: Tx, customerId: string, enabled: boolean) {
  const reminders = await tx.customerReminder.findMany({
    where: { customerId, type: "REACTIVATION", resolvedAt: null },
    select: { id: true },
  });
  if (reminders.length) {
    const reminderIds = reminders.map((reminder) => reminder.id);
    await tx.customerReminder.updateMany({ where: { id: { in: reminderIds } }, data: { generation: { increment: 1 } } });
    if (enabled) await tx.customerReminderReceipt.deleteMany({ where: { reminderId: { in: reminderIds } } });
  }
  if (!enabled) {
    const jobs = await tx.whatsAppAutomationJob.findMany({
      where: { customerId, type: "REACTIVATION", status: { in: ["QUEUED", "RETRY"] } },
      select: { id: true },
    });
    if (jobs.length) {
      const ids = jobs.map((job) => job.id);
      await tx.whatsAppAutomationJob.updateMany({ where: { id: { in: ids } }, data: { status: "CANCELLED", lastError: "Reminder order dinonaktifkan." } });
      await tx.whatsAppMessage.updateMany({ where: { automationJobId: { in: ids }, status: { in: ["QUEUED", "FAILED"] } }, data: { status: "CANCELLED", errorMessage: "Reminder order dinonaktifkan." } });
    }
  }
}

export async function updateCustomerAction(formData: FormData) {
  return runRedirectingAction("/customers", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = updateCustomerSchema.safeParse({
      ...customerFields(formData),
      customerId: formValue(formData, "customerId"),
      version: formValue(formData, "version"),
      orderReminderEnabled: formData.has("orderReminderEnabled") ? formValue(formData, "orderReminderEnabled") : undefined,
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const { customerId, version, orderReminderEnabled, ...fields } = parsed.data;
    const result = await getPrismaClient().$transaction(async (tx) => {
      const current = await tx.customer.findUnique({ where: { id: customerId }, select: { customerTypeId: true, leadSourceId: true, salesPicId: true, orderReminderEnabled: true } });
      if (!current) throw new UserFacingError("Customer tidak ditemukan.");
      const [customerType, leadSource, salesPic] = await Promise.all([
        tx.customerType.findUnique({ where: { id: fields.customerTypeId }, select: { id: true } }),
        fields.leadSourceId ? tx.leadSource.findUnique({ where: { id: fields.leadSourceId }, select: { id: true } }) : null,
        fields.salesPicId ? tx.appUser.findFirst({ where: { id: fields.salesPicId, OR: [{ role: "ADMIN_CUSTOMER", isActive: true }, { id: current.salesPicId ?? "" }] }, select: { id: true } }) : null,
      ]);
      if (!customerType) throw new UserFacingError("Jenis customer tidak ditemukan.");
      if (fields.leadSourceId && !leadSource) throw new UserFacingError("Sumber lead tidak ditemukan.");
      if (fields.salesPicId && !salesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");
      const updated = await tx.customer.updateMany({
        where: { id: customerId, version, archivedAt: null },
        data: { ...fields, email: fields.email?.toLowerCase(), ...(orderReminderEnabled === undefined ? {} : { orderReminderEnabled }), version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new UserFacingError("Customer sudah berubah atau telah diarsipkan. Muat ulang halaman.");
      if (orderReminderEnabled !== undefined && orderReminderEnabled !== current.orderReminderEnabled) {
        await resetCustomerOrderReminderDelivery(tx, customerId, orderReminderEnabled);
        await audit(tx, actor, "Customer", customerId, "ORDER_REMINDER_SETTING_UPDATED", ["orderReminderEnabled"]);
      }
      await audit(tx, actor, "Customer", customerId, "CUSTOMER_UPDATED", [
        "name", "companyName", "whatsapp", "email", "instagram", "address", "city", "notes", "customerTypeId", "leadSourceId", "salesPicId",
      ]);
      return updated;
    }, DEAL_TRANSACTION_OPTIONS);
    if (!result.count) throw new UserFacingError("Customer tidak dapat diperbarui.");

    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    revalidateCustomerReminders();
    return flashMessagePath("/customers", "notice", "Data customer diperbarui.");
  });
}

export async function updateCustomerOrderReminderAction(formData: FormData) {
  const customerId = String(formData.get("customerId") ?? "");
  return runRedirectingAction(`/customers/${encodeURIComponent(customerId)}`, async () => {
    const actor = await requireActor(CUSTOMER_REMINDER_SETTING_ROLES);
    const parsed = z.object({
      customerId: entityIdSchema,
      version: z.coerce.number().int().positive(),
      enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
    }).safeParse({ customerId, version: formData.get("version"), enabled: formData.get("enabled") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    await getPrismaClient().$transaction(async (tx) => {
      const updated = await tx.customer.updateMany({
        where: { id: parsed.data.customerId, version: parsed.data.version, archivedAt: null },
        data: { orderReminderEnabled: parsed.data.enabled, version: { increment: 1 } },
      });
      if (!updated.count) throw new UserFacingError("Pengaturan customer sudah berubah. Muat ulang halaman.");
      await resetCustomerOrderReminderDelivery(tx, parsed.data.customerId, parsed.data.enabled);
      await audit(tx, actor, "Customer", parsed.data.customerId, "ORDER_REMINDER_SETTING_UPDATED", ["orderReminderEnabled"]);
    }, DEAL_TRANSACTION_OPTIONS);
    revalidatePath(`/customers/${parsed.data.customerId}`);
    return flashMessagePath(`/customers/${parsed.data.customerId}`, "notice", `Reminder order ${parsed.data.enabled ? "diaktifkan" : "dinonaktifkan"}.`);
  });
}

export async function archiveCustomerAction(formData: FormData) {
  return runRedirectingAction("/customers", async () => {
    const actor = await requireActor(ARCHIVE_ROLES);
    const parsed = archiveCustomerSchema.safeParse({
      customerId: formValue(formData, "customerId"),
      version: formValue(formData, "version"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const prisma = getPrismaClient();
    await prisma.$transaction(
      async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: parsed.data.customerId },
          select: {
            archivedAt: true,
            opportunities: {
              where: {
                OR: [
                  { stage: { in: OPEN_STAGES } },
                  { salesOrders: { some: { status: "ACTIVE" } } },
                ],
              },
              select: { id: true },
              take: 1,
            },
          },
        });
        if (!customer || customer.archivedAt) throw new UserFacingError("Customer tidak ditemukan atau sudah diarsipkan.");
        if (customer.opportunities.length > 0) {
          throw new UserFacingError("Customer masih memiliki peluang terbuka atau Sales Order aktif.");
        }

        const updated = await tx.customer.updateMany({
          where: { id: parsed.data.customerId, version: parsed.data.version, archivedAt: null },
          data: { archivedAt: new Date(), version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new UserFacingError("Data customer sudah berubah. Muat ulang halaman.");
        await audit(tx, actor, "Customer", parsed.data.customerId, "CUSTOMER_ARCHIVED", ["archivedAt"]);
      },
      DEAL_TRANSACTION_OPTIONS,
    );

    revalidatePath("/crm");
    revalidatePath("/customers");
    revalidatePath(`/customers/${parsed.data.customerId}`);
    revalidateCustomerReminders();
    return flashMessagePath("/customers", "notice", "Customer diarsipkan.");
  });
}

export async function restoreCustomerAction(formData: FormData) {
  return runRedirectingAction("/customers?segment=archived", async () => {
    const actor = await requireActor(ARCHIVE_ROLES);
    const parsed = archiveCustomerSchema.safeParse({
      customerId: formValue(formData, "customerId"),
      version: formValue(formData, "version"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    await getPrismaClient().$transaction(async (tx) => {
      const updated = await tx.customer.updateMany({
        where: {
          id: parsed.data.customerId,
          version: parsed.data.version,
          archivedAt: { not: null },
        },
        data: { archivedAt: null, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new UserFacingError("Customer sudah aktif, tidak ditemukan, atau datanya telah berubah. Muat ulang halaman.");
      }
      await audit(tx, actor, "Customer", parsed.data.customerId, "CUSTOMER_RESTORED", ["archivedAt"]);
    }, DEAL_TRANSACTION_OPTIONS);

    revalidatePath("/crm");
    revalidatePath("/customers");
    revalidatePath(`/customers/${parsed.data.customerId}`);
    revalidateCustomerReminders();
    return flashMessagePath("/customers?segment=archived", "notice", "Customer diaktifkan kembali.");
  });
}

export async function createOpportunityAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = createOpportunitySchema.safeParse({
      customerId: formValue(formData, "customerId"),
      ...opportunityInput(formData),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const scheduleError = validateOpenOpportunitySchedule(parsed.data);
    if (scheduleError) throw new UserFacingError(scheduleError);

    const prisma = getPrismaClient();
    const opportunity = await prisma.$transaction(
      async (tx) => {
        const customer = await tx.customer.findFirst({
          where: { id: parsed.data.customerId, archivedAt: null },
          select: { id: true, leadSourceId: true, salesPicId: true },
        });
        if (!customer) throw new UserFacingError("Customer aktif tidak ditemukan.");

        const leadSourceId = parsed.data.leadSourceId ?? customer.leadSourceId;
        const salesPicId = parsed.data.salesPicId ?? customer.salesPicId;
        const [leadSource, salesPic] = await Promise.all([
          leadSourceId ? tx.leadSource.findFirst({ where: { id: leadSourceId, isActive: true }, select: { id: true } }) : null,
          salesPicId ? tx.appUser.findFirst({ where: { id: salesPicId, role: "ADMIN_CUSTOMER", isActive: true }, select: { id: true } }) : null,
        ]);
        if (leadSourceId && !leadSource) throw new UserFacingError("Sumber lead tidak aktif atau tidak ditemukan.");
        if (salesPicId && !salesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");
        const category = await resolveOpportunityCategory(tx, parsed.data.productCategoryId);

        const created = await tx.opportunity.create({
          data: {
            opportunityNo: await nextOpportunityNo(tx),
            customerId: customer.id,
            title: parsed.data.title,
            leadSourceId,
            salesPicId,
            productName: parsed.data.productName,
            productCategoryId: category?.id ?? null,
            garmentType: category?.garmentType ?? parsed.data.garmentType ?? null,
            needPurpose: parsed.data.needPurpose,
            specification: parsed.data.specification,
            nextAction: parsed.data.nextAction,
            nextActionAt: jakartaDateTime(parsed.data.nextActionAt),
          },
          select: { id: true },
        });
        await audit(tx, actor, "Opportunity", created.id, "OPPORTUNITY_CREATED", [
          "customerId", "title", "leadSourceId", "salesPicId", "productName", "garmentType", "productCategoryId", "needPurpose",
          "specification", "nextAction", "nextActionAt", "stage",
        ], { stage: "LEAD_BARU" });
        return created;
      },
      DEAL_TRANSACTION_OPTIONS,
    );

    revalidatePath("/crm");
    revalidatePath("/customers");
    revalidateCustomerReminders();
    return flashMessagePath(`/crm/peluang/${opportunity.id}`, "notice", "Prospek berhasil dibuat.");
  });
}

export async function createProspectAction(formData: FormData) {
  return runRedirectingAction("/crm/prospek", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const customerParsed = createProspectCustomerSchema.safeParse(customerFields(formData));
    if (!customerParsed.success) throw new UserFacingError(firstValidationMessage(customerParsed.error));

    await getPrismaClient().$transaction(async (tx) => {
      const michelleUser = await tx.appUser.findFirst({
        where: {
          isActive: true,
          OR: [
            { name: { contains: "Michelle", mode: "insensitive" } },
            { email: { contains: "michelle", mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      const salesPicId = michelleUser?.id
        ?? (actor.role === "ADMIN_CUSTOMER"
          ? actor.id
          : (await tx.appUser.findFirst({ where: { role: "ADMIN_CUSTOMER", isActive: true }, select: { id: true } }))?.id);
      if (!salesPicId) throw new UserFacingError("Admin Customer aktif tidak ditemukan.");

      const rawLeadSourceCustom = formValue(formData, "leadSourceCustom");
      const leadSourceCustom = typeof rawLeadSourceCustom === "string" ? rawLeadSourceCustom.trim() : "";
      let resolvedLeadSourceId = customerParsed.data.leadSourceId;

      if (resolvedLeadSourceId === "custom_other" || (resolvedLeadSourceId && leadSourceCustom)) {
        if (leadSourceCustom) {
          const trimmedCustom = leadSourceCustom.slice(0, 80);
          let customSource = await tx.leadSource.findFirst({
            where: { name: { equals: trimmedCustom, mode: "insensitive" } },
            select: { id: true },
          });
          if (!customSource) {
            customSource = await tx.leadSource.create({
              data: {
                name: trimmedCustom,
                description: "Sumber lead kustom dari form Prospek",
                position: 99,
                isActive: true,
              },
              select: { id: true },
            });
          }
          resolvedLeadSourceId = customSource.id;
        } else if (resolvedLeadSourceId === "custom_other") {
          let otherSource = await tx.leadSource.findFirst({
            where: { name: { equals: "Lainnya", mode: "insensitive" } },
            select: { id: true },
          });
          if (!otherSource) {
            otherSource = await tx.leadSource.create({
              data: { name: "Lainnya", description: "Sumber lead lainnya", position: 99, isActive: true },
              select: { id: true },
            });
          }
          resolvedLeadSourceId = otherSource.id;
        }
      }

      const [customerType, customerLeadSource] = await Promise.all([
        tx.customerType.findUnique({ where: { id: customerParsed.data.customerTypeId }, select: { id: true } }),
        resolvedLeadSourceId ? tx.leadSource.findFirst({ where: { id: resolvedLeadSourceId, isActive: true }, select: { id: true } }) : null,
      ]);
      if (!customerType) throw new UserFacingError("Jenis customer tidak ditemukan.");
      if (resolvedLeadSourceId && !customerLeadSource) throw new UserFacingError("Sumber lead tidak aktif atau tidak ditemukan.");
      const customer = await tx.customer.create({
        data: {
          ...customerParsed.data,
          leadSourceId: resolvedLeadSourceId,
          salesPicId,
          lifecycle: "PROSPEK",
          email: customerParsed.data.email?.toLowerCase(),
          customerNo: await nextCustomerNo(tx),
        },
        select: { id: true, name: true, leadSourceId: true },
      });
      await audit(tx, actor, "Customer", customer.id, "CUSTOMER_CREATED", [
        "name", "companyName", "whatsapp", "email", "instagram", "address", "city", "notes", "customerTypeId", "leadSourceId", "salesPicId", "lifecycle",
      ]);

      const leadSourceId = customer.leadSourceId;
      const leadSource = leadSourceId ? await tx.leadSource.findFirst({ where: { id: leadSourceId, isActive: true }, select: { id: true } }) : null;
      if (leadSourceId && !leadSource) throw new UserFacingError("Sumber lead tidak aktif atau tidak ditemukan.");

      const created = await tx.opportunity.create({
        data: {
          opportunityNo: await nextOpportunityNo(tx),
          customerId: customer.id,
          title: `Prospek: ${customer.name}`,
          stage: "FOLLOW_UP",
          origin: "PROSPEK_FORM",
          leadSourceId,
          salesPicId,
        },
        select: { id: true },
      });
      await audit(tx, actor, "Opportunity", created.id, "OPPORTUNITY_CREATED", [
        "customerId", "title", "leadSourceId", "salesPicId", "stage", "origin",
      ], { stage: "FOLLOW_UP", origin: "PROSPEK_FORM" });
      return created;
    }, DEAL_TRANSACTION_OPTIONS);

    revalidatePath("/crm");
    revalidatePath("/crm/prospek");
    revalidatePath("/customers");
    revalidatePath("/dashboard");
    revalidateCustomerReminders();
    return flashMessagePath("/crm/prospek", "notice", "Prospek berhasil dibuat.");
  });
}

export async function createRepeatOrderAction(formData: FormData) {
  return runRedirectingAction("/customers", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const customerId = entityIdSchema.safeParse(formValue(formData, "customerId"));
    if (!customerId.success) throw new UserFacingError("Pilih customer lama.");

    const opportunity = await getPrismaClient().$transaction(async (tx) => {
      const salesPicId = actor.role === "ADMIN_CUSTOMER"
        ? actor.id
        : (await tx.appUser.findFirst({ where: { role: "ADMIN_CUSTOMER", isActive: true }, select: { id: true } }))?.id;
      if (!salesPicId) throw new UserFacingError("Admin Customer aktif tidak ditemukan.");
      const customer = await tx.customer.findFirst({
        where: { id: customerId.data, archivedAt: null, lifecycle: "CUSTOMER" },
        select: { id: true, name: true, leadSourceId: true },
      });
      if (!customer) throw new UserFacingError("Customer aktif tidak ditemukan.");
      if (customer.leadSourceId && !await tx.leadSource.findFirst({ where: { id: customer.leadSourceId, isActive: true }, select: { id: true } })) {
        throw new UserFacingError("Sumber lead customer tidak aktif atau tidak ditemukan.");
      }
      const created = await tx.opportunity.create({
        data: {
          opportunityNo: await nextOpportunityNo(tx),
          customerId: customer.id,
          title: `Repeat Order: ${customer.name}`,
          stage: "NEGOSIASI",
          isRepeatOrder: true,
          origin: "REPEAT_ORDER",
          leadSourceId: customer.leadSourceId,
          salesPicId,
        },
        select: { id: true },
      });
      await audit(tx, actor, "Opportunity", created.id, "OPPORTUNITY_CREATED", ["customerId", "title", "stage", "leadSourceId", "salesPicId"], { stage: "NEGOSIASI", repeatOrder: true });
      return created;
    }, DEAL_TRANSACTION_OPTIONS);

    revalidatePath("/crm");
    revalidatePath("/crm/prospek");
    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId.data}`);
    revalidatePath("/dashboard");
    return flashMessagePath(`/crm/peluang/${opportunity.id}`, "notice", "Repeat Order berhasil dibuat.");
  });
}

export async function updateOpportunityAction(formData: FormData) {
  return runRedirectingAction(opportunityTabFallback(formData, "po"), async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = updateOpportunitySchema.safeParse({
      opportunityId: formValue(formData, "opportunityId"),
      version: formValue(formData, "version"),
      ...opportunityInput(formData),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const result = await getPrismaClient().$transaction(async (tx) => {
      const current = await tx.opportunity.findUnique({
        where: { id: parsed.data.opportunityId },
        select: { stage: true },
      });
      if (!current) throw new UserFacingError("Peluang tidak ditemukan.");
      if (OPEN_STAGES.includes(current.stage)) {
        const scheduleError = validateOpenOpportunitySchedule(parsed.data);
        if (scheduleError) throw new UserFacingError(scheduleError);
      }
      const category = await resolveOpportunityCategory(tx, parsed.data.productCategoryId);

      const [leadSource, salesPic] = await Promise.all([
        parsed.data.leadSourceId ? tx.leadSource.findFirst({ where: { id: parsed.data.leadSourceId, isActive: true }, select: { id: true } }) : null,
        parsed.data.salesPicId ? tx.appUser.findFirst({ where: { id: parsed.data.salesPicId, role: "ADMIN_CUSTOMER", isActive: true }, select: { id: true } }) : null,
      ]);
      if (parsed.data.leadSourceId && !leadSource) throw new UserFacingError("Sumber lead tidak aktif atau tidak ditemukan.");
      if (parsed.data.salesPicId && !salesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");
      const updated = await tx.opportunity.updateMany({
        where: { id: parsed.data.opportunityId, version: parsed.data.version },
        data: {
          title: parsed.data.title,
          leadSourceId: parsed.data.leadSourceId ?? null,
          salesPicId: parsed.data.salesPicId ?? null,
          productName: parsed.data.productName ?? null,
          productCategoryId: category?.id ?? null,
          garmentType: category?.garmentType ?? parsed.data.garmentType ?? null,
          needPurpose: parsed.data.needPurpose ?? null,
          specification: parsed.data.specification ?? null,
          nextAction: parsed.data.nextAction ?? null,
          nextActionAt: jakartaDateTime(parsed.data.nextActionAt),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new UserFacingError("Peluang sudah berubah. Muat ulang halaman.");
      await audit(tx, actor, "Opportunity", parsed.data.opportunityId, "OPPORTUNITY_UPDATED", [
        "title", "leadSourceId", "salesPicId", "productName", "garmentType", "productCategoryId", "needPurpose", "specification",
        "nextAction", "nextActionAt",
      ]);
      return updated;
    }, DEAL_TRANSACTION_OPTIONS);
    if (!result.count) throw new UserFacingError("Peluang tidak dapat diperbarui.");

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}?tab=po`, "notice", "Peluang diperbarui.");
  });
}

async function moveOpportunityStage(formData: FormData) {
  const actor = await requireActor(CRM_OPERATOR_ROLES);
  const parsed = moveOpportunitySchema.safeParse({
    opportunityId: formValue(formData, "opportunityId"),
    version: formValue(formData, "version"),
    stage: formValue(formData, "stage"),
    cancelReason: formValue(formData, "cancelReason"),
  });
  if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

  // Pindah stage kanban memakai anggaran transaksi yang sama seperti Deal: pooler Supabase
  // lambat (ratusan ms per query) sehingga default Prisma (maxWait 2s / timeout 5s) bisa P2028.
  const customerId = await getPrismaClient().$transaction(async (tx) => {
    const current = await tx.opportunity.findUnique({
      where: { id: parsed.data.opportunityId },
      select: { stage: true, customerId: true },
    });
    if (!current) throw new UserFacingError("Peluang tidak ditemukan.");
    if (current.stage === "DEAL") throw new UserFacingError("Deal hanya dapat dibatalkan melalui Sales Order oleh Admin.");
    const allowedTransitions: Record<string, readonly string[]> = {
      LEAD_BARU: ["FOLLOW_UP", "NEGOSIASI", "LOST"],
      FOLLOW_UP: ["NEGOSIASI", "LOST"],
      NEGOSIASI: ["FOLLOW_UP", "LOST"],
      LOST: ["FOLLOW_UP"],
    };
    if (!allowedTransitions[current.stage]?.includes(parsed.data.stage)) {
      throw new UserFacingError(`Status ${STAGE_LABEL[current.stage]} tidak dapat langsung dipindahkan ke ${STAGE_LABEL[parsed.data.stage]}.`);
    }

    const updated = await tx.opportunity.updateMany({
      where: { id: parsed.data.opportunityId, version: parsed.data.version, stage: { not: "DEAL" } },
      data: {
        stage: parsed.data.stage,
        nextAction: parsed.data.stage === "LOST" ? null : undefined,
        nextActionAt: parsed.data.stage === "LOST" ? null : undefined,
        cancelReason: parsed.data.stage === "LOST" ? parsed.data.cancelReason : null,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new UserFacingError("Status sudah berubah. Muat ulang board.");
    const auditEvent = await audit(tx, actor, "Opportunity", parsed.data.opportunityId, "OPPORTUNITY_STAGE_CHANGED", [
      "stage", "nextAction", "nextActionAt", "cancelReason",
    ], { from: current.stage, to: parsed.data.stage });
    await addSystemActivity(tx, actor, {
      customerId: current.customerId,
      opportunityId: parsed.data.opportunityId,
      systemEvent: "STAGE_CHANGED",
      content: parsed.data.stage === "LOST" && parsed.data.cancelReason
        ? `Status peluang berubah dari ${STAGE_LABEL[current.stage]} menjadi Lost. Alasan: ${parsed.data.cancelReason}`
        : `Status peluang berubah dari ${STAGE_LABEL[current.stage]} menjadi ${STAGE_LABEL[parsed.data.stage]}.`,
      metadata: {
        from: current.stage,
        to: parsed.data.stage,
        ...(parsed.data.cancelReason ? { cancelReason: parsed.data.cancelReason } : {}),
      },
      sourceAuditEventId: auditEvent.id,
    });
    if (parsed.data.stage === "LOST") {
      await rearmCustomerRemindersAfterLost(tx, current.customerId);
    }
    return current.customerId;
  }, DEAL_TRANSACTION_OPTIONS);

  revalidatePath("/crm");
  revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
  revalidatePath(`/customers/${customerId}`);
  revalidateCustomerReminders();
  return { ...parsed.data, customerId };
}

export async function moveOpportunityStageAction(formData: FormData) {
  const redirectPath = opportunityRedirectPath(formData);
  return runRedirectingAction(redirectPath, async () => {
    await moveOpportunityStage(formData);
    return flashMessagePath(redirectPath, "notice", "Status peluang diperbarui.");
  });
}

export async function moveOpportunityStageOptimisticAction(formData: FormData) {
  try {
    const moved = await moveOpportunityStage(formData);
    return { ok: true as const, opportunityId: moved.opportunityId, version: moved.version + 1 };
  } catch (error) {
    return { ok: false as const, kind: flashKindForError(error), message: messageForError(error) };
  }
}

export async function addCommunicationActivityAction(formData: FormData) {
  const fallbackOpportunityId = entityIdSchema.safeParse(formValue(formData, "opportunityId"));
  const fallbackCustomerId = entityIdSchema.safeParse(formValue(formData, "customerId"));
  const fallbackPath = fallbackOpportunityId.success
    ? `/crm/peluang/${fallbackOpportunityId.data}?tab=aktivitas`
    : fallbackCustomerId.success ? `/customers/${fallbackCustomerId.data}` : "/customers";

  return runRedirectingAction(fallbackPath, async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = addCommunicationActivitySchema.safeParse({
      context: formValue(formData, "context"),
      customerId: formValue(formData, "customerId"),
      opportunityId: formValue(formData, "opportunityId"),
      channel: formValue(formData, "channel"),
      direction: formValue(formData, "direction"),
      occurredAt: formValue(formData, "occurredAt"),
      content: formValue(formData, "content"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const occurredAt = jakartaDateTime(parsed.data.occurredAt);
    if (!occurredAt || occurredAt > new Date()) throw new UserFacingError("Waktu aktivitas tidak boleh berada di masa depan.");

    await getPrismaClient().$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: parsed.data.customerId },
        select: { id: true, archivedAt: true },
      });
      if (!customer) throw new UserFacingError("Customer tidak ditemukan.");
      if (customer.archivedAt) throw new UserFacingError("Pulihkan customer sebelum mencatat aktivitas baru.");
      if (parsed.data.opportunityId) {
        const opportunity = await tx.opportunity.findFirst({
          where: { id: parsed.data.opportunityId, customerId: customer.id },
          select: { id: true },
        });
        if (!opportunity) throw new UserFacingError("Peluang tidak terhubung ke customer ini.");
      }

      const activity = await tx.communicationActivity.create({
        data: {
          customerId: customer.id,
          opportunityId: parsed.data.opportunityId,
          authorId: actor.id,
          kind: parsed.data.channel === "INTERNAL_NOTE" ? "INTERNAL_NOTE" : "COMMUNICATION",
          channel: parsed.data.channel === "INTERNAL_NOTE" ? null : parsed.data.channel,
          direction: parsed.data.channel === "INTERNAL_NOTE" ? null : parsed.data.direction,
          content: parsed.data.content,
          occurredAt,
        },
        select: { id: true },
      });
      await audit(tx, actor, "CommunicationActivity", activity.id, "COMMUNICATION_ACTIVITY_ADDED", [
        "kind", "channel", "direction", "content", "occurredAt",
      ], { customerId: customer.id, opportunityId: parsed.data.opportunityId ?? null });
    }, DEAL_TRANSACTION_OPTIONS);

    revalidatePath(`/customers/${parsed.data.customerId}`);
    if (parsed.data.opportunityId) revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    const destination = parsed.data.context === "opportunity" && parsed.data.opportunityId
      ? `/crm/peluang/${parsed.data.opportunityId}?tab=aktivitas`
      : `/customers/${parsed.data.customerId}`;
    return flashMessagePath(destination, "notice", "Aktivitas komunikasi ditambahkan.");
  });
}

export async function recordFollowUpResultAction(formData: FormData) {
  return runRedirectingAction("/crm/follow-up", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = recordFollowUpResultSchema.safeParse({
      opportunityId: formValue(formData, "opportunityId"),
      version: formValue(formData, "version"),
      content: formValue(formData, "content"),
      contactedAt: formValue(formData, "contactedAt"),
      channel: formValue(formData, "channel"),
      direction: formValue(formData, "direction"),
      nextAction: formValue(formData, "nextAction"),
      nextActionAt: formValue(formData, "nextActionAt"),
      stage: formValue(formData, "stage"),
      cancelReason: formValue(formData, "cancelReason"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const contactedAt = jakartaDateTime(parsed.data.contactedAt);
    if (!contactedAt || contactedAt > new Date()) throw new UserFacingError("Waktu kontak tidak boleh berada di masa depan.");
    const nextActionAt = parsed.data.stage === "LOST" ? null : jakartaDateTime(parsed.data.nextActionAt);
    if (nextActionAt && nextActionAt <= contactedAt) throw new UserFacingError("Jadwal berikutnya harus setelah waktu kontak.");

    const customerId = await getPrismaClient().$transaction(async (tx) => {
      const current = await tx.opportunity.findUnique({
        where: { id: parsed.data.opportunityId },
        select: { customerId: true, customer: { select: { archivedAt: true } } },
      });
      if (!current) throw new UserFacingError("Peluang tidak ditemukan.");
      if (current.customer.archivedAt) throw new UserFacingError("Pulihkan customer sebelum mencatat follow-up.");

      const updated = await tx.opportunity.updateMany({
        where: { id: parsed.data.opportunityId, version: parsed.data.version, stage: { notIn: ["DEAL", "LOST"] } },
        data: {
          stage: parsed.data.stage,
          lastContactedAt: contactedAt,
          nextAction: parsed.data.stage === "LOST" ? null : parsed.data.nextAction,
          nextActionAt,
          cancelReason: parsed.data.stage === "LOST" ? parsed.data.cancelReason : null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new UserFacingError("Peluang sudah berubah atau telah ditutup. Muat ulang halaman.");
      const activity = await tx.communicationActivity.create({
        data: {
          customerId: current.customerId,
          opportunityId: parsed.data.opportunityId,
          authorId: actor.id,
          kind: "COMMUNICATION",
          channel: parsed.data.channel,
          direction: parsed.data.direction,
          content: parsed.data.content,
          occurredAt: contactedAt,
          metadata: {
            stage: parsed.data.stage,
            ...(parsed.data.nextAction ? { nextAction: parsed.data.nextAction } : {}),
            ...(nextActionAt ? { nextActionAt: nextActionAt.toISOString() } : {}),
            ...(parsed.data.cancelReason ? { cancelReason: parsed.data.cancelReason } : {}),
          },
        },
        select: { id: true },
      });
      await audit(tx, actor, "Opportunity", parsed.data.opportunityId, "FOLLOW_UP_RECORDED", [
        "lastContactedAt", "nextAction", "nextActionAt", "stage", "cancelReason", "communicationActivityId",
      ], { communicationActivityId: activity.id });
      if (parsed.data.stage === "LOST") {
        await rearmCustomerRemindersAfterLost(tx, current.customerId);
      }
      return current.customerId;
    }, DEAL_TRANSACTION_OPTIONS);

    revalidatePath("/crm");
    revalidatePath("/crm/follow-up");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    revalidatePath(`/customers/${customerId}`);
    revalidateCustomerReminders();
    return flashMessagePath("/crm/follow-up", "notice", "Hasil follow-up dan langkah berikutnya tersimpan.");
  });
}

export async function createPurchaseOrderDraftAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  return runFormAction("create-po-draft", async () => {
    const timer = documentTimer("create-po-draft");
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    timer.mark("auth");
    const parsed = purchaseOrderDraftSchema.safeParse(purchaseOrderInput(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    timer.mark("parse");

    const prisma = getPrismaClient();
    const purchaseOrderId = randomUUID();
    const preparedItems = await preparePoItems(formData, parsed.data.items);
    const rows = await preparePurchaseOrderRows(prisma, preparedItems);
    timer.mark("rows");
    const allDecorationMethods = [...new Set(preparedItems.flatMap((item) => item.decorationMethods))];
    await prisma.$transaction(async (tx) => {
        const opportunity = await tx.opportunity.findUnique({
          where: { id: parsed.data.opportunityId },
          select: {
            stage: true,
            customer: { select: { id: true, name: true, poCustomerCode: true, archivedAt: true } },
            purchaseOrders: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
            _count: { select: { purchaseOrders: true } },
          },
        });
        if (!opportunity || opportunity.customer.archivedAt) throw new UserFacingError("Peluang aktif tidak ditemukan.");
        if (opportunity.stage !== "NEGOSIASI") throw new UserFacingError("PO hanya dapat dibuat saat peluang berada di Negosiasi.");
        if (opportunity.purchaseOrders.length) throw new UserFacingError("Selesaikan draft PO yang sedang aktif.");
        if (opportunity._count.purchaseOrders > 0) throw new UserFacingError("Gunakan aksi Revisi PO dari dokumen sebelumnya.");

        const category = await resolveProductCategory(tx, parsed.data.productCategoryId, parsed.data.garmentType);
        const itemCategories = await Promise.all(preparedItems.map((item) => resolveProductCategory(tx, item.productCategoryId, category.garmentType)));
        const created = await tx.purchaseOrder.create({
          data: {
            id: purchaseOrderId,
            purchaseOrderNo: await nextPurchaseOrderNo(tx, opportunity.customer),
            opportunityId: parsed.data.opportunityId,
            revision: 1,
            garmentType: category.garmentType,
            productCategoryId: category.productCategoryId,
            productName: parsed.data.pola,
            instansi: parsed.data.instansi,
            pola: parsed.data.pola,
            material: parsed.data.material,
            color: parsed.data.baseColor,
            baseColor: parsed.data.baseColor,
            variationColor: parsed.data.variationColor,
            decorationMethod: legacyDecorationMethod(allDecorationMethods),
            decorationMethods: allDecorationMethods,
            orderDate: optionalDate(parsed.data.orderDate),
            sampleSize: category.garmentType === "JERSEY" ? parsed.data.sampleSize : null,
            designNotes: parsed.data.designNotes,
            notes: parsed.data.notes,
            deadline: optionalDate(parsed.data.deadline),
            depositRequired: parsed.data.depositRequired,
            designTask: { create: { deadline: optionalDate(parsed.data.designDeadline)! } },
            createdById: actor.id,
            items: {
              create: preparedItems.map((item, position) => ({
                id: item.itemId,
                position,
                name: item.name,
                productCategoryId: itemCategories[position]?.productCategoryId ?? null,
                garmentType: itemCategories[position]?.garmentType ?? category.garmentType,
                decorationMethods: [...new Set(item.decorationMethods)],
                designNotes: item.designNotes,
              })),
            },
            sizes: { create: rows.sizes },
            rosterEntries: { create: rows.roster },
          },
          select: { id: true },
        });
        await audit(tx, actor, "PurchaseOrder", created.id, "PURCHASE_ORDER_DRAFT_CREATED", [
          "garmentType", "productCategoryId", "productName", "instansi", "pola", "material", "baseColor", "variationColor", "decorationMethods", "orderDate", "sampleSize", "designNotes", "notes", "deadline", "designDeadline", "depositRequired", "items", "sizes", "roster",
        ], { opportunityId: parsed.data.opportunityId });
    }, DOCUMENT_DRAFT_TRANSACTION_OPTIONS);
    timer.mark("transaction");

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    timer.mark("revalidate");
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}?tab=po`, "notice", "Draft PO dibuat.");
  });
}

export async function updatePurchaseOrderDraftAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  return runFormAction("update-po-draft", async () => {
    const timer = documentTimer("update-po-draft");
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    timer.mark("auth");
    const parsed = purchaseOrderDraftSchema.safeParse(purchaseOrderInput(formData));
    if (!parsed.success || !parsed.data.purchaseOrderId || !parsed.data.version) {
      throw new UserFacingError(parsed.success ? "Identitas PO tidak lengkap." : firstValidationMessage(parsed.error));
    }
    timer.mark("parse");
    const prisma = getPrismaClient();
    const purchaseOrderId = parsed.data.purchaseOrderId;
    const preparedItems = await preparePoItems(formData, parsed.data.items);
    const rows = await preparePurchaseOrderRows(prisma, preparedItems);
    timer.mark("rows");
    const allDecorationMethods = [...new Set(preparedItems.flatMap((item) => item.decorationMethods))];
    await prisma.$transaction(async (tx) => {
        const category = await resolveProductCategory(tx, parsed.data.productCategoryId, parsed.data.garmentType);
        const itemCategories = await Promise.all(preparedItems.map((item) => resolveProductCategory(tx, item.productCategoryId, category.garmentType)));
        const updated = await tx.purchaseOrder.updateMany({
          where: { id: purchaseOrderId, opportunityId: parsed.data.opportunityId, status: "DRAFT", revision: { lt: 4 }, version: parsed.data.version, opportunity: { purchaseOrders: { none: { status: "AGREED" } }, invoices: { none: { status: "ISSUED" } } } },
          data: {
            garmentType: category.garmentType,
            productCategoryId: category.productCategoryId,
            productName: parsed.data.pola,
            instansi: parsed.data.instansi,
            pola: parsed.data.pola,
            material: parsed.data.material,
            color: parsed.data.baseColor,
            baseColor: parsed.data.baseColor,
            variationColor: parsed.data.variationColor,
            decorationMethod: legacyDecorationMethod(allDecorationMethods),
            decorationMethods: allDecorationMethods,
            orderDate: optionalDate(parsed.data.orderDate),
            sampleSize: category.garmentType === "JERSEY" ? parsed.data.sampleSize : null,
            designNotes: parsed.data.designNotes,
            notes: parsed.data.notes,
            deadline: optionalDate(parsed.data.deadline),
            depositRequired: parsed.data.depositRequired,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new UserFacingError("Draft sudah berubah atau tidak lagi dapat diedit.");
        await tx.designTask.upsert({ where: { purchaseOrderId }, update: { deadline: optionalDate(parsed.data.designDeadline)! }, create: { purchaseOrderId, deadline: optionalDate(parsed.data.designDeadline)! } });
        await tx.purchaseOrderRosterEntry.deleteMany({ where: { purchaseOrderId } });
        await tx.purchaseOrderSize.deleteMany({ where: { purchaseOrderId } });
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId } });
        await tx.purchaseOrderItem.createMany({
          data: preparedItems.map((item, position) => ({ id: item.itemId, purchaseOrderId, position, name: item.name, productCategoryId: itemCategories[position]?.productCategoryId ?? null, garmentType: itemCategories[position]?.garmentType ?? category.garmentType, decorationMethods: [...new Set(item.decorationMethods)], designNotes: item.designNotes ?? null })),
        });
        await tx.purchaseOrderSize.createMany({
          data: rows.sizes.map((item) => ({ purchaseOrderId, ...item })),
        });
        if (rows.roster.length) await tx.purchaseOrderRosterEntry.createMany({ data: rows.roster.map((item) => ({ purchaseOrderId, ...item })) });
        await audit(tx, actor, "PurchaseOrder", purchaseOrderId, "PURCHASE_ORDER_DRAFT_UPDATED", [
          "garmentType", "productCategoryId", "productName", "instansi", "pola", "material", "baseColor", "variationColor", "decorationMethods", "orderDate", "sampleSize", "designNotes", "notes", "deadline", "designDeadline", "depositRequired", "items", "sizes", "roster",
        ]);
    }, DOCUMENT_DRAFT_TRANSACTION_OPTIONS);
    timer.mark("transaction");

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    timer.mark("revalidate");
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}?tab=po`, "notice", "Draft PO diperbarui.");
  });
}

export async function agreePurchaseOrderAction(formData: FormData) {
  return runRedirectingAction(opportunityTabFallback(formData, "po"), async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = purchaseOrderIdSchema.safeParse({
      purchaseOrderId: formValue(formData, "purchaseOrderId"),
      version: formValue(formData, "version"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const result = await getPrismaClient().$transaction(async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.findUnique({
        where: { id: parsed.data.purchaseOrderId },
        select: {
          purchaseOrderNo: true,
          opportunityId: true,
          status: true,
          garmentType: true,
          deadline: true,
          designSentAt: true,
          customerConfirmedAt: true,
          sizes: { select: { id: true }, take: 1 },
          opportunity: {
            select: {
              stage: true,
              customerId: true,
              invoices: { where: { status: { in: ["DRAFT", "ISSUED"] } }, select: { id: true, status: true } },
              purchaseOrders: { where: { status: "AGREED", id: { not: parsed.data.purchaseOrderId } }, select: { id: true }, take: 1 },
            },
          },
        },
      });
      if (!purchaseOrder || purchaseOrder.status !== "DRAFT") throw new UserFacingError("Draft PO tidak ditemukan.");
      if (purchaseOrder.opportunity.stage !== "NEGOSIASI") throw new UserFacingError("PO hanya dapat disepakati saat Negosiasi.");
      if (purchaseOrder.opportunity.invoices.some((invoice) => invoice.status === "ISSUED")) throw new UserFacingError("Invoice sudah diterbitkan dan bersifat final.");
      if (purchaseOrder.opportunity.invoices.length) throw new UserFacingError("Selesaikan invoice draft sebelum menyepakati PO.");
      if (purchaseOrder.opportunity.purchaseOrders.length) throw new UserFacingError("PO sudah disepakati dan bersifat final.");
      if (!purchaseOrder.sizes.length) throw new UserFacingError("PO belum memiliki ukuran dan jumlah.");
      if (!purchaseOrder.garmentType || !purchaseOrder.deadline) throw new UserFacingError("Jenis pakaian dan deadline produksi wajib dilengkapi sebelum PO disepakati.");
      if (!purchaseOrder.customerConfirmedAt) throw new UserFacingError("Kirim 1 set PDF PO ke customer dan tandai konfirmasi tidak ada revisi sebelum menyepakati PO.");
      const business = await tx.businessProfile.findUnique({ where: { id: "default" } });

      const agreedAt = new Date();
      const updated = await tx.purchaseOrder.updateMany({
        where: { id: parsed.data.purchaseOrderId, status: "DRAFT", version: parsed.data.version },
        data: {
          status: "AGREED",
          agreedAt,
          snapshotBusinessName: business?.name ?? "AS Konveksi",
          snapshotBusinessPhone: business?.phone,
          snapshotBusinessEmail: business?.email,
          snapshotBusinessAddress: business?.address,
          snapshotBusinessLogoPath: business?.logoPath,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new UserFacingError("PO sudah berubah. Muat ulang halaman.");
      const auditEvent = await audit(tx, actor, "PurchaseOrder", parsed.data.purchaseOrderId, "PURCHASE_ORDER_AGREED", ["status", "agreedAt"]);
      await addSystemActivity(tx, actor, {
        customerId: purchaseOrder.opportunity.customerId,
        opportunityId: purchaseOrder.opportunityId,
        systemEvent: "PURCHASE_ORDER_AGREED",
        content: `PO ${purchaseOrder.purchaseOrderNo} disepakati.`,
        occurredAt: agreedAt,
        metadata: { purchaseOrderId: parsed.data.purchaseOrderId, purchaseOrderNo: purchaseOrder.purchaseOrderNo },
        sourceAuditEventId: auditEvent.id,
      });
      return { opportunityId: purchaseOrder.opportunityId, customerId: purchaseOrder.opportunity.customerId };
    }, DEAL_TRANSACTION_OPTIONS);

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${result.opportunityId}`);
    revalidatePath(`/customers/${result.customerId}`);
    return flashMessagePath(`/crm/peluang/${result.opportunityId}?tab=po`, "notice", "PO disepakati dan dikunci.");
  });
}

/**
 * Tabel CRM > Purchase order membaca data dari `unstable_cache` bertag "purchase-orders" (30 detik).
 * Deposit baru harus langsung tampil di kolom Deposit/Tanggal Deposit, jadi tag dikosongkan juga.
 */
function revalidatePurchaseOrderList() {
  revalidatePath("/crm/purchase-orders");
  revalidateTag("purchase-orders", { expire: 0 });
}

export async function recordPurchaseOrderDepositAction(formData: FormData) {
  const fallbackPurchaseOrderId = entityIdSchema.safeParse(formValue(formData, "purchaseOrderId"));
  const fallbackPath = fallbackPurchaseOrderId.success ? "/crm/purchase-orders" : "/crm";
  return runRedirectingAction(fallbackPath, async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = purchaseOrderDepositSchema.safeParse({
      purchaseOrderId: formValue(formData, "purchaseOrderId"),
      amount: formValue(formData, "amount"),
      paymentMethodId: formValue(formData, "paymentMethodId"),
      paidAt: formValue(formData, "paidAt"),
      reference: formValue(formData, "reference"),
      note: formValue(formData, "note"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const paidAt = jakartaDateTime(parsed.data.paidAt) ?? new Date();
    if (paidAt.getTime() > Date.now() + 5 * 60 * 1000) throw new UserFacingError("Tanggal deposit tidak boleh maju ke masa depan.");
    // Bukti lama tetap dipakai bila tidak ada file baru, jadi tanda "sudah ada bukti" ikut dikirim.
    const existingDeposit = await getPrismaClient().purchaseOrderDeposit.findUnique({
      where: { purchaseOrderId: parsed.data.purchaseOrderId },
      select: { proofPath: true },
    });
    const proof = await paymentProof(formData, actor.id, parsed.data.paymentMethodId, Boolean(existingDeposit?.proofPath));

    const opportunityId = await getPrismaClient().$transaction(async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.findUnique({
        where: { id: parsed.data.purchaseOrderId },
        select: { id: true, purchaseOrderNo: true, status: true, opportunityId: true, depositRequired: true, deposit: { select: { id: true } } },
      });
      if (!purchaseOrder) throw new UserFacingError("Purchase order tidak ditemukan.");
      // Deposit hanya untuk PO yang checkbox Deposit-nya dicentang; DEVELOPER/OWNER tetap bisa mengisinya (AGENTS.md).
      if (!purchaseOrder.depositRequired && !purchaseOrder.deposit && !hasRole(actor.role, GATE_OVERRIDE_ROLES)) throw new UserFacingError("PO ini tidak memerlukan deposit. Centang Deposit pada form PO terlebih dahulu.");
      // Deposit dibuka selama PO masih draft; DEVELOPER/OWNER tetap bisa memperbaikinya (AGENTS.md).
      if (purchaseOrder.status !== "DRAFT" && !hasRole(actor.role, GATE_OVERRIDE_ROLES)) throw new UserFacingError("Deposit hanya dapat diubah saat PO masih draft.");
      const values = {
        amount: new Prisma.Decimal(parsed.data.amount),
        paidAt,
        paymentMethodId: parsed.data.paymentMethodId,
        reference: parsed.data.reference ?? null,
        note: parsed.data.note ?? null,
        ...(proof ?? {}),
        createdById: actor.id,
      };
      const deposit = purchaseOrder.deposit
        ? await tx.purchaseOrderDeposit.update({ where: { id: purchaseOrder.deposit.id }, data: values })
        : await tx.purchaseOrderDeposit.create({ data: { ...values, purchaseOrderId: purchaseOrder.id } });
      await audit(tx, actor, "PurchaseOrderDeposit", deposit.id, purchaseOrder.deposit ? "PURCHASE_ORDER_DEPOSIT_UPDATED" : "PURCHASE_ORDER_DEPOSIT_RECORDED", ["amount", "paidAt", "paymentMethodId", "reference", "note"], {
        purchaseOrderId: purchaseOrder.id,
        purchaseOrderNo: purchaseOrder.purchaseOrderNo,
        amount: parsed.data.amount,
      });
      return purchaseOrder.opportunityId;
    }, DEAL_TRANSACTION_OPTIONS);

    revalidatePath("/crm");
    revalidatePurchaseOrderList();
    revalidatePath(`/crm/peluang/${opportunityId}`);
    return flashMessagePath(`/crm/peluang/${opportunityId}?tab=po`, "notice", "Deposit desain tersimpan dan dikurangkan dari sisa tagihan invoicenya.");
  });
}

export async function markPurchaseOrderDesignSentAction(formData: FormData) {
  return runRedirectingAction(opportunityTabFallback(formData, "po"), async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = purchaseOrderIdSchema.safeParse({ purchaseOrderId: formValue(formData, "purchaseOrderId"), version: formValue(formData, "version") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const updated = await getPrismaClient().$transaction(async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.findUnique({
        where: { id: parsed.data.purchaseOrderId },
        select: {
          opportunityId: true,
          status: true,
          items: { select: { id: true } },
          designTask: { select: { revisions: { select: { itemId: true } } } },
        },
      });
      if (!purchaseOrder || purchaseOrder.status !== "DRAFT") throw new UserFacingError("Hanya PO draft yang dapat ditandai terkirim.");
      // PDF dikirim setelah desain SETIAP produk diunggah; DEVELOPER/OWNER selalu boleh melewati gate ini.
      const uploadedItemIds = new Set((purchaseOrder.designTask?.revisions ?? []).map((revision) => revision.itemId));
      const designUploaded = purchaseOrder.items.length > 0 && purchaseOrder.items.every((item) => uploadedItemIds.has(item.id));
      if (!designUploaded && !hasRole(actor.role, GATE_OVERRIDE_ROLES)) throw new UserFacingError("Unggah desain terlebih dahulu sebelum mengirim 1 set PDF ke customer.");
      const customerConfirmed = String(formData.get("customerConfirmed") ?? "") === "yes";
      const now = new Date();
      const result = await tx.purchaseOrder.updateMany({
        where: { id: parsed.data.purchaseOrderId, status: "DRAFT", version: parsed.data.version },
        data: { designSentAt: now, designSentById: actor.id, ...(customerConfirmed ? { customerConfirmedAt: now, customerConfirmedById: actor.id } : {}) },
      });
      if (result.count !== 1) throw new UserFacingError("PO sudah berubah. Muat ulang halaman.");
      await audit(tx, actor, "PurchaseOrder", parsed.data.purchaseOrderId, "PURCHASE_ORDER_DESIGN_SENT", ["designSentAt", "designSentById", ...(customerConfirmed ? ["customerConfirmedAt", "customerConfirmedById"] : [])]);
      return purchaseOrder;
    }, DEAL_TRANSACTION_OPTIONS);
    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${updated.opportunityId}`);
    return flashMessagePath(`/crm/peluang/${updated.opportunityId}?tab=po`, "notice", `1 set PDF PO ditandai terkirim oleh ${actor.name}. Minta konfirmasi revisi ke customer.`);
  });
}

export async function confirmPurchaseOrderCustomerAction(formData: FormData) {
  return runRedirectingAction(opportunityTabFallback(formData, "po"), async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = purchaseOrderIdSchema.safeParse({ purchaseOrderId: formValue(formData, "purchaseOrderId"), version: formValue(formData, "version") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const updated = await getPrismaClient().$transaction(async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.findUnique({ where: { id: parsed.data.purchaseOrderId }, select: { opportunityId: true, status: true, designSentAt: true } });
      if (!purchaseOrder || purchaseOrder.status !== "DRAFT") throw new UserFacingError("Hanya PO draft yang dapat dikonfirmasi.");
      if (!purchaseOrder.designSentAt) throw new UserFacingError("Kirim 1 set PDF PO ke customer terlebih dahulu.");
      const result = await tx.purchaseOrder.updateMany({
        where: { id: parsed.data.purchaseOrderId, status: "DRAFT", version: parsed.data.version },
        data: { customerConfirmedAt: new Date(), customerConfirmedById: actor.id },
      });
      if (result.count !== 1) throw new UserFacingError("PO sudah berubah. Muat ulang halaman.");
      await audit(tx, actor, "PurchaseOrder", parsed.data.purchaseOrderId, "PURCHASE_ORDER_CUSTOMER_CONFIRMED", ["customerConfirmedAt", "customerConfirmedById"]);
      return purchaseOrder;
    }, DEAL_TRANSACTION_OPTIONS);
    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${updated.opportunityId}`);
    return flashMessagePath(`/crm/peluang/${updated.opportunityId}?tab=po`, "notice", "Customer dikonfirmasi tidak ada revisi. PO siap disepakati.");
  });
}

export async function createPurchaseOrderRevisionAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  return runFormAction("create-po-revision", async () => {
    const timer = documentTimer("create-po-revision");
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    timer.mark("auth");
    const sourcePurchaseOrderId = entityIdSchema.safeParse(formValue(formData, "sourcePurchaseOrderId"));
    if (!sourcePurchaseOrderId.success) throw new UserFacingError(firstValidationMessage(sourcePurchaseOrderId.error));
    const parsed = purchaseOrderDraftSchema.safeParse(purchaseOrderInput(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    timer.mark("parse");
    const prisma = getPrismaClient();
    const purchaseOrderId = randomUUID();
    const preparedItems = await preparePoItems(formData, parsed.data.items);
    const rows = await preparePurchaseOrderRows(prisma, preparedItems);
    timer.mark("rows");
    const allDecorationMethods = [...new Set(preparedItems.flatMap((item) => item.decorationMethods))];
    const opportunityId = await prisma.$transaction(async (tx) => {
        const source = await tx.purchaseOrder.findUnique({
          where: { id: sourcePurchaseOrderId.data },
          select: {
            id: true,
            opportunityId: true,
            purchaseOrderNo: true,
            status: true,
            revision: true,
            version: true,
            opportunity: {
              select: {
                stage: true,
                customer: { select: { id: true, name: true, poCustomerCode: true } },
                invoices: { where: { status: { in: ["DRAFT", "ISSUED"] } }, select: { id: true, status: true } },
                purchaseOrders: { where: { status: "AGREED" }, select: { id: true }, take: 1 },
              },
            },
          },
        });
        if (!source || (source.status !== "DRAFT" && source.status !== "AGREED")) throw new UserFacingError("Revisi hanya dapat dibuat dari PO draft atau disepakati yang aktif.");
        if (source.revision >= 4) throw new UserFacingError("Batas maksimal 3 kali revisi PO sudah tercapai.");
        if (source.opportunityId !== parsed.data.opportunityId) throw new UserFacingError("PO sumber tidak sesuai dengan peluang.");
        if (source.opportunity.stage !== "NEGOSIASI") throw new UserFacingError("Revisi PO hanya dapat dibuat saat Negosiasi.");
        if (source.status === "DRAFT") {
          if (source.opportunity.purchaseOrders.length || source.opportunity.invoices.some((invoice) => invoice.status === "ISSUED")) throw new UserFacingError("PO atau invoice sudah final dan tidak dapat direvisi.");
          if (source.opportunity.invoices.length) throw new UserFacingError("Selesaikan invoice draft sebelum membuat revisi PO.");
        } else {
          // E3: revisi dari PO yang sudah disepakati (mis. tambah qty H-1).
          if (source.opportunity.invoices.some((invoice) => invoice.status === "ISSUED")) throw new UserFacingError("Invoice sudah terbit. Batalkan Sales Order terlebih dahulu sebelum merevisi PO yang disepakati.");
          if (source.opportunity.invoices.length) throw new UserFacingError("Selesaikan invoice draft sebelum membuat revisi PO.");
          const downstream = await tx.salesOrder.findFirst({ where: { purchaseOrderId: source.id, status: "ACTIVE" }, select: { id: true } });
          if (downstream) throw new UserFacingError("Sales Order sudah terbentuk. Batalkan Sales Order terlebih dahulu sebelum merevisi PO yang disepakati.");
        }
        const category = await resolveProductCategory(tx, parsed.data.productCategoryId, parsed.data.garmentType);
        const itemCategories = await Promise.all(preparedItems.map((item) => resolveProductCategory(tx, item.productCategoryId, category.garmentType)));
        const locked = await tx.purchaseOrder.updateMany({
          where: { id: source.id, status: source.status, revision: source.revision, version: source.version },
          data: { status: "SUPERSEDED", version: { increment: 1 } },
        });
        if (locked.count !== 1) throw new UserFacingError("PO sudah berubah. Muat ulang halaman.");
        const created = await tx.purchaseOrder.create({
          data: {
            id: purchaseOrderId,
            purchaseOrderNo: formatPurchaseOrderRevisionNo(source.purchaseOrderNo, source.revision + 1),
            opportunityId: source.opportunityId,
            revision: source.revision + 1,
            garmentType: category.garmentType,
            productCategoryId: category.productCategoryId,
            productName: parsed.data.pola,
            instansi: parsed.data.instansi,
            pola: parsed.data.pola,
            material: parsed.data.material,
            color: parsed.data.baseColor,
            baseColor: parsed.data.baseColor,
            variationColor: parsed.data.variationColor,
            decorationMethod: legacyDecorationMethod(allDecorationMethods),
            decorationMethods: allDecorationMethods,
            orderDate: optionalDate(parsed.data.orderDate),
            sampleSize: category.garmentType === "JERSEY" ? parsed.data.sampleSize : null,
            designNotes: parsed.data.designNotes,
            notes: parsed.data.notes,
            deadline: optionalDate(parsed.data.deadline),
            depositRequired: parsed.data.depositRequired,
            designTask: { create: { deadline: optionalDate(parsed.data.designDeadline)! } },
            createdById: actor.id,
            items: {
              create: preparedItems.map((item, position) => ({
                id: item.itemId,
                position,
                name: item.name,
                productCategoryId: itemCategories[position]?.productCategoryId ?? null,
                garmentType: itemCategories[position]?.garmentType ?? category.garmentType,
                decorationMethods: [...new Set(item.decorationMethods)],
                designNotes: item.designNotes,
              })),
            },
            sizes: { create: rows.sizes },
            rosterEntries: { create: rows.roster },
          },
          select: { id: true },
        });
        await audit(tx, actor, "PurchaseOrder", created.id, "PURCHASE_ORDER_REVISION_CREATED", [
          "revision", "garmentType", "productCategoryId", "productName", "instansi", "pola", "material", "baseColor", "variationColor", "decorationMethods", "orderDate", "sampleSize", "designNotes", "notes", "deadline", "designDeadline", "depositRequired", "items", "sizes", "roster",
        ], { sourcePurchaseOrderId: source.id, fromStatus: source.status });
        return source.opportunityId;
    }, { ...DOCUMENT_DRAFT_TRANSACTION_OPTIONS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    timer.mark("transaction");

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${opportunityId}`);
    timer.mark("revalidate");
    return flashMessagePath(`/crm/peluang/${opportunityId}?tab=po`, "notice", "Draft revisi PO dibuat.");
  });
}

export async function createInvoiceDraftAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  return runFormAction("create-invoice-draft", async () => {
    const timer = documentTimer("create-invoice-draft");
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    timer.mark("auth");
    const parsed = invoiceDraftSchema.safeParse(invoiceInput(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    timer.mark("parse");

    const prisma = getPrismaClient();
    const invoice = await prisma.$transaction(
      async (tx) => {
        const opportunity = await tx.opportunity.findUnique({
          where: { id: parsed.data.opportunityId },
          select: {
            id: true,
            stage: true,
            customer: { select: { name: true, companyName: true, whatsapp: true, email: true, instagram: true, address: true, archivedAt: true } },
            invoices: { where: { status: { in: ["DRAFT", "ISSUED"] } }, select: { id: true, status: true, purchaseOrderId: true } },
            purchaseOrders: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
          },
        });
        if (!opportunity || opportunity.customer.archivedAt) throw new UserFacingError("Peluang aktif tidak ditemukan.");
        if (opportunity.stage !== "NEGOSIASI") throw new UserFacingError("Invoice hanya dapat dibuat saat Negosiasi.");
        if (opportunity.purchaseOrders.length) throw new UserFacingError("Sepakati atau selesaikan draft PO sebelum membuat invoice.");
        if (opportunity.invoices.some((item) => item.status === "DRAFT")) throw new UserFacingError("Peluang ini masih memiliki invoice draft.");
        if (opportunity.invoices.some((item) => item.status === "ISSUED" && item.purchaseOrderId === parsed.data.purchaseOrderId)) {
          throw new UserFacingError("PO ini sudah memiliki invoice terbit dan bersifat final.");
        }

        const purchaseOrder = await tx.purchaseOrder.findFirst({
          where: { id: parsed.data.purchaseOrderId, opportunityId: opportunity.id, status: "AGREED" },
          select: {
            productName: true,
            garmentType: true,
            items: { select: { id: true, name: true, garmentType: true }, orderBy: { position: "asc" } },
            sizes: { select: { id: true, itemId: true, sizeId: true, size: true, sleeveLength: true, quantity: true }, orderBy: { position: "asc" } },
          },
        });
        if (!purchaseOrder) throw new UserFacingError("PO Disepakati tidak ditemukan.");
        const calculated = calculateInvoiceForPurchaseOrder(purchaseOrder, parsed.data.items, parsed.data.discountPercent, parsed.data.taxPercent);
        const business = await tx.businessProfile.findUnique({ where: { id: "default" } });

        const aggregate = await tx.invoice.aggregate({ where: { opportunityId: opportunity.id }, _max: { revision: true } });
        const created = await tx.invoice.create({
          data: {
            invoiceNo: await nextInvoiceNo(tx),
            opportunityId: opportunity.id,
            purchaseOrderId: parsed.data.purchaseOrderId,
            revision: (aggregate._max.revision ?? 0) + 1,
            snapshotCustomerName: opportunity.customer.name,
            snapshotCompanyName: opportunity.customer.companyName,
            snapshotWhatsapp: opportunity.customer.whatsapp,
            snapshotEmail: opportunity.customer.email,
            snapshotInstagram: opportunity.customer.instagram,
            snapshotAddress: opportunity.customer.address,
            snapshotBusinessName: business?.name ?? "AS Konveksi",
            snapshotBusinessPhone: business?.phone,
            snapshotBusinessEmail: business?.email,
            snapshotBusinessAddress: business?.address,
            snapshotBusinessLogoPath: business?.logoPath,
            snapshotSignatureName: business?.signatureName,
            snapshotSignatureTitle: business?.signatureTitle,
            snapshotSignaturePath: business?.signaturePath,
            discountType: calculated.discountPercent.eq(0) ? "NONE" : "PERCENTAGE",
            discountValue: calculated.discountPercent,
            subtotal: calculated.subtotal,
            totalDiscount: calculated.totalDiscount,
            taxPercent: calculated.taxPercent,
            taxAmount: calculated.taxAmount,
            total: calculated.total,
            dueAt: optionalDate(parsed.data.dueAt),
            notes: parsed.data.notes ?? business?.invoiceNotes,
            createdById: actor.id,
            items: { create: calculated.items },
          },
          select: { id: true },
        });
        await audit(tx, actor, "Invoice", created.id, "INVOICE_DRAFT_CREATED", [
          "purchaseOrderId", "items", "addons", "discountType", "discountValue", "subtotal", "totalDiscount", "taxPercent", "taxAmount", "total", "dueAt", "notes",
        ], { opportunityId: opportunity.id });
        return created;
      },
      DOCUMENT_DRAFT_TRANSACTION_OPTIONS,
    );
    timer.mark("transaction");

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    revalidateInvoiceList();
    timer.mark("revalidate");
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}?tab=invoice`, "notice", `Draft invoice ${invoice.id ? "berhasil dibuat" : "dibuat"}.`);
  });
}

export async function updateInvoiceDraftAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  return runFormAction("update-invoice-draft", async () => {
    const timer = documentTimer("update-invoice-draft");
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    timer.mark("auth");
    const parsed = invoiceDraftSchema.safeParse(invoiceInput(formData));
    if (!parsed.success || !parsed.data.invoiceId || !parsed.data.version) {
      throw new UserFacingError(parsed.success ? "Identitas invoice tidak lengkap." : firstValidationMessage(parsed.error));
    }
    timer.mark("parse");
    const invoiceId = parsed.data.invoiceId;
    const prisma = getPrismaClient();
    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { id: parsed.data.purchaseOrderId, opportunityId: parsed.data.opportunityId, status: "AGREED" },
      select: {
        productName: true,
        garmentType: true,
        items: { select: { id: true, name: true, garmentType: true }, orderBy: { position: "asc" } },
        sizes: { select: { id: true, itemId: true, sizeId: true, size: true, sleeveLength: true, quantity: true }, orderBy: { position: "asc" } },
      },
    });
    if (!purchaseOrder) throw new UserFacingError("PO Disepakati tidak ditemukan.");
    const calculated = calculateInvoiceForPurchaseOrder(purchaseOrder, parsed.data.items, parsed.data.discountPercent, parsed.data.taxPercent);
    timer.mark("calculate");

    await prisma.$transaction(
      async (tx) => {
        const updated = await tx.invoice.updateMany({
          where: { id: invoiceId, opportunityId: parsed.data.opportunityId, status: "DRAFT", revision: { lt: 4 }, version: parsed.data.version, purchaseOrder: { is: { id: parsed.data.purchaseOrderId, status: "AGREED" } }, opportunity: { invoices: { none: { status: "ISSUED" } } } },
          data: {
            purchaseOrderId: parsed.data.purchaseOrderId,
            discountType: calculated.discountPercent.eq(0) ? "NONE" : "PERCENTAGE",
            discountValue: calculated.discountPercent,
            subtotal: calculated.subtotal,
            totalDiscount: calculated.totalDiscount,
            taxPercent: calculated.taxPercent,
            taxAmount: calculated.taxAmount,
            total: calculated.total,
            dueAt: optionalDate(parsed.data.dueAt),
            notes: parsed.data.notes,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new UserFacingError("Draft sudah berubah atau tidak lagi dapat diedit.");
        await tx.invoiceItem.deleteMany({ where: { invoiceId } });
        const createdItems = await tx.invoiceItem.createManyAndReturn({
          data: calculated.items.map(({ addons: _addons, ...item }) => ({ ...item, invoiceId })),
          select: { id: true, position: true },
        });
        const itemIdByPosition = new Map(createdItems.map((item) => [item.position, item.id]));
        const addonRows = calculated.items.flatMap((item) => {
          const invoiceItemId = itemIdByPosition.get(item.position);
          if (!invoiceItemId) throw new UserFacingError("Item invoice gagal disimpan. Muat ulang halaman.");
          return item.addons.create.map((addon) => ({ ...addon, invoiceItemId }));
        });
        if (addonRows.length) await tx.invoiceItemAddon.createMany({ data: addonRows });
        await audit(tx, actor, "Invoice", invoiceId, "INVOICE_DRAFT_UPDATED", [
          "purchaseOrderId", "items", "addons", "discountType", "discountValue", "subtotal", "totalDiscount", "taxPercent", "taxAmount", "total", "dueAt", "notes",
        ]);
      },
      DOCUMENT_DRAFT_TRANSACTION_OPTIONS,
    );
    timer.mark("transaction");

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    revalidateInvoiceList();
    timer.mark("revalidate");
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}?tab=invoice`, "notice", "Draft invoice diperbarui.");
  });
}

export async function issueInvoiceAction(formData: FormData) {
  return runRedirectingAction(opportunityTabFallback(formData, "invoice"), async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = invoiceIdSchema.safeParse({ invoiceId: formValue(formData, "invoiceId"), version: formValue(formData, "version") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const issuedInvoice = await getPrismaClient().$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: parsed.data.invoiceId },
        select: {
          opportunityId: true,
          invoiceNo: true,
          revision: true,
          status: true,
          purchaseOrder: { select: { status: true } },
          items: { select: { id: true }, take: 1 },
          opportunity: {
            select: {
              stage: true,
              customerId: true,
              customer: { select: { name: true, companyName: true, whatsapp: true, email: true, instagram: true, address: true } },
              invoices: { where: { status: "ISSUED", id: { not: parsed.data.invoiceId } }, select: { id: true }, take: 1 },
            },
          },
        },
      });
      if (!invoice || invoice.status !== "DRAFT") throw new UserFacingError("Invoice draft tidak ditemukan.");
      if (invoice.opportunity.stage !== "NEGOSIASI") throw new UserFacingError("Invoice hanya dapat diterbitkan saat Negosiasi.");
      if (invoice.purchaseOrder.status !== "AGREED") throw new UserFacingError("PO terkait tidak lagi berstatus Disepakati.");
      if (invoice.opportunity.invoices.length) throw new UserFacingError("Invoice sudah diterbitkan dan bersifat final.");
      if (!invoice.items.length) throw new UserFacingError("Invoice belum memiliki item.");

      const issuedAt = new Date();
      const dueAt = addJakartaDays(issuedAt, 7);
      const business = await tx.businessProfile.findUnique({ where: { id: "default" } });
      const updated = await tx.invoice.updateMany({
        where: { id: parsed.data.invoiceId, status: "DRAFT", version: parsed.data.version },
        data: {
          status: "ISSUED",
          issuedAt,
          dueAt,
          snapshotCustomerName: invoice.opportunity.customer.name,
          snapshotCompanyName: invoice.opportunity.customer.companyName,
          snapshotWhatsapp: invoice.opportunity.customer.whatsapp,
          snapshotEmail: invoice.opportunity.customer.email,
          snapshotInstagram: invoice.opportunity.customer.instagram,
          snapshotAddress: invoice.opportunity.customer.address,
          snapshotBusinessName: business?.name ?? "AS Konveksi",
          snapshotBusinessPhone: business?.phone,
          snapshotBusinessEmail: business?.email,
          snapshotBusinessAddress: business?.address,
          snapshotBusinessLogoPath: business?.logoPath,
          snapshotSignatureName: business?.signatureName,
          snapshotSignatureTitle: business?.signatureTitle,
          snapshotSignaturePath: business?.signaturePath,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new UserFacingError("Invoice sudah berubah. Muat ulang halaman.");
      const auditEvent = await audit(tx, actor, "Invoice", parsed.data.invoiceId, "INVOICE_ISSUED", ["status", "issuedAt", "dueAt", "snapshot"]);
      await addSystemActivity(tx, actor, {
        customerId: invoice.opportunity.customerId,
        opportunityId: invoice.opportunityId,
        systemEvent: "INVOICE_ISSUED",
        content: `Invoice ${invoice.invoiceNo} diterbitkan.`,
        occurredAt: issuedAt,
        metadata: {
          invoiceId: parsed.data.invoiceId,
          invoiceNo: invoice.invoiceNo,
          revision: invoice.revision,
        },
        sourceAuditEventId: auditEvent.id,
      });
      if (actor.role !== "DEVELOPER") await enqueueIssuedInvoiceWhatsAppJob(tx, parsed.data.invoiceId);
      return { opportunityId: invoice.opportunityId, customerId: invoice.opportunity.customerId };
    }, DEAL_TRANSACTION_OPTIONS);

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${issuedInvoice.opportunityId}`);
    revalidatePath(`/customers/${issuedInvoice.customerId}`);
    revalidateInvoiceList();
    return flashMessagePath(`/crm/peluang/${issuedInvoice.opportunityId}?tab=invoice`, "notice", "Invoice diterbitkan, dikunci, dan pengiriman WhatsApp dijadwalkan.");
  });
}

export async function createInvoiceRevisionAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  return runFormAction("create-invoice-revision", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const sourceInvoiceId = entityIdSchema.safeParse(formValue(formData, "sourceInvoiceId"));
    if (!sourceInvoiceId.success) throw new UserFacingError(firstValidationMessage(sourceInvoiceId.error));
    const parsed = invoiceDraftSchema.safeParse(invoiceInput(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const opportunityId = await getPrismaClient().$transaction(
      async (tx) => {
        const source = await tx.invoice.findUnique({
          where: { id: sourceInvoiceId.data },
          select: {
            id: true,
            opportunityId: true,
            purchaseOrderId: true,
            status: true,
            revision: true,
            version: true,
            snapshotCustomerName: true,
            snapshotCompanyName: true,
            snapshotWhatsapp: true,
            snapshotEmail: true,
            snapshotInstagram: true,
            snapshotAddress: true,
            snapshotBusinessName: true,
            snapshotBusinessPhone: true,
            snapshotBusinessEmail: true,
            snapshotBusinessAddress: true,
            snapshotBusinessLogoPath: true,
            discountType: true,
            discountValue: true,
            subtotal: true,
            totalDiscount: true,
            total: true,
            dueAt: true,
            notes: true,
            opportunity: {
              select: {
                stage: true,
                purchaseOrders: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
                invoices: { where: { status: "ISSUED" }, select: { id: true }, take: 1 },
              },
            },
            purchaseOrder: {
              select: {
                status: true,
                productName: true,
                garmentType: true,
                items: { select: { id: true, name: true, garmentType: true }, orderBy: { position: "asc" } },
                sizes: { select: { id: true, itemId: true, sizeId: true, size: true, sleeveLength: true, quantity: true }, orderBy: { position: "asc" } },
              },
            },
          },
        });
        if (!source || source.status !== "DRAFT") {
          throw new UserFacingError("Revisi hanya dapat dibuat dari draft invoice aktif.");
        }
        if (source.revision >= 4) throw new UserFacingError("Batas maksimal 3 kali revisi invoice sudah tercapai.");
        if (source.opportunityId !== parsed.data.opportunityId || source.purchaseOrderId !== parsed.data.purchaseOrderId) {
          throw new UserFacingError("Invoice sumber tidak sesuai dengan peluang atau PO aktif.");
        }
        if (source.opportunity.invoices.length) throw new UserFacingError("Invoice sudah diterbitkan dan bersifat final.");
        if (source.opportunity.stage !== "NEGOSIASI" || source.purchaseOrder.status !== "AGREED") {
          throw new UserFacingError("Revisi invoice hanya dapat dibuat dari PO aktif saat Negosiasi.");
        }
        if (source.opportunity.purchaseOrders.length) throw new UserFacingError("Sepakati atau selesaikan draft PO sebelum merevisi invoice.");
        const calculated = calculateInvoiceForPurchaseOrder(source.purchaseOrder, parsed.data.items, parsed.data.discountPercent, parsed.data.taxPercent);
        const locked = await tx.invoice.updateMany({
          where: { id: source.id, status: "DRAFT", revision: source.revision, version: source.version },
          data: { status: "SUPERSEDED", version: { increment: 1 } },
        });
        if (locked.count !== 1) throw new UserFacingError("Draft invoice sudah berubah. Muat ulang halaman.");
        const created = await tx.invoice.create({
          data: {
            invoiceNo: await nextInvoiceNo(tx),
            opportunityId: source.opportunityId,
            purchaseOrderId: source.purchaseOrderId,
            revision: source.revision + 1,
            snapshotCustomerName: source.snapshotCustomerName,
            snapshotCompanyName: source.snapshotCompanyName,
            snapshotWhatsapp: source.snapshotWhatsapp,
            snapshotEmail: source.snapshotEmail,
            snapshotInstagram: source.snapshotInstagram,
            snapshotAddress: source.snapshotAddress,
            snapshotBusinessName: source.snapshotBusinessName,
            snapshotBusinessPhone: source.snapshotBusinessPhone,
            snapshotBusinessEmail: source.snapshotBusinessEmail,
            snapshotBusinessAddress: source.snapshotBusinessAddress,
            snapshotBusinessLogoPath: source.snapshotBusinessLogoPath,
            discountType: calculated.discountPercent.eq(0) ? "NONE" : "PERCENTAGE",
            discountValue: calculated.discountPercent,
            subtotal: calculated.subtotal,
            totalDiscount: calculated.totalDiscount,
            taxPercent: calculated.taxPercent,
            taxAmount: calculated.taxAmount,
            total: calculated.total,
            dueAt: optionalDate(parsed.data.dueAt),
            notes: parsed.data.notes,
            createdById: actor.id,
            items: { create: calculated.items },
          },
          select: { id: true },
        });
        await audit(tx, actor, "Invoice", created.id, "INVOICE_REVISION_CREATED", [
          "revision", "purchaseOrderId", "items", "addons", "discountType", "discountValue", "subtotal", "totalDiscount", "taxPercent", "taxAmount", "total", "dueAt", "notes",
        ], { sourceInvoiceId: source.id });
        return source.opportunityId;
      },
      DEAL_TRANSACTION_OPTIONS,
    );

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${opportunityId}`);
    revalidateInvoiceList();
    return flashMessagePath(`/crm/peluang/${opportunityId}?tab=invoice`, "notice", "Draft revisi invoice dibuat.");
  });
}

export async function completeDealAction(formData: FormData) {
  const fallbackOpportunityId = entityIdSchema.safeParse(formValue(formData, "opportunityId"));
  const fallbackPath = fallbackOpportunityId.success ? `/crm/peluang/${fallbackOpportunityId.data}?tab=deal` : "/crm";
  return runRedirectingAction(fallbackPath, async () => {
    const actor = await requireActor(DEAL_ROLES);
    const parsed = completeDealSchema.safeParse(completeDealInput(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const invoice = await runDealTransaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: parsed.data.invoiceId },
        select: {
          id: true, total: true, status: true, version: true, opportunityId: true, purchaseOrderId: true, issuedAt: true, dueAt: true,
          salesOrder: { select: { id: true } }, pendingPayment: { select: { id: true } },
          purchaseOrder: { select: { status: true, garmentType: true, deadline: true, deposit: { select: { amount: true } } } },
          opportunity: { select: { stage: true, version: true, purchaseOrders: { where: { status: "DRAFT" }, select: { id: true }, take: 1 }, invoices: { where: { status: "DRAFT" }, select: { id: true }, take: 1 } } },
        },
      });
      if (!invoice || invoice.status !== "ISSUED") throw new UserFacingError("Invoice tidak lagi berstatus terbit.");
      if (invoice.purchaseOrderId !== parsed.data.purchaseOrderId || invoice.purchaseOrder.status !== "AGREED" || !invoice.purchaseOrder.garmentType || !invoice.purchaseOrder.deadline) throw new UserFacingError("PO Disepakati belum lengkap.");
      if (invoice.opportunity.stage !== "NEGOSIASI" || invoice.opportunity.purchaseOrders.length || invoice.opportunity.invoices.length) throw new UserFacingError("Peluang belum siap untuk dijadwalkan.");
      if (invoice.opportunity.version !== parsed.data.opportunityVersion || invoice.version !== parsed.data.invoiceVersion) throw new UserFacingError("Peluang atau invoice sudah berubah. Muat ulang halaman.");
      if (invoice.salesOrder || invoice.pendingPayment) throw new UserFacingError("Jadwal pembayaran invoice ini sudah tersedia.");
      if (!invoice.issuedAt) throw new UserFacingError("Tanggal terbit invoice tidak tersedia.");

      const roundedTotal = invoice.total;
      // Deposit desain yang sudah dibayar dikurangkan dari sisa yang perlu dijadwalkan.
      const depositAmount = invoice.purchaseOrder.deposit?.amount ?? new Prisma.Decimal(0);
      const collectibleTotal = roundedTotal.sub(depositAmount);
      if (collectibleTotal.lte(0)) throw new UserFacingError("Deposit sudah menutup seluruh total invoice. Sesuaikan nominal deposit pada PO terlebih dahulu.");
      const requestedInitial = new Prisma.Decimal(parsed.data.initialValue);
      const requestedType = parsed.data.kind === "DEPOSIT" ? ("NOMINAL" as const) : parsed.data.initialValueType;
      if (parsed.data.kind === "DP" && parsed.data.initialValueType === "PERCENTAGE" && requestedInitial.lt(50)) throw new UserFacingError("DP minimal 50%.");
      if (parsed.data.initialValueType === "PERCENTAGE" && requestedInitial.gt(100)) throw new UserFacingError("Persentase pembayaran maksimal 100%.");
      const kind = parsed.data.kind === "LUNAS" || (parsed.data.initialValueType === "PERCENTAGE" && requestedInitial.eq(100)) ? "LUNAS" as const : parsed.data.kind;
      if (kind === "DP" && parsed.data.terms.length === 0) throw new UserFacingError("DP wajib memiliki minimal satu termin.");
      if (kind === "DEPOSIT" && parsed.data.terms.length === 0) throw new UserFacingError("Deposit wajib memiliki minimal satu termin sisa.");
      if (kind === "LUNAS" && parsed.data.terms.length) throw new UserFacingError("Pembayaran Lunas tidak memakai termin.");
      const initialDueAt = invoice.dueAt ?? addJakartaDays(invoice.issuedAt, 7);

      const amountFor = (valueType: "NOMINAL" | "PERCENTAGE", value: string) => {
        const decimal = new Prisma.Decimal(value);
        if (valueType === "PERCENTAGE" && decimal.gt(100)) throw new UserFacingError("Persentase pembayaran maksimal 100%.");
        return valueType === "PERCENTAGE" ? roundInvoiceTotal(collectibleTotal.mul(decimal).div(100)) : decimal;
      };
      const initialValueType = kind === "LUNAS" ? ("PERCENTAGE" as const) : requestedType;
      const initialValue = kind === "LUNAS" ? new Prisma.Decimal(100) : requestedInitial;
      const initialAmount = amountFor(initialValueType, initialValue.toString());
      if (initialAmount.lte(0) || initialAmount.gt(collectibleTotal)) throw new UserFacingError("Nilai pembayaran awal tidak valid.");

      let previousDueAt: Date | null = initialDueAt;
      const terms = parsed.data.terms.map((term, position) => {
        const dueAt = optionalDate(term.dueAt);
        if (!dueAt) throw new UserFacingError("Deadline termin wajib diisi.");
        if (previousDueAt && dueAt <= previousDueAt) throw new UserFacingError(`Deadline Termin ${position + 1} minimal satu hari setelah ${position ? `Deadline Termin ${position}.` : "deadline DP."}`);
        previousDueAt = dueAt;
        return { position, valueType: term.valueType, value: new Prisma.Decimal(term.value), amount: amountFor(term.valueType, term.value), dueAt };
      });
      const outstandingAmount = collectibleTotal.sub(initialAmount);
      const termTotal = terms.reduce((sum, term) => sum.add(term.amount), new Prisma.Decimal(0));
      if (!termTotal.eq(outstandingAmount)) throw new UserFacingError(depositAmount.gt(0) ? "Total seluruh termin harus sama dengan sisa setelah pembayaran awal dan deposit." : "Total seluruh termin harus sama dengan sisa setelah pembayaran awal.");

      await tx.pendingDealPayment.create({ data: { invoiceId: invoice.id, kind, initialValueType, initialValue, initialAmount, initialDueAt, createdById: actor.id, terms: { create: terms } } });
      await audit(tx, actor, "Invoice", invoice.id, "PAYMENT_SCHEDULED", ["paymentSchedule"], { kind, initialDueAt, terms: terms.length });
      return invoice;
    });

    revalidatePath("/crm");
    revalidateInvoiceList();
    revalidatePath(`/crm/peluang/${invoice.opportunityId}`);
    return flashMessagePath(`/crm/peluang/${invoice.opportunityId}?tab=invoice`, "notice", "Jadwal pembayaran tersimpan. Catat pembayaran awal di Detail Invoice untuk membuat Sales Order dan Work Order.");
  });
}

function crmActionSuccess(): CrmActionState {
  return { error: null, success: true };
}

function crmActionFailure(error: unknown): CrmActionState {
  return { error: messageForError(error), success: false };
}

/**
 * Tabel CRM > Invoice membaca data dari `unstable_cache` bertag "invoices" (30 detik).
 * `revalidatePath` saja tidak mengosongkan cache itu, sehingga baris tabel (mis. status
 * pembayaran) bisa tampak tertinggal setelah aksi; tag dikosongkan bersamaan agar
 * auto-refresh halaman langsung menampilkan data segar.
 */
function revalidateInvoiceList() {
  revalidatePath("/crm/invoices");
  revalidateTag("invoices", { expire: 0 });
}

function revalidatePaymentMutationPaths(salesOrderId?: string) {
  if (salesOrderId) revalidatePath(`/sales-orders/${salesOrderId}`);
  revalidatePath("/crm");
  revalidatePath("/crm/prospek");
  revalidatePath("/dashboard");
  revalidatePath("/keuangan");
  revalidatePath("/produksi");
  revalidateInvoiceList();
}

async function paymentProof(formData: FormData, actorId: string, paymentMethodId: string, hasExistingProof = false) {
  const method = await getPrismaClient().paymentMethod.findFirst({ where: { id: paymentMethodId, isActive: true }, select: { name: true } });
  if (!method) throw new UserFacingError("Metode pembayaran tidak tersedia.");
  const proof = await uploadPaymentProof(formData.get("proof"), actorId);
  if (proofRequired(method.name) && !proof && !hasExistingProof) throw new UserFacingError(`Bukti pembayaran wajib untuk metode ${method.name}.`);
  return proof;
}

async function createSalesOrderFromPendingPayment(formData: FormData) {
  const actor = await requireActor(DEAL_ROLES);
  const parsed = payPendingInitialPaymentSchema.safeParse({
    invoiceId: formValue(formData, "invoiceId"),
    paymentMethodId: formValue(formData, "paymentMethodId"),
    paidAt: formValue(formData, "paidAt"),
    reference: formValue(formData, "reference"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
  const proof = await paymentProof(formData, actor.id, parsed.data.paymentMethodId);
  const paidAt = parsed.data.paidAt ? jakartaDateTime(parsed.data.paidAt) ?? new Date() : new Date();
  if (paidAt.getTime() > Date.now() + 5 * 60 * 1000) throw new UserFacingError("Tanggal pembayaran tidak boleh maju ke masa depan.");

  return runDealTransaction(async (tx) => {
    if (!await tx.paymentMethod.findFirst({ where: { id: parsed.data.paymentMethodId, isActive: true }, select: { id: true } })) throw new UserFacingError("Metode pembayaran tidak tersedia.");
    const invoice = await tx.invoice.findUnique({
      where: { id: parsed.data.invoiceId },
      select: {
        id: true,
        invoiceNo: true,
        purchaseOrderId: true,
        status: true,
        opportunityId: true,
        snapshotCustomerName: true,
        snapshotCompanyName: true,
        snapshotWhatsapp: true,
        snapshotEmail: true,
        snapshotInstagram: true,
        snapshotAddress: true,
        discountType: true,
        discountValue: true,
        subtotal: true,
        totalDiscount: true,
        taxPercent: true,
        taxAmount: true,
        total: true,
        salesOrder: { select: { id: true } },
        purchaseOrder: { select: { purchaseOrderNo: true, status: true, garmentType: true, deadline: true, deposit: { select: { amount: true } } } },
        items: {
          select: {
            position: true, productName: true, size: true, sleeveLength: true, description: true, quantity: true,
            unitPrice: true, grossAmount: true, discountPercent: true, discountCapAmount: true,
            discountAmount: true, total: true, subtotal: true,
          },
          orderBy: { position: "asc" },
        },
        pendingPayment: {
          select: {
            id: true,
            kind: true,
            initialValueType: true,
            initialValue: true,
            initialAmount: true,
            terms: { select: { id: true, position: true, valueType: true, value: true, amount: true, dueAt: true }, orderBy: { position: "asc" } },
          },
        },
        opportunity: {
          select: {
            stage: true,
            customerId: true,
            customer: { select: { lifecycle: true } },
            purchaseOrders: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
            invoices: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
          },
        },
      },
    });
    if (!invoice || invoice.status !== "ISSUED") throw new UserFacingError("Invoice tidak lagi berstatus terbit.");
    if (!invoice.pendingPayment) throw new UserFacingError("Jadwal pembayaran invoice tidak ditemukan.");
    if (invoice.purchaseOrder.status !== "AGREED") throw new UserFacingError("Invoice tidak terhubung ke PO Disepakati.");
    if (!invoice.purchaseOrder.garmentType) throw new UserFacingError("Jenis pakaian pada PO final belum ditentukan.");
    if (!invoice.purchaseOrder.deadline) throw new UserFacingError("Deadline produksi pada PO final belum ditentukan.");
    if (invoice.opportunity.stage !== "NEGOSIASI") throw new UserFacingError("Peluang tidak lagi berada di Negosiasi.");
    if (invoice.opportunity.purchaseOrders.length || invoice.opportunity.invoices.length) throw new UserFacingError("Selesaikan seluruh draft PO dan invoice sebelum Deal.");
    if (invoice.salesOrder) throw new UserFacingError("Invoice ini sudah memiliki Sales Order.");

    const activeOrder = await tx.salesOrder.findFirst({ where: { opportunityId: invoice.opportunityId, status: "ACTIVE" }, select: { id: true } });
    if (activeOrder) throw new UserFacingError("Peluang ini sudah memiliki Sales Order aktif.");

    const depositAmount = invoice.purchaseOrder.deposit?.amount ?? new Prisma.Decimal(0);
    const scheduledTotal = invoice.pendingPayment.terms.reduce((sum, term) => sum.add(term.amount), invoice.pendingPayment.initialAmount);
    if (!scheduledTotal.eq(invoice.total.sub(depositAmount))) throw new UserFacingError("Jadwal pembayaran tidak sama dengan sisa setelah deposit.");
    // Deposit desain menyatu ke pembayaran awal supaya sisa tagihan Sales Order langsung berkurang.
    const initialAmount = invoice.pendingPayment.initialAmount.add(depositAmount);
    const outstandingAmount = invoice.total.sub(initialAmount);

    const opportunityUpdated = await tx.opportunity.updateMany({
      where: { id: invoice.opportunityId, stage: "NEGOSIASI" },
      data: { stage: "DEAL", nextAction: null, nextActionAt: null, cancelReason: null, version: { increment: 1 } },
    });
    if (opportunityUpdated.count !== 1) throw new UserFacingError("Peluang sudah berubah. Muat ulang halaman.");
    if (invoice.opportunity.customer.lifecycle === "PROSPEK") {
      await tx.customer.update({ where: { id: invoice.opportunity.customerId }, data: { lifecycle: "CUSTOMER" } });
    }

    const created = await tx.salesOrder.create({
      data: {
        salesOrderNo: await nextSalesOrderNo(tx),
        opportunityId: invoice.opportunityId,
        purchaseOrderId: invoice.purchaseOrderId,
        invoiceId: invoice.id,
        purchaseOrderNo: invoice.purchaseOrder.purchaseOrderNo,
        invoiceNo: invoice.invoiceNo,
        snapshotCustomerName: invoice.snapshotCustomerName,
        snapshotCompanyName: invoice.snapshotCompanyName,
        snapshotWhatsapp: invoice.snapshotWhatsapp,
        snapshotEmail: invoice.snapshotEmail,
        snapshotInstagram: invoice.snapshotInstagram,
        snapshotAddress: invoice.snapshotAddress,
        discountType: invoice.discountType,
        discountValue: invoice.discountValue,
        subtotal: invoice.subtotal,
        totalDiscount: invoice.totalDiscount,
        taxPercent: invoice.taxPercent,
        taxAmount: invoice.taxAmount,
        total: invoice.total,
        acceptedAt: paidAt,
        createdById: actor.id,
        items: { create: invoice.items },
        cost: { create: {} },
        payment: {
          create: {
            kind: invoice.pendingPayment.kind,
            paidAt,
            initialValueType: invoice.pendingPayment.initialValueType,
            initialValue: invoice.pendingPayment.initialValue,
            initialAmount,
            outstandingAmount,
            createdById: actor.id,
            terms: { create: invoice.pendingPayment.terms.map(({ position, valueType, value, amount, dueAt }) => ({ position, valueType, value, amount, dueAt })) },
            transactions: {
              create: {
                amount: initialAmount,
                paidAt,
                paymentMethodId: parsed.data.paymentMethodId,
                reference: parsed.data.reference,
                note: depositAmount.gt(0) ? [parsed.data.note, "Termasuk deposit desain"].filter(Boolean).join(" · ") : parsed.data.note,
                ...(proof ?? {}),
                createdById: actor.id,
              },
            },
          },
        },
      },
      select: { id: true, salesOrderNo: true },
    });
    const initialTransaction = await tx.paymentTransaction.findFirstOrThrow({
      where: { payment: { salesOrderId: created.id }, paymentTermId: null, status: "ACTIVE" },
      select: { id: true },
    });

    await tx.pendingPaymentTerm.deleteMany({ where: { pendingPaymentId: invoice.pendingPayment.id } });
    await tx.pendingDealPayment.delete({ where: { id: invoice.pendingPayment.id } });
    await ensureProductionWorkOrder(tx, actor, created.id);

    const salesOrderAudit = await audit(tx, actor, "SalesOrder", created.id, "SALES_ORDER_CREATED", ["status", "snapshot", "items", "total", "payment", "terms"], {
      opportunityId: invoice.opportunityId,
      purchaseOrderId: invoice.purchaseOrderId,
      invoiceId: invoice.id,
      paymentKind: invoice.pendingPayment.kind,
    });
    await audit(tx, actor, "PaymentTransaction", initialTransaction.id, "PAYMENT_RECORDED", ["amount", "paidAt", "paymentMethodId", "reference", "note"], {
      salesOrderId: created.id,
      paymentKind: "INITIAL",
    });
    await audit(tx, actor, "Opportunity", invoice.opportunityId, "OPPORTUNITY_STAGE_CHANGED", ["stage"], { from: invoice.opportunity.stage, to: "DEAL" });
    await addSystemActivity(tx, actor, {
      customerId: invoice.opportunity.customerId,
      opportunityId: invoice.opportunityId,
      systemEvent: "DEAL_ORDER_CREATED",
      content: `Customer deal dan Sales Order ${created.salesOrderNo} terbentuk.`,
      occurredAt: paidAt,
      metadata: {
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        purchaseOrderId: invoice.purchaseOrderId,
        purchaseOrderNo: invoice.purchaseOrder.purchaseOrderNo,
        salesOrderId: created.id,
        salesOrderNo: created.salesOrderNo,
        paymentKind: invoice.pendingPayment.kind,
      },
      sourceAuditEventId: salesOrderAudit.id,
    });
    await scheduleCustomerReminders(tx, {
      customerId: invoice.opportunity.customerId,
      sourceSalesOrderId: created.id,
      acceptedAt: paidAt,
    });

    return {
      id: created.id,
      customerId: invoice.opportunity.customerId,
      opportunityId: invoice.opportunityId,
    };
  });
}

async function recordPaymentTerm(formData: FormData, paidAt: Date) {
  const actor = await requireActor(DEAL_ROLES);
  const parsed = payInvoicePaymentTermSchema.safeParse({
    salesOrderId: formValue(formData, "salesOrderId"),
    paymentTermId: formValue(formData, "paymentTermId"),
    paymentMethodId: formValue(formData, "paymentMethodId"),
    paidAt: formValue(formData, "paidAt"),
  });
  if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
  const resolvedPaidAt = parsed.data.paidAt ? jakartaDateTime(parsed.data.paidAt) ?? paidAt : paidAt;
  if (resolvedPaidAt.getTime() > Date.now() + 5 * 60 * 1000) throw new UserFacingError("Tanggal pembayaran tidak boleh maju ke masa depan.");
  const proof = await paymentProof(formData, actor.id, parsed.data.paymentMethodId);
  const reference = typeof formValue(formData, "reference") === "string" ? String(formValue(formData, "reference")).trim() || null : null;
  const note = typeof formValue(formData, "note") === "string" ? String(formValue(formData, "note")).trim() || null : null;

  await runDealTransaction(async (tx) => {
    if (!await tx.paymentMethod.findFirst({ where: { id: parsed.data.paymentMethodId, isActive: true }, select: { id: true } })) throw new UserFacingError("Metode pembayaran tidak tersedia.");
    const term = await tx.paymentTerm.findFirst({
      where: { id: parsed.data.paymentTermId, payment: { salesOrderId: parsed.data.salesOrderId, salesOrder: { status: "ACTIVE" } } },
      select: {
        id: true,
        amount: true,
        paymentId: true,
        transactions: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
      },
    });
    if (!term) throw new UserFacingError("Termin pembayaran tidak ditemukan.");
    if (term.transactions.length) throw new UserFacingError("Termin ini sudah dibayar.");
    const transaction = await tx.paymentTransaction.create({
      data: {
        paymentId: term.paymentId,
        paymentTermId: term.id,
        paymentMethodId: parsed.data.paymentMethodId,
        amount: term.amount,
        paidAt: resolvedPaidAt,
        reference,
        note,
        ...(proof ?? {}),
        createdById: actor.id,
      },
      select: { id: true },
    });
    const totals = await tx.paymentTransaction.aggregate({
      where: { paymentId: term.paymentId, status: "ACTIVE" },
      _sum: { amount: true },
    });
    const payment = await tx.dealPayment.findUniqueOrThrow({ where: { id: term.paymentId }, select: { salesOrder: { select: { total: true } } } });
    await tx.dealPayment.update({
      where: { id: term.paymentId },
      data: { outstandingAmount: Prisma.Decimal.max(payment.salesOrder.total.sub(totals._sum.amount ?? 0), 0) },
    });
    await ensureProductionWorkOrder(tx, actor, parsed.data.salesOrderId);
    await audit(tx, actor, "PaymentTransaction", transaction.id, "PAYMENT_RECORDED", ["amount", "paidAt", "paymentMethodId", "reference", "note"], {
      salesOrderId: parsed.data.salesOrderId,
      paymentTermId: term.id,
    });
  });

  revalidatePaymentMutationPaths(parsed.data.salesOrderId);
}

async function editPaymentTransaction(formData: FormData) {
  const actor = await requireActor(DEAL_ROLES);
  const parsed = editPaymentTransactionSchema.safeParse({
    salesOrderId: formValue(formData, "salesOrderId"),
    transactionId: formValue(formData, "transactionId"),
    version: formValue(formData, "version"),
    paymentMethodId: formValue(formData, "paymentMethodId"),
    amount: formValue(formData, "amount"),
    paidAt: formValue(formData, "paidAt"),
    reference: formValue(formData, "reference"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
  const existingProof = await getPrismaClient().paymentTransaction.findFirst({ where: { id: parsed.data.transactionId, status: "ACTIVE", payment: { salesOrderId: parsed.data.salesOrderId } }, select: { proofPath: true } });
  const proof = await paymentProof(formData, actor.id, parsed.data.paymentMethodId, Boolean(existingProof?.proofPath));
  const paidAt = jakartaDateTime(parsed.data.paidAt);
  if (!paidAt || paidAt.getTime() > Date.now() + 5 * 60 * 1000) throw new UserFacingError("Tanggal pembayaran tidak valid.");
  const amount = new Prisma.Decimal(parsed.data.amount);

  await runDealTransaction(async (tx) => {
    const transaction = await tx.paymentTransaction.findFirst({
      where: { id: parsed.data.transactionId, status: "ACTIVE", payment: { salesOrderId: parsed.data.salesOrderId, salesOrder: { status: "ACTIVE" } } },
      select: { id: true, paymentId: true, version: true, amount: true, paidAt: true },
    });
    if (!transaction) throw new UserFacingError("Pembayaran aktif tidak ditemukan.");
    if (transaction.version !== parsed.data.version) throw new UserFacingError("Pembayaran sudah berubah. Muat ulang halaman.");
    const otherPayments = await tx.paymentTransaction.aggregate({
      where: { paymentId: transaction.paymentId, status: "ACTIVE", id: { not: transaction.id } },
      _sum: { amount: true },
    });
    const payment = await tx.dealPayment.findUniqueOrThrow({ where: { id: transaction.paymentId }, select: { salesOrder: { select: { total: true } } } });
    const newTotal = (otherPayments._sum.amount ?? new Prisma.Decimal(0)).add(amount);
    if (amount.lte(0) || newTotal.gt(payment.salesOrder.total)) throw new UserFacingError("Nominal harus positif dan total pembayaran tidak boleh melebihi invoice.");
    const updated = await tx.paymentTransaction.updateMany({
      where: { id: transaction.id, status: "ACTIVE", version: transaction.version },
      data: {
        amount,
        paidAt,
        paymentMethodId: parsed.data.paymentMethodId,
        reference: parsed.data.reference,
        note: parsed.data.note,
        ...(proof ?? {}),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new UserFacingError("Pembayaran sudah berubah. Muat ulang halaman.");
    await tx.dealPayment.update({ where: { id: transaction.paymentId }, data: { outstandingAmount: payment.salesOrder.total.sub(newTotal) } });
    await audit(tx, actor, "PaymentTransaction", transaction.id, "PAYMENT_UPDATED", ["amount", "paidAt", "paymentMethodId", "reference", "note", "version"], {
      salesOrderId: parsed.data.salesOrderId,
      previousAmount: transaction.amount.toString(),
      amount: amount.toString(),
      previousPaidAt: transaction.paidAt.toISOString(),
      paidAt: paidAt.toISOString(),
    });
  });

  revalidatePaymentMutationPaths(parsed.data.salesOrderId);
}

async function voidPaymentTransaction(formData: FormData) {
  const actor = await requireActor(DEAL_ROLES);
  const parsed = voidPaymentTransactionSchema.safeParse({
    salesOrderId: formValue(formData, "salesOrderId"),
    transactionId: formValue(formData, "transactionId"),
    reason: formValue(formData, "reason"),
  });
  if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

  await getPrismaClient().$transaction(async (tx) => {
    const transaction = await tx.paymentTransaction.findFirst({
      where: { id: parsed.data.transactionId, status: "ACTIVE", payment: { salesOrderId: parsed.data.salesOrderId, salesOrder: { status: "ACTIVE" } } },
      select: { id: true, paymentId: true },
    });
    if (!transaction) throw new UserFacingError("Pembayaran aktif tidak ditemukan.");
    const updated = await tx.paymentTransaction.updateMany({
      where: { id: transaction.id, status: "ACTIVE" },
      data: { status: "VOIDED", voidedAt: new Date(), voidReason: parsed.data.reason, voidedById: actor.id },
    });
    if (updated.count !== 1) throw new UserFacingError("Pembayaran sudah berubah. Muat ulang halaman.");
    const totals = await tx.paymentTransaction.aggregate({
      where: { paymentId: transaction.paymentId, status: "ACTIVE" },
      _sum: { amount: true },
    });
    const payment = await tx.dealPayment.findUniqueOrThrow({ where: { id: transaction.paymentId }, select: { salesOrder: { select: { total: true } } } });
    await tx.dealPayment.update({
      where: { id: transaction.paymentId },
      data: { outstandingAmount: Prisma.Decimal.max(payment.salesOrder.total.sub(totals._sum.amount ?? 0), 0) },
    });
    await audit(tx, actor, "PaymentTransaction", transaction.id, "PAYMENT_VOIDED", ["status", "voidedAt", "voidReason", "voidedById"], {
      salesOrderId: parsed.data.salesOrderId,
    });
  }, DEAL_TRANSACTION_OPTIONS);

  revalidatePaymentMutationPaths(parsed.data.salesOrderId);
}

export async function payPendingInitialPaymentAction(_prevState: CrmActionState, formData: FormData): Promise<CrmActionState> {
  try {
    const salesOrder = await createSalesOrderFromPendingPayment(formData);
    revalidatePaymentMutationPaths(salesOrder.id);
    revalidatePath("/crm/invoices");
    revalidatePath(`/crm/peluang/${salesOrder.opportunityId}`);
    revalidatePath(`/customers/${salesOrder.customerId}`);
    revalidateCustomerReminders();
    return crmActionSuccess();
  } catch (error) {
    return crmActionFailure(error);
  }
}

export async function payInvoicePaymentTermAction(_prevState: CrmActionState, formData: FormData): Promise<CrmActionState> {
  try {
    await recordPaymentTerm(formData, new Date());
    return crmActionSuccess();
  } catch (error) {
    return crmActionFailure(error);
  }
}

export async function editInvoicePaymentTransactionAction(_prevState: CrmActionState, formData: FormData): Promise<CrmActionState> {
  try {
    await editPaymentTransaction(formData);
    return crmActionSuccess();
  } catch (error) {
    return crmActionFailure(error);
  }
}

export async function voidInvoicePaymentTransactionAction(_prevState: CrmActionState, formData: FormData): Promise<CrmActionState> {
  try {
    await voidPaymentTransaction(formData);
    return crmActionSuccess();
  } catch (error) {
    return crmActionFailure(error);
  }
}

export async function payPaymentTermAction(formData: FormData) {
  const fallbackId = typeof formData.get("salesOrderId") === "string" ? String(formData.get("salesOrderId")) : "";
  return runRedirectingAction(fallbackId ? `/sales-orders/${fallbackId}` : "/crm", async () => {
    const parsed = payPaymentTermSchema.safeParse({
      salesOrderId: formValue(formData, "salesOrderId"),
      paymentTermId: formValue(formData, "paymentTermId"),
      paymentMethodId: formValue(formData, "paymentMethodId"),
      paidAt: formValue(formData, "paidAt"),
      reference: formValue(formData, "reference"),
      note: formValue(formData, "note"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const paidAt = jakartaDateTime(parsed.data.paidAt);
    if (!paidAt || paidAt.getTime() > Date.now() + 5 * 60 * 1000) throw new UserFacingError("Tanggal pembayaran tidak valid.");
    const normalized = new FormData();
    normalized.set("salesOrderId", parsed.data.salesOrderId);
    normalized.set("paymentTermId", parsed.data.paymentTermId);
    normalized.set("paymentMethodId", parsed.data.paymentMethodId);
    if (parsed.data.reference) normalized.set("reference", parsed.data.reference);
    if (parsed.data.note) normalized.set("note", parsed.data.note);
    const proof = formData.get("proof"); if (proof instanceof File && proof.size) normalized.set("proof", proof);
    await recordPaymentTerm(normalized, paidAt);

    return flashMessagePath(`/sales-orders/${parsed.data.salesOrderId}`, "notice", "Pembayaran termin berhasil dicatat.");
  });
}

export async function recordInitialPaymentAction(formData: FormData) {
  const fallbackId = typeof formData.get("salesOrderId") === "string" ? String(formData.get("salesOrderId")) : "";
  return runRedirectingAction(fallbackId ? `/sales-orders/${fallbackId}` : "/crm", async () => {
    const actor = await requireActor(DEAL_ROLES);
    const parsed = recordInitialPaymentSchema.safeParse({
      salesOrderId: formValue(formData, "salesOrderId"),
      paymentMethodId: formValue(formData, "paymentMethodId"),
      paidAt: formValue(formData, "paidAt"),
      reference: formValue(formData, "reference"),
      note: formValue(formData, "note"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const paidAt = jakartaDateTime(parsed.data.paidAt);
    if (!paidAt || paidAt.getTime() > Date.now() + 5 * 60 * 1000) throw new UserFacingError("Tanggal pembayaran tidak valid.");
    const proof = await paymentProof(formData, actor.id, parsed.data.paymentMethodId);

    await runDealTransaction(async (tx) => {
      const payment = await tx.dealPayment.findFirst({
        where: { salesOrderId: parsed.data.salesOrderId, salesOrder: { status: "ACTIVE" } },
        select: {
          id: true,
          initialAmount: true,
          salesOrder: { select: { total: true } },
          transactions: { where: { paymentTermId: null, status: "ACTIVE" }, select: { id: true }, take: 1 },
        },
      });
      if (!payment) throw new UserFacingError("Pembayaran Sales Order aktif tidak ditemukan.");
      if (payment.transactions.length) throw new UserFacingError("Pembayaran awal sudah tercatat aktif.");
      const transaction = await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          amount: payment.initialAmount,
          paidAt,
          paymentMethodId: parsed.data.paymentMethodId,
          reference: parsed.data.reference,
          note: parsed.data.note,
          ...(proof ?? {}),
          createdById: actor.id,
        },
        select: { id: true },
      });
      const totals = await tx.paymentTransaction.aggregate({
        where: { paymentId: payment.id, status: "ACTIVE" },
        _sum: { amount: true },
      });
      await tx.dealPayment.update({
        where: { id: payment.id },
        data: { outstandingAmount: Prisma.Decimal.max(payment.salesOrder.total.sub(totals._sum.amount ?? 0), 0) },
      });
      await ensureProductionWorkOrder(tx, actor, parsed.data.salesOrderId);
      await audit(tx, actor, "PaymentTransaction", transaction.id, "PAYMENT_RECORDED", ["amount", "paidAt", "paymentMethodId", "reference", "note"], {
        salesOrderId: parsed.data.salesOrderId,
        paymentKind: "INITIAL",
      });
    });

    revalidatePath(`/sales-orders/${parsed.data.salesOrderId}`);
    revalidatePath("/dashboard");
    revalidatePath("/keuangan");
    revalidatePath("/produksi");
    revalidateInvoiceList();
    return flashMessagePath(`/sales-orders/${parsed.data.salesOrderId}`, "notice", "Pembayaran awal berhasil dicatat ulang.");
  });
}

export async function editPaymentTransactionAction(formData: FormData) {
  const fallbackId = typeof formData.get("salesOrderId") === "string" ? String(formData.get("salesOrderId")) : "";
  return runRedirectingAction(fallbackId ? `/sales-orders/${fallbackId}` : "/crm", async () => {
    await editPaymentTransaction(formData);
    return flashMessagePath(fallbackId ? `/sales-orders/${fallbackId}` : "/crm", "notice", "Pembayaran berhasil diperbarui.");
  });
}

export async function voidPaymentTransactionAction(formData: FormData) {
  const fallbackId = typeof formData.get("salesOrderId") === "string" ? String(formData.get("salesOrderId")) : "";
  return runRedirectingAction(fallbackId ? `/sales-orders/${fallbackId}` : "/crm", async () => {
    await voidPaymentTransaction(formData);
    return flashMessagePath(fallbackId ? `/sales-orders/${fallbackId}` : "/crm", "notice", "Pembayaran dibatalkan dan saldo diperbarui.");
  });
}

export async function cancelPurchaseOrderAction(formData: FormData) {
  return runRedirectingAction(opportunityTabFallback(formData, "po"), async () => {
    const actor = await requireActor(OWNER_ACTION_ROLES);
    const parsed = cancelPurchaseOrderSchema.safeParse({
      purchaseOrderId: formValue(formData, "purchaseOrderId"),
      version: formValue(formData, "version"),
      cancelReason: formValue(formData, "cancelReason"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const result = await getPrismaClient().$transaction(async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.findUnique({
        where: { id: parsed.data.purchaseOrderId },
        select: { purchaseOrderNo: true, opportunityId: true, status: true },
      });
      if (!purchaseOrder) throw new UserFacingError("Purchase Order tidak ditemukan.");
      if (purchaseOrder.status !== "DRAFT") throw new UserFacingError("Hanya PO berstatus Draft yang dapat dibatalkan.");
      const updated = await tx.purchaseOrder.updateMany({
        where: { id: parsed.data.purchaseOrderId, status: "DRAFT", version: parsed.data.version },
        data: { status: "CANCELLED", version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new UserFacingError("PO sudah berubah. Muat ulang halaman.");
      await audit(tx, actor, "PurchaseOrder", parsed.data.purchaseOrderId, "PURCHASE_ORDER_CANCELLED", ["status", "cancelReason"], {
        purchaseOrderNo: purchaseOrder.purchaseOrderNo,
        cancelReason: parsed.data.cancelReason,
        cancelledById: actor.id,
        cancelledByName: actor.name,
      });
      return { opportunityId: purchaseOrder.opportunityId };
    }, DEAL_TRANSACTION_OPTIONS);

    revalidatePath("/crm");
    revalidatePath("/crm/purchase-orders");
    revalidatePath(`/crm/peluang/${result.opportunityId}`);
    return flashMessagePath(
      `/crm/peluang/${result.opportunityId}?tab=po`,
      "notice",
      `PO draft dibatalkan oleh ${actor.name}. Alasan: ${parsed.data.cancelReason}`,
    );
  });
}

export async function cancelInvoiceAction(formData: FormData) {
  return runRedirectingAction(opportunityTabFallback(formData, "invoice"), async () => {
    const actor = await requireActor(OWNER_ACTION_ROLES);
    const parsed = cancelInvoiceSchema.safeParse({
      invoiceId: formValue(formData, "invoiceId"),
      version: formValue(formData, "version"),
      cancelReason: formValue(formData, "cancelReason"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const result = await getPrismaClient().$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: parsed.data.invoiceId },
        select: { invoiceNo: true, opportunityId: true, status: true },
      });
      if (!invoice) throw new UserFacingError("Invoice tidak ditemukan.");
      if (invoice.status !== "DRAFT") throw new UserFacingError("Hanya invoice berstatus Draft yang dapat dibatalkan.");
      const updated = await tx.invoice.updateMany({
        where: { id: parsed.data.invoiceId, status: "DRAFT", version: parsed.data.version },
        data: { status: "CANCELLED", version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new UserFacingError("Invoice sudah berubah. Muat ulang halaman.");
      await audit(tx, actor, "Invoice", parsed.data.invoiceId, "INVOICE_CANCELLED", ["status", "cancelReason"], {
        invoiceNo: invoice.invoiceNo,
        cancelReason: parsed.data.cancelReason,
        cancelledById: actor.id,
        cancelledByName: actor.name,
      });
      return { opportunityId: invoice.opportunityId };
    }, DEAL_TRANSACTION_OPTIONS);

    revalidatePath("/crm");
    revalidateInvoiceList();
    revalidatePath(`/crm/peluang/${result.opportunityId}`);
    return flashMessagePath(
      `/crm/peluang/${result.opportunityId}?tab=invoice`,
      "notice",
      `Invoice draft dibatalkan oleh ${actor.name}. Alasan: ${parsed.data.cancelReason}`,
    );
  });
}

export async function reverseSalesOrderAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor(REVERSE_DEAL_ROLES);
    const parsed = reverseSalesOrderSchema.safeParse({
      salesOrderId: formValue(formData, "salesOrderId"),
      cancelReason: formValue(formData, "cancelReason"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const cancelledOrder = await getPrismaClient().$transaction(
      async (tx) => {
        const order = await tx.salesOrder.findUnique({
          where: { id: parsed.data.salesOrderId },
          select: {
            status: true,
            salesOrderNo: true,
            opportunityId: true,
            opportunity: { select: { stage: true, version: true, customerId: true } },
            productionWorkOrders: { select: { id: true, status: true, currentStage: true } },
          },
        });
        if (!order || order.status !== "ACTIVE") throw new UserFacingError("Sales Order tidak aktif atau tidak ditemukan.");
        if (order.opportunity.stage !== "DEAL") throw new UserFacingError("Peluang tidak lagi berada di stage Deal.");

        const cancelledAt = new Date();
        const cancelled = await tx.salesOrder.updateMany({
          where: { id: parsed.data.salesOrderId, status: "ACTIVE" },
          data: { status: "CANCELLED", cancelledAt, cancelledById: actor.id, cancelReason: parsed.data.cancelReason },
        });
        if (cancelled.count !== 1) throw new UserFacingError("Sales Order sudah berubah.");
        const opportunity = await tx.opportunity.updateMany({
          where: { id: order.opportunityId, stage: "DEAL", version: order.opportunity.version },
          data: { stage: "LOST", cancelReason: parsed.data.cancelReason, version: { increment: 1 } },
        });
        if (opportunity.count !== 1) throw new UserFacingError("Peluang sudah berubah.");

        for (const workOrder of order.productionWorkOrders) {
          if (workOrder.status === "CANCELLED") continue;
          await tx.productionWorkOrder.update({
            where: { id: workOrder.id },
            data: { status: "CANCELLED", cancelledAt, version: { increment: 1 } },
          });
          await tx.productionActivity.create({
            data: {
              workOrderId: workOrder.id,
              actorId: actor.id,
              type: "CANCELLED",
              fromStage: workOrder.currentStage,
              note: parsed.data.cancelReason,
            },
          });
          await audit(tx, actor, "ProductionWorkOrder", workOrder.id, "PRODUCTION_WORK_ORDER_CANCELLED", ["status", "cancelledAt"], { salesOrderId: parsed.data.salesOrderId });
        }

        const salesOrderAudit = await audit(tx, actor, "SalesOrder", parsed.data.salesOrderId, "SALES_ORDER_CANCELLED", ["status", "cancelledAt", "cancelledById", "cancelReason"]);
        await audit(tx, actor, "Opportunity", order.opportunityId, "OPPORTUNITY_STAGE_CHANGED", ["stage", "cancelReason"], { from: "DEAL", to: "LOST" });
        await addSystemActivity(tx, actor, {
          customerId: order.opportunity.customerId,
          opportunityId: order.opportunityId,
          systemEvent: "SALES_ORDER_CANCELLED",
          content: `Sales Order ${order.salesOrderNo} dibatalkan dan peluang dipindahkan ke Lost.`,
          occurredAt: cancelledAt,
          metadata: {
            salesOrderId: parsed.data.salesOrderId,
            salesOrderNo: order.salesOrderNo,
            cancelReason: parsed.data.cancelReason,
          },
          sourceAuditEventId: salesOrderAudit.id,
        });
        await restoreCustomerRemindersAfterCancellation(tx, order.opportunity.customerId);
        return { opportunityId: order.opportunityId, customerId: order.opportunity.customerId };
      },
      DEAL_TRANSACTION_OPTIONS,
    );

    revalidatePath("/crm");
    revalidatePath(`/sales-orders/${parsed.data.salesOrderId}`);
    revalidatePath(`/crm/peluang/${cancelledOrder.opportunityId}`);
    revalidatePath(`/customers/${cancelledOrder.customerId}`);
    revalidateInvoiceList();
    revalidateCustomerReminders();
    return flashMessagePath(`/crm/peluang/${cancelledOrder.opportunityId}?tab=deal`, "notice", "Sales Order dibatalkan dan peluang dipindahkan ke Lost.");
  });
}

export async function forceSendRepeatOrderReminderAction(formData: FormData) {
  const parsedCustomerId = entityIdSchema.safeParse(formValue(formData, "customerId"));
  const fallbackPath = parsedCustomerId.success ? `/customers/${parsedCustomerId.data}` : "/customers";

  return runRedirectingAction(fallbackPath, async () => {
    const actor = await requireDeveloperActor();
    if (!parsedCustomerId.success) throw new UserFacingError("Customer tidak valid.");

    const prisma = getPrismaClient();
    const [customer, business, template] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: parsedCustomerId.data },
        select: { id: true, name: true, companyName: true, archivedAt: true, salesPic: { select: { name: true } } },
      }),
      prisma.businessProfile.findUnique({ where: { id: "default" }, select: { name: true } }),
      prisma.whatsAppTemplate.findFirst({ where: { triggerType: "REACTIVATION", isActive: true }, orderBy: { updatedAt: "desc" }, select: { body: true } }),
    ]);
    if (!customer || customer.archivedAt) throw new UserFacingError("Customer tidak tersedia.");

    const text = renderWhatsAppTemplate(template?.body ?? DEFAULT_ORDER_REMINDER_TEMPLATE, {
      business_name: business?.name ?? "AS Konveksi",
      customer_name: customer.name,
      company_name: customer.companyName ?? "",
      sales_pic_name: customer.salesPic?.name ?? "",
    });
    await enqueueManualWhatsAppMessage({ actor, customerId: customer.id, text });
    await prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        entityType: "Customer",
        entityId: customer.id,
        action: "REPEAT_ORDER_TEST_FORCED",
        changedFields: [],
        metadata: { source: "developer-test" },
      },
    });
    revalidatePath(`/customers/${customer.id}`);
    revalidatePath("/whatsapp/jobs");
    return flashMessagePath(`/customers/${customer.id}`, "notice", "Reminder repeat order test dijadwalkan untuk dikirim.");
  });
}
