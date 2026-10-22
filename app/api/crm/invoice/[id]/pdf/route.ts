import { entityIdSchema } from "@/lib/crm/validation";
import { createInvoicePdf } from "@/lib/crm/invoice-pdf";
import { normalizePdfImage } from "@/lib/crm/pdf-image";
import { requireActor } from "@/lib/auth/session";
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadFilename } from "@/lib/download-filename";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

function workerAuthorized(request: Request) {
  const expected = process.env.WHATSAPP_WORKER_SECRET;
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !actual) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!workerAuthorized(request)) {
    try {
      await requireActor(CRM_VIEW_ROLES);
    } catch {
      return new Response("Anda harus masuk untuk mengunduh invoice.", { status: 401 });
    }
  }
  const parsed = entityIdSchema.safeParse((await params).id);
  if (!parsed.success) return new Response("Invoice tidak ditemukan.", { status: 404 });

  const prisma = getPrismaClient();
  const [invoice, currentBusiness, paymentMethods, settingPoints] = await Promise.all([prisma.invoice.findUnique({
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
      snapshotBankName: true,
      snapshotBankAccountNumber: true,
      snapshotBankAccountHolder: true,
      snapshotSignatureName: true,
      snapshotSignatureTitle: true,
      snapshotSignaturePath: true,
      discountType: true,
      discountValue: true,
      subtotal: true,
      totalDiscount: true,
      taxPercent: true,
      taxAmount: true,
      totalProfit: true,
      total: true,
      createdAt: true,
      issuedAt: true,
      dueAt: true,
      purchaseOrder: { select: { purchaseOrderNo: true } },
      items: {
        select: {
          productName: true, size: true, description: true, quantity: true, unitPrice: true, grossAmount: true,
          discountType: true, discountPercent: true, discountAmount: true, profitPercent: true, profitAmount: true, total: true, subtotal: true,
          addons: { select: { label: true, description: true, unitAmount: true, qty: true }, orderBy: { position: "asc" } },
        },
        orderBy: { position: "asc" },
      },
      salesOrder: { select: { payment: { select: { transactions: { select: { amount: true, status: true } } } } } },
    },
  }), prisma.businessProfile.findUnique({ where: { id: "default" } }), prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { position: "asc" }, select: { name: true, description: true } }),
    // Poin master "Pengaturan invoice" dibaca langsung (live), sama seperti daftar metode pembayaran.
    prisma.invoiceSettingPoint.findMany({ orderBy: [{ section: "asc" }, { position: "asc" }], select: { section: true, text: true } })]);
  if (!invoice) return new Response("Invoice tidak ditemukan.", { status: 404 });

  // Kop identitas memakai snapshot lebih dulu; kolom snapshot yang masih kosong (invoice lama,
  // dibuat sebelum profil perusahaan diisi) jatuh ke profil terkini supaya kopnya tidak polos.
  const logoPath = invoice.status === "DRAFT" ? currentBusiness?.logoPath : invoice.snapshotBusinessLogoPath ?? currentBusiness?.logoPath;
  let logoBytes: Uint8Array | undefined;
  if (logoPath) {
    const { data } = await createAdminClient().storage.from("business-assets").download(logoPath);
    if (data) {
      try { logoBytes = await normalizePdfImage(new Uint8Array(await data.arrayBuffer())); } catch { logoBytes = undefined; }
    }
  }
  const signaturePath = invoice.snapshotSignaturePath ?? currentBusiness?.signaturePath ?? null;
  let signatureBytes: Uint8Array | undefined;
  if (signaturePath) {
    const { data } = await createAdminClient().storage.from("business-assets").download(signaturePath);
    if (data) {
      try { signatureBytes = await normalizePdfImage(new Uint8Array(await data.arrayBuffer())); } catch { signatureBytes = undefined; }
    }
  }
  const pdf = await createInvoicePdf({
    ...invoice,
    snapshotBusinessName: invoice.snapshotBusinessName ?? currentBusiness?.name ?? "AS Konveksi",
    snapshotBusinessPhone: invoice.snapshotBusinessPhone ?? currentBusiness?.phone ?? null,
    snapshotBusinessEmail: invoice.snapshotBusinessEmail ?? currentBusiness?.email ?? null,
    snapshotBusinessAddress: invoice.snapshotBusinessAddress ?? currentBusiness?.address ?? null,
    snapshotSignatureName: invoice.snapshotSignatureName ?? currentBusiness?.signatureName ?? null,
    snapshotSignatureTitle: invoice.snapshotSignatureTitle ?? currentBusiness?.signatureTitle ?? null,
  }, { logo: logoBytes, signature: signatureBytes, paymentMethods, settingPoints });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${new URL(request.url).searchParams.has("preview") ? "inline" : "attachment"}; filename="${downloadFilename(`invoice-${invoice.invoiceNo}`, "pdf")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
