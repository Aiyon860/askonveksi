import { CRM_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { erpStorage, WHATSAPP_MEDIA_BUCKET } from "@/lib/storage/erp-storage";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let actor;
  try {
    actor = await requireActor(CRM_ROLES);
  } catch {
    return new Response("Anda harus masuk.", { status: 401 });
  }
  const message = await getPrismaClient().whatsAppMessage.findFirst({
    where: { id: (await params).id, ...(actor.role === "SALES" ? { conversation: { customer: { salesPicId: actor.id } } } : {}) },
    select: { mediaPath: true, mediaMimeType: true, mediaFileName: true },
  });
  if (!message?.mediaPath) return new Response("Lampiran tidak ditemukan.", { status: 404 });
  const result = await erpStorage(WHATSAPP_MEDIA_BUCKET).download(message.mediaPath);
  if (result.error) return new Response("Lampiran tidak ditemukan.", { status: 404 });
  const inlineImage = ["image/jpeg", "image/png", "image/webp"].includes(message.mediaMimeType ?? "");
  return new Response(await result.data.arrayBuffer(), {
    headers: {
      "Content-Type": inlineImage ? message.mediaMimeType! : "application/octet-stream",
      "Content-Disposition": `${inlineImage ? "inline" : "attachment"}; filename="${(message.mediaFileName || "lampiran").replace(/["\\\r\n]/g, "-")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
