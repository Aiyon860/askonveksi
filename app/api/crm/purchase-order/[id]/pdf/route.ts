import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { requireActor } from "@/lib/auth/session";
import { CRM_ROLES } from "@/lib/auth/permissions";
import { createPurchaseOrderPdf } from "@/lib/crm/purchase-order-pdf";
import { normalizePdfImage } from "@/lib/crm/pdf-image";
import { entityIdSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ATTACHMENT_LABEL: Record<string, string> = {
  MAIN_DESIGN: "Desain utama",
  FRONT: "Tampak depan",
  BACK: "Tampak belakang",
  LOGO_RIGHT: "Logo kanan",
  LOGO_BACK: "Logo belakang",
  LOGO_FRONT: "Logo depan",
  OTHER: "Lampiran lain",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireActor(CRM_ROLES); } catch { return new Response("Anda tidak memiliki akses untuk mengunduh PO.", { status: 403 }); }
  const parsed = entityIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response("PO tidak ditemukan.", { status: 404 });
  const prisma = getPrismaClient();
  const [purchaseOrder, currentBusiness] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id: parsed.data },
      include: {
        opportunity: { select: { customer: { select: { name: true, companyName: true } } } },
        sizes: { select: { size: true, sleeveLength: true, quantity: true }, orderBy: { position: "asc" } },
        rosterEntries: { select: { memberId: true, name: true, size: true }, orderBy: { position: "asc" } },
        attachments: { select: { path: true, kind: true, originalName: true, contentType: true, caption: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.businessProfile.findUnique({ where: { id: "default" } }),
  ]);
  if (!purchaseOrder) return new Response("PO tidak ditemukan.", { status: 404 });
  const storage = createAdminClient().storage;
  const logoPath = purchaseOrder.status === "DRAFT" ? currentBusiness?.logoPath : purchaseOrder.snapshotBusinessLogoPath;
  let logoBytes = new Uint8Array(await readFile(join(process.cwd(), "public/brand/askonveksi-logo.png")));
  if (logoPath) {
    const { data } = await storage.from("business-assets").download(logoPath);
    if (data) {
      try { logoBytes = await normalizePdfImage(new Uint8Array(await data.arrayBuffer())); } catch { /* Gunakan logo bawaan. */ }
    }
  }
  const assets = (await Promise.all(purchaseOrder.attachments.map(async (item) => {
    const label = item.caption || ATTACHMENT_LABEL[item.kind] || item.originalName;
    if (item.contentType === "application/pdf") return { kind: item.kind, label, originalName: item.originalName, contentType: item.contentType, bytes: new Uint8Array() };
    const { data } = await storage.from("crm-po-designs").download(item.path);
    if (!data) return null;
    try {
      return { kind: item.kind, label, originalName: item.originalName, contentType: "image/png", bytes: await normalizePdfImage(new Uint8Array(await data.arrayBuffer())) };
    } catch {
      return { kind: item.kind, label, originalName: item.originalName, contentType: item.contentType, bytes: new Uint8Array() };
    }
  }))).filter((item): item is NonNullable<typeof item> => item !== null);
  const profile = purchaseOrder.status === "DRAFT" ? currentBusiness : null;
  const pdf = await createPurchaseOrderPdf({
    ...purchaseOrder,
    snapshotBusinessName: purchaseOrder.snapshotBusinessName ?? profile?.name ?? "AS Konveksi",
    snapshotBusinessPhone: purchaseOrder.snapshotBusinessPhone ?? profile?.phone ?? null,
    snapshotBusinessEmail: purchaseOrder.snapshotBusinessEmail ?? profile?.email ?? null,
    snapshotBusinessAddress: purchaseOrder.snapshotBusinessAddress ?? profile?.address ?? null,
  }, logoBytes, assets);
  return new Response(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${purchaseOrder.purchaseOrderNo}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
