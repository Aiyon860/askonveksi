import { requireActor } from "@/lib/auth/session";
import { entityIdSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "quotation-acceptance-proofs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireActor();
  } catch {
    return new Response("Anda harus masuk untuk membuka bukti.", { status: 401 });
  }
  const parsed = entityIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response("Bukti tidak ditemukan.", { status: 404 });

  const proof = await getPrismaClient().quotation.findUnique({
    where: { id: parsed.data },
    select: { acceptanceProofPath: true, acceptanceProofName: true, acceptanceProofType: true },
  });
  if (!proof?.acceptanceProofPath || !proof.acceptanceProofType) return new Response("Bukti tidak ditemukan.", { status: 404 });

  const { data, error } = await createAdminClient().storage.from(BUCKET).download(proof.acceptanceProofPath);
  if (error) return new Response("Bukti tidak dapat dibuka.", { status: 404 });

  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": proof.acceptanceProofType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(proof.acceptanceProofName ?? "bukti-persetujuan")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
