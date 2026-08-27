import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type PdfQuotation = {
  quotationNo: string;
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
  items: Array<{
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
  return ({ DRAFT: "Draft", ISSUED: "Terbit", ACCEPTED: "Diterima", SUPERSEDED: "Digantikan" } as Record<string, string>)[status] ?? status;
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

export async function createQuotationPdf(quotation: PdfQuotation) {
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
    const footerQuotation = `Quotation ${safeText(quotation.quotationNo)}`;
    page.drawText(footerQuotation, {
      x: A4.width - margin - regular.widthOfTextAtSize(footerQuotation, 8),
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

  addPage();
  const scaledLogo = logo.scaleToFit(150, 44);
  page.drawImage(logo, { x: margin, y: y - scaledLogo.height, width: scaledLogo.width, height: scaledLogo.height });
  text("QUOTATION", A4.width - margin - 116, 18, bold);
  y -= 25;
  text(quotation.quotationNo, A4.width - margin - 116, 10, regular, rgb(0.35, 0.35, 0.35));
  y -= 15;
  text(`Status: ${statusLabel(quotation.status)}`, A4.width - margin - 116, 9, bold);
  y -= 48;

  text("Ditujukan kepada", margin, 9, bold, rgb(0.35, 0.35, 0.35));
  text(`Tanggal: ${date(quotation.issuedAt ?? quotation.createdAt)}`, 340, 9);
  y -= 18;
  text(quotation.snapshotCustomerName, margin, 12, bold);
  text(`Revisi: ${quotation.revision}`, 340, 9);
  y -= 16;
  if (quotation.snapshotCompanyName) { text(quotation.snapshotCompanyName, margin, 9); y -= 14; }
  const contacts = [quotation.snapshotWhatsapp, quotation.snapshotEmail, quotation.snapshotInstagram ? `@${quotation.snapshotInstagram}` : null].filter(Boolean).join(" · ");
  if (contacts) { text(contacts, margin, 9, regular, rgb(0.35, 0.35, 0.35)); y -= 14; }
  if (quotation.snapshotAddress) {
    for (const line of wrap(quotation.snapshotAddress, regular, 9, 285)) { text(line, margin, 9, regular, rgb(0.35, 0.35, 0.35)); y -= 12; }
  }
  y -= 20;

  const columns = { item: margin, qty: 345, price: 405, subtotal: 495 };
  ensure(32);
  page.drawRectangle({ x: margin, y: y - 8, width: A4.width - margin * 2, height: 22, color: rgb(0.94, 0.94, 0.94) });
  text("Item", columns.item, 9, bold);
  text("Qty", columns.qty, 9, bold);
  text("Harga", columns.price, 9, bold);
  text("Subtotal", columns.subtotal, 9, bold);
  y -= 28;

  quotation.items.forEach((item) => {
    const lines = wrap(item.description, regular, 9, 275);
    const rowHeight = Math.max(24, lines.length * 12 + 8);
    ensure(rowHeight);
    const rowTop = y;
    lines.forEach((line, index) => page.drawText(line, { x: columns.item, y: rowTop - index * 12, size: 9, font: regular }));
    page.drawText(String(item.quantity), { x: columns.qty, y: rowTop, size: 9, font: regular });
    page.drawText(currency(item.unitPrice), { x: columns.price, y: rowTop, size: 9, font: regular });
    page.drawText(currency(item.subtotal), { x: columns.subtotal, y: rowTop, size: 9, font: regular });
    y -= rowHeight;
    page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: A4.width - margin, y: y + 6 }, thickness: 0.5, color: rgb(0.86, 0.86, 0.86) });
  });

  ensure(100);
  y -= 8;
  const summaryX = 340;
  text("Subtotal", summaryX, 9);
  text(currency(quotation.subtotal), 480, 9);
  y -= 18;
  text("Diskon", summaryX, 9);
  const discount = quotation.discountType === "PERCENTAGE" ? `${quotation.discountValue.toString()}%` : currency(quotation.discountValue);
  text(discount, 480, 9);
  y -= 22;
  page.drawLine({ start: { x: summaryX, y: y + 12 }, end: { x: A4.width - margin, y: y + 12 }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
  text("TOTAL", summaryX, 11, bold);
  text(currency(quotation.total), 470, 11, bold);
  y -= 52;
  ensure(56);
  text("Catatan", margin, 9, bold);
  y -= 16;
  for (const line of wrap("Quotation ini dibuat berdasarkan rincian di atas. Mohon periksa ukuran, jumlah, harga, dan detail pekerjaan sebelum memberikan persetujuan.", regular, 9, A4.width - margin * 2)) {
    text(line, margin, 9, regular, rgb(0.35, 0.35, 0.35));
    y -= 12;
  }

  document.setTitle(`Quotation ${quotation.quotationNo}`);
  document.setAuthor("AS Konveksi");
  return document.save();
}
