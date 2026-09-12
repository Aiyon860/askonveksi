import "server-only";

import type { Prisma, WhatsAppJobStatus } from "@prisma/client";

import { CRM_OPERATOR_ROLES, hasRole, MASTER_DATA_ROLES } from "@/lib/auth/permissions";
import { requireActor, type Actor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { WHATSAPP_INBOX_ROLES } from "@/lib/whatsapp/access";
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
  await requireActor(MASTER_DATA_ROLES);
  return getPrismaClient().whatsAppAccount.findMany({ orderBy: [{ sendEnabled: "desc" }, { label: "asc" }] });
}

export async function getWhatsAppTemplates() {
  await requireActor(CRM_OPERATOR_ROLES);
  return getPrismaClient().whatsAppTemplate.findMany({ orderBy: [{ triggerType: "asc" }, { name: "asc" }] });
}

export async function getWhatsAppJobs(status?: WhatsAppJobStatus) {
  await requireActor(CRM_OPERATOR_ROLES);
  return getPrismaClient().whatsAppAutomationJob.findMany({
    where: status ? { status } : undefined,
    select: {
      id: true, type: true, status: true, scheduledAt: true, attempts: true, lastError: true, createdAt: true,
      customer: { select: { name: true, companyName: true } },
      account: { select: { label: true, status: true, sendEnabled: true, heartbeatAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getUnreadWhatsAppCount() {
  const actor = await requireActor();
  const result = await getPrismaClient().whatsAppConversation.aggregate({
    where: conversationVisibility(actor),
    _sum: { unreadCount: true },
  });
  return result._sum.unreadCount ?? 0;
}
