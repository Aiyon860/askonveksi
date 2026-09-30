"use server";

import { revalidatePath, updateTag } from "next/cache";

import { flashMessagePath, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { WHATSAPP_ACCOUNT_MANAGER_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { recipientFilterSchema } from "@/lib/whatsapp/campaigns";
import { normalizeWhatsAppNumber, renderWhatsAppTemplate, unknownTemplateVariables } from "@/lib/whatsapp/core";
import { getBroadcastRecipientOptions, getFollowUpTemplateBody } from "@/lib/whatsapp/data";
import { enqueueManualWhatsAppMessage } from "@/lib/whatsapp/jobs";

const BROADCAST_PATH = "/crm/follow-up";
const MAX_BROADCAST_RECIPIENTS = 200;
const MAX_BROADCAST_MESSAGE_LENGTH = 4_000;

function refreshBroadcast() {
  revalidatePath(BROADCAST_PATH);
  revalidatePath("/whatsapp");
  revalidatePath("/whatsapp/jobs");
  updateTag("badge-counts");
}

/** Daftar penerima broadcast dengan filter pencarian, tanggal, dan kategori customer.
 *  Filter Kategori Order hanya ada di dialog Campaign Promo. */
export async function getBroadcastRecipientsAction(input: {
  query?: string;
  from?: string;
  to?: string;
  customerTypeId?: string;
}) {
  const parsed = recipientFilterSchema.safeParse({
    query: input.query?.trim() ? input.query.trim() : undefined,
    from: input.from || undefined,
    to: input.to || undefined,
    customerTypeId: input.customerTypeId || undefined,
  });
  if (!parsed.success) throw new UserFacingError("Filter broadcast tidak valid.");
  const { items, total, truncated, customerTypes } = await getBroadcastRecipientOptions(parsed.data);
  return { items, total, truncated, customerTypes };
}

/**
 * Broadcast Repeat Order manual: mengirim Follow Up Hari Ini hanya ke customer yang dicentang.
 * Pesan memakai isi form bila diisi, atau template Follow Up terbaru bila dibiarkan kosong.
 * Kirim manual tidak diblokir saklar `orderReminderEnabled` (keputusan Admin Customer memilih penerima),
 * tetapi tetap menghormati arsip, nomor WhatsApp valid, dan status OPTED_OUT.
 */
export async function sendTodayFollowUpBroadcastAction(formData: FormData) {
  return runRedirectingAction(BROADCAST_PATH, async () => {
    const actor = await requireActor(WHATSAPP_ACCOUNT_MANAGER_ROLES);
    const requestedIds = [
      ...new Set(
        formData
          .getAll("customerIds")
          .map((value) => String(value))
          .filter(Boolean),
      ),
    ];
    if (!requestedIds.length) throw new UserFacingError("Pilih minimal satu customer sebelum menekan Follow Up Hari Ini.");
    if (requestedIds.length > MAX_BROADCAST_RECIPIENTS) {
      throw new UserFacingError(`Maksimal ${MAX_BROADCAST_RECIPIENTS} customer per pengiriman Follow Up Hari Ini.`);
    }

    const message = String(formData.get("message") ?? "").trim();
    if (message.length > MAX_BROADCAST_MESSAGE_LENGTH) {
      throw new UserFacingError(`Pesan terlalu panjang, maksimal ${MAX_BROADCAST_MESSAGE_LENGTH} karakter.`);
    }
    const unknownVariables = message ? unknownTemplateVariables(message) : [];
    if (unknownVariables.length) {
      throw new UserFacingError(`Variabel template tidak dikenal: ${unknownVariables.join(", ")}.`);
    }

    const prisma = getPrismaClient();
    const [customers, followUpTemplateBody, business] = await Promise.all([
      prisma.customer.findMany({
        where: {
          id: { in: requestedIds },
          archivedAt: null,
          whatsapp: { not: null },
          whatsappConsentStatus: { not: "OPTED_OUT" },
        },
        select: {
          id: true,
          name: true,
          companyName: true,
          whatsapp: true,
          salesPic: { select: { name: true } },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      getFollowUpTemplateBody(),
      prisma.businessProfile.findUnique({ where: { id: "default" }, select: { name: true } }),
    ]);

    const templateBody = message || followUpTemplateBody;
    const sentIds: string[] = [];
    for (const customer of customers) {
      if (!normalizeWhatsAppNumber(customer.whatsapp)) continue;
      let text: string;
      try {
        text = renderWhatsAppTemplate(templateBody, {
          business_name: business?.name ?? "AS Konveksi",
          customer_name: customer.name,
          company_name: customer.companyName ?? "",
          sales_pic_name: customer.salesPic?.name ?? "",
        });
      } catch {
        continue;
      }
      await enqueueManualWhatsAppMessage({ actor, customerId: customer.id, text });
      sentIds.push(customer.id);
    }

    const skipped = requestedIds.length - sentIds.length;
    if (sentIds.length) {
      await prisma.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "WhatsAppBroadcast",
          entityId: `follow-up-${new Date().toISOString()}`,
          action: "FOLLOW_UP_BROADCAST_QUEUED",
          changedFields: ["customerIds", "message"],
          metadata: { customerIds: sentIds, skipped, requested: requestedIds.length },
        },
      });
      refreshBroadcast();
      return flashMessagePath(
        BROADCAST_PATH,
        "notice",
        skipped
          ? `${sentIds.length} customer dijadwalkan menerima Follow Up Hari Ini. ${skipped} customer dilewati karena arsip, tanpa nomor WhatsApp, atau menolak pesan.`
          : `${sentIds.length} customer dijadwalkan menerima Follow Up Hari Ini.`,
      );
    }

    refreshBroadcast();
    return flashMessagePath(
      BROADCAST_PATH,
      "warning",
      "Tidak ada pesan yang dikirim. Customer terpilih hanya berisi data arsip, tanpa nomor WhatsApp valid, atau menolak pesan.",
    );
  });
}
