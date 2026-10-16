import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireActor();
  } catch {
    return new Response("Anda harus masuk.", { status: 401 });
  }
  const profile = await getPrismaClient().businessProfile.findUnique({ where: { id: "default" }, select: { signaturePath: true } });
  if (!profile?.signaturePath) return new Response("Gambar tanda tangan tidak ditemukan.", { status: 404 });
  const { data, error } = await createAdminClient().storage.from("business-assets").download(profile.signaturePath);
  if (error || !data) return new Response("Gambar tanda tangan tidak ditemukan.", { status: 404 });
  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
