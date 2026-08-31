"use server";

import { revalidatePath } from "next/cache";

import { flashMessagePath, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { requireActor } from "@/lib/auth/session";
import { entityIdSchema } from "@/lib/crm/validation";
import { customerReminderVisibilityWhere } from "@/lib/crm/reminder-data";
import { getPrismaClient } from "@/lib/prisma";

function refreshNotifications() {
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markCustomerReminderReadAction(formData: FormData) {
  return runRedirectingAction("/notifications", async () => {
    const actor = await requireActor();
    const parsed = entityIdSchema.safeParse(formData.get("reminderId"));
    if (!parsed.success) throw new UserFacingError("Notifikasi tidak valid.");

    const prisma = getPrismaClient();
    const reminder = await prisma.customerReminder.findFirst({
      where: {
        AND: [customerReminderVisibilityWhere(actor), { id: parsed.data }],
      },
      select: { id: true },
    });
    if (!reminder) throw new UserFacingError("Notifikasi tidak tersedia atau bukan bagian Anda.");

    await prisma.customerReminderReceipt.upsert({
      where: {
        reminderId_actorId: { reminderId: reminder.id, actorId: actor.id },
      },
      create: { reminderId: reminder.id, actorId: actor.id },
      update: { readAt: new Date() },
    });
    refreshNotifications();
    return flashMessagePath("/notifications", "notice", "Notifikasi ditandai sudah dibaca.");
  });
}

export async function markAllCustomerRemindersReadAction() {
  return runRedirectingAction("/notifications", async () => {
    const actor = await requireActor();
    const prisma = getPrismaClient();
    const reminders = await prisma.customerReminder.findMany({
      where: {
        AND: [
          customerReminderVisibilityWhere(actor),
          { receipts: { none: { actorId: actor.id } } },
        ],
      },
      select: { id: true },
    });

    if (reminders.length) {
      await prisma.customerReminderReceipt.createMany({
        data: reminders.map((reminder) => ({ reminderId: reminder.id, actorId: actor.id })),
        skipDuplicates: true,
      });
    }
    refreshNotifications();
    return flashMessagePath("/notifications", "notice", "Semua notifikasi ditandai sudah dibaca.");
  });
}
