import "server-only";

import type { Prisma, WhatsAppJobStatus } from "@prisma/client";

import { CRM_OPERATOR_ROLES, hasRole, MASTER_DATA_ROLES, WHATSAPP_ACCOUNT_MANAGER_ROLES } from "@/lib/auth/permissions";
import { requireActor, type Actor } from "@/lib/auth/session";
import { getActiveProductCategories } from "@/lib/master-data";
import { getPrismaClient } from "@/lib/prisma";
import { WHATSAPP_INBOX_ROLES } from "@/lib/whatsapp/access";
import { parseJakartaDateTime, MAX_CAMPAIGN_RECIPIENTS, type CampaignRecipientOption } from "@/lib/whatsapp/campaigns";
import { DEFAULT_ORDER_REMINDER_TEMPLATE, normalizeWhatsAppNumber } from "@/lib/whatsapp/core";
import { conversationVisibility } from "@/lib/whatsapp/visibility";

export async function getWhatsAppInbox(selectedId?: string, query?: string) {
  const actor = await requireActor(WHATSAPP_INBOX_ROLES);
  const prisma = getPrismaClient();
  const visibility = conversationVisibility(actor);
  const search = query?.trim();
  const where = {
    ...visibility,
    ...(search ? { OR: [
      { remoteJid: { contains: search, mode: "insensitive" as const } },
      { customer: { is: { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { companyName: { contains: search, mode: "insensitive" as const } }] } } },
    ] } : {}),
  } satisfies Prisma.WhatsAppConversationWhereInput;
  const conversations = await prisma.whatsAppConversation.findMany({
    where,
    select: {
      id: true,
      remoteJid: true,
      unreadCount: true,
      lastMessageAt: true,
      lastMessagePreview: true,
      account: { select: { label: true } },
      customer: { select: { id: true, name: true, companyName: true } },
    },
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  const activeId = selectedId && conversations.some((item) => item.id === selectedId) ? selectedId : conversations[0]?.id;
  const templates = await prisma.whatsAppTemplate.findMany({
    where: { isActive: true, triggerType: "MANUAL" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return { conversations, activeId, templates, canSeeUnknown: hasRole(actor.role, MASTER_DATA_ROLES) };
}

export async function getWhatsAppConversationMessages(actor: Actor, conversationId: string) {
  const conversation = await getPrismaClient().whatsAppConversation.findFirst({
    where: { id: conversationId, ...conversationVisibility(actor) },
    select: {
      messages: {
        select: {
          id: true,
          direction: true,
          kind: true,
          status: true,
          text: true,
          mediaPath: true,
          mediaFileName: true,
          mediaMimeType: true,
          errorMessage: true,
          occurredAt: true,
          automationJob: { select: { invoiceId: true, invoice: { select: { invoiceNo: true } } } },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 200,
      },
    },
  });
  return conversation?.messages.reverse() ?? null;
}

export async function getWhatsAppAccounts() {
  await requireActor(WHATSAPP_ACCOUNT_MANAGER_ROLES);
  return getPrismaClient().whatsAppAccount.findMany({ orderBy: [{ sendEnabled: "desc" }, { label: "asc" }] });
}

export type WhatsAppTemplateSort = "name" | "triggerType" | "isActive" | "updatedAt";
export type WhatsAppTemplateTriggerFilter = "all" | "MANUAL" | "NEXT_ACTION" | "REACTIVATION" | "INVOICE_ISSUED" | "INVOICE_DUE";
export type WhatsAppTemplateStatusFilter = "all" | "active" | "inactive";

export type WhatsAppTemplateTableInput = {
  query?: string;
  trigger?: WhatsAppTemplateTriggerFilter;
  status?: WhatsAppTemplateStatusFilter;
  page?: number;
  pageSize?: number;
  sort?: WhatsAppTemplateSort;
  direction?: "asc" | "desc";
};

export async function getWhatsAppTemplates(input: WhatsAppTemplateTableInput) {
  await requireActor(CRM_OPERATOR_ROLES);
  const prisma = getPrismaClient();
  const query = (input.query ?? "").trim().slice(0, 120);
  const trigger = input.trigger ?? "all";
  const status = input.status ?? "all";
  const page = Math.max(1, input.page ?? 1);
  const pageSize = input.pageSize ?? 20;
  const sort = input.sort ?? "updatedAt";
  const direction = input.direction ?? "desc";
  const where = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { body: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(trigger === "all" ? {} : { triggerType: trigger }),
    ...(status === "all" ? {} : { isActive: status === "active" }),
  } satisfies Prisma.WhatsAppTemplateWhereInput;
  const orderBy = [{ [sort]: direction }, { id: "asc" as const }] satisfies Prisma.WhatsAppTemplateOrderByWithRelationInput[];
  const [items, total] = await Promise.all([
    prisma.whatsAppTemplate.findMany({
      where,
      select: { id: true, name: true, triggerType: true, body: true, isActive: true, version: true, updatedAt: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.whatsAppTemplate.count({ where }),
  ]);
  return { items, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getWhatsAppJobs(status?: WhatsAppJobStatus) {
  const actor = await requireActor(CRM_OPERATOR_ROLES);
  return getPrismaClient().whatsAppAutomationJob.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(actor.role === "DEVELOPER" ? {} : { type: { not: "CAMPAIGN_TEST" } }),
    },
    select: {
      id: true, type: true, status: true, scheduledAt: true, attempts: true, lastError: true, createdAt: true,
      customer: { select: { name: true, companyName: true } },
      account: { select: { label: true, status: true, sendEnabled: true, heartbeatAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

const CAMPAIGN_RECIPIENT_LIMIT = 200;
const BROADCAST_RECIPIENT_LIMIT = 500;

export function campaignRecipientDateRange(from?: string, to?: string) {
  const start = from ? parseJakartaDateTime(`${from}T00:00`) : null;
  const endStart = to ? parseJakartaDateTime(`${to}T00:00`) : null;
  if ((from && !start) || (to && !endStart) || (start && endStart && start > endStart)) return null;
  return { start, end: endStart ? new Date(endStart.getTime() + 24 * 60 * 60 * 1000) : null };
}

type RecipientFilterInput = {
  query?: string;
  from?: string;
  to?: string;
  customerTypeId?: string;
  productCategoryId?: string;
};

/**
 * Daftar customer yang bisa dipilih sebagai penerima campaign / broadcast, lengkap dengan
 * tanggal order terakhir atau pembayaran DP terakhir. Penjaga role ada di pemanggilnya.
 */
async function queryRecipientOptions(input: RecipientFilterInput & { campaignId?: string; limit: number }) {
  const prisma = getPrismaClient();
  const range = campaignRecipientDateRange(input.from, input.to);
  const dateFilter = range && (range.start || range.end)
    ? { ...(range.start ? { gte: range.start } : {}), ...(range.end ? { lt: range.end } : {}) }
    : null;
  const filters: Prisma.CustomerWhereInput[] = [{ archivedAt: null }];
  if (input.query) filters.push({ OR: [
    { name: { contains: input.query, mode: "insensitive" } },
    { companyName: { contains: input.query, mode: "insensitive" } },
  ] });
  if (input.customerTypeId) filters.push({ customerTypeId: input.customerTypeId });
  // Kategori order = kategori produk Data Master pada PO (strict: PO tanpa kategori tidak ikut).
  if (input.productCategoryId) filters.push({ opportunities: { some: { purchaseOrders: { some: { productCategoryId: input.productCategoryId } } } } });
  if (dateFilter) filters.push({ OR: [
    { opportunities: { some: { salesOrders: { some: { acceptedAt: dateFilter } } } } },
    { opportunities: { some: { salesOrders: { some: { payment: { is: { paidAt: dateFilter } } } } } } },
  ] });
  const where = { AND: filters } satisfies Prisma.CustomerWhereInput;

  const [customers, total, saved, customerTypes, productCategories] = await Promise.all([
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        name: true,
        whatsapp: true,
        whatsappConsentStatus: true,
        customerType: { select: { name: true } },
        opportunities: {
          select: {
            salesOrders: {
              select: { acceptedAt: true, payment: { select: { paidAt: true } } },
              orderBy: { acceptedAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: input.limit,
    }),
    prisma.customer.count({ where }),
    input.campaignId
      ? prisma.whatsAppCampaignRecipient.findMany({
          where: { campaignId: input.campaignId },
          select: { customerId: true },
          orderBy: { customerId: "asc" },
          take: MAX_CAMPAIGN_RECIPIENTS,
        })
      : Promise.resolve([]),
    prisma.customerType.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getActiveProductCategories(),
  ]);

  const items: CampaignRecipientOption[] = customers.map((customer) => {
    let lastOrderAt: Date | null = null;
    let lastOrderKind: CampaignRecipientOption["lastOrderKind"] = null;
    for (const opportunity of customer.opportunities) {
      const order = opportunity.salesOrders[0];
      if (!order) continue;
      if (!lastOrderAt || order.acceptedAt > lastOrderAt) {
        lastOrderAt = order.acceptedAt;
        lastOrderKind = "ORDER";
      }
      const paidAt = order.payment?.paidAt;
      if (paidAt && paidAt > lastOrderAt) {
        lastOrderAt = paidAt;
        lastOrderKind = "PAYMENT";
      }
    }
    const hasValidWhatsApp = Boolean(normalizeWhatsAppNumber(customer.whatsapp));
    const consented = customer.whatsappConsentStatus !== "OPTED_OUT";
    return {
      id: customer.id,
      name: customer.name,
      customerTypeName: customer.customerType.name,
      lastOrderAt: lastOrderAt ? lastOrderAt.toISOString() : null,
      lastOrderKind,
      canReceive: hasValidWhatsApp && consented,
      reason: !hasValidWhatsApp ? "Tanpa nomor WhatsApp" : !consented ? "Menolak pesan" : null,
    };
  });

  return {
    items,
    total,
    truncated: total > input.limit,
    selectedIds: saved.map((item) => item.customerId),
    customerTypes,
    productCategories: productCategories.map(({ id, name }) => ({ id, name })),
  };
}

/**
 * Daftar customer yang bisa dipilih sebagai penerima campaign, lengkap dengan tanggal
 * order terakhir / pembayaran DP terakhir dan pilihan yang saat ini tersimpan.
 */
export async function getCampaignRecipientOptions(input: {
  campaignId: string;
  query?: string;
  from?: string;
  to?: string;
  customerTypeId?: string;
  productCategoryId?: string;
}) {
  await requireActor(CRM_OPERATOR_ROLES);
  return queryRecipientOptions({ ...input, limit: CAMPAIGN_RECIPIENT_LIMIT });
}

/** Daftar penerima broadcast Follow Up Hari Ini pada halaman CRM > Broadcast. */
export async function getBroadcastRecipientOptions(input: RecipientFilterInput) {
  await requireActor(WHATSAPP_ACCOUNT_MANAGER_ROLES);
  return queryRecipientOptions({ ...input, limit: BROADCAST_RECIPIENT_LIMIT });
}

/** Template Follow Up Hari Ini (REACTIVATION) terbaru; fallback ke template bawaan. */
export async function getFollowUpTemplateBody() {
  const template = await getPrismaClient().whatsAppTemplate.findFirst({
    where: { triggerType: "REACTIVATION", isActive: true },
    orderBy: { updatedAt: "desc" },
    select: { body: true },
  });
  return template?.body ?? DEFAULT_ORDER_REMINDER_TEMPLATE;
}

export async function getUnreadWhatsAppCount() {
  const actor = await requireActor();
  const result = await getPrismaClient().whatsAppConversation.aggregate({
    where: conversationVisibility(actor),
    _sum: { unreadCount: true },
  });
  return result._sum.unreadCount ?? 0;
}
