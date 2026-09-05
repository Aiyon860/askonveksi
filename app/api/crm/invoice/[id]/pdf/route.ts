import { entityIdSchema } from "@/lib/crm/validation";
import { createInvoicePdf } from "@/lib/crm/invoice-pdf";
import { normalizePdfImage } from "@/lib/crm/pdf-image";
import { requireActor } from "@/lib/auth/session";
import { CRM_ROLES } from "@/lib/auth/permissions";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireActor(CRM_ROLES);
  } catch {
    return new Response("Anda harus masuk untuk mengunduh invoice.", { status: 401 });
  }
  const parsed = entityIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response("Invoice tidak ditemukan.", { status: 404 });

  const prisma = getPrismaClient();
  const [invoice, currentBusiness] = await Promise.all([prisma.invoice.findUnique({
    where: { id: parsed.data },
    select: {
      invoiceNo: true,
      revision: true,
      status: true,
      snapshotCustomerName: true,
      snapshotCompanyName: true,
      snapshotWhatsapp: true,
      snapshotEmail: true,
      snapshotInstagram: true,
      snapshotAddress: true,
      snapshotBusinessName: true,
      snapshotBusinessPhone: true,
      snapshotBusinessEmail: true,
      snapshotBusinessAddress: true,
      snapshotBusinessLogoPath: true,
      discountType: true,
      discountValue: true,
      subtotal: true,
      totalDiscount: true,
      totalTax: true,
      total: true,
      createdAt: true,
      issuedAt: true,
      dueAt: true,
      notes: true,
      purchaseOrder: { select: { purchaseOrderNo: true } },
      items: {
        select: {
          productName: true, size: true, description: true, quantity: true, unitPrice: true, grossAmount: true,
          discountPercent: true, discountAmount: true, taxRate: true, taxAmount: true, total: true, subtotal: true,
        },
        orderBy: { position: "asc" },
      },
      salesOrder: { select: { payment: { select: { transactions: { select: { amount: true, status: true } } } } } },
    },
  }), prisma.businessProfile.findUnique({ where: { id: "default" } })]);
  if (!invoice) return new Response("Invoice tidak ditemukan.", { status: 404 });

  const profile = invoice.status === "DRAFT" ? currentBusiness : null;
  const logoPath = invoice.status === "DRAFT" ? profile?.logoPath : invoice.snapshotBusinessLogoPath;
  let logoBytes: Uint8Array | undefined;
  if (logoPath) {
    const { data } = await createAdminClient().storage.from("business-assets").download(logoPath);
    if (data) {
      try { logoBytes = await normalizePdfImage(new Uint8Array(await data.arrayBuffer())); } catch { logoBytes = undefined; }
    }
  }
  const pdf = await createInvoicePdf({
    ...invoice,
    snapshotBusinessName: invoice.snapshotBusinessName ?? profile?.name ?? "AS Konveksi",
    snapshotBusinessPhone: invoice.snapshotBusinessPhone ?? profile?.phone ?? null,
    snapshotBusinessEmail: invoice.snapshotBusinessEmail ?? profile?.email ?? null,
    snapshotBusinessAddress: invoice.snapshotBusinessAddress ?? profile?.address ?? null,
  }, logoBytes);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNo}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
