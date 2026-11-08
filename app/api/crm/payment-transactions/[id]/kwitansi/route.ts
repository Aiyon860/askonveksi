import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { forBrand } from "@/lib/brand/prisma-extension";
import { readDefaultBrandLogoPng } from "@/lib/crm/brand-logo";
import { createReceiptPdf } from "@/lib/crm/receipt-pdf";
import { normalizePdfImage } from "@/lib/crm/pdf-image";
import { entityIdSchema } from "@/lib/crm/validation";
import { downloadFilename } from "@/lib/download-filename";
import { getPrismaClient } from "@/lib/prisma";
import { BUSINESS_ASSETS_BUCKET, erpStorage } from "@/lib/storage/erp-storage";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireActor(CRM_VIEW_ROLES);
  } catch {
    return new Response("Anda harus masuk.", { status: 401 });
  }
  const parsed = entityIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response("Kwitansi tidak ditemukan.", { status: 404 });
  const prisma = getPrismaClient();
  const tx = await prisma.paymentTransaction.findUnique({
    where: { id: parsed.data },
    select: {
      id: true,
      amount: true,
      paidAt: true,
      reference: true,
      status: true,
      payment: {
        select: {
          salesOrder: {
            select: {
              brand: true,
              invoiceNo: true,
              snapshotCustomerName: true,
              snapshotCompanyName: true,
              invoice: {
                select: {
                  snapshotBusinessName: true,
                  snapshotBusinessAddress: true,
                  snapshotBusinessPhone: true,
                  snapshotBusinessEmail: true,
                  snapshotBusinessLogoPath: true,
                  snapshotSignatureName: true,
                  snapshotSignatureTitle: true,
                  snapshotSignaturePath: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!tx || tx.status !== "ACTIVE") return new Response("Kwitansi tidak ditemukan.", { status: 404 });
  const order = tx.payment.salesOrder;
  const profile = await prisma.businessProfile.findFirst(
    forBrand(order.brand, {
      where: {},
      select: { name: true, address: true, phone: true, email: true, logoPath: true, signatureName: true, signatureTitle: true, signaturePath: true },
    }),
  );
  const bucket = erpStorage(BUSINESS_ASSETS_BUCKET);
  const readImage = async (path: string | null) => {
    if (!path) return undefined;
    const { data: file } = await bucket.download(path);
    if (!file) return undefined;
    try {
      return await normalizePdfImage(new Uint8Array(await file.arrayBuffer()));
    } catch {
      return undefined;
    }
  };
  let logo = await readImage(order.invoice.snapshotBusinessLogoPath ?? profile?.logoPath ?? null);
  if (!logo) logo = await readDefaultBrandLogoPng(order.brand);
  const signature = await readImage(order.invoice.snapshotSignaturePath ?? profile?.signaturePath ?? null);
  const pdf = await createReceiptPdf({
    receiptNo: `KWT-${tx.id.slice(-8).toUpperCase()}`,
    invoiceNo: order.invoiceNo,
    customerName: order.snapshotCompanyName ?? order.snapshotCustomerName,
    amount: tx.amount,
    paidAt: tx.paidAt,
    reference: tx.reference,
    businessName: order.invoice.snapshotBusinessName ?? profile?.name ?? (order.brand === "SAGA" ? "SAGA" : "AS Konveksi"),
    businessAddress: order.invoice.snapshotBusinessAddress ?? profile?.address ?? null,
    businessPhone: order.invoice.snapshotBusinessPhone ?? profile?.phone ?? null,
    businessEmail: order.invoice.snapshotBusinessEmail ?? profile?.email ?? null,
    signatureName: order.invoice.snapshotSignatureName ?? profile?.signatureName ?? null,
    signatureTitle: order.invoice.snapshotSignatureTitle ?? profile?.signatureTitle ?? null,
  }, { brand: order.brand, logo, signature });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${new URL(request.url).searchParams.has("preview") ? "inline" : "attachment"}; filename="${downloadFilename(`kwitansi-${order.invoiceNo}`, "pdf")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
