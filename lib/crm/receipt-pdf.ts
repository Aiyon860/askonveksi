import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { readDefaultBrandLogoPng } from "@/lib/crm/brand-logo";
import { MIN_FONT_SIZE, clipPdfText, wrapPdfText } from "@/lib/crm/pdf-typography";

type ReceiptData = {
  receiptNo: string;
  invoiceNo: string;
  customerName: string;
  amount: { toString(): string };
  paidAt: Date;
  reference: string | null;
  businessName: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  signatureName: string | null;
  signatureTitle: string | null;
};

type ReceiptAssets = {
  /** PNG hasil normalizePdfImage; kalau kosong memakai logo brand terbaru. */
  logo?: Uint8Array;
  /** PNG hasil normalizePdfImage dari snapshot invoice. */
  signature?: Uint8Array;
};

// Halaman A5 landscape (595,28 × 420 pt), ukuran sama seperti template kwitansi.
const W = 595.28;
const H = 420;
const M = 15; // margin kiri
const RIGHT = 577; // tepi kanan garis
const VALUE_X = 131; // kolom nilai
const COL_X = 407; // kolom kanan: tanggal, nama, tanda tangan

function safeText(value: string) {
  return value.replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

function date(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(value);
}

function amount(value: { toString(): string }) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value.toString()));
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

/** "dua juta ... ribu rupiah" menjadi "Dua Juta ... Ribu Rupiah". */
function terbilangRupiah(n: number) {
  return `${terbilang(n)} rupiah`
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export async function createReceiptPdf(data: ReceiptData, assets: ReceiptAssets = {}) {
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

  const page: PDFPage = document.addPage([W, H]);
  const ink = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.28, 0.28, 0.28);

  function text(value: string, x: number, y: number, size: number, font: PDFFont, color = ink) {
    page.drawText(safeText(value), { x, y, size, font, color });
  }

  function rightText(value: string, right: number, y: number, size: number, font: PDFFont, color = ink) {
    const safeValue = safeText(value);
    page.drawText(safeValue, { x: right - font.widthOfTextAtSize(safeValue, size), y, size, font, color });
  }

  /** Garis pemisah horizontal selebar blok konten. */
  function rule(y: number) {
    page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness: 0.8, color: rgb(0.7, 0.7, 0.7) });
  }

  // ——— Kop: logo, identitas perusahaan, judul & nomor dokumen
  const scaledLogo = logo.scaleToFit(88, 74);
  page.drawImage(logo, { x: M, y: H - 8 - scaledLogo.height, width: scaledLogo.width, height: scaledLogo.height });

  const companyLines: string[] = [];
  if (data.businessAddress) {
    // Alamat boleh memuat jeda baris buatan (seperti referensi); tiap baris dibungkus lagi bila kepanjangan.
    const segments = data.businessAddress.split(/\r?\n/).flatMap((segment) => wrapPdfText(safeText(segment.trim()), regular, MIN_FONT_SIZE, 230));
    companyLines.push(...segments.filter(Boolean).slice(0, 4));
  }
  if (data.businessPhone) companyLines.push(`Telp: ${data.businessPhone}`);
  if (data.businessEmail) companyLines.push(`Email: ${data.businessEmail}`);

  let y = H - 25.5;
  text(clipPdfText(safeText(data.businessName ?? "AS Konveksi"), bold, MIN_FONT_SIZE, 230), 113, y, MIN_FONT_SIZE, bold);
  for (const line of companyLines.slice(0, 6)) {
    y -= 13;
    text(line, 113, y, MIN_FONT_SIZE, regular, muted);
  }

  rightText("KWITANSI", RIGHT, H - 38, 15, bold, ink);
  rightText(`Payment No. : ${data.receiptNo}`, RIGHT, H - 60, MIN_FONT_SIZE, regular, ink);
  rightText(`Invoice No. : ${data.invoiceNo}`, RIGHT, H - 77, MIN_FONT_SIZE, regular, ink);

  rule(H - 107.5);

  // ——— Baris isian (mengalir ke bawah; tiap baris diberi garis pemisah seperti formulir)
  let cursor = H - 124;

  /** Satu baris "label (kiri) + nilai (kanan)" dengan bungkus baris maksimal `maxLines`. */
  function drawRow(label: string, value: string, options: { font?: PDFFont; size?: number; maxLines?: number } = {}) {
    const size = options.size ?? MIN_FONT_SIZE;
    const font = options.font ?? regular;
    const lines = wrapPdfText(safeText(value), font, size, RIGHT - VALUE_X).slice(0, options.maxLines ?? 2);
    text(`${label}:`, M, cursor, MIN_FONT_SIZE, bold);
    lines.forEach((line, index) => page.drawText(line, { x: VALUE_X, y: cursor - index * 13, size, font, color: ink }));
    cursor -= (lines.length - 1) * 13 + 12;
    rule(cursor);
    cursor -= 12;
  }

  // ——— Baris 1: Terima Dari
  drawRow("Terima Dari", data.customerName, { maxLines: 1 });
  // ——— Baris 2: Banyaknya Uang (terbilang)
  drawRow("Banyaknya Uang", terbilangRupiah(Math.round(Number(data.amount.toString()))), { maxLines: 3 });
  // ——— Baris 3: Untuk pembayaran
  drawRow("Untuk pembayaran", `Pembayaran Invoice ${data.invoiceNo}${data.reference ? ` (${data.reference})` : ""}`, { maxLines: 2 });

  // ——— Jumlah rupiah (kiri) & blok tanggal/tanda tangan (kanan) pada pita yang sama
  const band = cursor;
  text("Jumlah Rp:", M, band, MIN_FONT_SIZE, bold);
  page.drawText(safeText(amount(data.amount)), { x: VALUE_X, y: band, size: 14, font: bold, color: ink });

  text(date(data.paidAt), COL_X, band, MIN_FONT_SIZE, regular);
  let signatureTop = band - 16;
  if (signature) {
    const scaled = signature.scaleToFit(150, 42);
    page.drawImage(signature, { x: COL_X, y: signatureTop - scaled.height, width: scaled.width, height: scaled.height });
    signatureTop -= scaled.height + 8;
  }
  if (data.signatureName) text(clipPdfText(safeText(data.signatureName), bold, MIN_FONT_SIZE, 170), COL_X, signatureTop, MIN_FONT_SIZE, bold);
  if (data.signatureTitle) text(clipPdfText(safeText(data.signatureTitle), regular, MIN_FONT_SIZE, 170), COL_X, signatureTop - 14, MIN_FONT_SIZE, regular, muted);

  document.setTitle(`Kwitansi ${data.receiptNo}`);
  return document.save();
}
