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

// Kertas slip landscape 28,5 x 9 cm (1 cm = 28,3465 pt).
const SLIP = { width: 807.87, height: 600.12 };
const margin = 20;
const RIGHT = SLIP.width - margin;
const LABEL_WIDTH = 160;
const VALUE_X = margin + LABEL_WIDTH + 12;

function safeText(value: string) {
  return value.replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

function date(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(value);
}

/** Angka gaya invoice: id-ID dua desimal, 4.330.000,00 (label baris sudah menyebut "Rp"). */
function amount(value: { toString(): string }) {
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value.toString()));
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

  const page: PDFPage = document.addPage([SLIP.width, SLIP.height]);
  const ink = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.32, 0.32, 0.32);
  let y = SLIP.height - margin - 4;

  function rightText(value: string, size = MIN_FONT_SIZE, font = regular, color = ink) {
    const safeValue = safeText(value);
    page.drawText(safeValue, { x: RIGHT - font.widthOfTextAtSize(safeValue, size), y, size, font, color });
  }

  /** Garis pemisah horizontal selebar konten. */
  function rule(lineY = y) {
    page.drawLine({ start: { x: margin, y: lineY }, end: { x: RIGHT, y: lineY }, thickness: 0.8, color: rgb(0.72, 0.72, 0.72) });
  }

  /** Kotak pola garis abu tipis untuk terbilang dan nominal. */
  function stripedBox(boxX: number, boxBottom: number, boxWidth: number, boxHeight: number) {
    page.drawRectangle({ x: boxX, y: boxBottom, width: boxWidth, height: boxHeight, color: rgb(0.94, 0.94, 0.94) });
    for (let lineY = boxBottom + 2; lineY < boxBottom + boxHeight; lineY += 3) {
      page.drawLine({ start: { x: boxX, y: lineY }, end: { x: boxX + boxWidth, y: lineY }, thickness: 0.4, color: rgb(0.8, 0.8, 0.8) });
    }
  }

  // ——— Kop: logo + identitas perusahaan kiri, judul + nomor kanan
  const headerTop = y;
  const scaledLogo = logo.scaleToFit(140, 60);
  page.drawImage(logo, { x: margin, y: y - scaledLogo.height, width: scaledLogo.width, height: scaledLogo.height });
  const companyX = margin + scaledLogo.width + 14;
  const companyWidth = 300;
  page.drawText(clipPdfText(safeText(data.businessName ?? "AS Konveksi"), bold, MIN_FONT_SIZE, companyWidth), { x: companyX, y: y - 12, size: MIN_FONT_SIZE, font: bold });
  let companyBottom = y - 12 - 15;
  const companyLines: string[] = [];
  if (data.businessAddress) {
    companyLines.push(...data.businessAddress.split(/\r?\n/).flatMap((segment) => wrapPdfText(safeText(segment.trim()), regular, MIN_FONT_SIZE, companyWidth)).filter(Boolean).slice(0, 3));
  }
  if (data.businessPhone) companyLines.push(`Telp: ${data.businessPhone}`);
  if (data.businessEmail) companyLines.push(`Email: ${data.businessEmail}`);
  for (const line of companyLines.slice(0, 5)) {
    page.drawText(line, { x: companyX, y: companyBottom, size: MIN_FONT_SIZE, font: regular, color: muted });
    companyBottom -= 15;
  }
  page.drawText("KUITANSI", { x: RIGHT - bold.widthOfTextAtSize("KUITANSI", 18), y: headerTop - 16, size: 18, font: bold });
  y = headerTop - 36;
  rightText(`Payment No. ${safeText(data.receiptNo)}`);
  y -= 17;
  rightText(`Invoice No. ${safeText(data.invoiceNo)}`);
  y = Math.min(companyBottom, y) - 8;
  rule();
  y -= 18;

  /** Satu baris formulir: label tebal kiri + nilai (wrap) vertikal di tengah baris; kotak garis opsional di zona nilai. */
  function drawRow(label: string, valueLines: string[], font: PDFFont, style: "plain" | "striped" | "underline") {
    const rowHeight = Math.max(46, valueLines.length * 16 + 16);
    // Kotak arsir mengikuti tinggi isi teks (tidak sebaris penuh) agar ramping.
    const boxHeight = style === "striped" ? valueLines.length * 16 + 12 : rowHeight;
    const boxBottom = y - (rowHeight + boxHeight) / 2;
    if (style === "striped") stripedBox(VALUE_X - 6, boxBottom, RIGHT - VALUE_X + 6, boxHeight);
    const firstBaseline = boxBottom + boxHeight - 16;
    page.drawText(safeText(label), { x: margin, y: firstBaseline, size: MIN_FONT_SIZE, font: bold });
    valueLines.forEach((line, index) => {
      page.drawText(line, { x: VALUE_X, y: firstBaseline - index * 16, size: MIN_FONT_SIZE, font, color: ink });
    });
    if (style === "underline") page.drawLine({ start: { x: VALUE_X, y: y - rowHeight + 6 }, end: { x: RIGHT, y: y - rowHeight + 6 }, thickness: 0.7, color: rgb(0.72, 0.72, 0.72) });
    y -= rowHeight;
    rule(y);
    y -= 14;
  }

  const valueWidth = RIGHT - VALUE_X;
  const wrapValue = (value: string, maxLines: number) => wrapPdfText(safeText(value), regular, MIN_FONT_SIZE, valueWidth).slice(0, maxLines);
  // ——— Baris 1: Terima Dari
  drawRow("Terima Dari", wrapValue(data.customerName, 1), regular, "plain");
  // ——— Baris 2: Banyaknya Uang (terbilang dalam kotak garis)
  drawRow("Banyaknya Uang", wrapValue(terbilangRupiah(Math.round(Number(data.amount.toString()))), 2), regular, "striped");
  // ——— Baris 3: Untuk pembayaran
  drawRow("Untuk pembayaran", wrapValue(`Pembayaran Invoice ${data.invoiceNo}${data.reference ? ` (${data.reference})` : ""}`, 1), regular, "underline");

  // ——— Pita bawah: jumlah rupiah (kiri) & blok tanggal/tanda tangan (kanan)
  const band = y;
  const amountBoxHeight = 30;
  const amountBoxBottom = band - 2 - amountBoxHeight;
  const amountBaseline = amountBoxBottom + 11;
  // Label sebaris (satu baseline) dengan angka; digit vertikal di tengah kotak.
  page.drawText("Jumlah Rp", { x: margin, y: amountBaseline, size: 16, font: bold });
  const amountText = safeText(amount(data.amount));
  const amountWidth = bold.widthOfTextAtSize(amountText, 16);
  stripedBox(VALUE_X - 6, amountBoxBottom, amountWidth + 24, amountBoxHeight);
  page.drawText(amountText, { x: VALUE_X + 6, y: amountBaseline, size: 16, font: bold });
  // Satu sumber ukuran blok tanda tangan: ubah di sini, posisi tengah + gambar ikut.
  const SIGN_DATE_SIZE = MIN_FONT_SIZE;
  const SIGN_NAME_SIZE = MIN_FONT_SIZE;
  const SIGN_IMAGE_MAX_WIDTH = 160;
  const signZoneWidth = 200;
  const signX = RIGHT - signZoneWidth;
  const signCenter = signX + signZoneWidth / 2;
  const signDate = date(data.paidAt);
  const signDateBaseline = band - 20;
  page.drawText(signDate, { x: signCenter - regular.widthOfTextAtSize(signDate, SIGN_DATE_SIZE) / 2, y: signDateBaseline, size: SIGN_DATE_SIZE, font: regular });
  const signer = data.signatureName ?? data.businessName ?? "AS Konveksi";
  const signName = clipPdfText(safeText(signer), bold, SIGN_NAME_SIZE, signZoneWidth);
  const signNameBaseline = signDateBaseline - 16;
  page.drawText(signName, { x: signCenter - bold.widthOfTextAtSize(signName, SIGN_NAME_SIZE) / 2, y: signNameBaseline, size: SIGN_NAME_SIZE, font: bold });
  if (signature) {
    // Gambar mulai di bawah nama; tingginya dikunci sisa ruang hingga margin
    // bawah sehingga tidak pernah terpotong tepi kertas.
    const imageTop = signNameBaseline - 8;
    const sigMaxHeight = Math.max(24, imageTop - margin);
    const scaled = signature.scaleToFit(SIGN_IMAGE_MAX_WIDTH, sigMaxHeight);
    page.drawImage(signature, { x: signCenter - scaled.width / 2, y: imageTop - scaled.height, width: scaled.width, height: scaled.height });
  }

  document.setTitle(`Kwitansi ${data.receiptNo}`);
  return document.save();
}
