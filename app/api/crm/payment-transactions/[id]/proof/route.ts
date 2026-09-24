import { requireActor } from "@/lib/auth/session";
import { entityIdSchema } from "@/lib/crm/validation";
import { PAYMENT_PROOF_BUCKET } from "@/lib/payment-proof";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireActor(); } catch { return new Response("Anda harus masuk.", { status: 401 }); }
  const id = entityIdSchema.safeParse((await params).id);
  if (!id.success) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const proof = await getPrismaClient().paymentTransaction.findUnique({ where: { id: id.data }, select: { proofPath: true, proofFileName: true, proofMimeType: true } });
  if (!proof?.proofPath || !proof.proofFileName || !proof.proofMimeType) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const { data, error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).download(proof.proofPath);
  if (error) return new Response("Bukti tidak ditemukan.", { status: 404 });
  const inline = proof.proofMimeType.startsWith("image/");
  return new Response(await data.arrayBuffer(), { headers: { "Content-Type": proof.proofMimeType, "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(proof.proofFileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
