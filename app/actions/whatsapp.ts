"use server";

import { revalidatePath, updateTag } from "next/cache";
import { randomUUID } from "node:crypto";

import { flashMessagePath, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { MASTER_DATA_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { nextCustomerNo } from "@/lib/crm/numbers";
import { createCustomerSchema, firstValidationMessage } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeWhatsAppNumber, remoteJidForNumber, whatsappAccountSchema, whatsappTemplateSchema } from "@/lib/whatsapp/core";
import { enqueueInvoiceWhatsAppMessage, enqueueManualWhatsAppMessage, ensureCustomerWhatsAppConversation } from "@/lib/whatsapp/jobs";

function refreshWhatsApp() {
  revalidatePath("/whatsapp");
  revalidatePath("/whatsapp/jobs");
  revalidatePath("/master-data/whatsapp/accounts");
  revalidatePath("/master-data/whatsapp/templates");
  updateTag("badge-counts");
}

export async function createWhatsAppAccountAction(formData: FormData) {
  return runRedirectingAction("/master-data/whatsapp/accounts", async () => {
    await requireActor(MASTER_DATA_ROLES);
    const parsed = whatsappAccountSchema.safeParse({ label: formData.get("label"), phoneNumber: formData.get("phoneNumber") });
    if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Data account tidak valid.");
    await getPrismaClient().whatsAppAccount.create({ data: parsed.data });
    refreshWhatsApp();
    return flashMessagePath("/master-data/whatsapp/accounts", "notice", "Nomor WhatsApp ditambahkan.");
  });
}

export async function requestWhatsAppPairingAction(formData: FormData) {
  return runRedirectingAction("/master-data/whatsapp/accounts", async () => {
    await requireActor(MASTER_DATA_ROLES);
    const id = String(formData.get("accountId") ?? "");
    const updated = await getPrismaClient().whatsAppAccount.updateMany({
      where: { id },
      data: {
        status: "PAIRING",
        connectRequestedAt: new Date(),
        disconnectRequestedAt: null,
        disconnectedAt: null,
        pairingCode: null,
        pairingCodeExpiresAt: null,
        lastError: null,
      },
    });
    if (!updated.count) throw new UserFacingError("Account WhatsApp tidak ditemukan.");
    refreshWhatsApp();
    return flashMessagePath("/master-data/whatsapp/accounts", "notice", "Permintaan pairing dikirim ke worker.");
  });
}

export async function enableWhatsAppAccountAction(formData: FormData) {
  return runRedirectingAction("/master-data/whatsapp/accounts", async () => {
    await requireActor(MASTER_DATA_ROLES);
    const id = String(formData.get("accountId") ?? "");
    await getPrismaClient().$transaction(async (tx) => {
      const account = await tx.whatsAppAccount.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!account) throw new UserFacingError("Account WhatsApp tidak ditemukan.");
      if (account.status !== "CONNECTED") throw new UserFacingError("Hanya nomor yang terhubung yang dapat diaktifkan.");
      await tx.whatsAppAccount.updateMany({ where: { sendEnabled: true }, data: { sendEnabled: false } });
      await tx.whatsAppAccount.update({ where: { id }, data: { sendEnabled: true } });
    });
    refreshWhatsApp();
    return flashMessagePath("/master-data/whatsapp/accounts", "notice", "Nomor pengirim aktif diperbarui.");
  });
}

export async function disconnectWhatsAppAccountAction(formData: FormData) {
  return runRedirectingAction("/master-data/whatsapp/accounts", async () => {
    await requireActor(MASTER_DATA_ROLES);
    const id = String(formData.get("accountId") ?? "");
    await getPrismaClient().whatsAppAccount.update({ where: { id }, data: { sendEnabled: false, disconnectRequestedAt: new Date() } });
    refreshWhatsApp();
    return flashMessagePath("/master-data/whatsapp/accounts", "notice", "Permintaan logout dikirim ke worker.");
  });
}

export async function saveWhatsAppTemplateAction(formData: FormData) {
  return runRedirectingAction("/master-data/whatsapp/templates", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const parsed = whatsappTemplateSchema.safeParse({
      id: String(formData.get("id") ?? "") || undefined,
      name: formData.get("name"),
      triggerType: formData.get("triggerType"),
      body: formData.get("body"),
      isActive: formData.get("isActive") === "on",
      version: formData.get("version") || undefined,
    });
    if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Template tidak valid.");
    await getPrismaClient().$transaction(async (tx) => {
      if (parsed.data.isActive) await tx.whatsAppTemplate.updateMany({
        where: { triggerType: parsed.data.triggerType, isActive: true, ...(parsed.data.id ? { id: { not: parsed.data.id } } : {}) },
        data: { isActive: false, updatedById: actor.id, version: { increment: 1 } },
      });
      if (parsed.data.id) {
        const updated = await tx.whatsAppTemplate.updateMany({
          where: { id: parsed.data.id, version: parsed.data.version },
          data: { name: parsed.data.name, triggerType: parsed.data.triggerType, body: parsed.data.body, isActive: parsed.data.isActive, updatedById: actor.id, version: { increment: 1 } },
        });
        if (!updated.count) throw new UserFacingError("Template sudah berubah. Muat ulang lalu coba lagi.");
      } else {
        await tx.whatsAppTemplate.create({ data: { ...parsed.data, createdById: actor.id, updatedById: actor.id } });
      }
    });
    refreshWhatsApp();
    return flashMessagePath("/master-data/whatsapp/templates", "notice", "Template WhatsApp disimpan.");
  });
}

export async function sendWhatsAppMessageAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const fallback = conversationId ? `/whatsapp?conversation=${encodeURIComponent(conversationId)}` : "/whatsapp";
  return runRedirectingAction(fallback, async () => {
    const actor = await requireActor();
    const text = String(formData.get("text") ?? "").trim();
    const templateId = String(formData.get("templateId") ?? "") || undefined;
    const file = formData.get("attachment");
    if ((!text && !templateId && !(file instanceof File && file.size)) || text.length > 4000) throw new UserFacingError("Isi pesan, pilih template, atau pilih lampiran.");
    let attachment: { path: string; mimeType: string; fileName: string; sizeBytes: number; kind: "IMAGE" | "DOCUMENT" } | undefined;
    if (file instanceof File && file.size) {
      if (file.size > 10 * 1024 * 1024) throw new UserFacingError("Lampiran maksimal 10 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
      const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
      const isWebp = new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
      const mimeType = isPdf ? "application/pdf" : isJpeg ? "image/jpeg" : isPng ? "image/png" : isWebp ? "image/webp" : null;
      if (!mimeType) throw new UserFacingError("Lampiran harus berupa PDF, JPG, PNG, atau WebP yang valid.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || `lampiran-${randomUUID()}`;
      const path = `outbound/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
      const result = await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").upload(path, bytes, { contentType: mimeType, upsert: false });
      if (result.error) throw new UserFacingError("Lampiran belum dapat disimpan.");
      attachment = { path, mimeType, fileName: safeName, sizeBytes: file.size, kind: mimeType.startsWith("image/") ? "IMAGE" : "DOCUMENT" };
    }
    try {
      const resultId = await enqueueManualWhatsAppMessage({ actor, conversationId, text, attachment, templateId });
      refreshWhatsApp();
      return flashMessagePath(`/whatsapp?conversation=${resultId}`, "notice", "Pesan masuk antrean WhatsApp.");
    } catch (error) {
      if (attachment) await createAdminClient().storage.from(process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media").remove([attachment.path]);
      throw error;
    }
  });
}

export async function openCustomerWhatsAppAction(formData: FormData) {
  return runRedirectingAction("/whatsapp", async () => {
    const actor = await requireActor();
    const conversation = await ensureCustomerWhatsAppConversation(actor, String(formData.get("customerId") ?? ""));
    return `/whatsapp?conversation=${conversation.id}`;
  });
}

export async function sendInvoiceWhatsAppAction(formData: FormData) {
  return runRedirectingAction("/crm/invoices", async () => {
    const actor = await requireActor();
    const conversationId = await enqueueInvoiceWhatsAppMessage(actor, String(formData.get("invoiceId") ?? ""));
    refreshWhatsApp();
    return flashMessagePath(`/whatsapp?conversation=${conversationId}`, "notice", "Invoice masuk antrean WhatsApp.");
  });
}

export async function markWhatsAppConversationReadAction(formData: FormData) {
  const actor = await requireActor();
  const id = String(formData.get("conversationId") ?? "");
  const updated = await getPrismaClient().whatsAppConversation.updateMany({
    where: { id, ...(actor.role === "SALES" ? { customer: { salesPicId: actor.id } } : {}) },
    data: { unreadCount: 0 },
  });
  if (!updated.count) throw new UserFacingError("Percakapan tidak tersedia.");
  refreshWhatsApp();
}

export async function linkWhatsAppConversationAction(formData: FormData) {
  return runRedirectingAction("/whatsapp", async () => {
    await requireActor(MASTER_DATA_ROLES);
    const conversationId = String(formData.get("conversationId") ?? "");
    const customerId = String(formData.get("customerId") ?? "");
    await getPrismaClient().$transaction(async (tx) => {
      const [customer, conversation] = await Promise.all([
        tx.customer.findFirst({ where: { id: customerId, archivedAt: null }, select: { id: true, whatsapp: true } }),
        tx.whatsAppConversation.findUnique({ where: { id: conversationId }, select: { id: true, accountId: true, remoteJid: true, unreadCount: true, isResolved: true, lastMessageAt: true } }),
      ]);
      if (!customer || !conversation) throw new UserFacingError("Customer atau percakapan tidak ditemukan.");
      const phoneNumber = conversation.remoteJid.endsWith("@s.whatsapp.net")
        ? normalizeWhatsAppNumber(conversation.remoteJid.split("@")[0])
        : null;
      const previousJid = remoteJidForNumber(customer.whatsapp ?? "");
      const duplicate = previousJid && previousJid !== conversation.remoteJid
        ? await tx.whatsAppConversation.findUnique({ where: { accountId_remoteJid: { accountId: conversation.accountId, remoteJid: previousJid } } })
        : null;
      if (duplicate && duplicate.id !== conversation.id) {
        await tx.whatsAppMessage.updateMany({ where: { conversationId: duplicate.id }, data: { conversationId: conversation.id } });
        await tx.whatsAppConversation.delete({ where: { id: duplicate.id } });
      }
      const latest = await tx.whatsAppMessage.findFirst({
        where: { conversationId: conversation.id },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        select: { occurredAt: true, text: true, kind: true },
      });
      await tx.whatsAppConversation.update({
        where: { id: conversation.id },
        data: {
          customerId,
          unreadCount: conversation.unreadCount + (duplicate?.unreadCount ?? 0),
          isResolved: duplicate ? conversation.isResolved && duplicate.isResolved : conversation.isResolved,
          lastMessageAt: latest?.occurredAt ?? conversation.lastMessageAt,
          lastMessagePreview: latest ? (latest.text ?? `[${latest.kind.toLowerCase()}]`).slice(0, 240) : undefined,
        },
      });
      if (phoneNumber) await tx.customer.update({ where: { id: customer.id }, data: { whatsapp: phoneNumber } });
    });
    refreshWhatsApp();
    return flashMessagePath(`/whatsapp?conversation=${conversationId}`, "notice", "Percakapan ditautkan dan nomor WhatsApp customer diperbarui.");
  });
}

export async function createWhatsAppCustomerAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  return runRedirectingAction(`/whatsapp?conversation=${encodeURIComponent(conversationId)}`, async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const prisma = getPrismaClient();
    const conversation = await prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, remoteJid: true, customerId: true },
    });
    const phoneNumber = conversation?.remoteJid.endsWith("@s.whatsapp.net")
      ? normalizeWhatsAppNumber(conversation.remoteJid.split("@")[0])
      : null;
    if (!conversation || conversation.customerId || !phoneNumber) throw new UserFacingError("Percakapan tidak dapat ditambahkan sebagai customer baru.");

    const parsed = createCustomerSchema.safeParse({
      name: formData.get("name"),
      companyName: formData.get("companyName"),
      whatsapp: phoneNumber,
      email: formData.get("email"),
      instagram: formData.get("instagram"),
      address: formData.get("address"),
      city: formData.get("city"),
      notes: formData.get("notes"),
      customerTypeId: formData.get("customerTypeId"),
      leadSourceId: formData.get("leadSourceId"),
      salesPicId: formData.get("salesPicId"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    await prisma.$transaction(async (tx) => {
      const [customerType, leadSource, salesPic] = await Promise.all([
        tx.customerType.findUnique({ where: { id: parsed.data.customerTypeId }, select: { id: true } }),
        parsed.data.leadSourceId ? tx.leadSource.findUnique({ where: { id: parsed.data.leadSourceId }, select: { id: true } }) : null,
        parsed.data.salesPicId ? tx.appUser.findFirst({ where: { id: parsed.data.salesPicId, role: "SALES", isActive: true }, select: { id: true } }) : null,
      ]);
      if (!customerType) throw new UserFacingError("Jenis customer tidak ditemukan.");
      if (parsed.data.leadSourceId && !leadSource) throw new UserFacingError("Sumber lead tidak ditemukan.");
      if (parsed.data.salesPicId && !salesPic) throw new UserFacingError("Sales/PIC tidak aktif atau tidak ditemukan.");

      const customer = await tx.customer.create({
        data: { ...parsed.data, email: parsed.data.email?.toLowerCase(), customerNo: await nextCustomerNo(tx) },
        select: { id: true },
      });
      const linked = await tx.whatsAppConversation.updateMany({ where: { id: conversationId, customerId: null }, data: { customerId: customer.id } });
      if (!linked.count) throw new UserFacingError("Percakapan sudah ditautkan ke customer lain.");
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "Customer",
          entityId: customer.id,
          action: "CUSTOMER_CREATED",
          changedFields: ["name", "companyName", "whatsapp", "email", "instagram", "address", "city", "notes", "customerTypeId", "leadSourceId", "salesPicId"],
          metadata: { source: "whatsapp-inbox", conversationId },
        },
      });
    });

    updateTag("customer-options");
    revalidatePath("/customers");
    refreshWhatsApp();
    return flashMessagePath(`/whatsapp?conversation=${conversationId}`, "notice", "Customer dibuat dan percakapan berhasil ditautkan.");
  });
}

export async function retryWhatsAppJobAction(formData: FormData) {
  return runRedirectingAction("/whatsapp/jobs", async () => {
    await requireActor(MASTER_DATA_ROLES);
    const updated = await getPrismaClient().whatsAppAutomationJob.updateMany({
      where: { id: String(formData.get("jobId") ?? ""), status: { in: ["FAILED", "CANCELLED"] } },
      data: { status: "QUEUED", attempts: 0, scheduledAt: new Date(), nextAttemptAt: null, lastError: null, leaseOwner: null, leaseExpiresAt: null },
    });
    if (!updated.count) throw new UserFacingError("Job tidak dapat diulang.");
    refreshWhatsApp();
    return flashMessagePath("/whatsapp/jobs", "notice", "Job WhatsApp masuk antrean kembali.");
  });
}

export async function cancelWhatsAppJobAction(formData: FormData) {
  return runRedirectingAction("/whatsapp/jobs", async () => {
    await requireActor(MASTER_DATA_ROLES);
    const id = String(formData.get("jobId") ?? "");
    const updated = await getPrismaClient().whatsAppAutomationJob.updateMany({
      where: { id, status: { in: ["QUEUED", "RETRY"] } },
      data: { status: "CANCELLED", nextAttemptAt: null, lastError: "Dibatalkan manual.", leaseOwner: null, leaseExpiresAt: null },
    });
    if (!updated.count) throw new UserFacingError("Job tidak dapat dibatalkan.");
    await getPrismaClient().whatsAppMessage.updateMany({ where: { automationJobId: id, status: "QUEUED" }, data: { status: "CANCELLED" } });
    refreshWhatsApp();
    return flashMessagePath("/whatsapp/jobs", "notice", "Job WhatsApp dibatalkan.");
  });
}
