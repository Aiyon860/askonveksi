import "server-only";

import { Prisma } from "@prisma/client";

import {
  addCalendarMonthsJakarta,
  CUSTOMER_REMINDER_DELAYS,
} from "@/lib/crm/reminder-types";

function reminderDueAt(type: "REACTIVATION", acceptedAt: Date) {
  const target = addCalendarMonthsJakarta(acceptedAt, CUSTOMER_REMINDER_DELAYS[type] ?? 6);
  const jakarta = new Date(target.getTime() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(jakarta.getUTCFullYear(), jakarta.getUTCMonth(), jakarta.getUTCDate(), 2));
}

async function upsertReminderSchedule(
  tx: Prisma.TransactionClient,
  data: {
    customerId: string;
    sourceSalesOrderId: string;
    acceptedAt: Date;
    type: "REACTIVATION";
    rearm: boolean;
  },
) {
  return tx.customerReminder.upsert({
    where: {
      sourceSalesOrderId_type: {
        sourceSalesOrderId: data.sourceSalesOrderId,
        type: data.type,
      },
    },
    create: {
      customerId: data.customerId,
      sourceSalesOrderId: data.sourceSalesOrderId,
      type: data.type,
      dueAt: reminderDueAt(data.type, data.acceptedAt),
    },
    update: {
      customerId: data.customerId,
      dueAt: reminderDueAt(data.type, data.acceptedAt),
      resolvedAt: null,
      ...(data.rearm ? { generation: { increment: 1 } } : {}),
    },
    select: { id: true },
  });
}

export async function scheduleCustomerReminders(
  tx: Prisma.TransactionClient,
  data: { customerId: string; sourceSalesOrderId: string; acceptedAt: Date },
) {
  const resolvedAt = new Date();
  await tx.customerReminder.updateMany({
    where: {
      customerId: data.customerId,
      resolvedAt: null,
      sourceSalesOrderId: { not: data.sourceSalesOrderId },
    },
    data: { resolvedAt },
  });

  await upsertReminderSchedule(tx, { ...data, type: "REACTIVATION", rearm: false });
}

export async function restoreCustomerRemindersAfterCancellation(
  tx: Prisma.TransactionClient,
  customerId: string,
) {
  const resolvedAt = new Date();
  await tx.customerReminder.updateMany({
    where: { customerId, resolvedAt: null },
    data: { resolvedAt },
  });

  const previousOrder = await tx.salesOrder.findFirst({
    where: { status: "ACTIVE", opportunity: { customerId } },
    select: { id: true, acceptedAt: true },
    orderBy: [{ acceptedAt: "desc" }, { id: "desc" }],
  });
  if (!previousOrder) return;

  const reminders = [await upsertReminderSchedule(tx, {
    customerId,
    sourceSalesOrderId: previousOrder.id,
    acceptedAt: previousOrder.acceptedAt,
    type: "REACTIVATION",
    rearm: true,
  })];
  await tx.customerReminderReceipt.deleteMany({
    where: { reminderId: { in: reminders.map((reminder) => reminder.id) } },
  });
}

export async function rearmCustomerRemindersAfterLost(
  tx: Prisma.TransactionClient,
  customerId: string,
) {
  const openOpportunityCount = await tx.opportunity.count({
    where: {
      customerId,
      stage: { in: ["LEAD_BARU", "FOLLOW_UP", "NEGOSIASI"] },
    },
  });
  if (openOpportunityCount > 0) return;

  const reminders = await tx.customerReminder.findMany({
    where: { customerId, type: "REACTIVATION", resolvedAt: null },
    select: { id: true },
  });
  if (!reminders.length) return;

  await tx.customerReminder.updateMany({
    where: { id: { in: reminders.map((reminder) => reminder.id) } },
    data: { generation: { increment: 1 } },
  });
  await tx.customerReminderReceipt.deleteMany({
    where: { reminderId: { in: reminders.map((reminder) => reminder.id) } },
  });
}
