import { requireActor } from "@/lib/auth/session";
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { entityIdSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "crm-po-designs";

/** Pratinjau desain penjahit per produk (Sprint 11 R3) — dipakai thumbnail dialog & PDF. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    await requireActor(CRM_VIEW_ROLES);
  } catch {
    return new Response("Anda harus masuk untuk membuka desain penjahit.", { status: 401 });
  }

  const values = await params;
  const purchaseOrderId = entityIdSchema.safeParse(values.id);
  const itemId = entityIdSchema.safeParse(values.itemId);
  if (!purchaseOrderId.success || !itemId.success) return new Response("Desain penjahit tidak ditemukan.", { status: 404 });

  const item = await getPrismaClient().purchaseOrderItem.findFirst({
    where: { id: itemId.data, purchaseOrderId: purchaseOrderId.data, penjahitDesignPath: { not: null } },
    select: { penjahitDesignPath: true, penjahitDesignName: true, penjahitDesignType: true },
  });
  if (!item?.penjahitDesignPath) return new Response("Desain penjahit tidak ditemukan.", { status: 404 });

  const { data, error } = await createAdminClient().storage.from(BUCKET).download(item.penjahitDesignPath);
  if (error) return new Response("Desain penjahit tidak dapat dibuka.", { status: 404 });

  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": item.penjahitDesignType ?? "image/png",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(item.penjahitDesignName ?? "desain-penjahit")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
