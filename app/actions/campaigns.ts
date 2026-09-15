"use server";

import { revalidatePath } from "next/cache";

import { flashMessagePath, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { CRM_OPERATOR_ROLES } from "@/lib/auth/permissions";
import { requireActor, requireDeveloperActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { campaignTestSchema, campaignFieldsSchema, deleteCampaignSchema, parseJakartaDateTime, renderCampaignMessage, toggleCampaignSchema, updateCampaignSchema } from "@/lib/whatsapp/campaigns";
import { enqueueCampaignTestWhatsAppMessage } from "@/lib/whatsapp/jobs";

function campaignInput(formData: FormData) {
  return { name: formData.get("name"), body: formData.get("body"), scheduledAt: formData.get("scheduledAt") };
}

export async function sendCampaignTestAction(formData: FormData) {
  return runRedirectingAction("/campaigns", async () => {
    const actor = await requireDeveloperActor();
    const parsed = campaignTestSchema.safeParse({ body: formData.get("body"), phoneNumber: formData.get("phoneNumber") });
    if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Data test campaign tidak valid.");

    const business = await getPrismaClient().businessProfile.findUnique({ where: { id: "default" }, select: { name: true } });
    const text = renderCampaignMessage(parsed.data.body, {
      customer_name: "Customer Test",
      company_name: "Perusahaan Test",
      business_name: business?.name ?? "AS Konveksi",
    });
    await enqueueCampaignTestWhatsAppMessage(actor, parsed.data.phoneNumber, text);
    revalidatePath("/campaigns");
    revalidatePath("/whatsapp/jobs");
    return flashMessagePath("/campaigns", "notice", "Pesan test dijadwalkan untuk dikirim.");
  });
}

export async function createCampaignAction(formData: FormData) {
  return runRedirectingAction("/campaigns", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = campaignFieldsSchema.safeParse(campaignInput(formData));
    if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Campaign tidak valid.");
    const scheduledAt = parseJakartaDateTime(parsed.data.scheduledAt)!;
    if (scheduledAt <= new Date()) throw new UserFacingError("Jadwal campaign harus di masa depan.");
    await getPrismaClient().$transaction(async (tx) => {
      const campaign = await tx.whatsAppCampaign.create({
        data: { name: parsed.data.name, body: parsed.data.body, scheduledAt, createdById: actor.id, updatedById: actor.id },
        select: { id: true },
      });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "WhatsAppCampaign", entityId: campaign.id, action: "CAMPAIGN_CREATED", changedFields: ["name", "body", "scheduledAt"] } });
    });
    revalidatePath("/campaigns");
    return flashMessagePath("/campaigns", "notice", "Campaign dijadwalkan.");
  });
}

export async function updateCampaignAction(formData: FormData) {
  return runRedirectingAction("/campaigns", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = updateCampaignSchema.safeParse({ ...campaignInput(formData), campaignId: formData.get("campaignId"), version: formData.get("version") });
    if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Campaign tidak valid.");
    const scheduledAt = parseJakartaDateTime(parsed.data.scheduledAt)!;
    if (scheduledAt <= new Date()) throw new UserFacingError("Jadwal campaign harus di masa depan.");
    await getPrismaClient().$transaction(async (tx) => {
      const updated = await tx.whatsAppCampaign.updateMany({
        where: { id: parsed.data.campaignId, version: parsed.data.version, status: { in: ["SCHEDULED", "PAUSED"] } },
        data: { name: parsed.data.name, body: parsed.data.body, scheduledAt, updatedById: actor.id, version: { increment: 1 } },
      });
      if (!updated.count) throw new UserFacingError("Campaign sudah mulai atau berubah. Muat ulang halaman.");
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "WhatsAppCampaign", entityId: parsed.data.campaignId, action: "CAMPAIGN_UPDATED", changedFields: ["name", "body", "scheduledAt"] } });
    });
    revalidatePath("/campaigns");
    return flashMessagePath("/campaigns", "notice", "Campaign diperbarui.");
  });
}

export async function toggleCampaignAction(formData: FormData) {
  return runRedirectingAction("/campaigns", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = toggleCampaignSchema.safeParse({ campaignId: formData.get("campaignId"), version: formData.get("version"), enabled: formData.get("enabled") });
    if (!parsed.success) throw new UserFacingError("Campaign tidak valid.");
    const now = new Date();
    let notice = "";
    await getPrismaClient().$transaction(async (tx) => {
      const campaign = await tx.whatsAppCampaign.findFirst({
        where: { id: parsed.data.campaignId, version: parsed.data.version },
        select: { status: true, scheduledAt: true },
      });
      if (!campaign) throw new UserFacingError("Campaign sudah berubah. Muat ulang halaman.");

      if (parsed.data.enabled) {
        if (campaign.status !== "PAUSED") throw new UserFacingError("Campaign ini tidak dapat diaktifkan kembali.");
        const nextStatus = campaign.scheduledAt > now ? "SCHEDULED" : "SKIPPED";
        const resumed = await tx.whatsAppCampaign.updateMany({
          where: { id: parsed.data.campaignId, version: parsed.data.version, status: "PAUSED" },
          data: { status: nextStatus, updatedById: actor.id, version: { increment: 1 } },
        });
        if (!resumed.count) throw new UserFacingError("Campaign sudah berubah. Muat ulang halaman.");
        await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "WhatsAppCampaign", entityId: parsed.data.campaignId, action: nextStatus === "SCHEDULED" ? "CAMPAIGN_RESUMED" : "CAMPAIGN_SKIPPED", changedFields: ["status"] } });
        notice = nextStatus === "SCHEDULED" ? "Campaign diaktifkan dan akan dikirim sesuai jadwal." : "Jadwal campaign sudah lewat sehingga pengiriman dilewati.";
        return;
      }

      if (campaign.status !== "SCHEDULED" && campaign.status !== "PROCESSING") throw new UserFacingError("Campaign ini tidak dapat dijeda.");
      const nextStatus = campaign.status === "SCHEDULED" ? "PAUSED" : "SKIPPED";
      const paused = await tx.whatsAppCampaign.updateMany({
        where: { id: parsed.data.campaignId, version: parsed.data.version, status: campaign.status },
        data: { status: nextStatus, updatedById: actor.id, version: { increment: 1 } },
      });
      if (!paused.count) throw new UserFacingError("Campaign sudah berubah. Muat ulang halaman.");
      if (nextStatus === "SKIPPED") {
        await tx.whatsAppAutomationJob.updateMany({
          where: { campaignId: parsed.data.campaignId, status: { in: ["QUEUED", "RETRY"] } },
          data: { status: "CANCELLED", nextAttemptAt: null, lastError: "Campaign dihentikan melalui switch." },
        });
        await tx.whatsAppMessage.updateMany({
          where: { automationJob: { is: { campaignId: parsed.data.campaignId } }, status: "QUEUED" },
          data: { status: "CANCELLED", errorMessage: "Campaign dihentikan melalui switch." },
        });
      }
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "WhatsAppCampaign", entityId: parsed.data.campaignId, action: nextStatus === "PAUSED" ? "CAMPAIGN_PAUSED" : "CAMPAIGN_SKIPPED", changedFields: ["status"] } });
      notice = nextStatus === "PAUSED" ? "Campaign dijeda. Aktifkan kembali sebelum jadwal dimulai." : "Sisa pengiriman campaign dilewati.";
    });
    revalidatePath("/campaigns");
    revalidatePath("/whatsapp/jobs");
    return flashMessagePath("/campaigns", "notice", notice);
  });
}

export async function deleteCampaignAction(formData: FormData) {
  return runRedirectingAction("/campaigns", async () => {
    const actor = await requireActor(CRM_OPERATOR_ROLES);
    const parsed = deleteCampaignSchema.safeParse({ campaignId: formData.get("campaignId"), version: formData.get("version") });
    if (!parsed.success) throw new UserFacingError("Campaign tidak valid.");

    await getPrismaClient().$transaction(async (tx) => {
      const locked = await tx.whatsAppCampaign.updateMany({
        where: { id: parsed.data.campaignId, version: parsed.data.version },
        data: { updatedById: actor.id, version: { increment: 1 } },
      });
      if (!locked.count) throw new UserFacingError("Campaign sudah berubah. Muat ulang halaman.");

      await tx.whatsAppMessage.updateMany({
        where: { automationJob: { is: { campaignId: parsed.data.campaignId, status: { in: ["QUEUED", "RETRY"] } } }, status: "QUEUED" },
        data: { status: "CANCELLED", errorMessage: "Campaign dihapus." },
      });
      await tx.whatsAppAutomationJob.updateMany({
        where: { campaignId: parsed.data.campaignId, status: { in: ["QUEUED", "RETRY"] } },
        data: { status: "CANCELLED", nextAttemptAt: null, lastError: "Campaign dihapus." },
      });
      await tx.whatsAppAutomationJob.updateMany({ where: { campaignId: parsed.data.campaignId }, data: { campaignId: null } });
      await tx.whatsAppCampaign.delete({ where: { id: parsed.data.campaignId } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "WhatsAppCampaign", entityId: parsed.data.campaignId, action: "CAMPAIGN_DELETED", changedFields: ["campaign"] } });
    });
    revalidatePath("/campaigns");
    revalidatePath("/whatsapp/jobs");
    return flashMessagePath("/campaigns", "notice", "Campaign dihapus.");
  });
}
