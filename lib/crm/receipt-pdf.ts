import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type ReceiptData = {
  receiptNo: string;
  invoiceNo: string;
  customerName: string;
  amount: { toString(): string };
  paidAt: Date;
  paymentMethod: string | null;
  reference: string | null;
  note: string | null;
  businessName: string | null;
  businessAddress: string | null;
  signatureName: string | null;
  signatureTitle: string | null;
};

function safeText(value: string) {
  return value.replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

function currency(value: { toString(): string }) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value.toString()));
}

function date(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(value);
}

function terbilang(n: number): string {
  const kata = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
  if (n < 12) return kata[n];
  if (n < 20) return `${terbilang(n - 10)} belas`;
  if (n < 100) return `${terbilang(Math.floor(n / 10))} puluh ${terbilang(n % 10)}`.trim();
  if (n < 200) return `seratus ${terbilang(n - 100)}`.trim();
  if (n < 1000) return `${terbilang(Math.floor(n / 100))} ratus ${terbilang(n % 100)}`.trim();
  if (n < 2000) return `seribu ${terbilang(n - 1000)}`.trim();
  if (n < 1_000_000) return `${terbilang(Math.floor(n / 1000))} ribu ${terbilang(n % 1000)}`.trim();
  if (n < 1_000_000_000) return `${terbilang(Math.floor(n / 1_000_000))} juta ${terbilang(n % 1_000_000)}`.trim();
  return `${terbilang(Math.floor(n / 1_000_000_000))} miliar ${terbilang(n % 1_000_000_000)}`.trim();
}

export async function createReceiptPdf(data: ReceiptData) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const page = document.addPage([595.28, 420]);
  const margin = 48;
  let y = 420 - margin;

  page.drawText("KWITANSI", { x: margin, y, size: 18, font: bold });
  page.drawText(safeText(data.receiptNo), { x: margin, y: y - 18, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4) });
  y -= 44;
  const label = (t: string, v: string) => {
    page.drawText(t, { x: margin, y, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(safeText(v), { x: margin + 130, y, size: 10, font: regular });
    y -= 18;
  };
  label("Telah diterima dari", data.customerName);
  label("Uang sejumlah", `${currency(data.amount)} (${terbilang(Math.round(Number(data.amount.toString())))} rupiah)`);
  label("Untuk pembayaran", `Invoice ${data.invoiceNo}${data.reference ? ` · ${data.reference}` : ""}`);
  label("Tanggal", date(data.paidAt));
  label("Metode", data.paymentMethod ?? "-");
  if (data.note) label("Catatan", data.note);
  y -= 12;
  page.drawText(safeText(data.businessName ?? "AS Konveksi"), { x: 595.28 - margin - 180, y, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4) });
  y -= 30;
  if (data.signatureName) {
    page.drawText(safeText(data.signatureName), { x: 595.28 - margin - 180, y, size: 11, font: bold });
    y -= 14;
    page.drawText(safeText(data.signatureTitle ?? ""), { x: 595.28 - margin - 180, y, size: 8, font: regular, color: rgb(0.4, 0.4, 0.4) });
  }
  document.setTitle(`Kwitansi ${data.receiptNo}`);
  return document.save();
}
