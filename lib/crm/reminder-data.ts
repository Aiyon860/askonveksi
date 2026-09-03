import "server-only";

import { Prisma, type CustomerReminderType } from "@prisma/client";

import type { Actor } from "@/lib/auth/session";
import { requireActor } from "@/lib/auth/session";
import { OPEN_STAGES } from "@/lib/crm/constants";
import { getPrismaClient } from "@/lib/prisma";

export type ReminderReadFilter = "all" | "unread";
export type ReminderTypeFilter = "all" | "repeat" | "reactivation";

function typeWhere(type: ReminderTypeFilter): CustomerReminderType | undefined {
  if (type === "repeat") return "REPEAT_ORDER";
  if (type === "reactivation") return "REACTIVATION";
  return undefined;
}

export function customerReminderVisibilityWhere(
  actor: Actor,
  reference = new Date(),
): Prisma.CustomerReminderWhereInput {
  return {
    resolvedAt: null,
    dueAt: { lte: reference },
    customer: {
      archivedAt: null,
      opportunities: { none: { stage: { in: OPEN_STAGES } } },
      ...(actor.role === "SALES" ? { salesPicId: actor.id } : {}),
    },
    OR: [
      { type: "REACTIVATION" },
      {
        type: "REPEAT_ORDER",
        sourceSalesOrder: {
          customerReminders: {
            some: {
              type: "REACTIVATION",
              resolvedAt: null,
              dueAt: { gt: reference },
            },
          },
        },
      },
    ],
  };
}

const reminderListSelect = {
  id: true,
  type: true,
  dueAt: true,
  generation: true,
  customer: {
    select: {
      id: true,
      customerNo: true,
      name: true,
      companyName: true,
      whatsapp: true,
      salesPic: { select: { id: true, name: true } },
    },
  },
  sourceSalesOrder: {
    select: {
      id: true,
      salesOrderNo: true,
      acceptedAt: true,
      total: true,
      items: {
        select: { description: true, quantity: true, position: true },
        orderBy: { position: "asc" as const },
      },
    },
  },
  receipts: { select: { readAt: true }, take: 1 },
} satisfies Prisma.CustomerReminderSelect;

export async function getCustomerReminders({
  readFilter,
  typeFilter,
  page,
  pageSize,
}: {
  readFilter: ReminderReadFilter;
  typeFilter: ReminderTypeFilter;
  page: number;
  pageSize: number;
}) {
  const actor = await requireActor();
  const reference = new Date();
  const selectedType = typeWhere(typeFilter);
  const where = {
    AND: [
      customerReminderVisibilityWhere(actor, reference),
      ...(selectedType ? [{ type: selectedType }] : []),
      ...(readFilter === "unread" ? [{ receipts: { none: { actorId: actor.id } } }] : []),
    ],
  } satisfies Prisma.CustomerReminderWhereInput;
  const select = {
    ...reminderListSelect,
    receipts: {
      where: { actorId: actor.id },
      select: { readAt: true },
      take: 1,
    },
  } satisfies Prisma.CustomerReminderSelect;
  const prisma = getPrismaClient();
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Math.min(50, Math.max(10, pageSize));
  const [rows, total] = await Promise.all([
    prisma.customerReminder.findMany({
      where,
      select,
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
    prisma.customerReminder.count({ where }),
  ]);

  return {
    items: rows.map(({ receipts, ...row }) => ({
      ...row,
      sourceSalesOrder: {
        ...row.sourceSalesOrder,
        total: row.sourceSalesOrder.total.toString(),
      },
      readAt: receipts[0]?.readAt ?? null,
    })),
    total,
    page: safePage,
    pageSize: safePageSize,
    pageCount: Math.max(1, Math.ceil(total / safePageSize)),
  };
}

export async function getUnreadCustomerReminderCount() {
  const actor = await requireActor();
  return getPrismaClient().customerReminder.count({
    where: {
      AND: [
        customerReminderVisibilityWhere(actor),
        { receipts: { none: { actorId: actor.id } } },
      ],
    },
  });
}

export async function getRepeatOrderDraft(customerId: string, reminderId: string) {
  const actor = await requireActor();
  const reminder = await getPrismaClient().customerReminder.findFirst({
    where: {
      AND: [
        customerReminderVisibilityWhere(actor),
        { id: reminderId, customerId },
      ],
    },
    select: {
      id: true,
      type: true,
      customerId: true,
      sourceSalesOrder: {
        select: {
          id: true,
          salesOrderNo: true,
          total: true,
          items: {
            select: { description: true, quantity: true, position: true },
            orderBy: { position: "asc" },
          },
          opportunity: { select: { title: true, productName: true } },
        },
      },
    },
  });
  if (!reminder) return null;

  const quantity = reminder.sourceSalesOrder.items.reduce((total, item) => total + item.quantity, 0);
  const productName = reminder.sourceSalesOrder.opportunity.productName
    ?? reminder.sourceSalesOrder.items[0]?.description
    ?? null;
  return {
    reminderId: reminder.id,
    type: reminder.type,
    sourceSalesOrderId: reminder.sourceSalesOrder.id,
    salesOrderNo: reminder.sourceSalesOrder.salesOrderNo,
    title: productName ? `Repeat order ${productName}` : `Repeat ${reminder.sourceSalesOrder.opportunity.title}`,
    productName,
    estimatedQuantity: quantity || null,
    estimatedValue: reminder.sourceSalesOrder.total.toString(),
  };
}
