import "server-only";

import { Prisma, type CustomerReminderType } from "@prisma/client";

import {
  addCalendarMonthsJakarta,
  CUSTOMER_REMINDER_DELAYS,
} from "@/lib/crm/reminder-types";

function reminderDueAt(type: CustomerReminderType, acceptedAt: Date) {
  return addCalendarMonthsJakarta(acceptedAt, CUSTOMER_REMINDER_DELAYS[type]);
}

async function upsertReminderSchedule(
  tx: Prisma.TransactionClient,
  data: {
    customerId: string;
    sourceSalesOrderId: string;
    acceptedAt: Date;
    type: CustomerReminderType;
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

  for (const type of Object.keys(CUSTOMER_REMINDER_DELAYS) as CustomerReminderType[]) {
    await upsertReminderSchedule(tx, { ...data, type, rearm: false });
  }
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

  const reminders: Array<{ id: string }> = [];
  for (const type of Object.keys(CUSTOMER_REMINDER_DELAYS) as CustomerReminderType[]) {
    reminders.push(await upsertReminderSchedule(tx, {
      customerId,
      sourceSalesOrderId: previousOrder.id,
      acceptedAt: previousOrder.acceptedAt,
      type,
      rearm: true,
    }));
  }
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
      stage: { in: ["LEAD_BARU", "DIHUBUNGI", "KEBUTUHAN_TERGALI", "PENAWARAN", "FOLLOW_UP", "NEGOSIASI"] },
    },
  });
  if (openOpportunityCount > 0) return;

  const reminders = await tx.customerReminder.findMany({
    where: { customerId, resolvedAt: null },
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
