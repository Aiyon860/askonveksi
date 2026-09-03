"use server";

import { Prisma, type CommunicationSystemEvent } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { flashMessagePath, messageForError, UserFacingError, runRedirectingAction } from "@/lib/actions/response";
import { ARCHIVE_ROLES, CRM_OPERATOR_ROLES, DEAL_ROLES, REVERSE_DEAL_ROLES } from "@/lib/auth/permissions";
import { requireActor, type Actor } from "@/lib/auth/session";
import { OPEN_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
import { nextCustomerNo, nextOpportunityNo, nextInvoiceNo, nextPurchaseOrderNo, nextSalesOrderNo } from "@/lib/crm/numbers";
import {
  rearmCustomerRemindersAfterLost,
  restoreCustomerRemindersAfterCancellation,
  scheduleCustomerReminders,
} from "@/lib/crm/reminders";
import {
  completeDealSchema,
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
  PURCHASE_ORDER_ATTACHMENT_TYPES,
  recordFollowUpResultSchema,
  reverseSalesOrderSchema,
  updateCustomerSchema,
  updateOpportunitySchema,
} from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createProductionWorkOrder } from "@/lib/production/service";
import { createAdminClient } from "@/lib/supabase/admin";

type Tx = Prisma.TransactionClient;
const PURCHASE_ORDER_ATTACHMENT_BUCKET = "crm-po-designs";
const DEAL_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 20_000,
} as const;

function revalidateCustomerReminders() {
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

function formValue(formData: FormData, key: string) {
  return formData.get(key);
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
  const files = formData.getAll("designAttachments").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > PURCHASE_ORDER_ATTACHMENT_MAX_FILES) throw new UserFacingError("Maksimal lima lampiran desain per revisi PO.");

  return Promise.all(files.map(async (file) => {
    if (file.size > PURCHASE_ORDER_ATTACHMENT_MAX_BYTES) throw new UserFacingError("Setiap lampiran desain maksimal 5 MB.");
    if (!PURCHASE_ORDER_ATTACHMENT_TYPES.includes(file.type as (typeof PURCHASE_ORDER_ATTACHMENT_TYPES)[number])) {
      throw new UserFacingError("Lampiran desain harus berformat JPG, PNG, WebP, atau PDF.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
    const isWebp = bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
    const isPdf = bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
    const matchesDeclaredType = file.type === "image/jpeg"
      ? isJpeg
      : file.type === "image/png"
        ? isPng
        : file.type === "image/webp"
          ? isWebp
          : isPdf;
    if (!matchesDeclaredType) throw new UserFacingError("Isi lampiran tidak sesuai dengan format file yang dipilih.");

    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "application/pdf" ? "pdf" : "jpg";
    return {
      bytes,
      contentType: file.type,
      originalName: file.name.slice(0, 255),
      sizeBytes: file.size,
      path: `${purchaseOrderId}/${randomUUID()}.${extension}`,
    };
  }));
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

function invoiceInput(formData: FormData) {
  const sizes = formData.getAll("itemSize");
  const descriptions = formData.getAll("itemDescription");
  const quantities = formData.getAll("itemQuantity");
  const unitPrices = formData.getAll("itemUnitPrice");
  const length = Math.max(sizes.length, descriptions.length, quantities.length, unitPrices.length);
  const items = Array.from({ length }, (_, index) => ({
    size: sizes[index],
    description: descriptions[index],
    quantity: quantities[index],
    unitPrice: unitPrices[index],
  }));

  return {
    opportunityId: formValue(formData, "opportunityId"),
    purchaseOrderId: formValue(formData, "purchaseOrderId"),
    invoiceId: formValue(formData, "invoiceId") || undefined,
    version: formValue(formData, "version") || undefined,
    dueAt: formValue(formData, "dueAt"),
    notes: formValue(formData, "notes"),
    discountType: formValue(formData, "discountType"),
    discountValue: formValue(formData, "discountValue"),
    items,
  };
}

function purchaseOrderInput(formData: FormData) {
  const sizes = formData.getAll("size");
  const quantities = formData.getAll("sizeQuantity");
  return {
    opportunityId: formValue(formData, "opportunityId"),
    purchaseOrderId: formValue(formData, "purchaseOrderId") || undefined,
    version: formValue(formData, "version") || undefined,
    customerReference: formValue(formData, "customerReference"),
    productName: formValue(formData, "productName"),
    material: formValue(formData, "material"),
    color: formValue(formData, "color"),
    designNotes: formValue(formData, "designNotes"),
    notes: formValue(formData, "notes"),
    deadline: formValue(formData, "deadline"),
    sizes: Array.from({ length: Math.max(sizes.length, quantities.length) }, (_, index) => ({
      size: sizes[index],
      quantity: quantities[index],
    })),
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
    paidAt: formValue(formData, "paidAt"),
    initialValueType: formValue(formData, "initialValueType"),
    initialValue: formValue(formData, "initialValue"),
    terms: Array.from({ length: Math.max(valueTypes.length, values.length, dueDates.length) }, (_, index) => ({
      valueType: valueTypes[index],
      value: values[index],
      dueAt: dueDates[index],
    })),
    productionRoute: formValue(formData, "productionRoute"),
    productionProductName: formValue(formData, "productionProductName"),
    productionDeadline: formValue(formData, "productionDeadline"),
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
    needPurpose: formValue(formData, "needPurpose"),
    designStatus: formValue(formData, "designStatus"),
    specification: formValue(formData, "specification"),
    customerBudget: formValue(formData, "customerBudget"),
    leadScore: formValue(formData, "leadScore") || "0",
    estimatedQuantity: formValue(formData, "estimatedQuantity"),
    estimatedValue: formValue(formData, "estimatedValue"),
    deadline: formValue(formData, "deadline"),
    nextAction: formValue(formData, "nextAction"),
    nextActionAt: formValue(formData, "nextActionAt"),
  };
}

function calculateInvoice(data: {
  discountType: "NONE" | "NOMINAL" | "PERCENTAGE";
  discountValue: string;
  items: Array<{ size: string; description: string; quantity: number; unitPrice: string }>;
}) {
  const items = data.items.map((item, position) => {
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    return {
      position,
      size: item.size,
      description: item.description,
      quantity: item.quantity,
      unitPrice,
      subtotal: unitPrice.mul(item.quantity),
    };
  });
  const subtotal = items.reduce((sum, item) => sum.add(item.subtotal), new Prisma.Decimal(0));
  const discountValue = data.discountType === "NONE" ? new Prisma.Decimal(0) : new Prisma.Decimal(data.discountValue);

  if (data.discountType === "PERCENTAGE" && discountValue.gt(100)) {
    throw new UserFacingError("Diskon persentase maksimal 100%.");
  }

  const discountAmount =
    data.discountType === "PERCENTAGE"
      ? subtotal.mul(discountValue).div(100)
      : data.discountType === "NOMINAL"
        ? discountValue
        : new Prisma.Decimal(0);

  if (discountAmount.gt(subtotal)) throw new UserFacingError("Diskon tidak boleh melebihi subtotal.");

  return { items, subtotal, discountValue, total: subtotal.sub(discountAmount) };
}

async function uploadPurchaseOrderAttachments(
  attachments: Awaited<ReturnType<typeof validatedPurchaseOrderAttachments>>,
) {
  const uploaded: string[] = [];
  try {
    for (const attachment of attachments) {
      const { error } = await createAdminClient().storage
        .from(PURCHASE_ORDER_ATTACHMENT_BUCKET)
        .upload(attachment.path, attachment.bytes, { contentType: attachment.contentType, upsert: false });
      if (error) throw new UserFacingError("Lampiran desain belum dapat disimpan.");
      uploaded.push(attachment.path);
    }
    return uploaded;
  } catch (error) {
    if (uploaded.length) await createAdminClient().storage.from(PURCHASE_ORDER_ATTACHMENT_BUCKET).remove(uploaded);
    throw error;
  }
}

async function cleanupPurchaseOrderAttachments(paths: string[]) {
  if (paths.length) await createAdminClient().storage.from(PURCHASE_ORDER_ATTACHMENT_BUCKET).remove(paths);
}

export async function createCustomerAction(formData: FormData) {
  return runRedirectingAction("/crm/pelanggan", async () => {
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
    revalidatePath("/crm/pelanggan");
    return flashMessagePath("/crm/pelanggan", "notice", "Customer berhasil dibuat.");
  });
}

export async function updateCustomerAction(formData: FormData) {
  return runRedirectingAction("/crm/pelanggan", async () => {
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

    revalidatePath("/crm/pelanggan");
    revalidatePath(`/crm/pelanggan/${customerId}`);
    revalidateCustomerReminders();
    return flashMessagePath("/crm/pelanggan", "notice", "Data customer diperbarui.");
  });
}

export async function archiveCustomerAction(formData: FormData) {
  return runRedirectingAction("/crm/pelanggan", async () => {
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
    revalidatePath("/crm/pelanggan");
    revalidatePath(`/crm/pelanggan/${parsed.data.customerId}`);
    revalidateCustomerReminders();
    return flashMessagePath("/crm/pelanggan", "notice", "Customer diarsipkan.");
  });
}

export async function restoreCustomerAction(formData: FormData) {
  return runRedirectingAction("/crm/pelanggan?segment=archived", async () => {
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
    revalidatePath("/crm/pelanggan");
    revalidatePath(`/crm/pelanggan/${parsed.data.customerId}`);
    revalidateCustomerReminders();
    return flashMessagePath("/crm/pelanggan?segment=archived", "notice", "Customer diaktifkan kembali.");
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
            needPurpose: parsed.data.needPurpose,
            designStatus: parsed.data.designStatus,
            specification: parsed.data.specification,
            customerBudget: parsed.data.customerBudget ? new Prisma.Decimal(parsed.data.customerBudget) : null,
            leadScore: parsed.data.leadScore,
            estimatedQuantity: parsed.data.estimatedQuantity,
            estimatedValue: parsed.data.estimatedValue ? new Prisma.Decimal(parsed.data.estimatedValue) : null,
            deadline: optionalDate(parsed.data.deadline),
            nextAction: parsed.data.nextAction,
            nextActionAt: jakartaDateTime(parsed.data.nextActionAt),
          },
          select: { id: true },
        });
        await audit(tx, actor, "Opportunity", created.id, "OPPORTUNITY_CREATED", [
          "customerId", "title", "leadSourceId", "salesPicId", "productName", "needPurpose", "designStatus",
          "specification", "customerBudget", "leadScore", "estimatedQuantity", "estimatedValue", "deadline",
          "nextAction", "nextActionAt", "stage",
        ], { stage: "LEAD_BARU" });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/crm");
    revalidatePath("/crm/pelanggan");
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
          needPurpose: opportunityParsed.data.needPurpose,
          designStatus: opportunityParsed.data.designStatus,
          specification: opportunityParsed.data.specification,
          customerBudget: opportunityParsed.data.customerBudget ? new Prisma.Decimal(opportunityParsed.data.customerBudget) : null,
          leadScore: opportunityParsed.data.leadScore,
          estimatedQuantity: opportunityParsed.data.estimatedQuantity,
          estimatedValue: opportunityParsed.data.estimatedValue ? new Prisma.Decimal(opportunityParsed.data.estimatedValue) : null,
          deadline: optionalDate(opportunityParsed.data.deadline),
          nextAction: opportunityParsed.data.nextAction,
          nextActionAt: jakartaDateTime(opportunityParsed.data.nextActionAt),
        },
        select: { id: true },
      });
      await audit(tx, actor, "Opportunity", created.id, "OPPORTUNITY_CREATED", [
        "customerId", "title", "leadSourceId", "salesPicId", "productName", "needPurpose", "designStatus",
        "specification", "customerBudget", "leadScore", "estimatedQuantity", "estimatedValue", "deadline", "nextAction", "nextActionAt", "stage",
      ], { stage: "LEAD_BARU" });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/crm");
    revalidatePath("/crm/pelanggan");
    revalidatePath("/dashboard");
    revalidateCustomerReminders();
    return flashMessagePath(`/crm/peluang/${opportunity.id}`, "notice", "Lead baru berhasil dibuat.");
  });
}

export async function updateOpportunityAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = updateOpportunitySchema.safeParse({
      opportunityId: formValue(formData, "opportunityId"),
      version: formValue(formData, "version"),
      ...opportunityInput(formData),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const result = await getPrismaClient().$transaction(async (tx) => {
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
          needPurpose: parsed.data.needPurpose ?? null,
          designStatus: parsed.data.designStatus ?? null,
          specification: parsed.data.specification ?? null,
          customerBudget: parsed.data.customerBudget ? new Prisma.Decimal(parsed.data.customerBudget) : null,
          leadScore: parsed.data.leadScore,
          estimatedQuantity: parsed.data.estimatedQuantity,
          estimatedValue: parsed.data.estimatedValue ? new Prisma.Decimal(parsed.data.estimatedValue) : null,
          deadline: optionalDate(parsed.data.deadline),
          nextAction: parsed.data.nextAction ?? null,
          nextActionAt: jakartaDateTime(parsed.data.nextActionAt),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new UserFacingError("Peluang sudah berubah. Muat ulang halaman.");
      await audit(tx, actor, "Opportunity", parsed.data.opportunityId, "OPPORTUNITY_UPDATED", [
        "title", "leadSourceId", "salesPicId", "productName", "needPurpose", "designStatus", "specification",
        "customerBudget", "leadScore", "estimatedQuantity", "estimatedValue", "deadline", "nextAction", "nextActionAt",
      ]);
      return updated;
    });
    if (!result.count) throw new UserFacingError("Peluang tidak dapat diperbarui.");

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}`, "notice", "Peluang diperbarui.");
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
      LEAD_BARU: ["FOLLOW_UP", "LOST"],
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
  revalidatePath(`/crm/pelanggan/${customerId}`);
  revalidateCustomerReminders();
  return { ...parsed.data, customerId };
}

export async function moveOpportunityStageAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    await moveOpportunityStage(formData);
    return flashMessagePath("/crm", "notice", "Status peluang diperbarui.");
  });
}

export async function moveOpportunityStageOptimisticAction(formData: FormData) {
  try {
    const moved = await moveOpportunityStage(formData);
    return { ok: true as const, opportunityId: moved.opportunityId, version: moved.version + 1 };
  } catch (error) {
    return { ok: false as const, message: messageForError(error) };
  }
}

export async function addCommunicationActivityAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
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

    revalidatePath(`/crm/pelanggan/${parsed.data.customerId}`);
    if (parsed.data.opportunityId) revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    const destination = parsed.data.context === "opportunity" && parsed.data.opportunityId
      ? `/crm/peluang/${parsed.data.opportunityId}`
      : `/crm/pelanggan/${parsed.data.customerId}`;
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
    revalidatePath(`/crm/pelanggan/${customerId}`);
    revalidateCustomerReminders();
    return flashMessagePath("/crm/follow-up", "notice", "Hasil follow-up dan langkah berikutnya tersimpan.");
  });
}

export async function createPurchaseOrderDraftAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = purchaseOrderDraftSchema.safeParse(purchaseOrderInput(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const purchaseOrderId = randomUUID();
    const attachments = await validatedPurchaseOrderAttachments(formData, purchaseOrderId);
    const uploadedPaths = await uploadPurchaseOrderAttachments(attachments);
    try {
      await getPrismaClient().$transaction(async (tx) => {
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
            productName: parsed.data.productName,
            material: parsed.data.material,
            color: parsed.data.color,
            designNotes: parsed.data.designNotes,
            notes: parsed.data.notes,
            deadline: optionalDate(parsed.data.deadline),
            createdById: actor.id,
            sizes: { create: parsed.data.sizes.map((item, position) => ({ ...item, position })) },
            attachments: {
              create: attachments.map(({ path, originalName, contentType, sizeBytes }) => ({ path, originalName, contentType, sizeBytes })),
            },
          },
          select: { id: true },
        });
        await audit(tx, actor, "PurchaseOrder", created.id, "PURCHASE_ORDER_DRAFT_CREATED", [
          "productName", "material", "color", "designNotes", "notes", "deadline", "sizes", "attachments",
        ], { opportunityId: parsed.data.opportunityId });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      await cleanupPurchaseOrderAttachments(uploadedPaths);
      throw error;
    }

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}`, "notice", "Draft PO dibuat.");
  });
}

export async function updatePurchaseOrderDraftAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = purchaseOrderDraftSchema.safeParse(purchaseOrderInput(formData));
    if (!parsed.success || !parsed.data.purchaseOrderId || !parsed.data.version) {
      throw new UserFacingError(parsed.success ? "Identitas PO tidak lengkap." : firstValidationMessage(parsed.error));
    }
    const purchaseOrderId = parsed.data.purchaseOrderId;
    const attachments = await validatedPurchaseOrderAttachments(formData, purchaseOrderId);
    const existingAttachmentCount = await getPrismaClient().purchaseOrderAttachment.count({ where: { purchaseOrderId } });
    if (existingAttachmentCount + attachments.length > PURCHASE_ORDER_ATTACHMENT_MAX_FILES) {
      throw new UserFacingError("Maksimal lima lampiran desain per revisi PO.");
    }
    const uploadedPaths = await uploadPurchaseOrderAttachments(attachments);
    try {
      await getPrismaClient().$transaction(async (tx) => {
        const updated = await tx.purchaseOrder.updateMany({
          where: { id: purchaseOrderId, opportunityId: parsed.data.opportunityId, status: "DRAFT", version: parsed.data.version },
          data: {
            customerReference: parsed.data.customerReference,
            productName: parsed.data.productName,
            material: parsed.data.material,
            color: parsed.data.color,
            designNotes: parsed.data.designNotes,
            notes: parsed.data.notes,
            deadline: optionalDate(parsed.data.deadline),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new UserFacingError("Draft PO sudah berubah atau tidak lagi dapat diedit.");
        await tx.purchaseOrderSize.deleteMany({ where: { purchaseOrderId } });
        await tx.purchaseOrderSize.createMany({
          data: parsed.data.sizes.map((item, position) => ({ purchaseOrderId, position, ...item })),
        });
        if (attachments.length) {
          await tx.purchaseOrderAttachment.createMany({
            data: attachments.map(({ path, originalName, contentType, sizeBytes }) => ({ purchaseOrderId, path, originalName, contentType, sizeBytes })),
          });
        }
        await audit(tx, actor, "PurchaseOrder", purchaseOrderId, "PURCHASE_ORDER_DRAFT_UPDATED", [
          "productName", "material", "color", "designNotes", "notes", "deadline", "sizes", "attachments",
        ]);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      await cleanupPurchaseOrderAttachments(uploadedPaths);
      throw error;
    }

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}`, "notice", "Draft PO diperbarui.");
  });
}

export async function agreePurchaseOrderAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
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
        data: { status: "AGREED", agreedAt, version: { increment: 1 } },
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
    revalidatePath(`/crm/pelanggan/${result.customerId}`);
    return flashMessagePath(`/crm/peluang/${result.opportunityId}`, "notice", "PO disepakati dan dikunci.");
  });
}

export async function createPurchaseOrderRevisionAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const purchaseOrderId = entityIdSchema.safeParse(formValue(formData, "purchaseOrderId"));
    if (!purchaseOrderId.success) throw new UserFacingError(firstValidationMessage(purchaseOrderId.error));

    const opportunityId = await getPrismaClient().$transaction(async (tx) => {
      const source = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId.data },
        select: {
          id: true, opportunityId: true, status: true, customerReference: true, productName: true, material: true,
          color: true, designNotes: true, notes: true, deadline: true,
          opportunity: {
            select: {
              stage: true,
              invoices: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
            },
          },
          sizes: { select: { position: true, size: true, quantity: true }, orderBy: { position: "asc" } },
          attachments: { select: { path: true, originalName: true, contentType: true, sizeBytes: true } },
        },
      });
      if (!source || source.status !== "AGREED") throw new UserFacingError("Revisi hanya dapat dibuat dari PO Disepakati.");
      if (source.opportunity.stage !== "NEGOSIASI") throw new UserFacingError("Revisi PO hanya dapat dibuat saat Negosiasi.");
      if (source.opportunity.invoices.length) throw new UserFacingError("Selesaikan invoice draft sebelum membuat revisi PO.");
      const draft = await tx.purchaseOrder.findFirst({ where: { opportunityId: source.opportunityId, status: "DRAFT" }, select: { id: true } });
      if (draft) throw new UserFacingError("Selesaikan draft PO yang sedang aktif.");
      const aggregate = await tx.purchaseOrder.aggregate({ where: { opportunityId: source.opportunityId }, _max: { revision: true } });
      const created = await tx.purchaseOrder.create({
        data: {
          purchaseOrderNo: await nextPurchaseOrderNo(tx),
          opportunityId: source.opportunityId,
          revision: (aggregate._max.revision ?? 0) + 1,
          customerReference: source.customerReference,
          productName: source.productName,
          material: source.material,
          color: source.color,
          designNotes: source.designNotes,
          notes: source.notes,
          deadline: source.deadline,
          createdById: actor.id,
          sizes: { create: source.sizes },
          attachments: { create: source.attachments },
        },
        select: { id: true },
      });
      await audit(tx, actor, "PurchaseOrder", created.id, "PURCHASE_ORDER_REVISION_CREATED", ["revision", "sizes", "attachments"], { sourcePurchaseOrderId: source.id });
      return source.opportunityId;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${opportunityId}`);
    return flashMessagePath(`/crm/peluang/${opportunityId}`, "notice", "Draft revisi PO dibuat.");
  });
}

export async function createInvoiceDraftAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = invoiceDraftSchema.safeParse(invoiceInput(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const calculated = calculateInvoice(parsed.data);

    const invoice = await getPrismaClient().$transaction(
      async (tx) => {
        const opportunity = await tx.opportunity.findUnique({
          where: { id: parsed.data.opportunityId },
          select: {
            id: true,
            stage: true,
            customer: { select: { name: true, companyName: true, whatsapp: true, email: true, instagram: true, address: true, archivedAt: true } },
            invoices: { where: { status: { in: ["DRAFT", "ISSUED"] } }, select: { id: true, status: true } },
            purchaseOrders: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
          },
        });
        if (!opportunity || opportunity.customer.archivedAt) throw new UserFacingError("Peluang aktif tidak ditemukan.");
        if (opportunity.stage !== "NEGOSIASI") throw new UserFacingError("Invoice hanya dapat dibuat saat Negosiasi.");
        if (opportunity.purchaseOrders.length) throw new UserFacingError("Sepakati atau selesaikan draft PO sebelum membuat invoice.");
        if (opportunity.invoices.some((item) => item.status === "DRAFT")) throw new UserFacingError("Peluang ini masih memiliki invoice draft.");
        if (opportunity.invoices.some((item) => item.status === "ISSUED")) throw new UserFacingError("Gunakan aksi buat revisi dari invoice terbit.");

        const purchaseOrder = await tx.purchaseOrder.findFirst({
          where: { id: parsed.data.purchaseOrderId, opportunityId: opportunity.id, status: "AGREED" },
          select: { sizes: { select: { size: true, quantity: true }, orderBy: { position: "asc" } } },
        });
        if (!purchaseOrder) throw new UserFacingError("PO Disepakati tidak ditemukan.");
        const expected = new Map(purchaseOrder.sizes.map((item) => [item.size.toLocaleLowerCase("id-ID"), item.quantity]));
        if (calculated.items.length !== expected.size || calculated.items.some((item) => expected.get(item.size.toLocaleLowerCase("id-ID")) !== item.quantity)) {
          throw new UserFacingError("Ukuran dan jumlah invoice harus sama dengan PO.");
        }

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
            discountType: parsed.data.discountType,
            discountValue: calculated.discountValue,
            subtotal: calculated.subtotal,
            total: calculated.total,
            dueAt: optionalDate(parsed.data.dueAt),
            notes: parsed.data.notes,
            createdById: actor.id,
            items: { create: calculated.items },
          },
          select: { id: true },
        });
        await audit(tx, actor, "Invoice", created.id, "INVOICE_DRAFT_CREATED", [
          "purchaseOrderId", "items", "discountType", "discountValue", "subtotal", "total", "dueAt", "notes",
        ], { opportunityId: opportunity.id });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}`, "notice", `Draft invoice ${invoice.id ? "berhasil dibuat" : "dibuat"}.`);
  });
}

export async function updateInvoiceDraftAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = invoiceDraftSchema.safeParse(invoiceInput(formData));
    if (!parsed.success || !parsed.data.invoiceId || !parsed.data.version) {
      throw new UserFacingError(parsed.success ? "Identitas invoice tidak lengkap." : firstValidationMessage(parsed.error));
    }
    const invoiceId = parsed.data.invoiceId;
    const calculated = calculateInvoice(parsed.data);

    await getPrismaClient().$transaction(
      async (tx) => {
        const purchaseOrder = await tx.purchaseOrder.findFirst({
          where: { id: parsed.data.purchaseOrderId, opportunityId: parsed.data.opportunityId, status: "AGREED" },
          select: { sizes: { select: { size: true, quantity: true } } },
        });
        if (!purchaseOrder) throw new UserFacingError("PO Disepakati tidak ditemukan.");
        const expected = new Map(purchaseOrder.sizes.map((item) => [item.size.toLocaleLowerCase("id-ID"), item.quantity]));
        if (calculated.items.length !== expected.size || calculated.items.some((item) => expected.get(item.size.toLocaleLowerCase("id-ID")) !== item.quantity)) {
          throw new UserFacingError("Ukuran dan jumlah invoice harus sama dengan PO.");
        }
        const updated = await tx.invoice.updateMany({
          where: { id: invoiceId, opportunityId: parsed.data.opportunityId, status: "DRAFT", version: parsed.data.version },
          data: {
            purchaseOrderId: parsed.data.purchaseOrderId,
            discountType: parsed.data.discountType,
            discountValue: calculated.discountValue,
            subtotal: calculated.subtotal,
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
          "purchaseOrderId", "items", "discountType", "discountValue", "subtotal", "total", "dueAt", "notes",
        ]);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}`, "notice", "Draft invoice diperbarui.");
  });
}

export async function issueInvoiceAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
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
    revalidatePath(`/crm/pelanggan/${issuedInvoice.customerId}`);
    return flashMessagePath(`/crm/peluang/${issuedInvoice.opportunityId}`, "notice", "Invoice diterbitkan dan dikunci.");
  });
}

export async function createInvoiceRevisionAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const invoiceId = entityIdSchema.safeParse(formValue(formData, "invoiceId"));
    if (!invoiceId.success) throw new UserFacingError(firstValidationMessage(invoiceId.error));

    const opportunityId = await getPrismaClient().$transaction(
      async (tx) => {
        const source = await tx.invoice.findUnique({
          where: { id: invoiceId.data },
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
            discountType: true,
            discountValue: true,
            subtotal: true,
            total: true,
            dueAt: true,
            notes: true,
            opportunity: {
              select: {
                stage: true,
                purchaseOrders: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
              },
            },
            purchaseOrder: { select: { status: true } },
            items: { select: { position: true, size: true, description: true, quantity: true, unitPrice: true, subtotal: true }, orderBy: { position: "asc" } },
          },
        });
        if (!source || source.status !== "ISSUED") {
          throw new UserFacingError("Revisi hanya dapat dibuat dari invoice Terbit.");
        }
        if (source.opportunity.stage !== "NEGOSIASI" || source.purchaseOrder.status !== "AGREED") {
          throw new UserFacingError("Revisi invoice hanya dapat dibuat dari PO aktif saat Negosiasi.");
        }
        if (source.opportunity.purchaseOrders.length) throw new UserFacingError("Sepakati atau selesaikan draft PO sebelum merevisi invoice.");
        const existingDraft = await tx.invoice.findFirst({ where: { opportunityId: source.opportunityId, status: "DRAFT" }, select: { id: true } });
        if (existingDraft) throw new UserFacingError("Selesaikan draft yang sedang aktif sebelum membuat revisi.");

        if (source.status === "ISSUED") {
          const superseded = await tx.invoice.updateMany({ where: { id: source.id, status: "ISSUED" }, data: { status: "SUPERSEDED", version: { increment: 1 } } });
          if (superseded.count !== 1) throw new UserFacingError("Status invoice sudah berubah.");
        }
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
            discountType: source.discountType,
            discountValue: source.discountValue,
            subtotal: source.subtotal,
            total: source.total,
            dueAt: source.dueAt,
            notes: source.notes,
            createdById: actor.id,
            items: { create: source.items },
          },
          select: { id: true },
        });
        await audit(tx, actor, "Invoice", created.id, "INVOICE_REVISION_CREATED", ["revision", "items"], { sourceInvoiceId: source.id });
        return source.opportunityId;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/crm");
    revalidatePath(`/crm/peluang/${opportunityId}`);
    return flashMessagePath(`/crm/peluang/${opportunityId}`, "notice", "Draft revisi invoice dibuat.");
  });
}

export async function completeDealAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor(DEAL_ROLES);
    const parsed = completeDealSchema.safeParse(completeDealInput(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const paidAt = jakartaDateTime(parsed.data.paidAt);
    if (!paidAt) throw new UserFacingError("Tanggal pembayaran wajib diisi.");
    if (paidAt.getTime() > Date.now() + 5 * 60 * 1000) throw new UserFacingError("Tanggal pembayaran tidak boleh berada di masa depan.");
    const productionDeadline = optionalDate(parsed.data.productionDeadline);
    if (!productionDeadline || productionDeadline.toISOString().slice(0, 10) !== parsed.data.productionDeadline) throw new UserFacingError("Deadline produksi tidak valid.");

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
            purchaseOrder: { select: { purchaseOrderNo: true, status: true } },
            items: { select: { position: true, size: true, description: true, quantity: true, unitPrice: true, subtotal: true }, orderBy: { position: "asc" } },
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
              },
            },
          },
          select: { id: true, salesOrderNo: true },
        });

        await createProductionWorkOrder(tx, actor, {
          salesOrderId: created.id,
          route: parsed.data.productionRoute,
          productName: parsed.data.productionProductName,
          quantity: invoice.items.reduce((sum, item) => sum + item.quantity, 0),
          deadline: productionDeadline,
        });

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
    revalidatePath(`/crm/peluang/${salesOrder.opportunityId}`);
    revalidatePath(`/crm/pelanggan/${salesOrder.customerId}`);
    revalidateCustomerReminders();
    return flashMessagePath(`/sales-orders/${salesOrder.id}`, "notice", `${salesOrder.salesOrderNo} berhasil dibuat.`);
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
    revalidatePath(`/crm/pelanggan/${cancelledOrder.customerId}`);
    revalidateCustomerReminders();
    return flashMessagePath(`/crm/peluang/${cancelledOrder.opportunityId}`, "notice", "Sales Order dibatalkan dan peluang dipindahkan ke Lost.");
  });
}
