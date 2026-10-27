import { CRM_OPERATOR_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { erpStorage, WHATSAPP_MEDIA_BUCKET } from "@/lib/storage/erp-storage";

export const runtime = "nodejs";

/** Pratinjau gambar campaign untuk form edit (butuh role operator CRM). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireActor(CRM_OPERATOR_ROLES);
  } catch {
    return new Response("Anda tidak berhak membuka gambar campaign.", { status: 403 });
  }

  const campaign = await getPrismaClient().whatsAppCampaign.findUnique({
    where: { id: (await params).id },
    select: { imagePath: true, imageMimeType: true, imageFileName: true },
  });
  if (!campaign?.imagePath) return new Response("Gambar tidak ditemukan.", { status: 404 });

  const result = await erpStorage(WHATSAPP_MEDIA_BUCKET).download(campaign.imagePath);
  if (result.error) return new Response("Gambar tidak ditemukan.", { status: 404 });

  return new Response(await result.data.arrayBuffer(), {
    headers: {
      "Content-Type": campaign.imageMimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${(campaign.imageFileName || "campaign").replace(/["\\\r\n]/g, "-")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
