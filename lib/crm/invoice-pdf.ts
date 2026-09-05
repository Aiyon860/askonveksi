import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";

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
  discountType: string;
  discountValue: { toString(): string };
  subtotal: { toString(): string };
  totalDiscount: { toString(): string };
  totalTax: { toString(): string };
  total: { toString(): string };
  createdAt: Date;
  issuedAt: Date | null;
  dueAt: Date | null;
  notes: string | null;
  purchaseOrder: { purchaseOrderNo: string };
  items: Array<{
    productName: string | null;
    size: string;
    description: string;
    quantity: number;
    unitPrice: { toString(): string };
    grossAmount: { toString(): string };
    discountPercent: { toString(): string };
    discountAmount: { toString(): string };
    taxRate: { toString(): string };
    taxAmount: { toString(): string };
    total: { toString(): string };
    subtotal: { toString(): string };
  }>;
  salesOrder: { payment: { transactions: Array<{ amount: { toString(): string }; status: string }> } | null } | null;
};

const A4 = { width: 595.28, height: 841.89 };
const margin = 48;

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

export async function createInvoicePdf(invoice: PdfInvoice, customLogoBytes?: Uint8Array) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = customLogoBytes ?? await readFile(join(process.cwd(), "public/brand/askonveksi-logo.png"));
  const logo = await document.embedPng(logoBytes);
  let page!: PDFPage;
  let y!: number;

  function addPage() {
    page = document.addPage([A4.width, A4.height]);
    y = A4.height - margin;
    page.drawText(safeText(invoice.snapshotBusinessName ?? "AS Konveksi"), { x: margin, y: 24, size: 8, font: regular, color: rgb(0.45, 0.45, 0.45) });
    const footerInvoice = `Invoice ${safeText(invoice.invoiceNo)}`;
    page.drawText(footerInvoice, {
      x: A4.width - margin - regular.widthOfTextAtSize(footerInvoice, 8),
      y: 24,
      size: 8,
      font: regular,
      color: rgb(0.45, 0.45, 0.45),
    });
  }

  function ensure(height: number) {
    if (y - height < margin + 20) addPage();
  }

  function text(value: string, x: number, size = 10, font = regular, color = rgb(0.12, 0.12, 0.12)) {
    page.drawText(safeText(value), { x, y, size, font, color });
  }

  function rightText(value: string, right: number, size = 10, font = regular, color = rgb(0.12, 0.12, 0.12)) {
    const safeValue = safeText(value);
    page.drawText(safeValue, { x: right - font.widthOfTextAtSize(safeValue, size), y, size, font, color });
  }

  addPage();
  if (invoice.status === "DRAFT") page.drawText("DRAFT", { x: 150, y: 370, size: 82, font: bold, color: rgb(0.9, 0.9, 0.9), rotate: degrees(35), opacity: 0.45 });
  const scaledLogo = logo.scaleToFit(150, 44);
  page.drawImage(logo, { x: margin, y: y - scaledLogo.height, width: scaledLogo.width, height: scaledLogo.height });
  text("INVOICE", A4.width - margin - 116, 18, bold);
  y -= 25;
  text(invoice.invoiceNo, A4.width - margin - 116, 10, regular, rgb(0.35, 0.35, 0.35));
  y -= 15;
  text(`Status: ${statusLabel(invoice.status)}`, A4.width - margin - 116, 9, bold);
  y -= 48;

  text("Info perusahaan", margin, 9, bold, rgb(0.35, 0.35, 0.35));
  text("Tagihan untuk", 297, 9, bold, rgb(0.35, 0.35, 0.35));
  y -= 18;
  text(invoice.snapshotBusinessName ?? "AS Konveksi", margin, 10, bold);
  text(invoice.snapshotCustomerName, 297, 10, bold);
  y -= 15;
  text([invoice.snapshotBusinessPhone, invoice.snapshotBusinessEmail].filter(Boolean).join(" · ") || "-", margin, 8, regular, rgb(0.35, 0.35, 0.35));
  text([invoice.snapshotWhatsapp, invoice.snapshotEmail].filter(Boolean).join(" · ") || "-", 297, 8, regular, rgb(0.35, 0.35, 0.35));
  y -= 13;
  const businessAddress = wrap(invoice.snapshotBusinessAddress ?? "-", regular, 8, 220).slice(0, 3);
  const customerAddress = wrap(invoice.snapshotAddress ?? "-", regular, 8, 220).slice(0, 3);
  businessAddress.forEach((line, index) => page.drawText(line, { x: margin, y: y - index * 10, size: 8, font: regular, color: rgb(0.35, 0.35, 0.35) }));
  customerAddress.forEach((line, index) => page.drawText(line, { x: 297, y: y - index * 10, size: 8, font: regular, color: rgb(0.35, 0.35, 0.35) }));
  y -= Math.max(businessAddress.length, customerAddress.length) * 10 + 13;
  text(`Referensi: ${safeText(invoice.purchaseOrder.purchaseOrderNo)}`, margin, 8);
  text(`Tanggal: ${date(invoice.issuedAt ?? invoice.createdAt)}`, 245, 8);
  text(`Jatuh tempo: ${invoice.dueAt ? date(invoice.dueAt) : "-"}`, 405, 8);
  y -= 28;

  const tableRight = A4.width - margin;
  const columns = { product: margin, description: 108, qtyRight: 330, priceRight: 402, discountRight: 452, taxRight: 492, totalRight: tableRight };
  const headerHorizontalInset = 8;
  ensure(32);
  page.drawRectangle({
    x: margin - headerHorizontalInset,
    y: y - 8,
    width: tableRight - margin + headerHorizontalInset * 2,
    height: 22,
    color: rgb(0.94, 0.94, 0.94),
  });
  text("Produk", columns.product, 8, bold);
  text("Deskripsi", columns.description, 8, bold);
  rightText("Qty", columns.qtyRight, 8, bold);
  rightText("Harga", columns.priceRight, 8, bold);
  rightText("Diskon", columns.discountRight, 8, bold);
  rightText("Pajak", columns.taxRight, 8, bold);
  rightText("Jumlah", columns.totalRight, 8, bold);
  y -= 28;

  invoice.items.forEach((item) => {
    const lines = wrap(item.description, regular, 8, 190);
    const rowHeight = Math.max(24, lines.length * 12 + 8);
    ensure(rowHeight);
    const rowTop = y;
    page.drawText(safeText(item.productName ?? "Produk"), { x: columns.product, y: rowTop, size: 8, font: regular });
    lines.forEach((line, index) => page.drawText(line, { x: columns.description, y: rowTop - index * 11, size: 8, font: regular }));
    const quantity = String(item.quantity);
    const unitPrice = currency(item.unitPrice);
    const discount = Number(item.discountAmount.toString()) ? `${item.discountPercent.toString()}%` : "-";
    const tax = Number(item.taxAmount.toString()) ? `${item.taxRate.toString()}%` : "-";
    const lineTotal = currency(item.total);
    page.drawText(quantity, { x: columns.qtyRight - regular.widthOfTextAtSize(quantity, 8), y: rowTop, size: 8, font: regular });
    page.drawText(unitPrice, { x: columns.priceRight - regular.widthOfTextAtSize(unitPrice, 8), y: rowTop, size: 8, font: regular });
    page.drawText(discount, { x: columns.discountRight - regular.widthOfTextAtSize(discount, 8), y: rowTop, size: 8, font: regular });
    page.drawText(tax, { x: columns.taxRight - regular.widthOfTextAtSize(tax, 8), y: rowTop, size: 8, font: regular });
    page.drawText(lineTotal, { x: columns.totalRight - regular.widthOfTextAtSize(lineTotal, 8), y: rowTop, size: 8, font: regular });
    y -= rowHeight;
    page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: A4.width - margin, y: y + 6 }, thickness: 0.5, color: rgb(0.86, 0.86, 0.86) });
  });

  ensure(100);
  y -= 8;
  const storedDiscount = Number(invoice.totalDiscount.toString());
  const legacyDiscount = invoice.discountType !== "NONE" && storedDiscount === 0
    ? Math.max(0, Number(invoice.subtotal.toString()) + Number(invoice.totalTax.toString()) - Number(invoice.total.toString()))
    : 0;
  const displayedDiscount = storedDiscount || legacyDiscount;
  const summaryX = 340;
  text("Subtotal", summaryX, 9);
  rightText(currency(invoice.subtotal), columns.totalRight, 9);
  y -= 18;
  text("Diskon", summaryX, 9);
  rightText(currency({ toString: () => String(displayedDiscount) }), columns.totalRight, 9);
  y -= 18;
  text("Pajak", summaryX, 9);
  rightText(currency(invoice.totalTax), columns.totalRight, 9);
  y -= 22;
  page.drawLine({ start: { x: summaryX, y: y + 12 }, end: { x: A4.width - margin, y: y + 12 }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
  text("TOTAL", summaryX, 11, bold);
  rightText(currency(invoice.total), columns.totalRight, 11, bold);
  const totalPaid = invoice.salesOrder?.payment?.transactions.filter((item) => item.status === "ACTIVE").reduce((sum, item) => sum + Number(item.amount.toString()), 0) ?? 0;
  y -= 18;
  text("Total terbayar", summaryX, 9);
  rightText(currency({ toString: () => String(totalPaid) }), columns.totalRight, 9);
  y -= 18;
  text("Sisa tagihan", summaryX, 9, bold);
  rightText(currency({ toString: () => String(Math.max(0, Number(invoice.total.toString()) - totalPaid)) }), columns.totalRight, 9, bold);
  y -= 52;
  ensure(56);
  text("Catatan", margin, 9, bold);
  y -= 16;
  for (const line of wrap(invoice.notes ?? "Invoice ini dibuat berdasarkan PO yang telah disepakati. Mohon periksa ukuran, jumlah, dan harga sebelum melakukan pembayaran.", regular, 9, A4.width - margin * 2)) {
    text(line, margin, 9, regular, rgb(0.35, 0.35, 0.35));
    y -= 12;
  }

  document.setTitle(`Invoice ${invoice.invoiceNo}`);
  document.setAuthor(invoice.snapshotBusinessName ?? "AS Konveksi");
  return document.save();
}
