import { requireActor } from "@/lib/auth/session";
import { CRM_ROLES } from "@/lib/auth/permissions";
import { entityIdSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "crm-po-designs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    await requireActor(CRM_ROLES);
  } catch {
    return new Response("Anda harus masuk untuk membuka lampiran desain.", { status: 401 });
  }

  const values = await params;
  const purchaseOrderId = entityIdSchema.safeParse(values.id);
  const attachmentId = entityIdSchema.safeParse(values.attachmentId);
  if (!purchaseOrderId.success || !attachmentId.success) return new Response("Lampiran tidak ditemukan.", { status: 404 });

  const attachment = await getPrismaClient().purchaseOrderAttachment.findFirst({
    where: { id: attachmentId.data, purchaseOrderId: purchaseOrderId.data },
    select: { path: true, originalName: true, contentType: true },
  });
  if (!attachment) return new Response("Lampiran tidak ditemukan.", { status: 404 });

  const { data, error } = await createAdminClient().storage.from(BUCKET).download(attachment.path);
  if (error) return new Response("Lampiran tidak dapat dibuka.", { status: 404 });

  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
