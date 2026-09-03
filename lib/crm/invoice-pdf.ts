import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

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
  discountType: string;
  discountValue: { toString(): string };
  subtotal: { toString(): string };
  total: { toString(): string };
  createdAt: Date;
  issuedAt: Date | null;
  dueAt: Date | null;
  notes: string | null;
  purchaseOrder: { purchaseOrderNo: string };
  items: Array<{
    size: string;
    description: string;
    quantity: number;
    unitPrice: { toString(): string };
    subtotal: { toString(): string };
  }>;
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

export async function createInvoicePdf(invoice: PdfInvoice) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await readFile(join(process.cwd(), "public/brand/askonveksi-logo.png"));
  const logo = await document.embedPng(logoBytes);
  let page!: PDFPage;
  let y!: number;

  function addPage() {
    page = document.addPage([A4.width, A4.height]);
    y = A4.height - margin;
    page.drawText("AS Konveksi", { x: margin, y: 24, size: 8, font: regular, color: rgb(0.45, 0.45, 0.45) });
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
  const scaledLogo = logo.scaleToFit(150, 44);
  page.drawImage(logo, { x: margin, y: y - scaledLogo.height, width: scaledLogo.width, height: scaledLogo.height });
  text("INVOICE", A4.width - margin - 116, 18, bold);
  y -= 25;
  text(invoice.invoiceNo, A4.width - margin - 116, 10, regular, rgb(0.35, 0.35, 0.35));
  y -= 15;
  text(`Status: ${statusLabel(invoice.status)}`, A4.width - margin - 116, 9, bold);
  y -= 48;

  text("Ditujukan kepada", margin, 9, bold, rgb(0.35, 0.35, 0.35));
  text(`Tanggal: ${date(invoice.issuedAt ?? invoice.createdAt)}`, 340, 9);
  y -= 18;
  text(invoice.snapshotCustomerName, margin, 12, bold);
  text(`Revisi: ${invoice.revision}`, 340, 9);
  y -= 14;
  text(`PO: ${safeText(invoice.purchaseOrder.purchaseOrderNo)}`, 340, 9);
  if (invoice.dueAt) { y -= 14; text(`Jatuh tempo: ${date(invoice.dueAt)}`, 340, 9); }
  y -= 16;
  if (invoice.snapshotCompanyName) { text(invoice.snapshotCompanyName, margin, 9); y -= 14; }
  const contacts = [invoice.snapshotWhatsapp, invoice.snapshotEmail, invoice.snapshotInstagram ? `@${invoice.snapshotInstagram}` : null].filter(Boolean).join(" · ");
  if (contacts) { text(contacts, margin, 9, regular, rgb(0.35, 0.35, 0.35)); y -= 14; }
  if (invoice.snapshotAddress) {
    for (const line of wrap(invoice.snapshotAddress, regular, 9, 285)) { text(line, margin, 9, regular, rgb(0.35, 0.35, 0.35)); y -= 12; }
  }
  y -= 20;

  const tableRight = A4.width - margin;
  const columns = { size: margin, item: 92, qtyRight: 375, priceRight: 465, subtotalRight: tableRight };
  const headerHorizontalInset = 8;
  ensure(32);
  page.drawRectangle({
    x: margin - headerHorizontalInset,
    y: y - 8,
    width: tableRight - margin + headerHorizontalInset * 2,
    height: 22,
    color: rgb(0.94, 0.94, 0.94),
  });
  text("Ukuran", columns.size, 9, bold);
  text("Item", columns.item, 9, bold);
  rightText("Qty", columns.qtyRight, 9, bold);
  rightText("Harga", columns.priceRight, 9, bold);
  rightText("Subtotal", columns.subtotalRight, 9, bold);
  y -= 28;

  invoice.items.forEach((item) => {
    const lines = wrap(item.description, regular, 9, 225);
    const rowHeight = Math.max(24, lines.length * 12 + 8);
    ensure(rowHeight);
    const rowTop = y;
    page.drawText(safeText(item.size), { x: columns.size, y: rowTop, size: 9, font: regular });
    lines.forEach((line, index) => page.drawText(line, { x: columns.item, y: rowTop - index * 12, size: 9, font: regular }));
    const quantity = String(item.quantity);
    const unitPrice = currency(item.unitPrice);
    const itemSubtotal = currency(item.subtotal);
    page.drawText(quantity, { x: columns.qtyRight - regular.widthOfTextAtSize(quantity, 9), y: rowTop, size: 9, font: regular });
    page.drawText(unitPrice, { x: columns.priceRight - regular.widthOfTextAtSize(unitPrice, 9), y: rowTop, size: 9, font: regular });
    page.drawText(itemSubtotal, { x: columns.subtotalRight - regular.widthOfTextAtSize(itemSubtotal, 9), y: rowTop, size: 9, font: regular });
    y -= rowHeight;
    page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: A4.width - margin, y: y + 6 }, thickness: 0.5, color: rgb(0.86, 0.86, 0.86) });
  });

  ensure(100);
  y -= 8;
  const summaryX = 340;
  text("Subtotal", summaryX, 9);
  rightText(currency(invoice.subtotal), columns.subtotalRight, 9);
  y -= 18;
  text("Diskon", summaryX, 9);
  const discount = invoice.discountType === "PERCENTAGE" ? `${invoice.discountValue.toString()}%` : currency(invoice.discountValue);
  rightText(discount, columns.subtotalRight, 9);
  y -= 22;
  page.drawLine({ start: { x: summaryX, y: y + 12 }, end: { x: A4.width - margin, y: y + 12 }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
  text("TOTAL", summaryX, 11, bold);
  rightText(currency(invoice.total), columns.subtotalRight, 11, bold);
  y -= 52;
  ensure(56);
  text("Catatan", margin, 9, bold);
  y -= 16;
  for (const line of wrap(invoice.notes ?? "Invoice ini dibuat berdasarkan PO yang telah disepakati. Mohon periksa ukuran, jumlah, dan harga sebelum melakukan pembayaran.", regular, 9, A4.width - margin * 2)) {
    text(line, margin, 9, regular, rgb(0.35, 0.35, 0.35));
    y -= 12;
  }

  document.setTitle(`Invoice ${invoice.invoiceNo}`);
  document.setAuthor("AS Konveksi");
  return document.save();
}
