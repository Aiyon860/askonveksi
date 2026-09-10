import { DESIGN_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { entityIdSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ taskId: string; attachmentId: string }> }) {
  try { await requireActor(DESIGN_VIEW_ROLES); } catch { return new Response("Anda tidak berhak membuka file desain.", { status: 403 }); }
  const values = await params;
  const taskId = entityIdSchema.safeParse(values.taskId);
  const attachmentId = entityIdSchema.safeParse(values.attachmentId);
  if (!taskId.success || !attachmentId.success) return new Response("File desain tidak ditemukan.", { status: 404 });
  const attachment = await getPrismaClient().designAttachment.findFirst({ where: { id: attachmentId.data, designRevision: { designTaskId: taskId.data } }, select: { path: true, originalName: true, contentType: true } });
  if (!attachment) return new Response("File desain tidak ditemukan.", { status: 404 });
  const { data, error } = await createAdminClient().storage.from("crm-po-designs").download(attachment.path);
  if (error) return new Response("File desain tidak dapat dibuka.", { status: 404 });
  return new Response(await data.arrayBuffer(), { headers: { "Content-Type": attachment.contentType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
