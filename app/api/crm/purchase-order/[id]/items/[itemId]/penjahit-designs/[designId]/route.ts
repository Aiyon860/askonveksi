import { requireActor } from "@/lib/auth/session";
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { entityIdSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";

const BUCKET = PO_DESIGNS_BUCKET;

/**
 * Pratinjau satu gambar desain penjahit per produk — dipakai thumbnail dialog
 * "Edit PDF Penjahit". Satu produk boleh punya banyak gambar (maks 10).
 * Route lama `/penjahit-design` tetap tersedia untuk data tunggal sebelum revisi.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string; designId: string }> },
) {
  try {
    await requireActor(CRM_VIEW_ROLES);
  } catch {
    return new Response("Anda harus masuk untuk membuka desain penjahit.", { status: 401 });
  }

  const values = await params;
  const purchaseOrderId = entityIdSchema.safeParse(values.id);
  const itemId = entityIdSchema.safeParse(values.itemId);
  const designId = entityIdSchema.safeParse(values.designId);
  if (!purchaseOrderId.success || !itemId.success || !designId.success) return new Response("Desain penjahit tidak ditemukan.", { status: 404 });

  const design = await getPrismaClient().purchaseOrderItemDesign.findFirst({
    where: {
      id: designId.data,
      itemId: itemId.data,
      item: { purchaseOrderId: purchaseOrderId.data },
    },
    select: { path: true, originalName: true, contentType: true },
  });
  if (!design) return new Response("Desain penjahit tidak ditemukan.", { status: 404 });

  const { data, error } = await erpStorage(BUCKET).download(design.path);
  if (error) return new Response("Desain penjahit tidak dapat dibuka.", { status: 404 });

  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": design.contentType || "image/png",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(design.originalName || "desain-penjahit")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
