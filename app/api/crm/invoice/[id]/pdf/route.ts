import { entityIdSchema } from "@/lib/crm/validation";
import { createInvoicePdf } from "@/lib/crm/invoice-pdf";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireActor();
  } catch {
    return new Response("Anda harus masuk untuk mengunduh invoice.", { status: 401 });
  }
  const parsed = entityIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response("Invoice tidak ditemukan.", { status: 404 });

  const invoice = await getPrismaClient().invoice.findUnique({
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
      discountType: true,
      discountValue: true,
      subtotal: true,
      total: true,
      createdAt: true,
      issuedAt: true,
      dueAt: true,
      notes: true,
      purchaseOrder: { select: { purchaseOrderNo: true } },
      items: { select: { size: true, description: true, quantity: true, unitPrice: true, subtotal: true }, orderBy: { position: "asc" } },
    },
  });
  if (!invoice) return new Response("Invoice tidak ditemukan.", { status: 404 });

  const pdf = await createInvoicePdf(invoice);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNo}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
