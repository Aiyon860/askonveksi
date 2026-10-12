import { DESIGN_VIEW_ROLES, DETAIL_DESIGN_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { entityIdSchema } from "@/lib/crm/validation";
import { sniffImageContentType } from "@/lib/design/image";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ taskId: string; attachmentId: string }> }) {
  try { await requireActor([...DESIGN_VIEW_ROLES, ...DETAIL_DESIGN_VIEW_ROLES]); } catch { return new Response("Anda tidak berhak membuka file desain.", { status: 403 }); }
  const values = await params;
  const taskId = entityIdSchema.safeParse(values.taskId);
  const attachmentId = entityIdSchema.safeParse(values.attachmentId);
  if (!taskId.success || !attachmentId.success) return new Response("File desain tidak ditemukan.", { status: 404 });
  const attachment = await getPrismaClient().designAttachment.findFirst({ where: { id: attachmentId.data, designRevision: { designTaskId: taskId.data } }, select: { path: true, originalPath: true, originalName: true, contentType: true } });
  if (!attachment) return new Response("File desain tidak ditemukan.", { status: 404 });
  const original = new URL(request.url).searchParams.has("original");
  const { data, error } = await createAdminClient().storage.from("crm-po-designs").download(original && attachment.originalPath ? attachment.originalPath : attachment.path);
  if (error) return new Response("File desain tidak dapat dibuka.", { status: 404 });
  const disposition = new URL(request.url).searchParams.has("inline") ? "inline" : "attachment";
  // Salinan desain awal dan revisi lama bisa berjenis beda dari kolom contentType,
  // jadi tipe dikenali ulang dari isi file agar pratinjau dengan `nosniff` tetap tampil.
  const buffer = await data.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return new Response(buffer, { headers: { "Content-Type": sniffImageContentType(bytes) ?? attachment.contentType, "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
