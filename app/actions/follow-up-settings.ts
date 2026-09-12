"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { flashMessagePath, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { CRM_OPERATOR_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { firstValidationMessage } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";

const settingsSchema = z.object({
  version: z.coerce.number().int().positive(),
  offsets: z.array(z.coerce.number().int().min(-365).max(365)).length(3).refine((items) => new Set(items).size === 3, "Ketiga waktu pengingat harus berbeda."),
});

export async function updateFollowUpSettingsAction(formData: FormData) {
  return runRedirectingAction("/crm/follow-up/settings", async () => {
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

    revalidatePath("/crm/follow-up/settings");
    return flashMessagePath("/crm/follow-up/settings", "notice", "Waktu pengingat pembayaran disimpan.");
  });
}
