"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { flashMessagePath, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { CRM_OPERATOR_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { firstValidationMessage } from "@/lib/crm/validation";
import { repeatOrderDueAt } from "@/lib/crm/reminder-types";
import { getPrismaClient } from "@/lib/prisma";

const settingsSchema = z.object({
  version: z.coerce.number().int().positive(),
  offsets: z.array(z.coerce.number().int().min(-365).max(365)).length(3).refine((items) => new Set(items).size === 3, "Ketiga waktu pengingat harus berbeda."),
});

export async function updateFollowUpSettingsAction(formData: FormData) {
  return runRedirectingAction("/settings", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = settingsSchema.safeParse({ version: formData.get("version"), offsets: formData.getAll("offset") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const offsets = [...parsed.data.offsets].sort((a, b) => a - b);

    await getPrismaClient().$transaction(async (tx) => {
      const updated = await tx.businessProfile.updateMany({
        where: { id: "default", version: parsed.data.version },
        data: { invoiceReminderOffsets: offsets, version: { increment: 1 } },
      });
      if (!updated.count) throw new UserFacingError("Pengaturan sudah berubah. Muat ulang halaman.");
      const jobs = await tx.whatsAppAutomationJob.findMany({
        where: { type: "INVOICE_DUE", status: { in: ["QUEUED", "RETRY"] } },
        select: { id: true },
      });
      if (jobs.length) {
        const ids = jobs.map((job) => job.id);
        await tx.whatsAppAutomationJob.updateMany({ where: { id: { in: ids } }, data: { status: "CANCELLED", lastError: "Jadwal pengingat pembayaran diperbarui.", nextAttemptAt: null } });
        await tx.whatsAppMessage.updateMany({ where: { automationJobId: { in: ids }, status: { in: ["QUEUED", "SENDING"] } }, data: { status: "CANCELLED", errorMessage: "Jadwal pengingat pembayaran diperbarui." } });
      }
      await tx.auditEvent.create({
        data: { actorId: actor.id, entityType: "BusinessProfile", entityId: "default", action: "INVOICE_REMINDER_SETTINGS_UPDATED", changedFields: ["invoiceReminderOffsets"], metadata: { offsets } },
      });
    });

    revalidatePath("/settings");
    return flashMessagePath("/settings", "notice", "Waktu pengingat pembayaran disimpan.");
  });
}

const repeatOrderSettingsSchema = z.object({
  version: z.coerce.number().int().positive(),
  intervals: z.array(z.coerce.number().int().min(1).max(120)).min(1, "Isi minimal satu jeda bulan.").max(24),
});

export async function updateRepeatOrderSettingsAction(formData: FormData) {
  return runRedirectingAction("/settings", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = repeatOrderSettingsSchema.safeParse({
      version: formData.get("version"),
      intervals: formData.getAll("interval"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    await getPrismaClient().$transaction(async (tx) => {
      const updated = await tx.businessProfile.updateMany({
        where: { id: "default", version: parsed.data.version },
        data: { repeatOrderIntervals: parsed.data.intervals, version: { increment: 1 } },
      });
      if (!updated.count) throw new UserFacingError("Pengaturan sudah berubah. Muat ulang halaman.");

      const reminders = await tx.customerReminder.findMany({
        where: { type: "REACTIVATION", resolvedAt: null },
        select: { id: true, nextOccurrence: true, sourceSalesOrder: { select: { acceptedAt: true } } },
      });
      for (const reminder of reminders) {
        await tx.customerReminder.update({
          where: { id: reminder.id },
          data: {
            dueAt: repeatOrderDueAt(reminder.sourceSalesOrder.acceptedAt, parsed.data.intervals, reminder.nextOccurrence),
            generation: { increment: 1 },
          },
        });
      }

      const reminderIds = reminders.map((reminder) => reminder.id);
      const jobs = reminderIds.length ? await tx.whatsAppAutomationJob.findMany({
        where: { reminderId: { in: reminderIds }, type: "REACTIVATION", status: { in: ["QUEUED", "RETRY"] } },
        select: { id: true },
      }) : [];
      if (jobs.length) {
        const ids = jobs.map((job) => job.id);
        await tx.whatsAppAutomationJob.updateMany({ where: { id: { in: ids } }, data: { status: "CANCELLED", lastError: "Pola reminder order diperbarui.", nextAttemptAt: null } });
        await tx.whatsAppMessage.updateMany({ where: { automationJobId: { in: ids }, status: { in: ["QUEUED", "SENDING"] } }, data: { status: "CANCELLED", errorMessage: "Pola reminder order diperbarui." } });
      }
      await tx.auditEvent.create({
        data: { actorId: actor.id, entityType: "BusinessProfile", entityId: "default", action: "REPEAT_ORDER_SETTINGS_UPDATED", changedFields: ["repeatOrderIntervals"], metadata: { intervals: parsed.data.intervals } },
      });
    });

    revalidatePath("/settings");
    return flashMessagePath("/settings", "notice", "Pola reminder repeat order disimpan.");
  });
}
