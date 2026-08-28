"use server";

import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { flashMessagePath, messageForError, UserFacingError, runRedirectingAction } from "@/lib/actions/response";
import { ARCHIVE_ROLES, REVERSE_DEAL_ROLES } from "@/lib/auth/permissions";
import { requireActor, type Actor } from "@/lib/auth/session";
import { OPEN_STAGES } from "@/lib/crm/constants";
import { nextCustomerNo, nextOpportunityNo, nextQuotationNo, nextSalesOrderNo } from "@/lib/crm/numbers";
import {
  acceptQuotationSchema,
  ACCEPTANCE_PROOF_MAX_BYTES,
  ACCEPTANCE_PROOF_TYPES,
  addNoteSchema,
  archiveCustomerSchema,
  createCustomerSchema,
  createOpportunitySchema,
  entityIdSchema,
  firstValidationMessage,
  moveOpportunitySchema,
  quotationDraftSchema,
  quotationIdSchema,
  reverseSalesOrderSchema,
  updateCustomerSchema,
  updateOpportunitySchema,
} from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

type Tx = Prisma.TransactionClient;
const ACCEPTANCE_PROOF_BUCKET = "quotation-acceptance-proofs";

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
  await tx.auditEvent.create({
    data: { actorId: actor.id, entityType, entityId, action, changedFields, metadata },
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

    const customer = await getPrismaClient().$transaction(
      async (tx) => {
        const created = await tx.customer.create({
          data: { ...parsed.data, email: parsed.data.email?.toLowerCase(), customerNo: await nextCustomerNo(tx) },
          select: { id: true },
        });
        await audit(tx, actor, "Customer", created.id, "CUSTOMER_CREATED", [
          "name", "companyName", "whatsapp", "email", "instagram", "address",
        ]);
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/crm");
    revalidatePath("/crm/pelanggan");
    return flashMessagePath(`/crm/pelanggan/${customer.id}`, "notice", "Customer berhasil dibuat.");
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
      const updated = await tx.customer.updateMany({
        where: { id: customerId, version, archivedAt: null },
        data: { ...fields, email: fields.email?.toLowerCase(), version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new UserFacingError("Customer sudah berubah atau telah diarsipkan. Muat ulang halaman.");
      await audit(tx, actor, "Customer", customerId, "CUSTOMER_UPDATED", [
        "name", "companyName", "whatsapp", "email", "instagram", "address",
      ]);
      return updated;
    });
    if (!result.count) throw new UserFacingError("Customer tidak dapat diperbarui.");

    revalidatePath("/crm/pelanggan");
    revalidatePath(`/crm/pelanggan/${customerId}`);
    return flashMessagePath(`/crm/pelanggan/${customerId}`, "notice", "Data customer diperbarui.");
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
    return flashMessagePath("/crm/pelanggan", "notice", "Customer diarsipkan.");
  });
}

export async function restoreCustomerAction(formData: FormData) {
  return runRedirectingAction("/crm/pelanggan?archived=true", async () => {
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
    return flashMessagePath("/crm/pelanggan?archived=true", "notice", "Customer diaktifkan kembali.");
  });
}

export async function createOpportunityAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor();
    const parsed = createOpportunitySchema.safeParse({
      customerId: formValue(formData, "customerId"),
      title: formValue(formData, "title"),
      estimatedQuantity: formValue(formData, "estimatedQuantity"),
      estimatedValue: formValue(formData, "estimatedValue"),
      deadline: formValue(formData, "deadline"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const prisma = getPrismaClient();
    const opportunity = await prisma.$transaction(
      async (tx) => {
        const customer = await tx.customer.findFirst({
          where: { id: parsed.data.customerId, archivedAt: null },
          select: { id: true },
        });
        if (!customer) throw new UserFacingError("Customer aktif tidak ditemukan.");

        const created = await tx.opportunity.create({
          data: {
            opportunityNo: await nextOpportunityNo(tx),
            customerId: customer.id,
            title: parsed.data.title,
            estimatedQuantity: parsed.data.estimatedQuantity,
            estimatedValue: parsed.data.estimatedValue ? new Prisma.Decimal(parsed.data.estimatedValue) : null,
            deadline: optionalDate(parsed.data.deadline),
          },
          select: { id: true },
        });
        await audit(tx, actor, "Opportunity", created.id, "OPPORTUNITY_CREATED", [
          "customerId", "title", "estimatedQuantity", "estimatedValue", "deadline", "stage",
        ], { stage: "LEAD" });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/crm");
    revalidatePath("/crm/pelanggan");
    return flashMessagePath(`/crm/peluang/${opportunity.id}`, "notice", "Lead baru berhasil dibuat.");
  });
}

export async function updateOpportunityAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor();
    const parsed = updateOpportunitySchema.safeParse({
      opportunityId: formValue(formData, "opportunityId"),
      version: formValue(formData, "version"),
      title: formValue(formData, "title"),
      estimatedQuantity: formValue(formData, "estimatedQuantity"),
      estimatedValue: formValue(formData, "estimatedValue"),
      deadline: formValue(formData, "deadline"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const result = await getPrismaClient().$transaction(async (tx) => {
      const updated = await tx.opportunity.updateMany({
        where: { id: parsed.data.opportunityId, version: parsed.data.version },
        data: {
          title: parsed.data.title,
          estimatedQuantity: parsed.data.estimatedQuantity,
          estimatedValue: parsed.data.estimatedValue ? new Prisma.Decimal(parsed.data.estimatedValue) : null,
          deadline: optionalDate(parsed.data.deadline),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new UserFacingError("Peluang sudah berubah. Muat ulang halaman.");
      await audit(tx, actor, "Opportunity", parsed.data.opportunityId, "OPPORTUNITY_UPDATED", [
        "title", "estimatedQuantity", "estimatedValue", "deadline",
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
    followUpAt: formValue(formData, "followUpAt"),
    cancelReason: formValue(formData, "cancelReason"),
  });
  if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

  const followUpAt = jakartaDateTime(parsed.data.followUpAt);
  if (parsed.data.stage === "FOLLOW_UP" && followUpAt && followUpAt <= new Date()) {
    throw new UserFacingError("Jadwal follow-up harus berada di masa mendatang.");
  }

  await getPrismaClient().$transaction(async (tx) => {
    const current = await tx.opportunity.findUnique({
      where: { id: parsed.data.opportunityId },
      select: { stage: true },
    });
    if (!current) throw new UserFacingError("Peluang tidak ditemukan.");
    if (current.stage === "DEAL") throw new UserFacingError("Deal hanya dapat dibalik melalui Sales Order oleh Owner/Admin.");

    const updated = await tx.opportunity.updateMany({
      where: { id: parsed.data.opportunityId, version: parsed.data.version, stage: { not: "DEAL" } },
      data: {
        stage: parsed.data.stage,
        followUpAt: parsed.data.stage === "FOLLOW_UP" ? followUpAt : null,
        cancelReason: parsed.data.stage === "BATAL" ? parsed.data.cancelReason : null,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new UserFacingError("Status sudah berubah. Muat ulang board.");
    await audit(tx, actor, "Opportunity", parsed.data.opportunityId, "OPPORTUNITY_STAGE_CHANGED", [
      "stage", "followUpAt", "cancelReason",
    ], { from: current.stage, to: parsed.data.stage });
  });

  revalidatePath("/crm");
  revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
  return parsed.data;
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

export async function addNoteAction(formData: FormData) {
  return runRedirectingAction("/crm", async () => {
    const actor = await requireActor();
    const parsed = addNoteSchema.safeParse({
      opportunityId: formValue(formData, "opportunityId"),
      content: formValue(formData, "content"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    await getPrismaClient().$transaction(async (tx) => {
      const exists = await tx.opportunity.findUnique({ where: { id: parsed.data.opportunityId }, select: { id: true } });
      if (!exists) throw new UserFacingError("Peluang tidak ditemukan.");
      const note = await tx.cRMNote.create({
        data: { opportunityId: parsed.data.opportunityId, authorId: actor.id, content: parsed.data.content },
        select: { id: true },
      });
      await audit(tx, actor, "CRMNote", note.id, "NOTE_ADDED", ["content"], { opportunityId: parsed.data.opportunityId });
    });

    revalidatePath(`/crm/peluang/${parsed.data.opportunityId}`);
    return flashMessagePath(`/crm/peluang/${parsed.data.opportunityId}`, "notice", "Catatan ditambahkan.");
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
        if (opportunity.stage !== "PENAWARAN") throw new UserFacingError("Quotation hanya dapat dibuat pada stage Penawaran.");
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

    const opportunityId = await getPrismaClient().$transaction(async (tx) => {
      const quotation = await tx.quotation.findUnique({
        where: { id: parsed.data.quotationId },
        select: {
          opportunityId: true,
          status: true,
          items: { select: { id: true }, take: 1 },
          opportunity: {
            select: {
              stage: true,
              customer: { select: { name: true, companyName: true, whatsapp: true, email: true, instagram: true, address: true } },
            },
          },
        },
      });
      if (!quotation || quotation.status !== "DRAFT") throw new UserFacingError("Quotation draft tidak ditemukan.");
      if (quotation.opportunity.stage !== "PENAWARAN") throw new UserFacingError("Quotation hanya dapat diterbitkan pada stage Penawaran.");
      if (!quotation.items.length) throw new UserFacingError("Quotation belum memiliki item.");

      const updated = await tx.quotation.updateMany({
        where: { id: parsed.data.quotationId, status: "DRAFT", version: parsed.data.version },
        data: {
          status: "ISSUED",
          issuedAt: new Date(),
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
      await audit(tx, actor, "Quotation", parsed.data.quotationId, "QUOTATION_ISSUED", ["status", "issuedAt", "snapshot"]);
      return quotation.opportunityId;
    });

    revalidatePath(`/crm/peluang/${opportunityId}`);
    return flashMessagePath(`/crm/peluang/${opportunityId}`, "notice", "Quotation diterbitkan dan dikunci.");
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
        if (source.opportunity.stage !== "PENAWARAN") {
          throw new UserFacingError("Revisi hanya dapat dibuat setelah peluang kembali ke Penawaran.");
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

    let salesOrder: { id: string; salesOrderNo: string };
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
            opportunity: { select: { stage: true, version: true } },
          },
        });
        if (!quotation || quotation.status !== "ISSUED") throw new UserFacingError("Quotation tidak lagi berstatus terbit.");
        if (quotation.opportunity.stage !== "PENAWARAN") throw new UserFacingError("Peluang tidak lagi berada di stage Penawaran.");
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
          where: { id: quotation.opportunityId, stage: "PENAWARAN", version: quotation.opportunity.version },
          data: { stage: "DEAL", followUpAt: null, cancelReason: null, version: { increment: 1 } },
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
        await audit(tx, actor, "SalesOrder", created.id, "SALES_ORDER_CREATED", ["status", "snapshot", "items", "total"], { opportunityId: quotation.opportunityId, quotationId: quotation.id });
        await audit(tx, actor, "Opportunity", quotation.opportunityId, "OPPORTUNITY_STAGE_CHANGED", ["stage"], { from: "PENAWARAN", to: "DEAL" });
        return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (proof) await createAdminClient().storage.from(ACCEPTANCE_PROOF_BUCKET).remove([proof.path]);
      throw error;
    }

    revalidatePath("/crm");
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

    const opportunityId = await getPrismaClient().$transaction(
      async (tx) => {
        const order = await tx.salesOrder.findUnique({
          where: { id: parsed.data.salesOrderId },
          select: { status: true, opportunityId: true, opportunity: { select: { stage: true, version: true } } },
        });
        if (!order || order.status !== "ACTIVE") throw new UserFacingError("Sales Order tidak aktif atau tidak ditemukan.");
        if (order.opportunity.stage !== "DEAL") throw new UserFacingError("Peluang tidak lagi berada di stage Deal.");

        const cancelled = await tx.salesOrder.updateMany({
          where: { id: parsed.data.salesOrderId, status: "ACTIVE" },
          data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: actor.id, cancelReason: parsed.data.cancelReason },
        });
        if (cancelled.count !== 1) throw new UserFacingError("Sales Order sudah berubah.");
        const opportunity = await tx.opportunity.updateMany({
          where: { id: order.opportunityId, stage: "DEAL", version: order.opportunity.version },
          data: { stage: "PENAWARAN", version: { increment: 1 } },
        });
        if (opportunity.count !== 1) throw new UserFacingError("Peluang sudah berubah.");

        await audit(tx, actor, "SalesOrder", parsed.data.salesOrderId, "SALES_ORDER_CANCELLED", ["status", "cancelledAt", "cancelledById", "cancelReason"]);
        await audit(tx, actor, "Opportunity", order.opportunityId, "OPPORTUNITY_STAGE_CHANGED", ["stage"], { from: "DEAL", to: "PENAWARAN" });
        return order.opportunityId;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath("/crm");
    revalidatePath(`/sales-orders/${parsed.data.salesOrderId}`);
    revalidatePath(`/crm/peluang/${opportunityId}`);
    return flashMessagePath(`/crm/peluang/${opportunityId}`, "notice", "Sales Order dibatalkan dan peluang dikembalikan ke Penawaran.");
  });
}
