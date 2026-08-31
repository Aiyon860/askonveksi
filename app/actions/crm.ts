"use server";

import { Prisma, type CommunicationSystemEvent } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { flashMessagePath, messageForError, UserFacingError, runRedirectingAction } from "@/lib/actions/response";
import { ARCHIVE_ROLES, REVERSE_DEAL_ROLES } from "@/lib/auth/permissions";
import { requireActor, type Actor } from "@/lib/auth/session";
import { OPEN_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
import { nextCustomerNo, nextOpportunityNo, nextQuotationNo, nextSalesOrderNo } from "@/lib/crm/numbers";
import {
  rearmCustomerRemindersAfterLost,
  restoreCustomerRemindersAfterCancellation,
  scheduleCustomerReminders,
} from "@/lib/crm/reminders";
import {
  acceptQuotationSchema,
  ACCEPTANCE_PROOF_MAX_BYTES,
  ACCEPTANCE_PROOF_TYPES,
  addCommunicationActivitySchema,
  archiveCustomerSchema,
  createCustomerSchema,
  createOpportunitySchema,
  entityIdSchema,
  firstValidationMessage,
  moveOpportunitySchema,
  opportunityFieldsSchema,
  quotationDraftSchema,
  quotationIdSchema,
  recordFollowUpResultSchema,
  reverseSalesOrderSchema,
  updateCustomerSchema,
  updateOpportunitySchema,
} from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

type Tx = Prisma.TransactionClient;
const ACCEPTANCE_PROOF_BUCKET = "quotation-acceptance-proofs";

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

async function validatedAcceptanceProof(value: FormDataEntryValue | null, quotationId: string) {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > ACCEPTANCE_PROOF_MAX_BYTES) throw new UserFacingError("Bukti gambar maksimal 5 MB.");
  if (!ACCEPTANCE_PROOF_TYPES.includes(value.type as (typeof ACCEPTANCE_PROOF_TYPES)[number])) {
    throw new UserFacingError("Bukti gambar harus berformat JPG, PNG, atau WebP.");
  }

  const bytes = new Uint8Array(await value.arrayBuffer());
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  const isWebp = bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!(isJpeg || isPng || isWebp)) throw new UserFacingError("Isi file tidak sesuai dengan format gambar yang dipilih.");

  const extension = value.type === "image/png" ? "png" : value.type === "image/webp" ? "webp" : "jpg";
  return {
    bytes,
    contentType: value.type,
    originalName: value.name.slice(0, 255),
    path: `${quotationId}/${randomUUID()}.${extension}`,
  };
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

function quotationInput(formData: FormData) {
  const descriptions = formData.getAll("itemDescription");
  const quantities = formData.getAll("itemQuantity");
  const unitPrices = formData.getAll("itemUnitPrice");
  const length = Math.max(descriptions.length, quantities.length, unitPrices.length);
  const items = Array.from({ length }, (_, index) => ({
    description: descriptions[index],
    quantity: quantities[index],
    unitPrice: unitPrices[index],
  }));

  return {
    opportunityId: formValue(formData, "opportunityId"),
    quotationId: formValue(formData, "quotationId") || undefined,
    version: formValue(formData, "version") || undefined,
    discountType: formValue(formData, "discountType"),
    discountValue: formValue(formData, "discountValue"),
    items,
  };
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

function calculateQuotation(data: {
  discountType: "NONE" | "NOMINAL" | "PERCENTAGE";
  discountValue: string;
  items: Array<{ description: string; quantity: number; unitPrice: string }>;
}) {
  const items = data.items.map((item, position) => {
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    return {
      position,
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

export async function createCustomerAction(formData: FormData) {
  return runRedirectingAction("/crm/pelanggan", async () => {
    const actor = await requireActor();
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
    const actor = await requireActor();
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
    const actor = await requireActor();
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
    const actor = await requireActor();
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
    const actor = await requireActor();
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
  const actor = await requireActor();
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
    if (current.stage === "DEAL") throw new UserFacingError("Deal hanya dapat dibalik melalui Sales Order oleh Owner/Admin.");

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
    const actor = await requireActor();
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
    const actor = await requireActor();
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

export async function createQuotationDraftAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor();
    const parsed = quotationDraftSchema.safeParse(quotationInput(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const calculated = calculateQuotation(parsed.data);

    const quotation = await getPrismaClient().$transaction(
      async (tx) => {
        const opportunity = await tx.opportunity.findUnique({
          where: { id: parsed.data.opportunityId },
          select: {
            id: true,
            stage: true,
            customer: { select: { name: true, companyName: true, whatsapp: true, email: true, instagram: true, address: true, archivedAt: true } },
            quotations: { where: { status: "DRAFT" }, select: { id: true }, take: 1 },
            _count: { select: { quotations: true } },
          },
        });
        if (!opportunity || opportunity.customer.archivedAt) throw new UserFacingError("Peluang aktif tidak ditemukan.");
        if (!(opportunity.stage === "PENAWARAN" || opportunity.stage === "NEGOSIASI")) throw new UserFacingError("Quotation hanya dapat dibuat pada stage Penawaran atau Negosiasi.");
        if (opportunity.quotations.length) throw new UserFacingError("Peluang ini masih memiliki quotation draft.");
        if (opportunity._count.quotations > 0) throw new UserFacingError("Gunakan aksi buat revisi dari quotation sebelumnya.");

        const created = await tx.quotation.create({
          data: {
            quotationNo: await nextQuotationNo(tx),
            opportunityId: opportunity.id,
            revision: 1,
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
            createdById: actor.id,
            items: { create: calculated.items },
          },
          select: { id: true },
        });
        await audit(tx, actor, "Quotation", created.id, "QUOTATION_DRAFT_CREATED", [
          "items", "discountType", "discountValue", "subtotal", "total",
        ], { opportunityId: opportunity.id });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}`, "notice", `Draft quotation ${quotation.id ? "berhasil dibuat" : "dibuat"}.`);
  });
}

export async function updateQuotationDraftAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor();
    const parsed = quotationDraftSchema.safeParse(quotationInput(formData));
    if (!parsed.success || !parsed.data.quotationId || !parsed.data.version) {
      throw new UserFacingError(parsed.success ? "Identitas quotation tidak lengkap." : firstValidationMessage(parsed.error));
    }
    const quotationId = parsed.data.quotationId;
    const calculated = calculateQuotation(parsed.data);

    await getPrismaClient().$transaction(
      async (tx) => {
        const updated = await tx.quotation.updateMany({
          where: { id: quotationId, opportunityId: parsed.data.opportunityId, status: "DRAFT", version: parsed.data.version },
          data: {
            discountType: parsed.data.discountType,
            discountValue: calculated.discountValue,
            subtotal: calculated.subtotal,
            total: calculated.total,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new UserFacingError("Draft sudah berubah atau tidak lagi dapat diedit.");
        await tx.quotationItem.deleteMany({ where: { quotationId } });
        await tx.quotationItem.createMany({
          data: calculated.items.map((item) => ({ ...item, quotationId })),
        });
        await audit(tx, actor, "Quotation", quotationId, "QUOTATION_DRAFT_UPDATED", [
          "items", "discountType", "discountValue", "subtotal", "total",
        ]);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}`, "notice", "Draft quotation diperbarui.");
  });
}

export async function issueQuotationAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor();
    const parsed = quotationIdSchema.safeParse({ quotationId: formValue(formData, "quotationId"), version: formValue(formData, "version") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const issuedQuotation = await getPrismaClient().$transaction(async (tx) => {
      const quotation = await tx.quotation.findUnique({
        where: { id: parsed.data.quotationId },
        select: {
          opportunityId: true,
          quotationNo: true,
          revision: true,
          status: true,
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
      if (!quotation || quotation.status !== "DRAFT") throw new UserFacingError("Quotation draft tidak ditemukan.");
      if (!(quotation.opportunity.stage === "PENAWARAN" || quotation.opportunity.stage === "NEGOSIASI")) throw new UserFacingError("Quotation hanya dapat diterbitkan pada stage Penawaran atau Negosiasi.");
      if (!quotation.items.length) throw new UserFacingError("Quotation belum memiliki item.");

      const issuedAt = new Date();
      const updated = await tx.quotation.updateMany({
        where: { id: parsed.data.quotationId, status: "DRAFT", version: parsed.data.version },
        data: {
          status: "ISSUED",
          issuedAt,
          snapshotCustomerName: quotation.opportunity.customer.name,
          snapshotCompanyName: quotation.opportunity.customer.companyName,
          snapshotWhatsapp: quotation.opportunity.customer.whatsapp,
          snapshotEmail: quotation.opportunity.customer.email,
          snapshotInstagram: quotation.opportunity.customer.instagram,
          snapshotAddress: quotation.opportunity.customer.address,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new UserFacingError("Quotation sudah berubah. Muat ulang halaman.");
      const auditEvent = await audit(tx, actor, "Quotation", parsed.data.quotationId, "QUOTATION_ISSUED", ["status", "issuedAt", "snapshot"]);
      await addSystemActivity(tx, actor, {
        customerId: quotation.opportunity.customerId,
        opportunityId: quotation.opportunityId,
        systemEvent: "QUOTATION_ISSUED",
        content: `Quotation ${quotation.quotationNo} diterbitkan.`,
        occurredAt: issuedAt,
        metadata: {
          quotationId: parsed.data.quotationId,
          quotationNo: quotation.quotationNo,
          revision: quotation.revision,
        },
        sourceAuditEventId: auditEvent.id,
      });
      return { opportunityId: quotation.opportunityId, customerId: quotation.opportunity.customerId };
    });

    revalidatePath(`/crm/peluang/${issuedQuotation.opportunityId}`);
    revalidatePath(`/crm/pelanggan/${issuedQuotation.customerId}`);
    return flashMessagePath(`/crm/peluang/${issuedQuotation.opportunityId}`, "notice", "Quotation diterbitkan dan dikunci.");
  });
}

export async function createQuotationRevisionAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor();
    const quotationId = entityIdSchema.safeParse(formValue(formData, "quotationId"));
    if (!quotationId.success) throw new UserFacingError(firstValidationMessage(quotationId.error));

    const opportunityId = await getPrismaClient().$transaction(
      async (tx) => {
        const source = await tx.quotation.findUnique({
          where: { id: quotationId.data },
          select: {
            id: true,
            opportunityId: true,
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
            opportunity: { select: { stage: true } },
            items: { select: { position: true, description: true, quantity: true, unitPrice: true, subtotal: true }, orderBy: { position: "asc" } },
          },
        });
        if (!source || !(["ISSUED", "ACCEPTED"] as const).includes(source.status as "ISSUED" | "ACCEPTED")) {
          throw new UserFacingError("Revisi hanya dapat dibuat dari quotation terbit atau diterima.");
        }
        if (!(source.opportunity.stage === "PENAWARAN" || source.opportunity.stage === "NEGOSIASI")) {
          throw new UserFacingError("Revisi hanya dapat dibuat pada stage Penawaran atau Negosiasi.");
        }
        const existingDraft = await tx.quotation.findFirst({ where: { opportunityId: source.opportunityId, status: "DRAFT" }, select: { id: true } });
        if (existingDraft) throw new UserFacingError("Selesaikan draft yang sedang aktif sebelum membuat revisi.");

        if (source.status === "ISSUED") {
          const superseded = await tx.quotation.updateMany({ where: { id: source.id, status: "ISSUED" }, data: { status: "SUPERSEDED", version: { increment: 1 } } });
          if (superseded.count !== 1) throw new UserFacingError("Status quotation sudah berubah.");
        }
        const aggregate = await tx.quotation.aggregate({ where: { opportunityId: source.opportunityId }, _max: { revision: true } });
        const created = await tx.quotation.create({
          data: {
            quotationNo: await nextQuotationNo(tx),
            opportunityId: source.opportunityId,
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
            createdById: actor.id,
            items: { create: source.items },
          },
          select: { id: true },
        });
        await audit(tx, actor, "Quotation", created.id, "QUOTATION_REVISION_CREATED", ["revision", "items"], { sourceQuotationId: source.id });
        return source.opportunityId;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath(`/crm/peluang/${opportunityId}`);
    return flashMessagePath(`/crm/peluang/${opportunityId}`, "notice", "Draft revisi quotation dibuat.");
  });
}

export async function acceptQuotationAndDealAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor();
    const parsed = acceptQuotationSchema.safeParse({
      quotationId: formValue(formData, "quotationId"),
      version: formValue(formData, "version"),
      acceptedAt: formValue(formData, "acceptedAt"),
      acceptanceReference: formValue(formData, "acceptanceReference"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const acceptedAt = jakartaDateTime(parsed.data.acceptedAt);
    if (!acceptedAt) throw new UserFacingError("Tanggal penerimaan wajib diisi.");
    if (acceptedAt.getTime() > Date.now() + 5 * 60 * 1000) throw new UserFacingError("Tanggal penerimaan tidak boleh berada di masa depan.");

    const proof = await validatedAcceptanceProof(formValue(formData, "acceptanceProof"), parsed.data.quotationId);
    if (proof) {
      const { error } = await createAdminClient().storage.from(ACCEPTANCE_PROOF_BUCKET).upload(proof.path, proof.bytes, {
        contentType: proof.contentType,
        upsert: false,
      });
      if (error) throw new UserFacingError("Bukti gambar belum dapat disimpan. Pastikan migrasi Storage sudah diterapkan.");
    }

    let salesOrder: { id: string; salesOrderNo: string; customerId: string; opportunityId: string };
    try {
      salesOrder = await getPrismaClient().$transaction(
        async (tx) => {
        const quotation = await tx.quotation.findUnique({
          where: { id: parsed.data.quotationId },
          select: {
            id: true,
            quotationNo: true,
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
            items: { select: { position: true, description: true, quantity: true, unitPrice: true, subtotal: true }, orderBy: { position: "asc" } },
            opportunity: { select: { stage: true, version: true, customerId: true } },
          },
        });
        if (!quotation || quotation.status !== "ISSUED") throw new UserFacingError("Quotation tidak lagi berstatus terbit.");
        if (!(quotation.opportunity.stage === "PENAWARAN" || quotation.opportunity.stage === "NEGOSIASI")) throw new UserFacingError("Peluang tidak lagi berada di stage Penawaran atau Negosiasi.");
        if (quotation.salesOrder) throw new UserFacingError("Quotation ini sudah memiliki Sales Order.");
        const activeOrder = await tx.salesOrder.findFirst({ where: { opportunityId: quotation.opportunityId, status: "ACTIVE" }, select: { id: true } });
        if (activeOrder) throw new UserFacingError("Peluang ini sudah memiliki Sales Order aktif.");

        const accepted = await tx.quotation.updateMany({
          where: { id: quotation.id, status: "ISSUED", version: parsed.data.version },
          data: {
            status: "ACCEPTED",
            acceptedAt,
            acceptanceReference: parsed.data.acceptanceReference,
            acceptanceProofPath: proof?.path,
            acceptanceProofName: proof?.originalName,
            acceptanceProofType: proof?.contentType,
            version: { increment: 1 },
          },
        });
        if (accepted.count !== 1) throw new UserFacingError("Quotation sudah berubah. Muat ulang halaman.");

        const opportunityUpdated = await tx.opportunity.updateMany({
          where: { id: quotation.opportunityId, stage: { in: ["PENAWARAN", "NEGOSIASI"] }, version: quotation.opportunity.version },
          data: { stage: "DEAL", nextAction: null, nextActionAt: null, cancelReason: null, version: { increment: 1 } },
        });
        if (opportunityUpdated.count !== 1) throw new UserFacingError("Peluang sudah berubah. Muat ulang halaman.");

        const created = await tx.salesOrder.create({
          data: {
            salesOrderNo: await nextSalesOrderNo(tx),
            opportunityId: quotation.opportunityId,
            quotationId: quotation.id,
            quotationNo: quotation.quotationNo,
            snapshotCustomerName: quotation.snapshotCustomerName,
            snapshotCompanyName: quotation.snapshotCompanyName,
            snapshotWhatsapp: quotation.snapshotWhatsapp,
            snapshotEmail: quotation.snapshotEmail,
            snapshotInstagram: quotation.snapshotInstagram,
            snapshotAddress: quotation.snapshotAddress,
            discountType: quotation.discountType,
            discountValue: quotation.discountValue,
            subtotal: quotation.subtotal,
            total: quotation.total,
            acceptedAt,
            createdById: actor.id,
            items: { create: quotation.items },
          },
          select: { id: true, salesOrderNo: true },
        });

        await audit(tx, actor, "Quotation", quotation.id, "QUOTATION_ACCEPTED", ["status", "acceptedAt", "acceptanceReference", "acceptanceProofPath"]);
        const salesOrderAudit = await audit(tx, actor, "SalesOrder", created.id, "SALES_ORDER_CREATED", ["status", "snapshot", "items", "total"], { opportunityId: quotation.opportunityId, quotationId: quotation.id });
        await audit(tx, actor, "Opportunity", quotation.opportunityId, "OPPORTUNITY_STAGE_CHANGED", ["stage"], { from: quotation.opportunity.stage, to: "DEAL" });
        await addSystemActivity(tx, actor, {
          customerId: quotation.opportunity.customerId,
          opportunityId: quotation.opportunityId,
          systemEvent: "DEAL_ORDER_CREATED",
          content: `Customer deal dan Sales Order ${created.salesOrderNo} terbentuk.`,
          occurredAt: acceptedAt,
          metadata: {
            quotationId: quotation.id,
            quotationNo: quotation.quotationNo,
            salesOrderId: created.id,
            salesOrderNo: created.salesOrderNo,
          },
          sourceAuditEventId: salesOrderAudit.id,
        });
        await scheduleCustomerReminders(tx, {
          customerId: quotation.opportunity.customerId,
          sourceSalesOrderId: created.id,
          acceptedAt,
        });
        return {
          ...created,
          customerId: quotation.opportunity.customerId,
          opportunityId: quotation.opportunityId,
        };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (proof) await createAdminClient().storage.from(ACCEPTANCE_PROOF_BUCKET).remove([proof.path]);
      throw error;
    }

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
          data: { stage: "PENAWARAN", version: { increment: 1 } },
        });
        if (opportunity.count !== 1) throw new UserFacingError("Peluang sudah berubah.");

        const salesOrderAudit = await audit(tx, actor, "SalesOrder", parsed.data.salesOrderId, "SALES_ORDER_CANCELLED", ["status", "cancelledAt", "cancelledById", "cancelReason"]);
        await audit(tx, actor, "Opportunity", order.opportunityId, "OPPORTUNITY_STAGE_CHANGED", ["stage"], { from: "DEAL", to: "PENAWARAN" });
        await addSystemActivity(tx, actor, {
          customerId: order.opportunity.customerId,
          opportunityId: order.opportunityId,
          systemEvent: "SALES_ORDER_CANCELLED",
          content: `Sales Order ${order.salesOrderNo} dibatalkan dan peluang dikembalikan ke Penawaran.`,
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
    return flashMessagePath(`/crm/peluang/${cancelledOrder.opportunityId}`, "notice", "Sales Order dibatalkan dan peluang dikembalikan ke Penawaran.");
  });
}
