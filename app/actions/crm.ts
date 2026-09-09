"use server";

import { Prisma, type CommunicationSystemEvent } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";

import { flashKindForError, flashMessagePath, messageForError, UserFacingError, runRedirectingAction } from "@/lib/actions/response";
import { ARCHIVE_ROLES, CRM_OPERATOR_ROLES, DEAL_ROLES, MASTER_DATA_ROLES, REVERSE_DEAL_ROLES } from "@/lib/auth/permissions";
import { requireActor, type Actor } from "@/lib/auth/session";
import { OPEN_STAGES, STAGE_LABEL, type OpportunityDetailTab } from "@/lib/crm/constants";
import { parseCustomerWorkbook, type CustomerExcelRow } from "@/lib/crm/customer-excel";
import { calculateInvoiceLines, type InvoicePricingInput } from "@/lib/crm/invoice-calculation";
import { nextCustomerNo, nextOpportunityNo, nextInvoiceNo, nextPurchaseOrderNo, nextSalesOrderNo } from "@/lib/crm/numbers";
import { parseRosterFile } from "@/lib/crm/roster-import";
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
  createCustomerSchema,
  createOpportunitySchema,
  entityIdSchema,
  firstValidationMessage,
  moveOpportunitySchema,
  opportunityFieldsSchema,
  invoiceDraftSchema,
  invoiceIdSchema,
  purchaseOrderDraftSchema,
  purchaseOrderIdSchema,
  PURCHASE_ORDER_ATTACHMENT_MAX_BYTES,
  PURCHASE_ORDER_ATTACHMENT_MAX_FILES,
  payInvoicePaymentTermSchema,
  payPaymentTermSchema,
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
import { ensureProductionWorkOrder } from "@/lib/production/service";
import { createAdminClient } from "@/lib/supabase/admin";

type Tx = Prisma.TransactionClient;
type CrmActionState = { error: string | null; success: boolean };

const PURCHASE_ORDER_ATTACHMENT_BUCKET = "crm-po-designs";
const PURCHASE_ORDER_ATTACHMENT_EXTENSIONS = new Set(["png", "psd"]);
const PURCHASE_ORDER_ATTACHMENT_CONTENT_TYPES = new Set([
  "",
  "application/octet-stream",
  "application/x-photoshop",
  "image/png",
  "image/vnd.adobe.photoshop",
]);
const DOCUMENT_DRAFT_TRANSACTION_OPTIONS = {
  maxWait: 20_000,
  timeout: 10_000,
} as const;
const DEAL_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 20_000,
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
  revalidatePath("/notifications");
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
  const opportunityId = entityIdSchema.safeParse(formValue(formData, "opportunityId"));
  const rawRedirectTo = formValue(formData, "redirectTo");
  if (!opportunityId.success || typeof rawRedirectTo !== "string") return "/crm";

  try {
    const url = new URL(rawRedirectTo, "http://askonveksi.local");
    if (url.origin === "http://askonveksi.local" && url.pathname === `/crm/peluang/${opportunityId.data}`) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return "/crm";
  }

  return "/crm";
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

async function validatedPurchaseOrderAttachments(formData: FormData, purchaseOrderId: string) {
  const kinds = formData.getAll("designAttachmentKind");
  const files: Array<{ file: File; kind: FormDataEntryValue | undefined }> = [];
  formData.getAll("designAttachments").forEach((value, index) => {
    if (value instanceof File && value.size > 0) files.push({ file: value, kind: kinds[index] });
  });
  if (files.length > PURCHASE_ORDER_ATTACHMENT_MAX_FILES) throw new UserFacingError("Maksimal lima lampiran desain per revisi PO.");

  return Promise.all(files.map(async ({ file, kind }) => {
    if (file.size > PURCHASE_ORDER_ATTACHMENT_MAX_BYTES) throw new UserFacingError("Setiap lampiran desain maksimal 5 MB.");

    const extension = storageExtension(file.name);
    if (!PURCHASE_ORDER_ATTACHMENT_EXTENSIONS.has(extension)) {
      throw new UserFacingError("Lampiran desain hanya boleh memakai format PNG atau PSD.");
    }
    if (!PURCHASE_ORDER_ATTACHMENT_CONTENT_TYPES.has(file.type)) {
      throw new UserFacingError("Lampiran desain hanya boleh memakai format PNG atau PSD.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = safeContentType(file.type);
    return {
      bytes,
      contentType,
      originalName: file.name.slice(0, 255),
      sizeBytes: file.size,
      path: `${purchaseOrderId}/${randomUUID()}.${extension}`,
      kind: typeof kind === "string" && ["MAIN_DESIGN", "FRONT", "BACK", "LOGO_RIGHT", "LOGO_BACK", "LOGO_FRONT", "OTHER"].includes(kind)
        ? kind as "MAIN_DESIGN" | "FRONT" | "BACK" | "LOGO_RIGHT" | "LOGO_BACK" | "LOGO_FRONT" | "OTHER"
        : "OTHER" as const,
    };
  }));
}

function storageExtension(fileName: string) {
  const match = /\.([a-z0-9]{1,10})$/i.exec(fileName);
  return match ? match[1].toLowerCase() : "bin";
}

function safeContentType(contentType: string) {
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(contentType) && contentType.length <= 64
    ? contentType
    : "application/octet-stream";
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

function normalizeImportText(value: string | null | undefined) {
  const normalized = value?.trim().toLocaleLowerCase("id-ID") ?? "";
  return normalized || null;
}

function normalizePhone(value: string | null | undefined) {
  let digits = value?.replace(/\D/g, "") ?? "";
  if (!digits) return null;
  if (digits.startsWith("62")) digits = `0${digits.slice(2)}`;
  if (digits.startsWith("8")) digits = `0${digits}`;
  return digits;
}

function assertNoDuplicateImportKeys(rows: CustomerExcelRow[]) {
  const indexes = [
    { label: "nama customer", values: rows.map((row) => [row.rowNumber, normalizeImportText(row.name)] as const) },
    { label: "WhatsApp", values: rows.map((row) => [row.rowNumber, normalizePhone(row.whatsapp)] as const) },
    { label: "Instagram", values: rows.map((row) => [row.rowNumber, normalizeImportText(row.instagram)] as const) },
    { label: "email", values: rows.map((row) => [row.rowNumber, normalizeImportText(row.email)] as const) },
  ];

  for (const { label, values } of indexes) {
    const seen = new Map<string, number>();
    for (const [rowNumber, value] of values) {
      if (!value) continue;
      const existing = seen.get(value);
      if (existing) throw new UserFacingError(`${label} pada baris ${existing} dan ${rowNumber} tidak boleh sama.`);
      seen.set(value, rowNumber);
    }
  }
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

type ImportCustomerMatch = {
  id: string;
  name: string;
  companyName: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  customerTypeId: string;
  leadSourceId: string | null;
  salesPicId: string | null;
};

function indexCustomers(customers: ImportCustomerMatch[]) {
  const add = (map: Map<string, ImportCustomerMatch[]>, key: string | null, customer: ImportCustomerMatch) => {
    if (!key) return;
    map.set(key, [...(map.get(key) ?? []), customer]);
  };

  const byName = new Map<string, ImportCustomerMatch[]>();
  const byWhatsapp = new Map<string, ImportCustomerMatch[]>();
  const byInstagram = new Map<string, ImportCustomerMatch[]>();
  const byEmail = new Map<string, ImportCustomerMatch[]>();

  for (const customer of customers) {
    add(byName, normalizeImportText(customer.name), customer);
    add(byWhatsapp, normalizePhone(customer.whatsapp), customer);
    add(byInstagram, normalizeImportText(customer.instagram), customer);
    add(byEmail, normalizeImportText(customer.email), customer);
  }

  return { byName, byWhatsapp, byInstagram, byEmail };
}

function addImportCustomer(indexes: ReturnType<typeof indexCustomers>, customer: ImportCustomerMatch) {
  const add = (map: Map<string, ImportCustomerMatch[]>, key: string | null) => {
    if (!key) return;
    map.set(key, [...(map.get(key) ?? []), customer]);
  };

  add(indexes.byName, normalizeImportText(customer.name));
  add(indexes.byWhatsapp, normalizePhone(customer.whatsapp));
  add(indexes.byInstagram, normalizeImportText(customer.instagram));
  add(indexes.byEmail, normalizeImportText(customer.email));
}

function singleCustomerMatch(label: string, rowNumber: number, candidates: ImportCustomerMatch[]) {
  if (candidates.length > 1) throw new UserFacingError(`${label} pada baris ${rowNumber} cocok dengan lebih dari satu customer.`);
  return candidates[0] ?? null;
}

function assertNoImportConflict(
  row: CustomerExcelRow,
  selected: ImportCustomerMatch,
  indexes: ReturnType<typeof indexCustomers>,
) {
  const checks = [
    { label: "nama customer", key: normalizeImportText(row.name), map: indexes.byName },
    { label: "WhatsApp", key: normalizePhone(row.whatsapp), map: indexes.byWhatsapp },
    { label: "Instagram", key: normalizeImportText(row.instagram), map: indexes.byInstagram },
    { label: "email", key: normalizeImportText(row.email), map: indexes.byEmail },
  ];

  for (const check of checks) {
    const conflicts = check.key ? (check.map.get(check.key) ?? []).filter((customer) => customer.id !== selected.id) : [];
    if (conflicts.length) throw new UserFacingError(`${check.label} pada baris ${row.rowNumber} cocok dengan customer lain.`);
  }
}

function findImportCustomer(row: CustomerExcelRow, indexes: ReturnType<typeof indexCustomers>) {
  const nameKey = normalizeImportText(row.name);
  const sameName = nameKey ? indexes.byName.get(nameKey) ?? [] : [];

  if (sameName.length === 1) {
    assertNoImportConflict(row, sameName[0], indexes);
    return sameName[0];
  }

  if (sameName.length > 1) {
    const sameNameIndexes = indexCustomers(sameName);
    const byContact =
      singleCustomerMatch("WhatsApp", row.rowNumber, normalizePhone(row.whatsapp) ? sameNameIndexes.byWhatsapp.get(normalizePhone(row.whatsapp) ?? "") ?? [] : []) ??
      singleCustomerMatch("Instagram", row.rowNumber, normalizeImportText(row.instagram) ? sameNameIndexes.byInstagram.get(normalizeImportText(row.instagram) ?? "") ?? [] : []) ??
      singleCustomerMatch("email", row.rowNumber, normalizeImportText(row.email) ? sameNameIndexes.byEmail.get(normalizeImportText(row.email) ?? "") ?? [] : []);
    if (!byContact) throw new UserFacingError(`Nama customer pada baris ${row.rowNumber} cocok dengan lebih dari satu customer. Lengkapi kontak yang unik.`);
    assertNoImportConflict(row, byContact, indexes);
    return byContact;
  }

  const byContact =
    singleCustomerMatch("WhatsApp", row.rowNumber, normalizePhone(row.whatsapp) ? indexes.byWhatsapp.get(normalizePhone(row.whatsapp) ?? "") ?? [] : []) ??
    singleCustomerMatch("Instagram", row.rowNumber, normalizeImportText(row.instagram) ? indexes.byInstagram.get(normalizeImportText(row.instagram) ?? "") ?? [] : []) ??
    singleCustomerMatch("email", row.rowNumber, normalizeImportText(row.email) ? indexes.byEmail.get(normalizeImportText(row.email) ?? "") ?? [] : []);

  if (byContact) assertNoImportConflict(row, byContact, indexes);
  return byContact;
}

function invoiceInput(formData: FormData) {
  const purchaseOrderSizeIds = formData.getAll("itemPurchaseOrderSizeId");
  const productNames = formData.getAll("itemProductName");
  const sizes = formData.getAll("itemSize");
  const sleeveLengths = formData.getAll("itemSleeveLength");
  const descriptions = formData.getAll("itemDescription");
  const quantities = formData.getAll("itemQuantity");
  const unitPrices = formData.getAll("itemUnitPrice");
  const discountPercents = formData.getAll("itemDiscountPercent");
  const length = Math.max(purchaseOrderSizeIds.length, sizes.length, unitPrices.length);
  const items = Array.from({ length }, (_, index) => ({
    purchaseOrderSizeId: purchaseOrderSizeIds[index],
    productName: productNames[index],
    size: sizes[index],
    sleeveLength: sleeveLengths[index],
    description: descriptions[index],
    quantity: quantities[index],
    unitPrice: unitPrices[index],
    discountPercent: discountPercents[index] || "0",
  }));

  return {
    opportunityId: formValue(formData, "opportunityId"),
    purchaseOrderId: formValue(formData, "purchaseOrderId"),
    invoiceId: formValue(formData, "invoiceId") || undefined,
    version: formValue(formData, "version") || undefined,
    dueAt: formValue(formData, "dueAt"),
    taxRate: formValue(formData, "taxRate"),
    notes: formValue(formData, "notes"),
    items,
  };
}

function purchaseOrderInput(formData: FormData) {
  const sizeIds = formData.getAll("sizeId");
  const sleeveLengths = formData.getAll("sleeveLength");
  const quantities = formData.getAll("sizeQuantity");
  const rosterMemberIds = formData.getAll("rosterMemberId");
  const rosterNames = formData.getAll("rosterName");
  const rosterSizeIds = formData.getAll("rosterSizeId");
  return {
    opportunityId: formValue(formData, "opportunityId"),
    purchaseOrderId: formValue(formData, "purchaseOrderId") || undefined,
    version: formValue(formData, "version") || undefined,
    customerReference: formValue(formData, "customerReference"),
    garmentType: formValue(formData, "garmentType"),
    productName: formValue(formData, "productName"),
    material: formValue(formData, "material"),
    baseColor: formValue(formData, "baseColor"),
    variationColor: formValue(formData, "variationColor"),
    decorationMethod: formValue(formData, "decorationMethod"),
    orderDate: formValue(formData, "orderDate"),
    sampleSize: formValue(formData, "sampleSize"),
    designNotes: formValue(formData, "designNotes"),
    notes: formValue(formData, "notes"),
    deadline: formValue(formData, "deadline"),
    sizes: Array.from({ length: Math.max(sizeIds.length, quantities.length) }, (_, index) => ({
      sizeId: sizeIds[index],
      sleeveLength: sleeveLengths[index],
      quantity: quantities[index],
    })),
    roster: Array.from({ length: Math.max(rosterMemberIds.length, rosterNames.length, rosterSizeIds.length) }, (_, index) => ({
      memberId: rosterMemberIds[index],
      name: rosterNames[index],
      sizeId: rosterSizeIds[index],
    })).filter((item) => item.memberId || item.name || item.sizeId),
  };
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
    initialDueAt: formValue(formData, "initialDueAt"),
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

async function uploadPurchaseOrderAttachments(
  attachments: Awaited<ReturnType<typeof validatedPurchaseOrderAttachments>>,
) {
  const uploaded: string[] = [];
  const storage = createAdminClient().storage.from(PURCHASE_ORDER_ATTACHMENT_BUCKET);
  try {
    await Promise.all(attachments.map(async (attachment) => {
      const { error } = await storage.upload(attachment.path, attachment.bytes, { contentType: attachment.contentType, upsert: false });
      if (error) throw new UserFacingError("Lampiran desain belum dapat disimpan.");
      uploaded.push(attachment.path);
    }));
    return uploaded;
  } catch (error) {
    if (uploaded.length) await storage.remove(uploaded);
    throw error;
  }
}

async function cleanupPurchaseOrderAttachments(paths: string[]) {
  if (paths.length) await createAdminClient().storage.from(PURCHASE_ORDER_ATTACHMENT_BUCKET).remove(paths);
}

type PurchaseOrderRowReader = {
  garmentSize: Tx["garmentSize"];
};

async function preparePurchaseOrderRows(
  db: PurchaseOrderRowReader,
  data: {
    sizes: Array<{ sizeId: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>;
    roster: Array<{ memberId: string; name: string; sizeId: string }>;
  },
  importedRoster: Array<{ memberId: string; name: string; size: string }>,
  replaceRosterFromFile: boolean,
) {
  const requestedIds = new Set([
    ...data.sizes.map((item) => item.sizeId),
    ...data.roster.map((item) => item.sizeId),
  ]);
  const sizeMasters = await db.garmentSize.findMany({
    where: {
      isActive: true,
      OR: [
        ...(requestedIds.size ? [{ id: { in: [...requestedIds] } }] : []),
        ...(importedRoster.length ? [{ name: { in: importedRoster.map((item) => item.size), mode: "insensitive" as const } }] : []),
      ],
    },
    select: { id: true, name: true },
  });
  const byId = new Map(sizeMasters.map((item) => [item.id, item]));
  const byName = new Map(sizeMasters.map((item) => [item.name.toLocaleLowerCase("id-ID"), item]));

  const sizes = data.sizes.filter((item) => item.quantity > 0).map((item, position) => {
    const master = byId.get(item.sizeId);
    if (!master) throw new UserFacingError("Salah satu ukuran matriks tidak aktif atau tidak ditemukan.");
    return { ...item, size: master.name, position };
  });
  const manualRoster = data.roster.map((item) => {
    const master = byId.get(item.sizeId);
    if (!master) throw new UserFacingError("Salah satu ukuran roster tidak aktif atau tidak ditemukan.");
    return { ...item, size: master.name };
  });
  const fileRoster = importedRoster.map((item, index) => {
    const master = byName.get(item.size.toLocaleLowerCase("id-ID"));
    if (!master) throw new UserFacingError(`Ukuran ${item.size} pada baris roster ${index + 2} belum tersedia di Data Master.`);
    return { memberId: item.memberId, name: item.name, sizeId: master.id, size: master.name };
  });
  const roster = replaceRosterFromFile ? fileRoster : manualRoster;
  const normalizedIds = roster.map((item) => item.memberId.toLocaleLowerCase("id-ID"));
  if (new Set(normalizedIds).size !== normalizedIds.length) throw new UserFacingError("ID anggota roster tidak boleh duplikat.");

  if (roster.length) {
    const matrixTotals = new Map<string, number>();
    for (const item of sizes) matrixTotals.set(item.sizeId, (matrixTotals.get(item.sizeId) ?? 0) + item.quantity);
    const rosterTotals = new Map<string, number>();
    for (const item of roster) rosterTotals.set(item.sizeId, (rosterTotals.get(item.sizeId) ?? 0) + 1);
    const allSizeIds = new Set([...matrixTotals.keys(), ...rosterTotals.keys()]);
    for (const sizeId of allSizeIds) {
      if ((matrixTotals.get(sizeId) ?? 0) !== (rosterTotals.get(sizeId) ?? 0)) {
        const sizeName = byId.get(sizeId)?.name ?? "tidak dikenal";
        throw new UserFacingError(`Total roster ukuran ${sizeName} harus sama dengan total Pendek dan Panjang pada matriks.`);
      }
    }
  }

  return {
    sizes,
    roster: roster.map((item, position) => ({ ...item, position })),
  };
}

function calculateInvoiceForPurchaseOrder(
  purchaseOrder: {
    productName: string;
    sizes: Array<{ id: string; sizeId: string | null; size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>;
  },
  submittedItems: InvoicePricingInput[],
  taxRate: string,
) {
  const submittedById = new Map(submittedItems.map((item) => [String(item.purchaseOrderSizeId), item]));
  if (submittedById.size !== purchaseOrder.sizes.length || submittedItems.length !== purchaseOrder.sizes.length) {
    throw new UserFacingError("Item invoice harus sama dengan seluruh baris matriks PO.");
  }
  const calculated = calculateInvoiceLines(purchaseOrder.sizes.map((poRow) => {
    const submitted = submittedById.get(poRow.id);
    if (!submitted) throw new UserFacingError("Salah satu baris PO tidak tersedia pada invoice.");
    return {
      purchaseOrderSizeId: poRow.id,
      productName: purchaseOrder.productName,
      size: poRow.size,
      sleeveLength: poRow.sleeveLength,
      description: `${purchaseOrder.productName} ${poRow.sleeveLength === "PENDEK" ? "lengan pendek" : "lengan panjang"} ukuran ${poRow.size}`,
      quantity: poRow.quantity,
      unitPrice: String(submitted.unitPrice),
      discountPercent: String(submitted.discountPercent),
    };
  }), taxRate);
  return {
    ...calculated,
    items: calculated.items.map(({ purchaseOrderSizeId, ...item }) => ({
      ...item,
      sizeId: purchaseOrder.sizes.find((row) => row.id === purchaseOrderSizeId)?.sizeId ?? null,
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
        const [customerType, leadSource, salesPic] = await Promise.all([
          tx.customerType.findUnique({ where: { id: parsed.data.customerTypeId }, select: { id: true } }),
          parsed.data.leadSourceId ? tx.leadSource.findUnique({ where: { id: parsed.data.leadSourceId }, select: { id: true } }) : null,
          parsed.data.salesPicId ? tx.appUser.findFirst({ where: { id: parsed.data.salesPicId, role: "SALES", isActive: true }, select: { id: true } }) : null,
        ]);
        if (!customerType) throw new UserFacingError("Jenis customer tidak ditemukan.");
        if (parsed.data.leadSourceId && !leadSource) throw new UserFacingError("Sumber lead tidak ditemukan.");
        if (parsed.data.salesPicId && !salesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");
        const created = await tx.customer.create({
          data: { ...parsed.data, email: parsed.data.email?.toLowerCase(), customerNo: await nextCustomerNo(tx) },
          select: { id: true },
        });
        await audit(tx, actor, "Customer", created.id, "CUSTOMER_CREATED", [
          "name", "companyName", "whatsapp", "email", "instagram", "address", "city", "notes", "customerTypeId", "leadSourceId", "salesPicId",
        ]);
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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
    assertNoDuplicateImportKeys(rows);

    const result = await getPrismaClient().$transaction(
      async (tx) => {
        const [customerTypes, leadSources, salesUsers, currentCustomers] = await Promise.all([
          tx.customerType.findMany({ select: { id: true, name: true } }),
          tx.leadSource.findMany({ select: { id: true, name: true } }),
          tx.appUser.findMany({ where: { role: "SALES", isActive: true }, select: { id: true, name: true } }),
          tx.customer.findMany({
            select: {
              id: true,
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
          }),
        ]);
        const customerTypeByName = uniqueNameMap(customerTypes, "Jenis customer");
        const leadSourceByName = uniqueNameMap(leadSources, "Sumber lead");
        const salesUserByName = uniqueNameMap(salesUsers, "Sales/PIC");
        const customerIndexes = indexCustomers(currentCustomers);
        const touchedCustomerIds = new Set<string>();
        let createdCount = 0;
        let updatedCount = 0;

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
            const created = await tx.customer.create({
              data: { ...data, customerNo: await nextCustomerNo(tx) },
              select: { id: true },
            });
            addImportCustomer(customerIndexes, { id: created.id, ...data });
            touchedCustomerIds.add(created.id);
            await audit(tx, actor, "Customer", created.id, "CUSTOMER_CREATED", [
              "name", "companyName", "whatsapp", "email", "instagram", "address", "city", "notes", "customerTypeId", "leadSourceId", "salesPicId",
            ], { source: "xlsx-import", rowNumber: row.rowNumber });
            createdCount += 1;
            continue;
          }

          if (touchedCustomerIds.has(current.id)) throw new UserFacingError(`Customer pada baris ${row.rowNumber} sudah diproses oleh baris lain.`);
          touchedCustomerIds.add(current.id);

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

          if (!changedFields.length) continue;

          await tx.customer.update({
            where: { id: current.id },
            data: { ...data, version: { increment: 1 } },
          });
          await audit(tx, actor, "Customer", current.id, "CUSTOMER_UPDATED", changedFields, {
            source: "xlsx-import",
            rowNumber: row.rowNumber,
          });
          updatedCount += 1;
        }

        return { createdCount, updatedCount };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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

export async function updateCustomerAction(formData: FormData) {
  return runRedirectingAction("/customers", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = updateCustomerSchema.safeParse({
      ...customerFields(formData),
      customerId: formValue(formData, "customerId"),
      version: formValue(formData, "version"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const { customerId, version, ...fields } = parsed.data;
    const result = await getPrismaClient().$transaction(async (tx) => {
      const current = await tx.customer.findUnique({ where: { id: customerId }, select: { customerTypeId: true, leadSourceId: true, salesPicId: true } });
      if (!current) throw new UserFacingError("Customer tidak ditemukan.");
      const [customerType, leadSource, salesPic] = await Promise.all([
        tx.customerType.findUnique({ where: { id: fields.customerTypeId }, select: { id: true } }),
        fields.leadSourceId ? tx.leadSource.findUnique({ where: { id: fields.leadSourceId }, select: { id: true } }) : null,
        fields.salesPicId ? tx.appUser.findFirst({ where: { id: fields.salesPicId, role: "SALES", OR: [{ isActive: true }, { id: current.salesPicId ?? "" }] }, select: { id: true } }) : null,
      ]);
      if (!customerType) throw new UserFacingError("Jenis customer tidak ditemukan.");
      if (fields.leadSourceId && !leadSource) throw new UserFacingError("Sumber lead tidak ditemukan.");
      if (fields.salesPicId && !salesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");
      const updated = await tx.customer.updateMany({
        where: { id: customerId, version, archivedAt: null },
        data: { ...fields, email: fields.email?.toLowerCase(), version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new UserFacingError("Customer sudah berubah atau telah diarsipkan. Muat ulang halaman.");
      await audit(tx, actor, "Customer", customerId, "CUSTOMER_UPDATED", [
        "name", "companyName", "whatsapp", "email", "instagram", "address", "city", "notes", "customerTypeId", "leadSourceId", "salesPicId",
      ]);
      return updated;
    });
    if (!result.count) throw new UserFacingError("Customer tidak dapat diperbarui.");

    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    revalidateCustomerReminders();
    return flashMessagePath("/customers", "notice", "Data customer diperbarui.");
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
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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
    });

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
          salesPicId ? tx.appUser.findFirst({ where: { id: salesPicId, role: "SALES", isActive: true }, select: { id: true } }) : null,
        ]);
        if (leadSourceId && !leadSource) throw new UserFacingError("Sumber lead tidak aktif atau tidak ditemukan.");
        if (salesPicId && !salesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");

        const created = await tx.opportunity.create({
          data: {
            opportunityNo: await nextOpportunityNo(tx),
            customerId: customer.id,
            title: parsed.data.title,
            leadSourceId,
            salesPicId,
            productName: parsed.data.productName,
            garmentType: parsed.data.garmentType,
            needPurpose: parsed.data.needPurpose,
            specification: parsed.data.specification,
            nextAction: parsed.data.nextAction,
            nextActionAt: jakartaDateTime(parsed.data.nextActionAt),
          },
          select: { id: true },
        });
        await audit(tx, actor, "Opportunity", created.id, "OPPORTUNITY_CREATED", [
          "customerId", "title", "leadSourceId", "salesPicId", "productName", "garmentType", "needPurpose",
          "specification", "nextAction", "nextActionAt", "stage",
        ], { stage: "LEAD_BARU" });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/crm");
    revalidatePath("/customers");
    revalidateCustomerReminders();
    return flashMessagePath(`/crm/peluang/${opportunity.id}`, "notice", "Lead baru berhasil dibuat.");
  });
}

export async function createLeadAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const customerMode = formValue(formData, "customerMode");
    if (customerMode !== "existing" && customerMode !== "new") throw new UserFacingError("Pilih jenis customer untuk lead.");
    const opportunityParsed = opportunityFieldsSchema.safeParse(opportunityInput(formData));
    if (!opportunityParsed.success) throw new UserFacingError(firstValidationMessage(opportunityParsed.error));
    const scheduleError = validateOpenOpportunitySchedule(opportunityParsed.data);
    if (scheduleError) throw new UserFacingError(scheduleError);
    const customerIdParsed = entityIdSchema.safeParse(formValue(formData, "customerId"));
    const customerParsed = customerMode === "new" ? createCustomerSchema.safeParse(customerFields(formData)) : null;
    if (customerMode === "existing" && !customerIdParsed.success) throw new UserFacingError("Pilih customer tersimpan.");
    if (customerParsed && !customerParsed.success) throw new UserFacingError(firstValidationMessage(customerParsed.error));

    const opportunity = await getPrismaClient().$transaction(async (tx) => {
      let customer: { id: string; leadSourceId: string | null; salesPicId: string | null };
      if (customerMode === "new" && customerParsed?.success) {
        const [customerType, customerLeadSource, customerSalesPic] = await Promise.all([
          tx.customerType.findUnique({ where: { id: customerParsed.data.customerTypeId }, select: { id: true } }),
          customerParsed.data.leadSourceId ? tx.leadSource.findFirst({ where: { id: customerParsed.data.leadSourceId, isActive: true }, select: { id: true } }) : null,
          customerParsed.data.salesPicId ? tx.appUser.findFirst({ where: { id: customerParsed.data.salesPicId, role: "SALES", isActive: true }, select: { id: true } }) : null,
        ]);
        if (!customerType) throw new UserFacingError("Jenis customer tidak ditemukan.");
        if (customerParsed.data.leadSourceId && !customerLeadSource) throw new UserFacingError("Sumber lead tidak aktif atau tidak ditemukan.");
        if (customerParsed.data.salesPicId && !customerSalesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");
        customer = await tx.customer.create({
          data: { ...customerParsed.data, email: customerParsed.data.email?.toLowerCase(), customerNo: await nextCustomerNo(tx) },
          select: { id: true, leadSourceId: true, salesPicId: true },
        });
        await audit(tx, actor, "Customer", customer.id, "CUSTOMER_CREATED", [
          "name", "companyName", "whatsapp", "email", "instagram", "address", "city", "notes", "customerTypeId", "leadSourceId", "salesPicId",
        ]);
      } else {
        customer = await tx.customer.findFirstOrThrow({
          where: { id: customerIdParsed.success ? customerIdParsed.data : "", archivedAt: null },
          select: { id: true, leadSourceId: true, salesPicId: true },
        }).catch(() => { throw new UserFacingError("Customer aktif tidak ditemukan."); });
      }

      const leadSourceId = opportunityParsed.data.leadSourceId ?? customer.leadSourceId;
      const salesPicId = opportunityParsed.data.salesPicId ?? customer.salesPicId;
      const [leadSource, salesPic] = await Promise.all([
        leadSourceId ? tx.leadSource.findFirst({ where: { id: leadSourceId, isActive: true }, select: { id: true } }) : null,
        salesPicId ? tx.appUser.findFirst({ where: { id: salesPicId, role: "SALES", isActive: true }, select: { id: true } }) : null,
      ]);
      if (leadSourceId && !leadSource) throw new UserFacingError("Sumber lead tidak aktif atau tidak ditemukan.");
      if (salesPicId && !salesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");

      const created = await tx.opportunity.create({
        data: {
          opportunityNo: await nextOpportunityNo(tx),
          customerId: customer.id,
          title: opportunityParsed.data.title,
          leadSourceId,
          salesPicId,
          productName: opportunityParsed.data.productName,
          garmentType: opportunityParsed.data.garmentType,
          needPurpose: opportunityParsed.data.needPurpose,
          specification: opportunityParsed.data.specification,
          nextAction: opportunityParsed.data.nextAction,
          nextActionAt: jakartaDateTime(opportunityParsed.data.nextActionAt),
        },
        select: { id: true },
      });
      await audit(tx, actor, "Opportunity", created.id, "OPPORTUNITY_CREATED", [
        "customerId", "title", "leadSourceId", "salesPicId", "productName", "garmentType", "needPurpose",
        "specification", "nextAction", "nextActionAt", "stage",
      ], { stage: "LEAD_BARU" });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/crm");
    revalidatePath("/customers");
    revalidatePath("/dashboard");
    revalidateCustomerReminders();
    return flashMessagePath(`/crm/peluang/${opportunity.id}`, "notice", "Lead baru berhasil dibuat.");
  });
}

export async function updateOpportunityAction(formData: FormData) {
  return runRedirectingAction(opportunityTabFallback(formData, "peluang"), async () => {
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

      const [leadSource, salesPic] = await Promise.all([
        parsed.data.leadSourceId ? tx.leadSource.findFirst({ where: { id: parsed.data.leadSourceId, isActive: true }, select: { id: true } }) : null,
        parsed.data.salesPicId ? tx.appUser.findFirst({ where: { id: parsed.data.salesPicId, role: "SALES", isActive: true }, select: { id: true } }) : null,
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
          garmentType: parsed.data.garmentType ?? null,
          needPurpose: parsed.data.needPurpose ?? null,
          specification: parsed.data.specification ?? null,
          nextAction: parsed.data.nextAction ?? null,
          nextActionAt: jakartaDateTime(parsed.data.nextActionAt),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new UserFacingError("Peluang sudah berubah. Muat ulang halaman.");
      await audit(tx, actor, "Opportunity", parsed.data.opportunityId, "OPPORTUNITY_UPDATED", [
        "title", "leadSourceId", "salesPicId", "productName", "garmentType", "needPurpose", "specification",
        "nextAction", "nextActionAt",
      ]);
      return updated;
    });
    if (!result.count) throw new UserFacingError("Peluang tidak dapat diperbarui.");

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}?tab=peluang`, "notice", "Peluang diperbarui.");
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

  const customerId = await getPrismaClient().$transaction(async (tx) => {
    const current = await tx.opportunity.findUnique({
      where: { id: parsed.data.opportunityId },
      select: { stage: true, customerId: true },
    });
    if (!current) throw new UserFacingError("Peluang tidak ditemukan.");
    if (current.stage === "DEAL") throw new UserFacingError("Deal hanya dapat dibatalkan melalui Sales Order oleh Admin.");
    const allowedTransitions: Record<string, readonly string[]> = {
      LEAD_BARU: ["FOLLOW_UP", "NEGOSIASI", "LOST"],
      FOLLOW_UP: ["LEAD_BARU", "NEGOSIASI", "LOST"],
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
  });

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
    });

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
    });

    revalidatePath("/crm");
    revalidatePath("/crm/follow-up");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    revalidatePath(`/customers/${customerId}`);
    revalidateCustomerReminders();
    return flashMessagePath("/crm/follow-up", "notice", "Hasil follow-up dan langkah berikutnya tersimpan.");
  });
}

export async function createPurchaseOrderDraftAction(formData: FormData) {
  return runRedirectingAction(opportunityTabFallback(formData, "po"), async () => {
    const timer = documentTimer("create-po-draft");
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    timer.mark("auth");
    const parsed = purchaseOrderDraftSchema.safeParse(purchaseOrderInput(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    timer.mark("parse");
    const rosterFile = formData.get("rosterFile");
    const replaceRosterFromFile = rosterFile instanceof File && rosterFile.size > 0;
    const importedRoster = replaceRosterFromFile ? await parseRosterFile(rosterFile) : [];
    timer.mark("roster");

    const prisma = getPrismaClient();
    const purchaseOrderId = randomUUID();
    const attachments = await validatedPurchaseOrderAttachments(formData, purchaseOrderId);
    timer.mark("attachments:read");
    const rows = await preparePurchaseOrderRows(prisma, parsed.data, importedRoster, replaceRosterFromFile);
    timer.mark("rows");
    const uploadedPaths = await uploadPurchaseOrderAttachments(attachments);
    timer.mark("attachments:upload");
    try {
      await prisma.$transaction(async (tx) => {
        const opportunity = await tx.opportunity.findUnique({
          where: { id: parsed.data.opportunityId },
          select: {
            stage: true,
            customer: { select: { archivedAt: true } },
            purchaseOrders: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
            _count: { select: { purchaseOrders: true } },
          },
        });
        if (!opportunity || opportunity.customer.archivedAt) throw new UserFacingError("Peluang aktif tidak ditemukan.");
        if (opportunity.stage !== "NEGOSIASI") throw new UserFacingError("PO hanya dapat dibuat saat peluang berada di Negosiasi.");
        if (opportunity.purchaseOrders.length) throw new UserFacingError("Selesaikan draft PO yang sedang aktif.");
        if (opportunity._count.purchaseOrders > 0) throw new UserFacingError("Gunakan aksi Revisi PO dari dokumen sebelumnya.");

        const created = await tx.purchaseOrder.create({
          data: {
            id: purchaseOrderId,
            purchaseOrderNo: await nextPurchaseOrderNo(tx),
            opportunityId: parsed.data.opportunityId,
            revision: 1,
            customerReference: parsed.data.customerReference,
            garmentType: parsed.data.garmentType,
            productName: parsed.data.productName,
            material: parsed.data.material,
            color: parsed.data.baseColor,
            baseColor: parsed.data.baseColor,
            variationColor: parsed.data.variationColor,
            decorationMethod: parsed.data.decorationMethod,
            orderDate: optionalDate(parsed.data.orderDate),
            sampleSize: parsed.data.garmentType === "JERSEY" ? parsed.data.sampleSize : null,
            designNotes: parsed.data.designNotes,
            notes: parsed.data.notes,
            deadline: optionalDate(parsed.data.deadline),
            createdById: actor.id,
            sizes: { create: rows.sizes },
            rosterEntries: { create: rows.roster },
            attachments: {
              create: attachments.map(({ path, originalName, contentType, sizeBytes, kind }) => ({ path, originalName, contentType, sizeBytes, kind })),
            },
          },
          select: { id: true },
        });
        await audit(tx, actor, "PurchaseOrder", created.id, "PURCHASE_ORDER_DRAFT_CREATED", [
          "garmentType", "productName", "material", "baseColor", "variationColor", "decorationMethod", "orderDate", "sampleSize", "designNotes", "notes", "deadline", "sizes", "roster", "attachments",
        ], { opportunityId: parsed.data.opportunityId });
      }, DOCUMENT_DRAFT_TRANSACTION_OPTIONS);
      timer.mark("transaction");
    } catch (error) {
      await cleanupPurchaseOrderAttachments(uploadedPaths);
      throw error;
    }

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    timer.mark("revalidate");
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}?tab=po`, "notice", "Draft PO dibuat.");
  });
}

export async function updatePurchaseOrderDraftAction(formData: FormData) {
  return runRedirectingAction(opportunityTabFallback(formData, "po"), async () => {
    const timer = documentTimer("update-po-draft");
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    timer.mark("auth");
    const parsed = purchaseOrderDraftSchema.safeParse(purchaseOrderInput(formData));
    if (!parsed.success || !parsed.data.purchaseOrderId || !parsed.data.version) {
      throw new UserFacingError(parsed.success ? "Identitas PO tidak lengkap." : firstValidationMessage(parsed.error));
    }
    timer.mark("parse");
    const rosterFile = formData.get("rosterFile");
    const replaceRosterFromFile = rosterFile instanceof File && rosterFile.size > 0;
    const importedRoster = replaceRosterFromFile ? await parseRosterFile(rosterFile) : [];
    timer.mark("roster");
    const prisma = getPrismaClient();
    const purchaseOrderId = parsed.data.purchaseOrderId;
    const attachments = await validatedPurchaseOrderAttachments(formData, purchaseOrderId);
    timer.mark("attachments:read");
    const [rows, existingAttachmentCount] = await Promise.all([
      preparePurchaseOrderRows(prisma, parsed.data, importedRoster, replaceRosterFromFile),
      prisma.purchaseOrderAttachment.count({ where: { purchaseOrderId } }),
    ]);
    timer.mark("rows-and-existing-attachments");
    if (existingAttachmentCount + attachments.length > PURCHASE_ORDER_ATTACHMENT_MAX_FILES) {
      throw new UserFacingError("Maksimal lima lampiran desain per revisi PO.");
    }
    const uploadedPaths = await uploadPurchaseOrderAttachments(attachments);
    timer.mark("attachments:upload");
    try {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.purchaseOrder.updateMany({
          where: { id: purchaseOrderId, opportunityId: parsed.data.opportunityId, status: "DRAFT", version: parsed.data.version },
          data: {
            customerReference: parsed.data.customerReference,
            garmentType: parsed.data.garmentType,
            productName: parsed.data.productName,
            material: parsed.data.material,
            color: parsed.data.baseColor,
            baseColor: parsed.data.baseColor,
            variationColor: parsed.data.variationColor,
            decorationMethod: parsed.data.decorationMethod,
            orderDate: optionalDate(parsed.data.orderDate),
            sampleSize: parsed.data.garmentType === "JERSEY" ? parsed.data.sampleSize : null,
            designNotes: parsed.data.designNotes,
            notes: parsed.data.notes,
            deadline: optionalDate(parsed.data.deadline),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new UserFacingError("Draft PO sudah berubah atau tidak lagi dapat diedit.");
        await tx.purchaseOrderRosterEntry.deleteMany({ where: { purchaseOrderId } });
        await tx.purchaseOrderSize.deleteMany({ where: { purchaseOrderId } });
        await tx.purchaseOrderSize.createMany({
          data: rows.sizes.map((item) => ({ purchaseOrderId, ...item })),
        });
        if (rows.roster.length) await tx.purchaseOrderRosterEntry.createMany({ data: rows.roster.map((item) => ({ purchaseOrderId, ...item })) });
        if (attachments.length) {
          await tx.purchaseOrderAttachment.createMany({
            data: attachments.map(({ path, originalName, contentType, sizeBytes, kind }) => ({ purchaseOrderId, path, originalName, contentType, sizeBytes, kind })),
          });
        }
        await audit(tx, actor, "PurchaseOrder", purchaseOrderId, "PURCHASE_ORDER_DRAFT_UPDATED", [
          "garmentType", "productName", "material", "baseColor", "variationColor", "decorationMethod", "orderDate", "sampleSize", "designNotes", "notes", "deadline", "sizes", "roster", "attachments",
        ]);
      }, DOCUMENT_DRAFT_TRANSACTION_OPTIONS);
      timer.mark("transaction");
    } catch (error) {
      await cleanupPurchaseOrderAttachments(uploadedPaths);
      throw error;
    }

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
          sizes: { select: { id: true }, take: 1 },
          opportunity: {
            select: {
              stage: true,
              customerId: true,
              invoices: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
            },
          },
        },
      });
      if (!purchaseOrder || purchaseOrder.status !== "DRAFT") throw new UserFacingError("Draft PO tidak ditemukan.");
      if (purchaseOrder.opportunity.stage !== "NEGOSIASI") throw new UserFacingError("PO hanya dapat disepakati saat Negosiasi.");
      if (purchaseOrder.opportunity.invoices.length) throw new UserFacingError("Selesaikan invoice draft sebelum menyepakati revisi PO.");
      if (!purchaseOrder.sizes.length) throw new UserFacingError("PO belum memiliki ukuran dan jumlah.");
      if (!purchaseOrder.garmentType || !purchaseOrder.deadline) throw new UserFacingError("Jenis pakaian dan deadline produksi wajib dilengkapi sebelum PO disepakati.");
      const business = await tx.businessProfile.findUnique({ where: { id: "default" } });

      await tx.purchaseOrder.updateMany({
        where: { opportunityId: purchaseOrder.opportunityId, status: "AGREED", id: { not: parsed.data.purchaseOrderId } },
        data: { status: "SUPERSEDED", version: { increment: 1 } },
      });
      await tx.invoice.updateMany({
        where: { opportunityId: purchaseOrder.opportunityId, status: "ISSUED" },
        data: { status: "SUPERSEDED", version: { increment: 1 } },
      });
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${result.opportunityId}`);
    revalidatePath(`/customers/${result.customerId}`);
    return flashMessagePath(`/crm/peluang/${result.opportunityId}?tab=po`, "notice", "PO disepakati dan dikunci.");
  });
}

export async function cancelPurchaseOrderDraftAction(formData: FormData) {
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
          id: true,
          purchaseOrderNo: true,
          opportunityId: true,
          revision: true,
          status: true,
          version: true,
          attachments: { select: { path: true } },
          opportunity: {
            select: {
              stage: true,
              customerId: true,
              purchaseOrders: {
                where: { status: "AGREED" },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      });
      if (!purchaseOrder || purchaseOrder.status !== "DRAFT") throw new UserFacingError("Draft revisi PO tidak ditemukan.");
      if (purchaseOrder.version !== parsed.data.version) throw new UserFacingError("Draft PO sudah berubah. Muat ulang halaman.");
      if (purchaseOrder.opportunity.stage !== "NEGOSIASI") throw new UserFacingError("Draft revisi PO hanya dapat dibatalkan saat Negosiasi.");
      if (purchaseOrder.revision <= 1 || !purchaseOrder.opportunity.purchaseOrders.length) {
        throw new UserFacingError("Draft PO awal tidak dapat dibatalkan dari aksi revisi.");
      }

      const attachmentPaths = purchaseOrder.attachments.map((attachment) => attachment.path);
      const reusedAttachments = attachmentPaths.length
        ? await tx.purchaseOrderAttachment.findMany({
            where: {
              path: { in: attachmentPaths },
              purchaseOrderId: { not: purchaseOrder.id },
            },
            select: { path: true },
          })
        : [];
      const reusedAttachmentPaths = new Set(reusedAttachments.map((attachment) => attachment.path));
      await tx.purchaseOrderAttachment.deleteMany({ where: { purchaseOrderId: purchaseOrder.id } });
      await tx.purchaseOrderRosterEntry.deleteMany({ where: { purchaseOrderId: purchaseOrder.id } });
      await tx.purchaseOrderSize.deleteMany({ where: { purchaseOrderId: purchaseOrder.id } });
      const deleted = await tx.purchaseOrder.deleteMany({
        where: { id: purchaseOrder.id, status: "DRAFT", version: parsed.data.version },
      });
      if (deleted.count !== 1) throw new UserFacingError("Draft PO sudah berubah. Muat ulang halaman.");

      await audit(tx, actor, "PurchaseOrder", purchaseOrder.id, "PURCHASE_ORDER_DRAFT_CANCELLED", ["status"], {
        purchaseOrderNo: purchaseOrder.purchaseOrderNo,
        revision: purchaseOrder.revision,
      });

      return {
        opportunityId: purchaseOrder.opportunityId,
        customerId: purchaseOrder.opportunity.customerId,
        attachmentPaths: attachmentPaths.filter((path) => !reusedAttachmentPaths.has(path)),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await cleanupPurchaseOrderAttachments(result.attachmentPaths);
    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${result.opportunityId}`);
    revalidatePath(`/customers/${result.customerId}`);
    return flashMessagePath(`/crm/peluang/${result.opportunityId}?tab=po`, "notice", "Draft revisi PO dibatalkan.");
  });
}

export async function createPurchaseOrderRevisionAction(formData: FormData) {
  return runRedirectingAction(opportunityTabFallback(formData, "po"), async () => {
    const timer = documentTimer("create-po-revision");
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    timer.mark("auth");
    const sourcePurchaseOrderId = entityIdSchema.safeParse(formValue(formData, "sourcePurchaseOrderId"));
    if (!sourcePurchaseOrderId.success) throw new UserFacingError(firstValidationMessage(sourcePurchaseOrderId.error));
    const parsed = purchaseOrderDraftSchema.safeParse(purchaseOrderInput(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    timer.mark("parse");
    const rosterFile = formData.get("rosterFile");
    const replaceRosterFromFile = rosterFile instanceof File && rosterFile.size > 0;
    const importedRoster = replaceRosterFromFile ? await parseRosterFile(rosterFile) : [];
    timer.mark("roster");

    const prisma = getPrismaClient();
    const purchaseOrderId = randomUUID();
    const attachments = await validatedPurchaseOrderAttachments(formData, purchaseOrderId);
    timer.mark("attachments:read");
    const [rows, sourceAttachmentCount] = await Promise.all([
      preparePurchaseOrderRows(prisma, parsed.data, importedRoster, replaceRosterFromFile),
      prisma.purchaseOrderAttachment.count({
        where: { purchaseOrderId: sourcePurchaseOrderId.data },
      }),
    ]);
    timer.mark("rows-and-existing-attachments");
    if (sourceAttachmentCount + attachments.length > PURCHASE_ORDER_ATTACHMENT_MAX_FILES) {
      throw new UserFacingError("Maksimal lima lampiran desain per revisi PO.");
    }
    const uploadedPaths = await uploadPurchaseOrderAttachments(attachments);
    timer.mark("attachments:upload");
    let opportunityId: string;
    try {
      opportunityId = await prisma.$transaction(async (tx) => {
        const source = await tx.purchaseOrder.findUnique({
          where: { id: sourcePurchaseOrderId.data },
          select: {
            id: true,
            opportunityId: true,
            status: true,
            opportunity: {
              select: {
                stage: true,
                invoices: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
              },
            },
            attachments: { select: { path: true, originalName: true, contentType: true, sizeBytes: true, kind: true, caption: true } },
          },
        });
        if (!source || source.status !== "AGREED") throw new UserFacingError("Revisi hanya dapat dibuat dari PO Disepakati.");
        if (source.opportunityId !== parsed.data.opportunityId) throw new UserFacingError("PO sumber tidak sesuai dengan peluang.");
        if (source.opportunity.stage !== "NEGOSIASI") throw new UserFacingError("Revisi PO hanya dapat dibuat saat Negosiasi.");
        if (source.opportunity.invoices.length) throw new UserFacingError("Selesaikan invoice draft sebelum membuat revisi PO.");
        const draft = await tx.purchaseOrder.findFirst({ where: { opportunityId: source.opportunityId, status: "DRAFT" }, select: { id: true } });
        if (draft) throw new UserFacingError("Selesaikan draft PO yang sedang aktif.");
        if (source.attachments.length + attachments.length > PURCHASE_ORDER_ATTACHMENT_MAX_FILES) {
          throw new UserFacingError("Maksimal lima lampiran desain per revisi PO.");
        }
        const aggregate = await tx.purchaseOrder.aggregate({ where: { opportunityId: source.opportunityId }, _max: { revision: true } });
        const created = await tx.purchaseOrder.create({
          data: {
            id: purchaseOrderId,
            purchaseOrderNo: await nextPurchaseOrderNo(tx),
            opportunityId: source.opportunityId,
            revision: (aggregate._max.revision ?? 0) + 1,
            customerReference: parsed.data.customerReference,
            garmentType: parsed.data.garmentType,
            productName: parsed.data.productName,
            material: parsed.data.material,
            color: parsed.data.baseColor,
            baseColor: parsed.data.baseColor,
            variationColor: parsed.data.variationColor,
            decorationMethod: parsed.data.decorationMethod,
            orderDate: optionalDate(parsed.data.orderDate),
            sampleSize: parsed.data.garmentType === "JERSEY" ? parsed.data.sampleSize : null,
            designNotes: parsed.data.designNotes,
            notes: parsed.data.notes,
            deadline: optionalDate(parsed.data.deadline),
            createdById: actor.id,
            sizes: { create: rows.sizes },
            rosterEntries: { create: rows.roster },
            attachments: {
              create: [
                ...source.attachments,
                ...attachments.map(({ path, originalName, contentType, sizeBytes, kind }) => ({ path, originalName, contentType, sizeBytes, kind })),
              ],
            },
          },
          select: { id: true },
        });
        await audit(tx, actor, "PurchaseOrder", created.id, "PURCHASE_ORDER_REVISION_CREATED", [
          "revision", "garmentType", "productName", "material", "baseColor", "variationColor", "decorationMethod", "orderDate", "sampleSize", "designNotes", "notes", "deadline", "sizes", "roster", "attachments",
        ], { sourcePurchaseOrderId: source.id });
        return source.opportunityId;
      }, DOCUMENT_DRAFT_TRANSACTION_OPTIONS);
      timer.mark("transaction");
    } catch (error) {
      await cleanupPurchaseOrderAttachments(uploadedPaths);
      throw error;
    }

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${opportunityId}`);
    timer.mark("revalidate");
    return flashMessagePath(`/crm/peluang/${opportunityId}?tab=po`, "notice", "Draft revisi PO dibuat.");
  });
}

export async function createInvoiceDraftAction(formData: FormData) {
  return runRedirectingAction(opportunityTabFallback(formData, "invoice"), async () => {
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
          throw new UserFacingError("PO ini sudah memiliki invoice terbit. Gunakan aksi buat revisi dari invoice terbit.");
        }

        const purchaseOrder = await tx.purchaseOrder.findFirst({
          where: { id: parsed.data.purchaseOrderId, opportunityId: opportunity.id, status: "AGREED" },
          select: {
            productName: true,
            sizes: { select: { id: true, sizeId: true, size: true, sleeveLength: true, quantity: true }, orderBy: { position: "asc" } },
          },
        });
        if (!purchaseOrder) throw new UserFacingError("PO Disepakati tidak ditemukan.");
        const calculated = calculateInvoiceForPurchaseOrder(purchaseOrder, parsed.data.items, parsed.data.taxRate);
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
            discountType: "NONE",
            discountValue: 0,
            subtotal: calculated.subtotal,
            totalDiscount: calculated.totalDiscount,
            totalTax: calculated.totalTax,
            total: calculated.total,
            dueAt: optionalDate(parsed.data.dueAt),
            notes: parsed.data.notes,
            createdById: actor.id,
            items: { create: calculated.items },
          },
          select: { id: true },
        });
        await audit(tx, actor, "Invoice", created.id, "INVOICE_DRAFT_CREATED", [
          "purchaseOrderId", "items", "subtotal", "totalDiscount", "totalTax", "total", "dueAt", "notes",
        ], { opportunityId: opportunity.id });
        return created;
      },
      DOCUMENT_DRAFT_TRANSACTION_OPTIONS,
    );
    timer.mark("transaction");

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    timer.mark("revalidate");
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}?tab=invoice`, "notice", `Draft invoice ${invoice.id ? "berhasil dibuat" : "dibuat"}.`);
  });
}

export async function updateInvoiceDraftAction(formData: FormData) {
  return runRedirectingAction(opportunityTabFallback(formData, "invoice"), async () => {
    const timer = documentTimer("update-invoice-draft");
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    timer.mark("auth");
    const parsed = invoiceDraftSchema.safeParse(invoiceInput(formData));
    if (!parsed.success || !parsed.data.invoiceId || !parsed.data.version) {
      throw new UserFacingError(parsed.success ? "Identitas invoice tidak lengkap." : firstValidationMessage(parsed.error));
    }
    timer.mark("parse");
    const invoiceId = parsed.data.invoiceId;

    await getPrismaClient().$transaction(
      async (tx) => {
        const purchaseOrder = await tx.purchaseOrder.findFirst({
          where: { id: parsed.data.purchaseOrderId, opportunityId: parsed.data.opportunityId, status: "AGREED" },
          select: {
            productName: true,
            sizes: { select: { id: true, sizeId: true, size: true, sleeveLength: true, quantity: true }, orderBy: { position: "asc" } },
          },
        });
        if (!purchaseOrder) throw new UserFacingError("PO Disepakati tidak ditemukan.");
        const calculated = calculateInvoiceForPurchaseOrder(purchaseOrder, parsed.data.items, parsed.data.taxRate);
        const updated = await tx.invoice.updateMany({
          where: { id: invoiceId, opportunityId: parsed.data.opportunityId, status: "DRAFT", version: parsed.data.version },
          data: {
            purchaseOrderId: parsed.data.purchaseOrderId,
            discountType: "NONE",
            discountValue: 0,
            subtotal: calculated.subtotal,
            totalDiscount: calculated.totalDiscount,
            totalTax: calculated.totalTax,
            total: calculated.total,
            dueAt: optionalDate(parsed.data.dueAt),
            notes: parsed.data.notes,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new UserFacingError("Draft sudah berubah atau tidak lagi dapat diedit.");
        await tx.invoiceItem.deleteMany({ where: { invoiceId } });
        await tx.invoiceItem.createMany({
          data: calculated.items.map((item) => ({ ...item, invoiceId })),
        });
        await audit(tx, actor, "Invoice", invoiceId, "INVOICE_DRAFT_UPDATED", [
          "purchaseOrderId", "items", "subtotal", "totalDiscount", "totalTax", "total", "dueAt", "notes",
        ]);
      },
      DOCUMENT_DRAFT_TRANSACTION_OPTIONS,
    );
    timer.mark("transaction");

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
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
            },
          },
        },
      });
      if (!invoice || invoice.status !== "DRAFT") throw new UserFacingError("Invoice draft tidak ditemukan.");
      if (invoice.opportunity.stage !== "NEGOSIASI") throw new UserFacingError("Invoice hanya dapat diterbitkan saat Negosiasi.");
      if (invoice.purchaseOrder.status !== "AGREED") throw new UserFacingError("PO terkait tidak lagi berstatus Disepakati.");
      if (!invoice.items.length) throw new UserFacingError("Invoice belum memiliki item.");

      const issuedAt = new Date();
      const business = await tx.businessProfile.findUnique({ where: { id: "default" } });
      await tx.invoice.updateMany({
        where: { opportunityId: invoice.opportunityId, status: "ISSUED", id: { not: parsed.data.invoiceId } },
        data: { status: "SUPERSEDED", version: { increment: 1 } },
      });
      const updated = await tx.invoice.updateMany({
        where: { id: parsed.data.invoiceId, status: "DRAFT", version: parsed.data.version },
        data: {
          status: "ISSUED",
          issuedAt,
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
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new UserFacingError("Invoice sudah berubah. Muat ulang halaman.");
      const auditEvent = await audit(tx, actor, "Invoice", parsed.data.invoiceId, "INVOICE_ISSUED", ["status", "issuedAt", "snapshot"]);
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
      return { opportunityId: invoice.opportunityId, customerId: invoice.opportunity.customerId };
    });

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${issuedInvoice.opportunityId}`);
    revalidatePath(`/customers/${issuedInvoice.customerId}`);
    return flashMessagePath(`/crm/peluang/${issuedInvoice.opportunityId}?tab=invoice`, "notice", "Invoice diterbitkan dan dikunci.");
  });
}

export async function createInvoiceRevisionAction(formData: FormData) {
  return runRedirectingAction(opportunityTabFallback(formData, "invoice"), async () => {
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
            totalTax: true,
            total: true,
            dueAt: true,
            notes: true,
            opportunity: {
              select: {
                stage: true,
                purchaseOrders: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
              },
            },
            purchaseOrder: {
              select: {
                status: true,
                productName: true,
                sizes: { select: { id: true, sizeId: true, size: true, sleeveLength: true, quantity: true }, orderBy: { position: "asc" } },
              },
            },
          },
        });
        if (!source || source.status !== "ISSUED") {
          throw new UserFacingError("Revisi hanya dapat dibuat dari invoice Terbit.");
        }
        if (source.opportunityId !== parsed.data.opportunityId || source.purchaseOrderId !== parsed.data.purchaseOrderId) {
          throw new UserFacingError("Invoice sumber tidak sesuai dengan peluang atau PO aktif.");
        }
        if (source.opportunity.stage !== "NEGOSIASI" || source.purchaseOrder.status !== "AGREED") {
          throw new UserFacingError("Revisi invoice hanya dapat dibuat dari PO aktif saat Negosiasi.");
        }
        if (source.opportunity.purchaseOrders.length) throw new UserFacingError("Sepakati atau selesaikan draft PO sebelum merevisi invoice.");
        const existingDraft = await tx.invoice.findFirst({ where: { opportunityId: source.opportunityId, status: "DRAFT" }, select: { id: true } });
        if (existingDraft) throw new UserFacingError("Selesaikan draft yang sedang aktif sebelum membuat revisi.");

        const calculated = calculateInvoiceForPurchaseOrder(source.purchaseOrder, parsed.data.items, parsed.data.taxRate);
        const aggregate = await tx.invoice.aggregate({ where: { opportunityId: source.opportunityId }, _max: { revision: true } });
        const created = await tx.invoice.create({
          data: {
            invoiceNo: await nextInvoiceNo(tx),
            opportunityId: source.opportunityId,
            purchaseOrderId: source.purchaseOrderId,
            revision: (aggregate._max.revision ?? 0) + 1,
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
            discountType: "NONE",
            discountValue: 0,
            subtotal: calculated.subtotal,
            totalDiscount: calculated.totalDiscount,
            totalTax: calculated.totalTax,
            total: calculated.total,
            dueAt: optionalDate(parsed.data.dueAt),
            notes: parsed.data.notes,
            createdById: actor.id,
            items: { create: calculated.items },
          },
          select: { id: true },
        });
        await audit(tx, actor, "Invoice", created.id, "INVOICE_REVISION_CREATED", [
          "revision", "purchaseOrderId", "items", "subtotal", "totalDiscount", "totalTax", "total", "dueAt", "notes",
        ], { sourceInvoiceId: source.id });
        return source.opportunityId;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${opportunityId}`);
    return flashMessagePath(`/crm/peluang/${opportunityId}?tab=invoice`, "notice", "Draft revisi invoice dibuat.");
  });
}

export async function cancelInvoiceDraftAction(formData: FormData) {
  return runRedirectingAction(opportunityTabFallback(formData, "invoice"), async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = invoiceIdSchema.safeParse({
      invoiceId: formValue(formData, "invoiceId"),
      version: formValue(formData, "version"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const result = await getPrismaClient().$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: parsed.data.invoiceId },
        select: {
          id: true,
          invoiceNo: true,
          opportunityId: true,
          revision: true,
          status: true,
          version: true,
          opportunity: {
            select: {
              stage: true,
              customerId: true,
              invoices: {
                where: { status: "ISSUED" },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      });
      if (!invoice || invoice.status !== "DRAFT") throw new UserFacingError("Draft revisi invoice tidak ditemukan.");
      if (invoice.version !== parsed.data.version) throw new UserFacingError("Draft invoice sudah berubah. Muat ulang halaman.");
      if (invoice.opportunity.stage !== "NEGOSIASI") throw new UserFacingError("Draft revisi invoice hanya dapat dibatalkan saat Negosiasi.");
      if (invoice.revision <= 1 || !invoice.opportunity.invoices.length) {
        throw new UserFacingError("Draft invoice awal tidak dapat dibatalkan dari aksi revisi.");
      }

      await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
      const deleted = await tx.invoice.deleteMany({
        where: { id: invoice.id, status: "DRAFT", version: parsed.data.version },
      });
      if (deleted.count !== 1) throw new UserFacingError("Draft invoice sudah berubah. Muat ulang halaman.");

      await audit(tx, actor, "Invoice", invoice.id, "INVOICE_DRAFT_CANCELLED", ["status"], {
        invoiceNo: invoice.invoiceNo,
        revision: invoice.revision,
      });

      return { opportunityId: invoice.opportunityId, customerId: invoice.opportunity.customerId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${result.opportunityId}`);
    revalidatePath(`/customers/${result.customerId}`);
    return flashMessagePath(`/crm/peluang/${result.opportunityId}?tab=invoice`, "notice", "Draft revisi invoice dibatalkan.");
  });
}

export async function completeDealAction(formData: FormData) {
  const fallbackOpportunityId = entityIdSchema.safeParse(formValue(formData, "opportunityId"));
  const fallbackPath = fallbackOpportunityId.success ? `/crm/peluang/${fallbackOpportunityId.data}?tab=deal` : "/crm";
  return runRedirectingAction(fallbackPath, async () => {
    const actor = await requireActor(DEAL_ROLES);
    const parsed = completeDealSchema.safeParse(completeDealInput(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const paidAt = optionalDate(parsed.data.initialDueAt);
    if (!paidAt) throw new UserFacingError("Deadline pembayaran awal wajib diisi.");
    const salesOrder = await runDealTransaction(
        async (tx) => {
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
            total: true,
            salesOrder: { select: { id: true } },
            purchaseOrder: { select: { purchaseOrderNo: true, status: true, garmentType: true, deadline: true } },
            items: {
              select: {
                position: true, productName: true, size: true, sleeveLength: true, description: true, quantity: true,
                unitPrice: true, grossAmount: true, discountPercent: true, discountCapAmount: true,
                discountAmount: true, taxRate: true, taxAmount: true, total: true, subtotal: true,
              },
              orderBy: { position: "asc" },
            },
            opportunity: {
              select: {
                stage: true,
                version: true,
                customerId: true,
                purchaseOrders: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
                invoices: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
              },
            },
          },
        });
        if (!invoice || invoice.status !== "ISSUED") throw new UserFacingError("Invoice tidak lagi berstatus terbit.");
        if (invoice.purchaseOrderId !== parsed.data.purchaseOrderId || invoice.purchaseOrder.status !== "AGREED") {
          throw new UserFacingError("Invoice tidak terhubung ke PO Disepakati yang dipilih.");
        }
        if (!invoice.purchaseOrder.garmentType) throw new UserFacingError("Jenis pakaian pada PO belum ditentukan. Buat revisi PO terlebih dahulu.");
        if (!invoice.purchaseOrder.deadline) throw new UserFacingError("Deadline produksi pada PO belum ditentukan. Buat revisi PO terlebih dahulu.");
        if (invoice.opportunity.stage !== "NEGOSIASI") throw new UserFacingError("Peluang tidak lagi berada di Negosiasi.");
        if (invoice.opportunity.purchaseOrders.length || invoice.opportunity.invoices.length) throw new UserFacingError("Selesaikan seluruh draft PO dan invoice sebelum Deal.");
        if (invoice.opportunity.version !== parsed.data.opportunityVersion) throw new UserFacingError("Peluang sudah berubah. Muat ulang board.");
        if (invoice.salesOrder) throw new UserFacingError("Invoice ini sudah memiliki Sales Order.");
        const activeOrder = await tx.salesOrder.findFirst({ where: { opportunityId: invoice.opportunityId, status: "ACTIVE" }, select: { id: true } });
        if (activeOrder) throw new UserFacingError("Peluang ini sudah memiliki Sales Order aktif.");

        const invoiceCurrent = await tx.invoice.count({ where: { id: invoice.id, status: "ISSUED", version: parsed.data.invoiceVersion } });
        if (invoiceCurrent !== 1) throw new UserFacingError("Invoice sudah berubah. Muat ulang halaman.");

        const amountFor = (valueType: "NOMINAL" | "PERCENTAGE", value: string) => {
          const decimal = new Prisma.Decimal(value);
          if (valueType === "PERCENTAGE" && decimal.gt(100)) throw new UserFacingError("Persentase pembayaran maksimal 100%.");
          return valueType === "PERCENTAGE" ? invoice.total.mul(decimal).div(100).toDecimalPlaces(2) : decimal;
        };
        const initialValueType = parsed.data.kind === "LUNAS" ? "NOMINAL" as const : parsed.data.initialValueType;
        const initialValue = parsed.data.kind === "LUNAS" ? invoice.total : new Prisma.Decimal(parsed.data.initialValue);
        const initialAmount = parsed.data.kind === "LUNAS" ? invoice.total : amountFor(parsed.data.initialValueType, parsed.data.initialValue);
        if (initialAmount.lte(0) || initialAmount.gt(invoice.total)) throw new UserFacingError("Nilai pembayaran awal tidak valid.");
        if (parsed.data.kind === "DP" && initialAmount.eq(invoice.total)) throw new UserFacingError("Gunakan jenis Lunas jika pembayaran awal sebesar total invoice.");

        let previousDueAt: Date | null = null;
        const terms = parsed.data.terms.map((term, position) => {
          const dueAt = optionalDate(term.dueAt);
          if (!dueAt) throw new UserFacingError("Tanggal termin wajib diisi.");
          if (previousDueAt && dueAt < previousDueAt) throw new UserFacingError("Tanggal termin harus berurutan.");
          previousDueAt = dueAt;
          return {
            position,
            valueType: term.valueType,
            value: new Prisma.Decimal(term.value),
            amount: amountFor(term.valueType, term.value),
            dueAt,
          };
        });
        const scheduledTotal = terms.reduce((sum, term) => sum.add(term.amount), initialAmount);
        if (!scheduledTotal.eq(invoice.total)) throw new UserFacingError("Pembayaran awal dan seluruh termin harus sama dengan total invoice.");
        const outstandingAmount = invoice.total.sub(initialAmount);

        const opportunityUpdated = await tx.opportunity.updateMany({
          where: { id: invoice.opportunityId, stage: "NEGOSIASI", version: parsed.data.opportunityVersion },
          data: { stage: "DEAL", nextAction: null, nextActionAt: null, cancelReason: null, version: { increment: 1 } },
        });
        if (opportunityUpdated.count !== 1) throw new UserFacingError("Peluang sudah berubah. Muat ulang halaman.");

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
            total: invoice.total,
            acceptedAt: paidAt,
            createdById: actor.id,
            items: { create: invoice.items },
            payment: {
              create: {
                kind: parsed.data.kind,
                paidAt,
                initialValueType,
                initialValue,
                initialAmount,
                outstandingAmount,
                createdById: actor.id,
                terms: { create: terms },
                transactions: {
                  create: {
                    amount: initialAmount,
                    paidAt,
                    createdById: actor.id,
                  },
                },
              },
            },
          },
          select: { id: true, salesOrderNo: true },
        });

        await ensureProductionWorkOrder(tx, actor, created.id);

        const salesOrderAudit = await audit(tx, actor, "SalesOrder", created.id, "SALES_ORDER_CREATED", ["status", "snapshot", "items", "total", "payment", "terms"], {
          opportunityId: invoice.opportunityId,
          purchaseOrderId: invoice.purchaseOrderId,
          invoiceId: invoice.id,
          paymentKind: parsed.data.kind,
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
            paymentKind: parsed.data.kind,
          },
          sourceAuditEventId: salesOrderAudit.id,
        });
        await scheduleCustomerReminders(tx, {
          customerId: invoice.opportunity.customerId,
          sourceSalesOrderId: created.id,
          acceptedAt: paidAt,
        });
        return {
          ...created,
          customerId: invoice.opportunity.customerId,
          opportunityId: invoice.opportunityId,
        };
        },
      );

    revalidatePath("/crm");
    revalidatePath("/dashboard");
    revalidatePath("/keuangan");
    revalidatePath("/produksi");
    revalidatePath(`/crm/peluang/${salesOrder.opportunityId}`);
    revalidatePath(`/customers/${salesOrder.customerId}`);
    revalidateCustomerReminders();
    return flashMessagePath(`/sales-orders/${salesOrder.id}`, "notice", `${salesOrder.salesOrderNo} berhasil dibuat.`);
  });
}

function crmActionSuccess(): CrmActionState {
  return { error: null, success: true };
}

function crmActionFailure(error: unknown): CrmActionState {
  return { error: messageForError(error), success: false };
}

function revalidatePaymentMutationPaths(salesOrderId?: string) {
  if (salesOrderId) revalidatePath(`/sales-orders/${salesOrderId}`);
  revalidatePath("/crm");
  revalidatePath("/dashboard");
  revalidatePath("/keuangan");
  revalidatePath("/produksi");
}

async function createSalesOrderFromPendingPayment(formData: FormData) {
  const actor = await requireActor(DEAL_ROLES);
  const parsed = payPendingInitialPaymentSchema.safeParse({
    invoiceId: formValue(formData, "invoiceId"),
    paymentMethodId: formValue(formData, "paymentMethodId"),
    reference: formValue(formData, "reference"),
    note: formValue(formData, "note"),
  });
  if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
  const paidAt = new Date();

  return runDealTransaction(async (tx) => {
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
        total: true,
        salesOrder: { select: { id: true } },
        purchaseOrder: { select: { purchaseOrderNo: true, status: true, garmentType: true, deadline: true } },
        items: {
          select: {
            position: true, productName: true, size: true, sleeveLength: true, description: true, quantity: true,
            unitPrice: true, grossAmount: true, discountPercent: true, discountCapAmount: true,
            discountAmount: true, taxRate: true, taxAmount: true, total: true, subtotal: true,
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
            purchaseOrders: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
            invoices: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
          },
        },
      },
    });
    if (!invoice || invoice.status !== "ISSUED") throw new UserFacingError("Invoice tidak lagi berstatus terbit.");
    if (!invoice.pendingPayment) throw new UserFacingError("Jadwal pembayaran invoice tidak ditemukan.");
    if (invoice.purchaseOrder.status !== "AGREED") throw new UserFacingError("Invoice tidak terhubung ke PO Disepakati.");
    if (!invoice.purchaseOrder.garmentType) throw new UserFacingError("Jenis pakaian pada PO belum ditentukan. Buat revisi PO terlebih dahulu.");
    if (!invoice.purchaseOrder.deadline) throw new UserFacingError("Deadline produksi pada PO belum ditentukan. Buat revisi PO terlebih dahulu.");
    if (invoice.opportunity.stage !== "NEGOSIASI") throw new UserFacingError("Peluang tidak lagi berada di Negosiasi.");
    if (invoice.opportunity.purchaseOrders.length || invoice.opportunity.invoices.length) throw new UserFacingError("Selesaikan seluruh draft PO dan invoice sebelum Deal.");
    if (invoice.salesOrder) throw new UserFacingError("Invoice ini sudah memiliki Sales Order.");

    const activeOrder = await tx.salesOrder.findFirst({ where: { opportunityId: invoice.opportunityId, status: "ACTIVE" }, select: { id: true } });
    if (activeOrder) throw new UserFacingError("Peluang ini sudah memiliki Sales Order aktif.");

    const scheduledTotal = invoice.pendingPayment.terms.reduce((sum, term) => sum.add(term.amount), invoice.pendingPayment.initialAmount);
    if (!scheduledTotal.eq(invoice.total)) throw new UserFacingError("Jadwal pembayaran tidak sama dengan total invoice.");
    const outstandingAmount = invoice.total.sub(invoice.pendingPayment.initialAmount);

    const opportunityUpdated = await tx.opportunity.updateMany({
      where: { id: invoice.opportunityId, stage: "NEGOSIASI" },
      data: { stage: "DEAL", nextAction: null, nextActionAt: null, cancelReason: null, version: { increment: 1 } },
    });
    if (opportunityUpdated.count !== 1) throw new UserFacingError("Peluang sudah berubah. Muat ulang halaman.");

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
        total: invoice.total,
        acceptedAt: paidAt,
        createdById: actor.id,
        items: { create: invoice.items },
        payment: {
          create: {
            kind: invoice.pendingPayment.kind,
            paidAt,
            initialValueType: invoice.pendingPayment.initialValueType,
            initialValue: invoice.pendingPayment.initialValue,
            initialAmount: invoice.pendingPayment.initialAmount,
            outstandingAmount,
            createdById: actor.id,
            terms: { create: invoice.pendingPayment.terms.map(({ position, valueType, value, amount, dueAt }) => ({ position, valueType, value, amount, dueAt })) },
            transactions: {
              create: {
                amount: invoice.pendingPayment.initialAmount,
                paidAt,
                paymentMethodId: parsed.data.paymentMethodId,
                reference: parsed.data.reference,
                note: parsed.data.note,
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
  });
  if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
  const reference = typeof formValue(formData, "reference") === "string" ? String(formValue(formData, "reference")).trim() || null : null;
  const note = typeof formValue(formData, "note") === "string" ? String(formValue(formData, "note")).trim() || null : null;

  await runDealTransaction(async (tx) => {
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
        paidAt,
        reference,
        note,
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
            productionWorkOrder: { select: { id: true, status: true, currentStage: true } },
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

        if (order.productionWorkOrder && order.productionWorkOrder.status !== "CANCELLED") {
          await tx.productionWorkOrder.update({
            where: { id: order.productionWorkOrder.id },
            data: { status: "CANCELLED", cancelledAt, version: { increment: 1 } },
          });
          await tx.productionActivity.create({
            data: {
              workOrderId: order.productionWorkOrder.id,
              actorId: actor.id,
              type: "CANCELLED",
              fromStage: order.productionWorkOrder.currentStage,
              note: parsed.data.cancelReason,
            },
          });
          await audit(tx, actor, "ProductionWorkOrder", order.productionWorkOrder.id, "PRODUCTION_WORK_ORDER_CANCELLED", ["status", "cancelledAt"], { salesOrderId: parsed.data.salesOrderId });
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
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/crm");
    revalidatePath(`/sales-orders/${parsed.data.salesOrderId}`);
    revalidatePath(`/crm/peluang/${cancelledOrder.opportunityId}`);
    revalidatePath(`/customers/${cancelledOrder.customerId}`);
    revalidateCustomerReminders();
    return flashMessagePath(`/crm/peluang/${cancelledOrder.opportunityId}?tab=deal`, "notice", "Sales Order dibatalkan dan peluang dipindahkan ke Lost.");
  });
}
