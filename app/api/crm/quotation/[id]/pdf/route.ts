import { entityIdSchema } from "@/lib/crm/validation";
import { createQuotationPdf } from "@/lib/crm/quotation-pdf";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireActor();
  } catch {
    return new Response("Anda harus masuk untuk mengunduh quotation.", { status: 401 });
  }
  const parsed = entityIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response("Quotation tidak ditemukan.", { status: 404 });

  const quotation = await getPrismaClient().quotation.findUnique({
    where: { id: parsed.data },
    select: {
      quotationNo: true,
      revision: true,
      status: true,
      snapshotCustomerName: true,
      snapshotCompanyName: true,
      snapshotWhatsapp: true,
      snapshotEmail: true,
      snapshotInstagram: true,
      snapshotAddress: true,
      discountType: true,
      discountValue: true,
      subtotal: true,
      total: true,
      createdAt: true,
      issuedAt: true,
      items: { select: { description: true, quantity: true, unitPrice: true, subtotal: true }, orderBy: { position: "asc" } },
    },
  });
  if (!quotation) return new Response("Quotation tidak ditemukan.", { status: 404 });

  const pdf = await createQuotationPdf(quotation);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quotation.quotationNo}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
