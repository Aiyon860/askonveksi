import { timingSafeEqual } from "node:crypto";

import { requireActor } from "@/lib/auth/session";
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import { forBrand } from "@/lib/brand/prisma-extension";
import { readDefaultBrandLogoPng } from "@/lib/crm/brand-logo";
import { createInvoicePdf } from "@/lib/crm/invoice-pdf";
import { normalizePdfImage } from "@/lib/crm/pdf-image";
import { entityIdSchema } from "@/lib/crm/validation";
import { downloadFilename } from "@/lib/download-filename";
import { getPrismaClient } from "@/lib/prisma";
import { BUSINESS_ASSETS_BUCKET, erpStorage } from "@/lib/storage/erp-storage";

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
  const invoice = await prisma.invoice.findUnique({
    where: { id: parsed.data },
    select: {
      brand: true,
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
      addons: { select: { label: true, description: true, unitAmount: true, qty: true }, orderBy: { position: "asc" } },
      salesOrder: { select: { payment: { select: { transactions: { select: { amount: true, status: true } } } } } },
    },
  });
  if (!invoice) return new Response("Invoice tidak ditemukan.", { status: 404 });

  // Profil & metode bayar mengikuti brand dokumen, bukan brand cookie aktif.
  const paymentMethodQuery = {
    where: { isActive: true },
    orderBy: { position: "asc" as const },
    select: { name: true, description: true },
  };
  const settingPointQuery = {
    orderBy: [{ section: "asc" as const }, { position: "asc" as const }],
    select: { section: true, text: true },
  };
  const [currentBusiness, paymentMethods, settingPoints] = await Promise.all([
    prisma.businessProfile.findFirst(forBrand(invoice.brand, { where: {} })),
    prisma.paymentMethod.findMany(forBrand(invoice.brand, paymentMethodQuery)),
    prisma.invoiceSettingPoint.findMany(forBrand(invoice.brand, settingPointQuery)),
  ]);

  // Kop mengikuti profil brand dokumen. Snapshot logo/nama brand lain (mis. invoice
  // SAGA yang dulu dibuat di Askonveksi) sengaja diabaikan supaya identitas tidak bocor.
  const brandDefaultName = invoice.brand === "SAGA" ? "SAGA" : "AS Konveksi";
  const snapshotName = invoice.snapshotBusinessName?.trim() || null;
  const snapshotLooksForeign =
    Boolean(snapshotName) &&
    ((invoice.brand === "SAGA" && /askonveksi|as\s*konveksi/i.test(snapshotName!)) ||
      (invoice.brand === "ASKONVEKSI" && /^saga$/i.test(snapshotName!)));
  const businessName = currentBusiness?.name ?? (snapshotLooksForeign ? null : snapshotName) ?? brandDefaultName;
  const businessPhone = currentBusiness?.phone ?? (snapshotLooksForeign ? null : invoice.snapshotBusinessPhone);
  const businessEmail = currentBusiness?.email ?? (snapshotLooksForeign ? null : invoice.snapshotBusinessEmail);
  const businessAddress = currentBusiness?.address ?? (snapshotLooksForeign ? null : invoice.snapshotBusinessAddress);

  const logoPath = currentBusiness?.logoPath ?? (snapshotLooksForeign ? null : invoice.snapshotBusinessLogoPath);
  let logoBytes = await readDefaultBrandLogoPng(invoice.brand);
  if (logoPath) {
    const { data } = await erpStorage(BUSINESS_ASSETS_BUCKET).download(logoPath);
    if (data) {
      try { logoBytes = await normalizePdfImage(new Uint8Array(await data.arrayBuffer())); } catch { /* fallback logo brand */ }
    }
  }
  const signaturePath = invoice.snapshotSignaturePath ?? currentBusiness?.signaturePath ?? null;
  let signatureBytes: Uint8Array | undefined;
  if (signaturePath) {
    const { data } = await erpStorage(BUSINESS_ASSETS_BUCKET).download(signaturePath);
    if (data) {
      try { signatureBytes = await normalizePdfImage(new Uint8Array(await data.arrayBuffer())); } catch { signatureBytes = undefined; }
    }
  }
  const pdf = await createInvoicePdf({
    ...invoice,
    snapshotBusinessName: businessName,
    snapshotBusinessPhone: businessPhone ?? null,
    snapshotBusinessEmail: businessEmail ?? null,
    snapshotBusinessAddress: businessAddress ?? null,
    snapshotSignatureName: invoice.snapshotSignatureName ?? currentBusiness?.signatureName ?? null,
    snapshotSignatureTitle: invoice.snapshotSignatureTitle ?? currentBusiness?.signatureTitle ?? null,
  }, { brand: invoice.brand, logo: logoBytes, signature: signatureBytes, paymentMethods, settingPoints });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${new URL(request.url).searchParams.has("preview") ? "inline" : "attachment"}; filename="${downloadFilename(`invoice-${invoice.invoiceNo}`, "pdf")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
