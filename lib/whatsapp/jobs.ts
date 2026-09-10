import "server-only";

import { Prisma, type WhatsAppJobType } from "@prisma/client";

import { UserFacingError } from "@/lib/actions/response";
import type { Actor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { nextWhatsAppSendAt, remoteJidForNumber, renderWhatsAppTemplate } from "@/lib/whatsapp/core";

export async function ensureCustomerWhatsAppConversation(actor: Actor, customerId: string) {
  const prisma = getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const [account, customer] = await Promise.all([
      tx.whatsAppAccount.findFirst({ where: { sendEnabled: true }, select: { id: true } }),
      tx.customer.findUnique({ where: { id: customerId }, select: { id: true, whatsapp: true, archivedAt: true, salesPicId: true } }),
    ]);
    if (!account) throw new UserFacingError("Belum ada nomor WhatsApp yang diaktifkan sebagai pengirim.");
    if (!customer || customer.archivedAt) throw new UserFacingError("Customer tidak tersedia.");
    if (actor.role === "SALES" && customer.salesPicId !== actor.id) throw new UserFacingError("Customer ini bukan bagian Anda.");
    const remoteJid = remoteJidForNumber(customer.whatsapp ?? "");
    if (!remoteJid) throw new UserFacingError("Nomor WhatsApp customer tidak valid.");
    return tx.whatsAppConversation.upsert({
      where: { accountId_remoteJid: { accountId: account.id, remoteJid } },
      create: { accountId: account.id, remoteJid, customerId: customer.id },
      update: { customerId: customer.id },
      select: { id: true },
    });
  });
}

export async function enqueueInvoiceWhatsAppMessage(actor: Actor, invoiceId: string) {
  const prisma = getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const [account, invoice, business, template] = await Promise.all([
      tx.whatsAppAccount.findFirst({ where: { sendEnabled: true }, select: { id: true } }),
      tx.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true, invoiceNo: true, status: true, total: true, dueAt: true, opportunityId: true,
          opportunity: { select: { opportunityNo: true, title: true, customerId: true, salesPicId: true, salesPic: { select: { name: true } }, customer: { select: { name: true, companyName: true, whatsapp: true, archivedAt: true } } } },
        },
      }),
      tx.businessProfile.findUnique({ where: { id: "default" }, select: { name: true } }),
      tx.whatsAppTemplate.findFirst({ where: { triggerType: "INVOICE_ISSUED", isActive: true }, orderBy: { updatedAt: "desc" } }),
    ]);
    if (!account) throw new UserFacingError("Belum ada nomor WhatsApp yang diaktifkan sebagai pengirim.");
    if (!invoice || invoice.status !== "ISSUED") throw new UserFacingError("Hanya invoice terbit yang dapat dikirim.");
    if (invoice.opportunity.customer.archivedAt) throw new UserFacingError("Customer tidak tersedia.");
    if (actor.role === "SALES" && invoice.opportunity.salesPicId !== actor.id) throw new UserFacingError("Invoice ini bukan bagian Anda.");
    const remoteJid = remoteJidForNumber(invoice.opportunity.customer.whatsapp ?? "");
    if (!remoteJid) throw new UserFacingError("Nomor WhatsApp customer tidak valid.");
    const text = template ? renderWhatsAppTemplate(template.body, {
      business_name: business?.name ?? "AS Konveksi",
      customer_name: invoice.opportunity.customer.name,
      company_name: invoice.opportunity.customer.companyName ?? "",
      sales_pic_name: invoice.opportunity.salesPic?.name ?? "",
      opportunity_no: invoice.opportunity.opportunityNo,
      opportunity_title: invoice.opportunity.title,
      invoice_no: invoice.invoiceNo,
      invoice_total: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(invoice.total.toNumber()),
      invoice_due_date: invoice.dueAt?.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) ?? "",
    }) : `Invoice ${invoice.invoiceNo} dari ${business?.name ?? "AS Konveksi"}.`;
    const conversation = await tx.whatsAppConversation.upsert({ where: { accountId_remoteJid: { accountId: account.id, remoteJid } }, create: { accountId: account.id, remoteJid, customerId: invoice.opportunity.customerId }, update: { customerId: invoice.opportunity.customerId } });
    const job = await tx.whatsAppAutomationJob.create({ data: { idempotencyKey: `manual-invoice:${invoice.id}:${crypto.randomUUID()}`, type: "MANUAL", accountId: account.id, templateId: template?.id, customerId: invoice.opportunity.customerId, opportunityId: invoice.opportunityId, invoiceId: invoice.id, payload: { text, attachment: { type: "invoice", invoiceId: invoice.id } }, scheduledAt: new Date() } });
    await tx.whatsAppMessage.create({ data: { accountId: account.id, conversationId: conversation.id, direction: "OUTBOUND", kind: "DOCUMENT", status: "QUEUED", text, mediaFileName: `invoice-${invoice.invoiceNo}.pdf`, mediaMimeType: "application/pdf", sentById: actor.id, automationJobId: job.id } });
    await tx.whatsAppConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date(), lastMessagePreview: text.slice(0, 240), isResolved: false } });
    return conversation.id;
  });
}

export async function enqueueManualWhatsAppMessage({
  actor,
  customerId,
  conversationId,
  text,
  templateId,
  attachment,
}: {
  actor: Actor;
  customerId?: string;
  conversationId?: string;
  text: string;
  templateId?: string;
  attachment?: { path: string; mimeType: string; fileName: string; sizeBytes: number; kind: "IMAGE" | "DOCUMENT" };
}) {
  const prisma = getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const account = await tx.whatsAppAccount.findFirst({
      where: { sendEnabled: true },
      select: { id: true },
    });
    if (!account) throw new UserFacingError("Belum ada nomor WhatsApp yang diaktifkan sebagai pengirim.");

    let conversation = conversationId
      ? await tx.whatsAppConversation.findUnique({
          where: { id: conversationId },
          select: { id: true, customerId: true, remoteJid: true },
        })
      : null;

    if (!conversation && customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { id: true, whatsapp: true, archivedAt: true, salesPicId: true },
      });
      if (!customer || customer.archivedAt) throw new UserFacingError("Customer tidak tersedia.");
      if (actor.role === "SALES" && customer.salesPicId !== actor.id) throw new UserFacingError("Customer ini bukan bagian Anda.");
      const remoteJid = remoteJidForNumber(customer.whatsapp ?? "");
      if (!remoteJid) throw new UserFacingError("Nomor WhatsApp customer tidak valid.");
      conversation = await tx.whatsAppConversation.upsert({
        where: { accountId_remoteJid: { accountId: account.id, remoteJid } },
        create: { accountId: account.id, remoteJid, customerId: customer.id },
        update: { customerId: customer.id },
        select: { id: true, customerId: true, remoteJid: true },
      });
    }

    if (!conversation?.customerId) throw new UserFacingError("Percakapan harus ditautkan ke customer sebelum mengirim pesan.");
    const customer = await tx.customer.findUnique({
      where: { id: conversation.customerId },
      select: { name: true, companyName: true, archivedAt: true, salesPicId: true, salesPic: { select: { name: true } } },
    });
    if (!customer || customer.archivedAt) throw new UserFacingError("Customer tidak tersedia.");
    if (actor.role === "SALES" && customer.salesPicId !== actor.id) throw new UserFacingError("Percakapan ini bukan bagian Anda.");

    let renderedText = text;
    if (templateId) {
      const [template, business] = await Promise.all([
        tx.whatsAppTemplate.findFirst({ where: { id: templateId, isActive: true, triggerType: "MANUAL" }, select: { body: true } }),
        tx.businessProfile.findUnique({ where: { id: "default" }, select: { name: true } }),
      ]);
      if (!template) throw new UserFacingError("Template WhatsApp tidak tersedia.");
      renderedText = text || renderWhatsAppTemplate(template.body, {
        business_name: business?.name ?? "AS Konveksi",
        customer_name: customer.name,
        company_name: customer.companyName ?? "",
        sales_pic_name: customer.salesPic?.name ?? "",
      });
    }

    const idempotencyKey = `manual:${crypto.randomUUID()}`;
    const job = await tx.whatsAppAutomationJob.create({
      data: {
        idempotencyKey,
        type: "MANUAL",
        accountId: account.id,
        templateId: templateId || null,
        customerId: conversation.customerId,
        payload: { text: renderedText, remoteJid: conversation.remoteJid, conversationId: conversation.id, attachment: attachment ?? null },
        scheduledAt: new Date(),
      },
      select: { id: true },
    });
    await tx.whatsAppMessage.create({
      data: {
        accountId: account.id,
        conversationId: conversation.id,
        direction: "OUTBOUND",
        status: "QUEUED",
        text: renderedText || null,
        kind: attachment?.kind ?? "TEXT",
        mediaPath: attachment?.path,
        mediaMimeType: attachment?.mimeType,
        mediaFileName: attachment?.fileName,
        mediaSizeBytes: attachment?.sizeBytes,
        sentById: actor.id,
        automationJobId: job.id,
      },
    });
    await tx.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), lastMessagePreview: renderedText.slice(0, 240), isResolved: false },
    });
    return conversation.id;
  });
}

export async function enqueueWhatsAppJob(
  tx: Prisma.TransactionClient,
  data: {
    idempotencyKey: string;
    type: Exclude<WhatsAppJobType, "MANUAL">;
    customerId: string;
    opportunityId?: string;
    invoiceId?: string;
    reminderId?: string;
    templateId?: string;
    text: string;
    scheduledAt: Date;
    attachment?: Prisma.InputJsonValue;
  },
) {
  return tx.whatsAppAutomationJob.upsert({
    where: { idempotencyKey: data.idempotencyKey },
    create: {
      idempotencyKey: data.idempotencyKey,
      type: data.type,
      customerId: data.customerId,
      opportunityId: data.opportunityId,
      invoiceId: data.invoiceId,
      reminderId: data.reminderId,
      templateId: data.templateId,
      payload: { text: data.text, attachment: data.attachment ?? null },
      scheduledAt: nextWhatsAppSendAt(data.scheduledAt),
    },
    update: {},
    select: { id: true },
  });
}
