import { requireActor } from "@/lib/auth/session";
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { forBrand } from "@/lib/brand/prisma-extension";
import { readDefaultBrandLogoPng } from "@/lib/crm/brand-logo";
import { createPurchaseOrderPdf } from "@/lib/crm/purchase-order-pdf";
import { normalizePdfImage } from "@/lib/crm/pdf-image";
import { entityIdSchema } from "@/lib/crm/validation";
import { downloadFilename } from "@/lib/download-filename";
import { getPrismaClient } from "@/lib/prisma";
import { BUSINESS_ASSETS_BUCKET, erpStorage, PO_DESIGNS_BUCKET } from "@/lib/storage/erp-storage";

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireActor(CRM_VIEW_ROLES); } catch { return new Response("Anda tidak memiliki akses untuk mengunduh PO.", { status: 403 }); }
  const parsed = entityIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response("Invoice tidak ditemukan.", { status: 404 });
  const variant = new URL(request.url).searchParams.get("variant") === "penjahit" ? "penjahit" as const : "customer" as const;

  const prisma = getPrismaClient();
  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id: parsed.data },
    include: {
      opportunity: { select: { customer: { select: { name: true, companyName: true } } } },
      productCategory: { select: { name: true } },
      items: { select: { id: true, name: true, pola: true, baseColor: true, variationColor: true, garmentType: true, decorationMethods: true, designNotes: true, penjahitDeadline: true, penjahitDesignPath: true, penjahitDesignName: true, penjahitDesignType: true, designs: { select: { path: true, originalName: true, contentType: true }, orderBy: { position: "asc" } }, productCategory: { select: { name: true } } }, orderBy: { position: "asc" } },
      sizes: { select: { itemId: true, size: true, sleeveLength: true, quantity: true }, orderBy: { position: "asc" } },
      rosterEntries: { select: { itemId: true, memberId: true, name: true, jabatan: true, size: true, sleeveLength: true }, orderBy: { position: "asc" } },
      attachments: { select: { path: true, kind: true, originalName: true, contentType: true, caption: true }, orderBy: { createdAt: "asc" } },
      // Desain tanpa tahap persetujuan: versi terbaru setiap produk langsung dipakai di PDF.
      designTask: { select: { revisions: { orderBy: [{ revision: "desc" }, { createdAt: "desc" }], select: { itemId: true, attachments: { select: { path: true, kind: true, originalName: true, contentType: true }, orderBy: { createdAt: "asc" } } } } } },
    },
  });
  if (!purchaseOrder) return new Response("PO tidak ditemukan.", { status: 404 });
  const currentBusiness = await prisma.businessProfile.findFirst(forBrand(purchaseOrder.brand, { where: {} }));
  // Profil brand dokumen diutamakan; snapshot nama/logo brand lain diabaikan.
  const brandDefaultName = purchaseOrder.brand === "SAGA" ? "SAGA" : "AS Konveksi";
  const snapshotName = purchaseOrder.snapshotBusinessName?.trim() || null;
  const snapshotLooksForeign =
    Boolean(snapshotName) &&
    ((purchaseOrder.brand === "SAGA" && /askonveksi|as\s*konveksi/i.test(snapshotName!)) ||
      (purchaseOrder.brand === "ASKONVEKSI" && /^saga$/i.test(snapshotName!)));
  const businessName = currentBusiness?.name ?? (snapshotLooksForeign ? null : snapshotName) ?? brandDefaultName;
  const businessPhone = currentBusiness?.phone ?? (snapshotLooksForeign ? null : purchaseOrder.snapshotBusinessPhone);
  const businessEmail = currentBusiness?.email ?? (snapshotLooksForeign ? null : purchaseOrder.snapshotBusinessEmail);
  const businessAddress = currentBusiness?.address ?? (snapshotLooksForeign ? null : purchaseOrder.snapshotBusinessAddress);
  const logoPath = currentBusiness?.logoPath ?? (snapshotLooksForeign ? null : purchaseOrder.snapshotBusinessLogoPath) ?? null;
  let logoBytes = await readDefaultBrandLogoPng(purchaseOrder.brand);
  if (logoPath) {
    const { data } = await erpStorage(BUSINESS_ASSETS_BUCKET).download(logoPath);
    if (data) {
      try { logoBytes = await normalizePdfImage(new Uint8Array(await data.arrayBuffer())); } catch { /* Gunakan logo bawaan brand. */ }
    }
  }
  const designRevisions = purchaseOrder.designTask?.revisions ?? [];
  const itemNames = new Map(purchaseOrder.items.map((item) => [item.id, item.name]));
  const latestDesignByItem = new Map<string, (typeof designRevisions)[number]>();
  for (const revision of designRevisions) if (!latestDesignByItem.has(revision.itemId)) latestDesignByItem.set(revision.itemId, revision);
  // `itemId` dipakai PDF: gambar desain menempel di lembar produknya masing-masing (H3).
  const designAttachments = [...latestDesignByItem].flatMap(([itemId, revision]) => revision.attachments.map((attachment) => ({
    ...attachment,
    itemId,
    caption: itemNames.get(itemId) ? `Desain produksi ${itemNames.get(itemId)}` : "Desain produksi",
  })));
  // Sprint 11 R3: varian penjahit menampilkan Desain Penjahit tiap produk di atas
  // gambar desain produksi; varian customer tidak menyertakannya (PDF customer tak berubah).
  // Revisi: satu produk boleh punya beberapa gambar — tiap gambar menjadi satu halaman
  // (lihat `drawPenjahitDesignSheet`). Kolom tunggal lama dipakai sebagai fallback.
  const penjahitAssets =
    variant === "penjahit"
      ? (await Promise.all(
          purchaseOrder.items.map(async (item) => {
            const designs = item.designs.length
              ? item.designs
              : item.penjahitDesignPath
                ? [{ path: item.penjahitDesignPath, originalName: item.penjahitDesignName ?? `Desain penjahit ${item.name}`, contentType: item.penjahitDesignType ?? "image/png" }]
                : [];
            const assets = await Promise.all(designs.map(async (design, index) => {
              const suffix = designs.length > 1 ? ` (${index + 1}/${designs.length})` : "";
              const label = `Desain penjahit ${item.name}${suffix}`;
              const { data } = await erpStorage(PO_DESIGNS_BUCKET).download(design.path);
              if (!data) return null;
              try {
                return { kind: "PENJAHIT_DESIGN", label, originalName: design.originalName || label, contentType: "image/png", bytes: await normalizePdfImage(new Uint8Array(await data.arrayBuffer())), itemId: item.id as string | null };
              } catch {
                return { kind: "PENJAHIT_DESIGN", label, originalName: design.originalName || label, contentType: design.contentType || "image/png", bytes: new Uint8Array(), itemId: item.id as string | null };
              }
            }));
            return assets;
          }),
        )).flat().filter((asset): asset is NonNullable<typeof asset> => asset !== null)
      : [];
  const assets = [...penjahitAssets, ...(await Promise.all([...purchaseOrder.attachments, ...designAttachments].map(async (item) => {
    const label = item.caption || ATTACHMENT_LABEL[item.kind] || item.originalName;
    // `itemId` wajib diteruskan agar gambar desain menempel di lembar produknya,
    // bukan jatuh ke lembar penutup di akhir dokumen.
    const itemId = ("itemId" in item && typeof item.itemId === "string" ? item.itemId : null) || null;
    if (item.contentType === "application/pdf") return { kind: item.kind, label, originalName: item.originalName, contentType: item.contentType, bytes: new Uint8Array(), itemId };
    const { data } = await erpStorage(PO_DESIGNS_BUCKET).download(item.path);
    if (!data) return null;
    try {
      return { kind: item.kind, label, originalName: item.originalName, contentType: "image/png", bytes: await normalizePdfImage(new Uint8Array(await data.arrayBuffer())), itemId };
    } catch {
      return { kind: item.kind, label, originalName: item.originalName, contentType: item.contentType, bytes: new Uint8Array(), itemId };
    }
  }))).filter((item): item is NonNullable<typeof item> => item !== null)];
  const pdf = await createPurchaseOrderPdf({
    ...purchaseOrder,
    productCategory: purchaseOrder.productCategory?.name ?? null,
    snapshotBusinessName: businessName,
    snapshotBusinessPhone: businessPhone ?? null,
    snapshotBusinessEmail: businessEmail ?? null,
    snapshotBusinessAddress: businessAddress ?? null,
  }, logoBytes, assets, variant, purchaseOrder.brand);
  // Nama file juga tanpa akhiran revisi (-R2/-R3) supaya customer/penjahit tidak
  // melihat penanda revisi; revisi tetap tercatat di sistem.
  const documentNo = purchaseOrder.purchaseOrderNo.replace(/-R\d+$/i, "");
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${new URL(request.url).searchParams.has("preview") ? "inline" : "attachment"}; filename="${downloadFilename(`purchase-order-${documentNo}${variant === "penjahit" ? "-penjahit" : ""}`, "pdf")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
