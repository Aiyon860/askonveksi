import "server-only";

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { readDefaultBrandLogoPng } from "@/lib/crm/brand-logo";
import { MIN_FONT_SIZE, clipPdfText } from "@/lib/crm/pdf-typography";

type PdfInvoiceSettingPoint = { section: "KETERANGAN" | "SYARAT_KETENTUAN"; text: string; isBold: boolean };

type PdfInvoice = {
  invoiceNo: string;
  revision: number;
  status: string;
  snapshotCustomerName: string;
  snapshotCompanyName: string | null;
  snapshotWhatsapp: string | null;
  snapshotEmail: string | null;
  snapshotInstagram: string | null;
  snapshotAddress: string | null;
  snapshotBusinessName: string | null;
  snapshotBusinessPhone: string | null;
  snapshotBusinessEmail: string | null;
  snapshotBusinessAddress: string | null;
  snapshotBusinessLogoPath: string | null;
  snapshotBankName: string | null;
  snapshotBankAccountNumber: string | null;
  snapshotBankAccountHolder: string | null;
  snapshotSignatureName: string | null;
  snapshotSignatureTitle: string | null;
  snapshotSignaturePath: string | null;
  subtotal: { toString(): string };
  totalDiscount: { toString(): string };
  taxPercent: { toString(): string };
  taxAmount: { toString(): string };
  total: { toString(): string };
  createdAt: Date;
  issuedAt: Date | null;
  dueAt: Date | null;
  purchaseOrder: { purchaseOrderNo: string };
  items: Array<{
    productName: string | null;
    size: string;
    description: string;
    quantity: number;
    unitPrice: { toString(): string };
    discountPercent?: { toString(): string } | string | null;
    discountAmount?: { toString(): string } | string | null;
    total: { toString(): string };
    addons?: Array<{ label: string; unitAmount: { toString(): string } }>;
  }>;
  salesOrder: { payment: { kind?: string; transactions: Array<{ amount: { toString(): string }; status: string }> } | null } | null;
};

const A4 = { width: 595.28, height: 841.89 };
const margin = 48;
const CONTENT_WIDTH = A4.width - margin * 2;

function safeText(value: string) {
  return value.replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

function currency(value: { toString(): string }) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value.toString()));
}

function date(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(value);
}

function statusLabel(status: string) {
  return ({ DRAFT: "Draft", ISSUED: "Terbit", SUPERSEDED: "Digantikan" } as Record<string, string>)[status] ?? status;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = safeText(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

type InvoiceAssets = {
  logo?: Uint8Array;
  signature?: Uint8Array;
  /** Daftar metode pembayaran aktif dari master data; dicetak saat invoice tidak punya snapshot rekening lama. */
  paymentMethods?: Array<{ name: string; description: string | null }>;
  /** Poin master "Pengaturan invoice": blok Keterangan & Syarat/Ketentuan, selalu mengikuti data terkini. */
  settingPoints?: PdfInvoiceSettingPoint[];
};

export async function createInvoicePdf(invoice: PdfInvoice, assets: InvoiceAssets = {}) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = assets.logo ?? await readDefaultBrandLogoPng();
  const logo = await document.embedPng(logoBytes);
  let signature: Awaited<ReturnType<typeof document.embedPng>> | undefined;
  if (assets.signature) {
    try {
      signature = await document.embedPng(assets.signature);
    } catch {
      signature = undefined;
    }
  }
  const signatureHeight = signature ? signature.scaleToFit(150, 46).height : 0;
  let page!: PDFPage;
  let y!: number;

  function addPage() {
    page = document.addPage([A4.width, A4.height]);
    y = A4.height - margin;
    page.drawText(safeText(invoice.snapshotBusinessName ?? "AS Konveksi"), { x: margin, y: 26, size: MIN_FONT_SIZE, font: regular, color: rgb(0.45, 0.45, 0.45) });
    const footerInvoice = `Invoice ${safeText(invoice.invoiceNo)}`;
    page.drawText(footerInvoice, {
      x: A4.width - margin - regular.widthOfTextAtSize(footerInvoice, MIN_FONT_SIZE),
      y: 26,
      size: MIN_FONT_SIZE,
      font: regular,
      color: rgb(0.45, 0.45, 0.45),
    });
  }

  function ensure(height: number) {
    if (y - height < margin + 20) addPage();
  }

  function text(value: string, x: number, size = MIN_FONT_SIZE, font = regular, color = rgb(0.12, 0.12, 0.12)) {
    page.drawText(safeText(value), { x, y, size, font, color });
  }

  function rightText(value: string, right: number, size = MIN_FONT_SIZE, font = regular, color = rgb(0.12, 0.12, 0.12)) {
    const safeValue = safeText(value);
    page.drawText(safeValue, { x: right - font.widthOfTextAtSize(safeValue, size), y, size, font, color });
  }

  /** Blok poin berurutan dari master "Pengaturan invoice" (tiap poin bisa bold). */
  function drawPointList(title: string, points: PdfInvoiceSettingPoint[]) {
    if (!points.length) return;
    ensure(70);
    text(title, margin, 14, bold);
    y -= 20;
    points.forEach((point, index) => {
      const font = point.isBold ? bold : regular;
      const lines = wrap(point.text, font, MIN_FONT_SIZE, CONTENT_WIDTH - 22);
      ensure(lines.length * 16 + 10);
      page.drawText(`${index + 1}.`, { x: margin, y, size: MIN_FONT_SIZE, font: regular, color: rgb(0.4, 0.4, 0.4) });
      lines.forEach((line, lineIndex) => {
        page.drawText(line, { x: margin + 22, y: y - lineIndex * 16, size: MIN_FONT_SIZE, font, color: rgb(0.12, 0.12, 0.12) });
      });
      y -= lines.length * 16 + 6;
    });
    y -= 10;
  }

  addPage();
  if (invoice.status === "DRAFT") page.drawText("DRAFT", { x: 150, y: 370, size: 82, font: bold, color: rgb(0.9, 0.9, 0.9), rotate: degrees(35), opacity: 0.45 });
  const scaledLogo = logo.scaleToFit(150, 44);
  page.drawImage(logo, { x: margin, y: y - scaledLogo.height, width: scaledLogo.width, height: scaledLogo.height });
  const headerRight = A4.width - margin;
  rightText("INVOICE", headerRight, 18, bold);
  y -= 24;
  rightText(invoice.invoiceNo, headerRight, MIN_FONT_SIZE, regular, rgb(0.35, 0.35, 0.35));
  y -= 20;
  rightText(`Status: ${statusLabel(invoice.status)}`, headerRight, MIN_FONT_SIZE, bold);
  y -= 46;

  const customerColumnX = 297;
  const columnWidth = CONTENT_WIDTH / 2 - 8;
  text("Info perusahaan", margin, MIN_FONT_SIZE, bold, rgb(0.35, 0.35, 0.35));
  text("Tagihan untuk", customerColumnX, MIN_FONT_SIZE, bold, rgb(0.35, 0.35, 0.35));
  y -= 20;
  text(clipPdfText(safeText(invoice.snapshotBusinessName ?? "AS Konveksi"), bold, MIN_FONT_SIZE, columnWidth), margin, MIN_FONT_SIZE, bold);
  text(clipPdfText(safeText(invoice.snapshotCustomerName), bold, MIN_FONT_SIZE, columnWidth), customerColumnX, MIN_FONT_SIZE, bold);
  y -= 18;
  const businessContact = wrap([invoice.snapshotBusinessPhone, invoice.snapshotBusinessEmail].filter(Boolean).join(" · ") || "-", regular, MIN_FONT_SIZE, columnWidth).slice(0, 2);
  const customerContact = wrap([invoice.snapshotWhatsapp, invoice.snapshotEmail].filter(Boolean).join(" · ") || "-", regular, MIN_FONT_SIZE, columnWidth).slice(0, 2);
  businessContact.forEach((line, index) => page.drawText(line, { x: margin, y: y - index * 15, size: MIN_FONT_SIZE, font: regular, color: rgb(0.35, 0.35, 0.35) }));
  customerContact.forEach((line, index) => page.drawText(line, { x: customerColumnX, y: y - index * 15, size: MIN_FONT_SIZE, font: regular, color: rgb(0.35, 0.35, 0.35) }));
  y -= Math.max(businessContact.length, customerContact.length) * 15 + 8;
  const businessAddress = wrap(invoice.snapshotBusinessAddress ?? "-", regular, MIN_FONT_SIZE, columnWidth).slice(0, 3);
  const customerAddress = wrap(invoice.snapshotAddress ?? "-", regular, MIN_FONT_SIZE, columnWidth).slice(0, 3);
  businessAddress.forEach((line, index) => page.drawText(line, { x: margin, y: y - index * 15, size: MIN_FONT_SIZE, font: regular, color: rgb(0.35, 0.35, 0.35) }));
  customerAddress.forEach((line, index) => page.drawText(line, { x: customerColumnX, y: y - index * 15, size: MIN_FONT_SIZE, font: regular, color: rgb(0.35, 0.35, 0.35) }));
  y -= Math.max(businessAddress.length, customerAddress.length) * 15 + 10;
  // Tiga baris meta dicetak bertumpuk; pada 12 pt tidak ada lagi muat untuk 3 kolom sebaris.
  for (const line of [
    `Referensi: ${safeText(invoice.purchaseOrder.purchaseOrderNo)}`,
    `Tanggal: ${date(invoice.issuedAt ?? invoice.createdAt)}`,
    `Deadline pembayaran awal: ${invoice.dueAt ? date(invoice.dueAt) : "-"}`,
  ]) {
    text(line, margin, MIN_FONT_SIZE);
    y -= 18;
  }
  y -= 10;

  const tableRight = A4.width - margin;
  const columns = { text: margin, qtyRight: 372, priceRight: 452, totalRight: tableRight };
  const textColumnWidth = columns.qtyRight - columns.text - 30;
  const headerHorizontalInset = 8;
  ensure(34);
  page.drawRectangle({
    x: margin - headerHorizontalInset,
    y: y - 10,
    width: tableRight - margin + headerHorizontalInset * 2,
    height: 26,
    color: rgb(0.94, 0.94, 0.94),
  });
  text("Deskripsi", columns.text, MIN_FONT_SIZE, bold);
  rightText("Qty", columns.qtyRight, MIN_FONT_SIZE, bold);
  rightText("Harga", columns.priceRight, MIN_FONT_SIZE, bold);
  rightText("Jumlah", columns.totalRight, MIN_FONT_SIZE, bold);
  y -= 32;

  invoice.items.forEach((item) => {
    const lines = wrap(item.description, regular, MIN_FONT_SIZE, textColumnWidth);
    const rowHeight = Math.max(30, (lines.length + 1) * 15 + 12);
    ensure(rowHeight);
    const rowTop = y;
    // Nama produk dan deskripsi digabung satu kolom supaya kolom angka tetap lega pada 12 pt.
    page.drawText(clipPdfText(safeText(item.productName ?? "Produk"), bold, MIN_FONT_SIZE, textColumnWidth), { x: columns.text, y: rowTop, size: MIN_FONT_SIZE, font: bold });
    lines.forEach((line, index) => page.drawText(line, { x: columns.text, y: rowTop - 16 - index * 15, size: MIN_FONT_SIZE, font: regular, color: rgb(0.28, 0.28, 0.28) }));
    const quantity = String(item.quantity);
    const unitPrice = currency({ toString: () => (Number(item.total.toString()) / item.quantity).toFixed(2) });
    const lineTotal = currency(item.total);
    page.drawText(quantity, { x: columns.qtyRight - regular.widthOfTextAtSize(quantity, MIN_FONT_SIZE), y: rowTop, size: MIN_FONT_SIZE, font: regular });
    page.drawText(unitPrice, { x: columns.priceRight - regular.widthOfTextAtSize(unitPrice, MIN_FONT_SIZE), y: rowTop, size: MIN_FONT_SIZE, font: regular });
    page.drawText(lineTotal, { x: columns.totalRight - regular.widthOfTextAtSize(lineTotal, MIN_FONT_SIZE), y: rowTop, size: MIN_FONT_SIZE, font: regular });
    y -= rowHeight;
    for (const addon of item.addons ?? []) {
      const addonTotal = Number(addon.unitAmount.toString()) * item.quantity;
      const addonText = `+ ${addon.label} (${item.quantity} x ${currency(addon.unitAmount)})`;
      const addonLines = wrap(addonText, regular, MIN_FONT_SIZE, textColumnWidth - 8);
      const addonHeight = addonLines.length * 15 + 6;
      ensure(addonHeight);
      addonLines.forEach((line, index) => page.drawText(line, { x: columns.text + 8, y: y - index * 15, size: MIN_FONT_SIZE, font: regular, color: rgb(0.35, 0.35, 0.35) }));
      const addonTotalText = currency({ toString: () => String(addonTotal) });
      page.drawText(addonTotalText, { x: columns.totalRight - regular.widthOfTextAtSize(addonTotalText, MIN_FONT_SIZE), y, size: MIN_FONT_SIZE, font: regular, color: rgb(0.35, 0.35, 0.35) });
      y -= addonHeight;
    }
    page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: A4.width - margin, y: y + 8 }, thickness: 0.5, color: rgb(0.86, 0.86, 0.86) });
  });

  ensure(180);
  y -= 8;
  const summaryX = 320;
  y -= 24;
  page.drawLine({ start: { x: summaryX, y: y + 14 }, end: { x: A4.width - margin, y: y + 14 }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
  text("Subtotal", summaryX, MIN_FONT_SIZE);
  rightText(currency(invoice.subtotal), columns.totalRight, MIN_FONT_SIZE);
  y -= 18;
  text("Diskon", summaryX, MIN_FONT_SIZE);
  rightText(currency(invoice.totalDiscount), columns.totalRight, MIN_FONT_SIZE);
  const taxPct = Number(invoice.taxPercent?.toString() ?? "0");
  if (taxPct > 0) {
    y -= 18;
    text(`Pajak (${taxPct}%)`, summaryX, MIN_FONT_SIZE);
    rightText(currency(invoice.taxAmount), columns.totalRight, MIN_FONT_SIZE);
  }
  y -= 20;
  text("TOTAL", summaryX, 14, bold);
  rightText(currency(invoice.total), columns.totalRight, 14, bold);
  const totalPaid = invoice.salesOrder?.payment?.transactions.filter((item) => item.status === "ACTIVE").reduce((sum, item) => sum + Number(item.amount.toString()), 0) ?? 0;
  y -= 20;
  text("Total terbayar", summaryX, MIN_FONT_SIZE);
  rightText(currency({ toString: () => String(totalPaid) }), columns.totalRight, MIN_FONT_SIZE);
  y -= 20;
  text("Sisa tagihan", summaryX, MIN_FONT_SIZE, bold);
  rightText(currency({ toString: () => String(Math.max(0, Number(invoice.total.toString()) - totalPaid)) }), columns.totalRight, MIN_FONT_SIZE, bold);
  y -= 30;
  ensure(90);
  const bankLine = [invoice.snapshotBankName, invoice.snapshotBankAccountNumber].filter(Boolean).join(" · ");
  if (bankLine) {
    // Invoice lama masih memakai snapshot rekening yang tersimpan di barisnya.
    text("Rekening pembayaran", margin, MIN_FONT_SIZE, bold);
    y -= 18;
    page.drawText(safeText(bankLine), { x: margin, y, size: MIN_FONT_SIZE, font: bold });
    y -= 18;
    if (invoice.snapshotBankAccountHolder) {
      text(`a.n. ${safeText(invoice.snapshotBankAccountHolder)}`, margin, MIN_FONT_SIZE, bold);
      y -= 18;
    } else {
      y -= 4;
    }
  } else if (assets.paymentMethods?.length) {
    // Field rekening dihapus dari profil; sumbernya sekarang master metode pembayaran.
    ensure(40);
    text("Metode pembayaran", margin, MIN_FONT_SIZE, bold);
    y -= 18;
    for (const method of assets.paymentMethods) {
      const label = method.description?.trim() ? `${method.name} · ${method.description.trim()}` : method.name;
      for (const line of wrap(label, regular, MIN_FONT_SIZE, CONTENT_WIDTH)) {
        ensure(22);
        text(line, margin, MIN_FONT_SIZE, regular, rgb(0.12, 0.12, 0.12));
        y -= 16;
      }
    }
    y -= 6;
  }

  ensure(70);
  // Blok Catatan lama diganti dua blok master "Pengaturan invoice" (mengikuti data terbaru).
  const settingPoints = assets.settingPoints ?? [];
  drawPointList("Keterangan", settingPoints.filter((point) => point.section === "KETERANGAN"));
  drawPointList("Syarat & Ketentuan", settingPoints.filter((point) => point.section === "SYARAT_KETENTUAN"));

  if (invoice.snapshotSignatureName || signature) {
    y -= 20;
    ensure(70 + signatureHeight);
    const signX = A4.width - margin - 180;
    text("Hormat kami,", signX, MIN_FONT_SIZE, regular, rgb(0.35, 0.35, 0.35));
    if (signature) {
      y -= 16;
      const scaled = signature.scaleToFit(150, 46);
      page.drawImage(signature, { x: signX, y: y - scaled.height, width: scaled.width, height: scaled.height });
      y -= scaled.height + 16;
    } else {
      y -= 30;
    }
    if (invoice.snapshotSignatureName) {
      page.drawText(clipPdfText(safeText(invoice.snapshotSignatureName), bold, MIN_FONT_SIZE, 180), { x: signX, y, size: MIN_FONT_SIZE, font: bold });
      y -= 16;
    }
    text(clipPdfText(safeText(invoice.snapshotSignatureTitle ?? ""), regular, MIN_FONT_SIZE, 180), signX, MIN_FONT_SIZE, regular, rgb(0.35, 0.35, 0.35));
    y -= 10;
  }

  document.setTitle(`Invoice ${invoice.invoiceNo}`);
  document.setAuthor(invoice.snapshotBusinessName ?? "AS Konveksi");
  return document.save();
}
