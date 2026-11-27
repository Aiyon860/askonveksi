import sharp from "sharp";

import { MASTER_DATA_ADMIN_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { readDefaultBrandLogoPng } from "@/lib/crm/brand-logo";
import { createInvoicePdf } from "@/lib/crm/invoice-pdf";
import { invoiceSettingsSchema } from "@/lib/crm/validation";

export const runtime = "nodejs";

// Pratinjau PDF invoice memakai data contoh dan isian form yang belum disimpan,
// supaya admin bisa melihat pengaruh ukuran teks tanpa menyimpan dulu.
export async function POST(request: Request) {
  try {
    await requireActor(MASTER_DATA_ADMIN_ROLES);
  } catch {
    return Response.json({ ok: false, message: "Anda tidak memiliki akses." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, message: "Data pratinjau tidak terbaca." }, { status: 400 });
  }
  const parsed = invoiceSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ ok: false, message: "Isian Keterangan, S&K, atau ukuran tanda tangan tidak valid." }, { status: 422 });
  }

  const actor = await requireActor(MASTER_DATA_ADMIN_ROLES);
  const settingPoints = [
    ...parsed.data.keterangan.map((point) => ({ section: "KETERANGAN" as const, text: point.text })),
    ...parsed.data.syarat.map((point) => ({ section: "SYARAT_KETENTUAN" as const, text: point.text })),
  ];
  const issuedAt = new Date("2026-11-26T09:00:00.000Z");
  const dueAt = new Date("2026-12-03T09:00:00.000Z");
  // Data contoh sengaja 7 baris (satu deskripsi panjang) supaya pratinjau
  // memperlihatkan tinggi baris wrap dan tabel yang mendekati dokumen asli.
  const sampleItem = (productName: string, size: string, description: string, quantity: number, unitPrice: number) => ({
    productName,
    size,
    description,
    quantity,
    unitPrice,
    grossAmount: quantity * unitPrice,
    discountType: "NOMINAL",
    discountPercent: 0,
    discountAmount: 0,
    profitPercent: 0,
    profitAmount: 0,
    total: quantity * unitPrice,
    subtotal: quantity * unitPrice,
    addons: [],
  });
  const dummyInvoice = {
    invoiceNo: "INV-CONTOH-001",
    revision: 1,
    status: "ISSUED",
    snapshotCustomerName: "Budi Santoso",
    snapshotCompanyName: "PT Contoh Abadi",
    snapshotWhatsapp: "0812-3456-7890",
    snapshotEmail: "budi@contoh.co.id",
    snapshotInstagram: "@contoh.abadi",
    snapshotAddress: "Jl. Contoh No. 12, Jakarta Selatan",
    snapshotBusinessName: actor.brand === "SAGA" ? "SAGA" : "AS Konveksi",
    snapshotBusinessPhone: "(021) 1234-5678",
    snapshotBusinessEmail: "halo@askonveksi.co.id",
    snapshotBusinessAddress: "Jakarta, Indonesia",
    snapshotBusinessLogoPath: null,
    snapshotBankName: null,
    snapshotBankAccountNumber: null,
    snapshotBankAccountHolder: null,
    snapshotSignatureName: "ADMIN CONTOH",
    snapshotSignatureTitle: "Admin",
    snapshotSignaturePath: null,
    subtotal: 1_500_000,
    totalDiscount: 0,
    taxPercent: 0,
    taxAmount: 0,
    totalProfit: 0,
    total: 1_500_000,
    createdAt: issuedAt,
    issuedAt,
    dueAt,
    purchaseOrder: { purchaseOrderNo: "PO-CONTOH-001" },
    items: [
      sampleItem("Jersey Tim Contoh", "L", "Sablon logo depan", 20, 50_000),
      sampleItem("Kaos Komunitas", "M", "Bordir dada", 10, 20_000),
      sampleItem("Polo Shirt Panitia", "L", "Bordir logo dada kiri", 5, 20_000),
      sampleItem("Jaket Varsity", "XL", "Bordir nama punggung dan logo di lengan kanan", 2, 25_000),
      sampleItem("Rompi Event", "M", "Sablon nomor punggung", 2, 25_000),
      sampleItem("Hoodie Komunitas", "L", "Bordir logo depan", 1, 60_000),
      sampleItem("Topi Bordir", "All Size", "Bordir logo", 1, 40_000),
    ],
    addons: [],
    salesOrder: { payment: { kind: "FULL", transactions: [] } },
  };

  const logo = await readDefaultBrandLogoPng(actor.brand);
  // Tanda tangan contoh dibuat dari SVG supaya perubahan ukuran maksimal terlihat di pratinjau.
  const signatureSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="100" viewBox="0 0 320 100"><path d="M12 72 C40 20, 55 86, 78 55 S115 16, 132 62 C150 96, 166 26, 188 58 S225 78, 246 40 C262 12, 282 70, 308 48" fill="none" stroke="#1f2a44" stroke-width="4" stroke-linecap="round"/></svg>';
  const signature = new Uint8Array(await sharp(Buffer.from(signatureSvg)).png().toBuffer());
  const pdf = await createInvoicePdf(dummyInvoice, {
    brand: actor.brand,
    logo,
    signature,
    settingPoints,
    signatureMaxWidth: parsed.data.signatureWidth,
    signatureMaxHeight: parsed.data.signatureHeight,
  });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="pratinjau-invoice.pdf"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
