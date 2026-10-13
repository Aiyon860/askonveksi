import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { createReceiptPdf } from "@/lib/crm/receipt-pdf";
import { entityIdSchema } from "@/lib/crm/validation";
import { downloadFilename } from "@/lib/download-filename";
import { getPrismaClient } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireActor(CRM_VIEW_ROLES);
  } catch {
    return new Response("Anda harus masuk.", { status: 401 });
  }
  const parsed = entityIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response("Kwitansi tidak ditemukan.", { status: 404 });
  const tx = await getPrismaClient().paymentTransaction.findUnique({
    where: { id: parsed.data },
    select: {
      id: true,
      amount: true,
      paidAt: true,
      reference: true,
      note: true,
      status: true,
      paymentMethod: { select: { name: true } },
      payment: { select: { salesOrder: { select: { invoiceNo: true, snapshotCustomerName: true, snapshotCompanyName: true, invoice: { select: { snapshotBusinessName: true, snapshotBusinessAddress: true, snapshotSignatureName: true, snapshotSignatureTitle: true } } } } } },
    },
  });
  if (!tx || tx.status !== "ACTIVE") return new Response("Kwitansi tidak ditemukan.", { status: 404 });
  const order = tx.payment.salesOrder;
  const pdf = await createReceiptPdf({
    receiptNo: `KWT-${tx.id.slice(-8).toUpperCase()}`,
    invoiceNo: order.invoiceNo,
    customerName: order.snapshotCompanyName ?? order.snapshotCustomerName,
    amount: tx.amount,
    paidAt: tx.paidAt,
    paymentMethod: tx.paymentMethod?.name ?? null,
    reference: tx.reference,
    note: tx.note,
    businessName: order.invoice.snapshotBusinessName,
    businessAddress: order.invoice.snapshotBusinessAddress,
    signatureName: order.invoice.snapshotSignatureName,
    signatureTitle: order.invoice.snapshotSignatureTitle,
  });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${downloadFilename(`kwitansi-${order.invoiceNo}`, "pdf")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
