import "server-only";

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { Brand } from "@/lib/brand/config";
import { DEFAULT_BRAND } from "@/lib/brand/config";
import { readDefaultBrandLogoPng } from "@/lib/crm/brand-logo";
import { clipPdfText } from "@/lib/crm/pdf-typography";
import { parseInvoicePointRuns, type InvoicePointRun } from "@/lib/crm/invoice-setting-html";

type PdfInvoiceSettingPoint = { section: "KETERANGAN" | "SYARAT_KETENTUAN"; text: string };

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
    discountType?: string | null;
    discountPercent?: { toString(): string } | string | null;
    discountAmount?: { toString(): string } | string | null;
    total: { toString(): string };
    addons?: Array<{ label: string; description?: string | null; unitAmount: { toString(): string }; qty?: number }>;
  }>;
  /** Add On level invoice untuk dokumen baru. */
  addons?: Array<{ label: string; description?: string | null; unitAmount: { toString(): string }; qty?: number }>;
  salesOrder: { payment: { kind?: string; transactions: Array<{ amount: { toString(): string }; status: string }> } | null } | null;
};

/* ------------------------------------------------------------------------- *
 * Token tampilan template invoice.
 *
 * Semua angka diambil dari file template klien (INV_SAL_INV_...docx) setelah
 * dikonversi twip → pt (1 pt = 20 twip). Ukuran, warna, dan jarak hanya boleh
 * berasal dari blok ini supaya PDF tetap mengikuti template Word-nya.
 * ------------------------------------------------------------------------- */
const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = { top: 58, topNext: 39, bottom: 14, x: 28.3 };
const TEXT_RIGHT = PAGE.width - MARGIN.x;

/** Ukuran teks: 9 pt untuk seluruh teks, 16,5 pt hanya judul "Invoice". */
const FONT = 9;
const TITLE_FONT = 16.5;
/** Line-height tabel yang teksnya wrap (302/240). */
const ROW_LINE_HEIGHT = FONT * 1.258;
/** Line-height daftar poin & alamat (254/240). */
const TEXT_LINE_HEIGHT = FONT * 1.058;
/** Word memakai line-height tunggal Arial ≈ 1,15 × ukuran font. */
const LINE_FACTOR = 1.15;
/** jarak baseline dari puncak baris (ascent Arial). */
const ASCENT_FACTOR = 0.905;

const COLOR = {
  title: rgb(51 / 255, 102 / 255, 153 / 255), // #336699
  meta: rgb(45 / 255, 61 / 255, 78 / 255), // #2D3D4E
  heading: rgb(45 / 255, 61 / 255, 78 / 255), // #2D3D4E
  name: rgb(48 / 255, 125 / 255, 172 / 255), // #307DAC
  body: rgb(84 / 255, 84 / 255, 84 / 255), // #545454
  tableHeadBg: rgb(45 / 255, 61 / 255, 78 / 255), // #2D3D4E
  tableRowBg: rgb(240 / 255, 240 / 255, 240 / 255), // #F0F0F0
  rule: rgb(86 / 255, 102 / 255, 118 / 255), // #566676
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
} as const;

/** Kop: gambar 131,25 × 63,26 pt di x 34,77. */
const LOGO = { x: 34.77, width: 131.25, height: 63.26 };
/** Tanda tangan 56,75 × 49,72 pt (dari master data bila diatur lain). */
const SIGNATURE_BOX = { width: 56.75, height: 49.72 };
/** Judul & meta kanan atas: indent kanan dari batas teks halaman. */
const TITLE_RIGHT = TEXT_RIGHT - 43.1;
const META_RIGHT = TEXT_RIGHT - 43.85;

/** Tabel item: tblInd 6,05 pt dari margin, total 527,1 pt. */
const TABLE = { x: MARGIN.x + 6.05, width: 527.1, headerHeight: 25.05, rowHeight: 22.05 };
/** Dua kolom info halaman 1: 151,55 pt | 112,05 pt | 275,3 pt. */
const INFO = {
  textIndent: 6.45,
  leftX: MARGIN.x + 6.45,
  leftWidth: 151.55 - 6.45,
  rightX: MARGIN.x + 151.55 + 112.05 + 6.45,
  rightWidth: 275.3 - 6.45,
  leftRuleX: 34.77,
  leftRuleWidth: 209.4,
  rightRuleX: 298.39,
  rightRuleWidth: 262.15,
};

/** Halaman 2: kolom kiri 232,35 pt | 56,15 pt | kanan 250,4 pt. */
const LEFT_COLUMN = { x: MARGIN.x, width: 232.35 };
const SUMMARY = { x: MARGIN.x + 232.35 + 56.15, width: 250.4 };
/** Indentasi blok total dari batas teks kanan (262 twip). */
const VALUES_RIGHT = TEXT_RIGHT - 13.1;
/** Tanggal & nama tanda tangan: rata tengah pada kolom kanan (indent kanan 1072 twip). */
const SIGN_CENTER = (SUMMARY.x + TEXT_RIGHT - 53.6) / 2;
/** Judul seksi di halaman 2 (indent 264 twip) serta garisnya. */
const LIST_HEADING_INDENT = 13.2;
const LIST_RULE_WIDTH = 222.3;
/** Daftar poin: indent kiri 43,2 pt (864 twip), hanging 12,7 pt. */
const POINT_INDENT = 43.2;
const POINT_HANGING = 12.7;
/** Garis di atas "Jumlah Tertagih": 367 px. */
const TOTAL_RULE_WIDTH = (367 * 3) / 4;

/**
 * Kursor vertikal gaya Word: tiap paragraf turun sebesar `before` + line-height,
 * dan baseline berada satu ascent di bawah puncak baris.
 */
function makeFlow(startTop: number) {
  let top = startTop;
  return {
    line(size: number, before = 0, factor = LINE_FACTOR) {
      top -= before;
      const baseline = top - size * ASCENT_FACTOR;
      top -= size * factor;
      return baseline;
    },
    get top() {
      return top;
    },
  };
}

function safeText(value: string) {
  return value.replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

/** Angka gaya invoice: 4.330.000,00 (id-ID, dua desimal). */
function templateNumber(value: number | string) {
  const number = Number(value);
  const safe = Number.isFinite(number) ? number : 0;
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safe);
}

function templateMoney(value: number | string) {
  return `Rp ${templateNumber(value)}`;
}

function slashDate(value: Date | null) {
  if (!value) return "-";
  const parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Jakarta" }).formatToParts(value);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("day")}/${pick("month")}/${pick("year")}`;
}

/** Tanggal tanda tangan gaya template: 19 Okt 2026. */
function signatureDate(value: Date) {
  const parts = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).formatToParts(value);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("day")} ${pick("month")} ${pick("year")}`;
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

type PointToken = { text: string; font: PDFFont; underline: boolean; size: number };

/** Ukuran terbesar pada satu baris; jarak antar-baris mengikuti angka ini. */
function lineMaxSize(tokens: PointToken[], baseSize: number) {
  return tokens.reduce((largest, token) => Math.max(largest, token.size), baseSize);
}

/** Bungkus run bergaya menjadi baris token sesuai lebar kolom; `\n` paksa baris baru. */
function layoutPointLines(
  runs: InvoicePointRun[],
  fonts: { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont },
  maxWidth: number,
  baseSize: number,
) {
  const lines: PointToken[][] = [];
  let line: PointToken[] = [];
  let lineWidth = 0;
  let pendingSpace = false;
  let pendingBreak = false;

  const newLine = () => {
    lines.push(line);
    line = [];
    lineWidth = 0;
    pendingSpace = false;
  };
  const append = (text: string, font: PDFFont, underline: boolean, size: number) => {
    const tokenWidth = font.widthOfTextAtSize(text, size);
    if (lineWidth > 0 && lineWidth + tokenWidth > maxWidth) newLine();
    line.push({ text, font, underline: underline && text.trim().length > 0, size });
    lineWidth += tokenWidth;
  };

  for (const run of runs) {
    const font = run.bold ? (run.italic ? fonts.boldItalic : fonts.bold) : run.italic ? fonts.italic : fonts.regular;
    const size = run.size ?? baseSize;
    for (const part of run.text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        if (part.includes("\n")) pendingBreak = true;
        else pendingSpace = true;
        continue;
      }
      if (pendingBreak) {
        if (line.length) newLine();
        pendingBreak = false;
      } else if (pendingSpace && line.length) {
        append(" ", fonts.regular, false, size);
      }
      pendingSpace = false;
      append(safeText(part), font, run.underline, size);
    }
  }
  if (line.length || !lines.length) lines.push(line);
  return lines;
}

type InvoiceAssets = {
  brand?: Brand;
  logo?: Uint8Array;
  signature?: Uint8Array;
  /** Daftar metode pembayaran aktif dari master data; dicetak saat invoice tidak punya snapshot rekening lama. */
  paymentMethods?: Array<{ name: string; description: string | null }>;
  /** Poin master "Pengaturan invoice": blok Keterangan & Syarat/Ketentuan, selalu mengikuti data terkini. */
  settingPoints?: PdfInvoiceSettingPoint[];
  /** Batas ukuran gambar tanda tangan dari master data (default 56,75 × 49,72 pt). */
  signatureMaxWidth?: number;
  signatureMaxHeight?: number;
};

export async function createInvoicePdf(invoice: PdfInvoice, assets: InvoiceAssets = {}) {
  const brand = assets.brand ?? DEFAULT_BRAND;
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const italic = await document.embedFont(StandardFonts.HelveticaOblique);
  const boldItalic = await document.embedFont(StandardFonts.HelveticaBoldOblique);
  const logoBytes = assets.logo ?? await readDefaultBrandLogoPng(brand);
  const logo = await document.embedPng(logoBytes);
  let signature: Awaited<ReturnType<typeof document.embedPng>> | undefined;
  if (assets.signature) {
    try {
      signature = await document.embedPng(assets.signature);
    } catch {
      signature = undefined;
    }
  }
  let page!: PDFPage;
  let y!: number;

  function addPage() {
    page = document.addPage([PAGE.width, PAGE.height]);
    // Halaman 1 memakai margin atas 58 pt; halaman berikutnya 39 pt.
    y = document.getPageCount() === 1 ? PAGE.height - MARGIN.top : PAGE.height - MARGIN.topNext;
  }

  function ensure(height: number) {
    if (y - height < MARGIN.bottom + 8) addPage();
  }

  function rightText(value: string, right: number, size = FONT, font = regular, color: ReturnType<typeof rgb> = COLOR.body) {
    const safeValue = safeText(value);
    page.drawText(safeValue, { x: right - font.widthOfTextAtSize(safeValue, size), y, size, font, color });
  }

  /** Jarak antar-baris mengikuti ukuran teks terbesar di baris itu (line-height template). */
  function textStep(previous: number, next: number) {
    return Math.max(previous, next) * 1.058;
  }

  /** Tinggi satu poin dari baseline baris pertamanya sampai bawah baris terakhir. */
  function pointDrop(sizes: number[]) {
    let drop = sizes[sizes.length - 1] * 1.058;
    for (let index = 1; index < sizes.length; index += 1) {
      drop += textStep(sizes[index - 1], sizes[index]);
    }
    return drop;
  }

  /** Judul seksi ke baseline poin pertama: baris kosong + garis 1,5 pt + jarak 9,35 pt. */
  const POINT_HEADING_DROP = 32.3;
  /** Jarak antar poin pada template (0–1 px). */
  const POINT_GAP = 0.05;

  /**
   * Jarak nomor ke teks poin: 12,7 pt, melebar bila nomornya dua digit
   * ("10.") supaya nomor tidak menimpa teks poin.
   */
  function pointTextIndent(points: PdfInvoiceSettingPoint[]) {
    const numberWidth = regular.widthOfTextAtSize(`${points.length}.`, FONT);
    return Math.max(POINT_HANGING, numberWidth + 2.25);
  }

  /**
   * Tinggi blok Keterangan / Syarat. Rumus ini harus sama dengan penurunan `y`
   * di `drawPointList` supaya pilihan pindah halaman benar-benar cocok.
   */
  function pointListDrop(points: PdfInvoiceSettingPoint[], width: number) {
    if (!points.length) return 0;
    const fonts = { regular, bold, italic, boldItalic };
    const wrapWidth = width - POINT_INDENT - pointTextIndent(points);
    const sizesPerPoint = points.map((point) =>
      layoutPointLines(parseInvoicePointRuns(point.text ?? ""), fonts, wrapWidth, FONT)
        .map((tokens) => lineMaxSize(tokens, FONT)),
    );
    let drop = POINT_HEADING_DROP;
    sizesPerPoint.forEach((sizes, pointIndex) => {
      if (pointIndex > 0) {
        const previousSizes = sizesPerPoint[pointIndex - 1];
        drop += textStep(previousSizes[previousSizes.length - 1], sizes[0]) + POINT_GAP;
      }
      drop += pointDrop(sizes);
    });
    return drop;
  }

  /**
   * Blok poin dari master "Pengaturan invoice". Tiap poin bisa memuat campuran
   * tebal/miring/garis bawah, baris baru, dan ukuran teks per fragmen.
   * Pemanggil sudah berusaha memuat seluruh blok; bila tetap tidak muat,
   * blok dilanjutkan per poin di halaman baru (judul diulang).
   */
  function drawPointList(title: string, points: PdfInvoiceSettingPoint[], x: number, width: number) {
    if (!points.length) return;
    const fonts = { regular, bold, italic, boldItalic };
    const headingX = x + LIST_HEADING_INDENT;
    const numberX = x + POINT_INDENT;
    const textIndent = pointTextIndent(points);
    const textX = numberX + textIndent;
    const wrapWidth = width - POINT_INDENT - textIndent;
    const prepared = points.map((point) => {
      const lines = layoutPointLines(parseInvoicePointRuns(point.text ?? ""), fonts, wrapWidth, FONT);
      return { lines, sizes: lines.map((tokens) => lineMaxSize(tokens, FONT)) };
    });
    const bottom = MARGIN.bottom + 8;
    const drawTitle = () => {
      page.drawText(safeText(title), { x: headingX, y, size: FONT, font: bold, color: COLOR.heading });
      const ruleY = y - 14.1;
      page.drawLine({ start: { x: headingX, y: ruleY }, end: { x: headingX + LIST_RULE_WIDTH, y: ruleY }, thickness: 1.5, color: COLOR.rule });
      y = ruleY;
    };

    drawTitle();
    let baseline = y - 18.2;
    let lastBaseline = baseline;
    prepared.forEach(({ lines, sizes }, pointIndex) => {
      if (pointIndex > 0) {
        // Turun satu baris dari baseline terakhir poin sebelumnya, lalu jarak antar poin.
        const previousSizes = prepared[pointIndex - 1].sizes;
        baseline -= textStep(previousSizes[previousSizes.length - 1], sizes[0]) + POINT_GAP;
      }
      if (baseline - pointDrop(sizes) < bottom) {
        addPage();
        drawTitle();
        baseline = y - 18.2;
      }
      page.drawText(`${pointIndex + 1}.`, { x: numberX, y: baseline, size: FONT, font: regular, color: COLOR.black });
      let lineY = baseline;
      lines.forEach((tokens, lineIndex) => {
        if (lineIndex > 0) lineY -= textStep(sizes[lineIndex - 1], sizes[lineIndex]);
        let cursorX = textX;
        for (const token of tokens) {
          if (!token.text) continue;
          page.drawText(token.text, { x: cursorX, y: lineY, size: token.size, font: token.font, color: COLOR.black });
          const tokenWidth = token.font.widthOfTextAtSize(token.text, token.size);
          if (token.underline) {
            page.drawLine({ start: { x: cursorX, y: lineY - 2 }, end: { x: cursorX + tokenWidth, y: lineY - 2 }, thickness: 0.8, color: COLOR.black });
          }
          cursorX += tokenWidth;
        }
      });
      lastBaseline = lineY;
      baseline = lineY;
    });
    y = lastBaseline - TEXT_LINE_HEIGHT - 8;
  }

  const issueDate = invoice.issuedAt ?? invoice.createdAt;
  const totalPaid = invoice.salesOrder?.payment?.transactions.filter((item) => item.status === "ACTIVE").reduce((sum, item) => sum + Number(item.amount.toString()), 0) ?? 0;
  const amountDue = Math.max(0, Number(invoice.total.toString()) - totalPaid);

  addPage();
  if (invoice.status === "DRAFT") page.drawText("DRAFT", { x: 150, y: 370, size: 82, font: bold, color: rgb(0.9, 0.9, 0.9), rotate: degrees(35), opacity: 0.45 });

  // Kop: logo di kiri, judul + meta di kanan mengikuti tab template.
  const header = makeFlow(PAGE.height - MARGIN.top);
  const titleBaseline = header.line(TITLE_FONT, 3.95);
  page.drawImage(logo, { x: LOGO.x, y: PAGE.height - 58.49 - LOGO.height, width: LOGO.width, height: LOGO.height });
  page.drawText("Invoice", { x: TITLE_RIGHT - bold.widthOfTextAtSize("Invoice", TITLE_FONT), y: titleBaseline, size: TITLE_FONT, font: bold, color: COLOR.title });

  const metaRows: Array<[string, string]> = [
    ["Referensi", safeText(invoice.invoiceNo)],
    ["Tanggal", slashDate(issueDate)],
    ["Tgl. Jatuh Tempo", slashDate(invoice.dueAt)],
  ];
  const metaValueWidth = Math.max(...metaRows.map(([, value]) => regular.widthOfTextAtSize(value, FONT)));
  const metaBaselines = [header.line(9, 15.3), header.line(9, 2.15), header.line(9, 2.15)];
  metaRows.forEach(([label, value], index) => {
    const metaY = metaBaselines[index];
    page.drawText(safeText(value), { x: META_RIGHT - regular.widthOfTextAtSize(value, FONT), y: metaY, size: FONT, font: regular, color: COLOR.meta });
    const labelWidth = regular.widthOfTextAtSize(label, FONT);
    page.drawText(safeText(label), { x: META_RIGHT - metaValueWidth - 8 - labelWidth, y: metaY, size: FONT, font: regular, color: COLOR.meta });
  });
  header.line(9, 0);
  header.line(9, 7.9);
  const infoHeadingBaseline = header.line(9, 0);
  header.line(9.5, 3);
  header.line(6.5, 2);
  const columnsTop = header.top;

  // Dua kolom info: perusahaan (151,55 pt) | customer (275,3 pt), dipisah kolom Word.
  const infoRuleY = infoHeadingBaseline - 17.5;
  page.drawText("Info Perusahaan", { x: INFO.leftX, y: infoHeadingBaseline, size: FONT, font: bold, color: COLOR.heading });
  page.drawText("Tagihan Untuk", { x: INFO.rightX, y: infoHeadingBaseline, size: FONT, font: bold, color: COLOR.heading });
  page.drawLine({ start: { x: INFO.leftRuleX, y: infoRuleY }, end: { x: INFO.leftRuleX + INFO.leftRuleWidth, y: infoRuleY }, thickness: 1.5, color: COLOR.rule });
  page.drawLine({ start: { x: INFO.rightRuleX, y: infoRuleY }, end: { x: INFO.rightRuleX + INFO.rightRuleWidth, y: infoRuleY }, thickness: 1.5, color: COLOR.rule });

  const businessFlow = makeFlow(columnsTop);
  const customerFlow = makeFlow(columnsTop);
  const businessNameY = businessFlow.line(9, 4.75);
  page.drawText(clipPdfText(safeText(invoice.snapshotBusinessName ?? "AS Konveksi"), bold, FONT, INFO.leftWidth), { x: INFO.leftX, y: businessNameY, size: FONT, font: bold, color: COLOR.name });
  const businessAddressLines = wrap(invoice.snapshotBusinessAddress ?? "-", regular, FONT, INFO.leftWidth);
  businessAddressLines.forEach((line, index) => {
    const lineY = businessFlow.line(9, index === 0 ? 2.25 : 0.6, 1.058);
    page.drawText(line, { x: INFO.leftX, y: lineY, size: FONT, font: regular, color: COLOR.body });
  });
  const businessPhoneY = businessFlow.line(9, 0.6);
  page.drawText(safeText(`Telp: ${invoice.snapshotBusinessPhone ?? "-"}`), { x: INFO.leftX, y: businessPhoneY, size: FONT, font: regular, color: COLOR.body });
  const businessEmailY = businessFlow.line(9, 0.65);
  page.drawText(safeText(`Email: ${invoice.snapshotBusinessEmail ?? "-"}`), { x: INFO.leftX, y: businessEmailY, size: FONT, font: regular, color: COLOR.body });

  // Tagihan ditujukan ke nama customer; perusahaan dipakai hanya sebagai fallback data lama.
  const customerName = invoice.snapshotCustomerName ?? invoice.snapshotCompanyName;
  const customerNameY = customerFlow.line(9, 4.75);
  page.drawText(clipPdfText(safeText(customerName), bold, FONT, INFO.rightWidth), { x: INFO.rightX, y: customerNameY, size: FONT, font: bold, color: COLOR.name });
  customerFlow.line(9, 2.25);
  const customerPhoneY = customerFlow.line(9, 0);
  const customerLines = [`Telp: ${invoice.snapshotWhatsapp ?? "-"}`];
  customerLines.forEach((line, index) => {
    page.drawText(safeText(line), { x: INFO.rightX, y: customerPhoneY - index * LINE_FACTOR * FONT, size: FONT, font: regular, color: COLOR.body });
  });
  y = Math.min(businessFlow.top, customerFlow.top) - 10.35;

  // Tabel barang: kepala navy, baris abu #F0F0F0, pemisah sel putih 2 px.
  // Teks panjang dibungkus ke bawah (wrap), bukan dipotong "...".
  const tableColumns = [
    { key: "product", label: "Produk", width: 103.15, align: "left" as const, indent: 7.5 },
    { key: "description", label: "Deskripsi", width: 103.15, align: "left" as const, indent: 6.75 },
    { key: "qty", label: "Qty", width: 40.1, align: "center" as const, indent: 0 },
    { key: "price", label: "Harga", width: 80.2, align: "right" as const, indent: 7.5 },
    { key: "disc", label: "Disc", width: 80.2, align: "center" as const, indent: 0 },
    { key: "tax", label: "Pajak", width: 40.1, align: "center" as const, indent: 0 },
    { key: "total", label: "Jumlah", width: 80.2, align: "right" as const, indent: 7.5 },
  ];
  const tableRight = TABLE.x + TABLE.width;
  function columnX(index: number) {
    return TABLE.x + tableColumns.slice(0, index).reduce((sum, column) => sum + column.width, 0);
  }
  function cellTextX(index: number, textWidth: number) {
    const column = tableColumns[index];
    const cellX = columnX(index);
    if (column.align === "left") return cellX + column.indent;
    if (column.align === "right") return cellX + column.width - column.indent - textWidth;
    return cellX + (column.width - textWidth) / 2;
  }
  /** Pemisah antar sel: putih 2 px, vertikal di tiap batas kolom + horizontal di bawah baris. */
  function drawCellSeparators(rowTop: number, rowHeight: number) {
    page.drawLine({
      start: { x: TABLE.x, y: rowTop - rowHeight },
      end: { x: tableRight, y: rowTop - rowHeight },
      thickness: 1.5,
      color: COLOR.white,
    });
    tableColumns.forEach((_, index) => {
      if (index === 0) return;
      const lineX = columnX(index);
      page.drawLine({ start: { x: lineX, y: rowTop }, end: { x: lineX, y: rowTop - rowHeight }, thickness: 1.5, color: COLOR.white });
    });
  }
  function headerBaseline(rowTop: number) {
    return rowTop - TABLE.headerHeight + 8.9;
  }
  function drawTableHeader() {
    ensure(TABLE.headerHeight + 4);
    const rowTop = y;
    page.drawRectangle({ x: TABLE.x, y: rowTop - TABLE.headerHeight, width: TABLE.width, height: TABLE.headerHeight, color: COLOR.tableHeadBg });
    tableColumns.forEach((column, index) => {
      const label = clipPdfText(column.label, bold, FONT, column.width - column.indent - 3);
      const textWidth = bold.widthOfTextAtSize(label, FONT);
      // Di template, judul Qty/Harga/Disc/Pajak/Jumlah rata tengah; Produk & Deskripsi kiri.
      const labelX = index <= 1 ? cellTextX(index, textWidth) : columnX(index) + (column.width - textWidth) / 2;
      page.drawText(label, { x: labelX, y: headerBaseline(rowTop), size: FONT, font: bold, color: COLOR.white });
    });
    drawCellSeparators(rowTop, TABLE.headerHeight);
    y -= TABLE.headerHeight;
  }
  function drawTableCell(index: number, value: string, baselineY: number, font: PDFFont) {
    const column = tableColumns[index];
    const clipped = clipPdfText(safeText(value), font, FONT, column.width - column.indent - 3);
    const textWidth = font.widthOfTextAtSize(clipped, FONT);
    page.drawText(clipped, { x: cellTextX(index, textWidth), y: baselineY, size: FONT, font, color: COLOR.body });
  }
  type TableRow = { cells: string[][]; lines: number };
  const tableRows: TableRow[] = [];
  const wrapCell = (value: string, columnIndex: number) =>
    wrap(value || "-", regular, FONT, tableColumns[columnIndex].width - tableColumns[columnIndex].indent - 3);
  for (const item of invoice.items) {
    const productLines = wrapCell(item.productName ?? "-", 0);
    const descLines = wrapCell(item.description || "-", 1);
    // Dokumen lama menyimpan Add On di dalam baris. Nominal baris produk
    // dikurangi Add On legacy agar tidak tampil dobel saat ditampilkan terpisah.
    const legacyAddonTotal = (item.addons ?? []).reduce((sum, addon) => sum + Number(addon.unitAmount.toString()) * (addon.qty ?? item.quantity), 0);
    tableRows.push({
      cells: [
        productLines,
        descLines,
        [String(item.quantity)],
        [templateNumber(item.unitPrice.toString())],
        [templateNumber(item.discountAmount?.toString() ?? "0")],
        ["-"],
        [templateNumber(Number(item.total.toString()) - legacyAddonTotal)],
      ],
      lines: Math.max(productLines.length, descLines.length),
    });
  }
  const addonRows = [
    ...(invoice.addons ?? []),
    ...invoice.items.flatMap((item) => (item.addons ?? []).map((addon) => ({ ...addon, qty: addon.qty ?? item.quantity }))),
  ];
  for (const addon of addonRows) {
    const addonQty = addon.qty ?? 1;
    const addonTotal = Number(addon.unitAmount.toString()) * addonQty;
    const addonProductLines = wrapCell(addon.label, 0);
    const addonDescLines = wrapCell(addon.description?.trim() || "-", 1);
    tableRows.push({
      cells: [
        addonProductLines,
        addonDescLines,
        [String(addonQty)],
        [templateNumber(addon.unitAmount.toString())],
        ["-"],
        ["-"],
        [templateNumber(addonTotal)],
      ],
      lines: Math.max(addonProductLines.length, addonDescLines.length),
    });
  }
  drawTableHeader();
  tableRows.forEach((row) => {
    // Baris satu baris 22,05 pt; tiap baris tambahan menambah line-height 1,258.
    const rowHeight = row.lines > 1 ? 35.15 + (row.lines - 2) * ROW_LINE_HEIGHT : TABLE.rowHeight;
    if (y - rowHeight < MARGIN.bottom + 8) {
      addPage();
      drawTableHeader();
    }
    const rowTop = y;
    page.drawRectangle({ x: TABLE.x, y: rowTop - rowHeight, width: TABLE.width, height: rowHeight, color: COLOR.tableRowBg });
    // Teks diposisikan vertikal rata tengah pada barisnya.
    const blockTop = rowTop - (rowHeight - row.lines * ROW_LINE_HEIGHT) / 2;
    const firstBaseline = blockTop - (ROW_LINE_HEIGHT + FONT * 0.72) / 2;
    row.cells.forEach((cellLines, cellIndex) => {
      cellLines.forEach((line, lineIndex) => {
        drawTableCell(cellIndex, line, firstBaseline - lineIndex * ROW_LINE_HEIGHT, regular);
      });
    });
    drawCellSeparators(rowTop, rowHeight);
    y = rowTop - rowHeight;
  });

  // Halaman 2: kolom kiri Keterangan (dan S&K di bawahnya), kolom kanan blok total + tanda tangan.
  addPage();
  const pageTop = PAGE.height - MARGIN.topNext;
  const listFlow = makeFlow(pageTop);
  const listHeadingBaseline = listFlow.line(9, 0);
  const summaryFlow = makeFlow(pageTop);
  const summaryBaselines = [
    summaryFlow.line(9, 4.05),
    summaryFlow.line(9, 4.75),
    summaryFlow.line(9, 4.75),
    summaryFlow.line(9, 4.8),
    summaryFlow.line(9, 5),
  ];

  const settingPoints = assets.settingPoints ?? [];
  const keteranganPoints = settingPoints.filter((point) => point.section === "KETERANGAN");
  const syaratPoints = settingPoints.filter((point) => point.section === "SYARAT_KETENTUAN");
  const summaryRows: Array<{ label: string; value: string }> = [
    { label: "Subtotal", value: templateMoney(invoice.subtotal.toString()) },
    { label: "Pajak", value: templateMoney(invoice.taxAmount.toString()) },
    { label: "Total", value: templateMoney(invoice.total.toString()) },
    { label: "Lunas", value: totalPaid > 0 ? `Rp (${templateNumber(totalPaid)})` : templateMoney(0) },
  ];
  // Label rata kanan tepat di kiri kolom nilai, jadi lebar nilai diukur dulu.
  const valueWidth = Math.max(
    ...summaryRows.map((row) => bold.widthOfTextAtSize(row.value, FONT)),
    bold.widthOfTextAtSize(templateMoney(amountDue), FONT),
  );
  const labelsRight = VALUES_RIGHT - valueWidth - 7.5;
  summaryRows.forEach((row, index) => {
    y = summaryBaselines[index];
    page.drawText(safeText(row.label), { x: labelsRight - bold.widthOfTextAtSize(row.label, FONT), y, size: FONT, font: bold, color: COLOR.body });
    rightText(row.value, VALUES_RIGHT, FONT, bold, COLOR.body);
  });
  // Garis di atas baris total: hitam 367 px, 1 px, rata kanan blok nilai.
  y = summaryBaselines[3] - 17;
  page.drawLine({ start: { x: VALUES_RIGHT - TOTAL_RULE_WIDTH, y }, end: { x: VALUES_RIGHT, y }, thickness: 0.75, color: COLOR.black });
  y = summaryBaselines[4];
  page.drawText("Jumlah Tertagih:", { x: labelsRight - bold.widthOfTextAtSize("Jumlah Tertagih:", FONT), y, size: FONT, font: bold, color: COLOR.body });
  rightText(templateMoney(amountDue), VALUES_RIGHT, FONT, bold, COLOR.body);

  // Tanggal, gambar, dan nama tanda tangan.
  const signDate = signatureDate(issueDate);
  const signDateY = y - 27.65;
  page.drawText(signDate, { x: SIGN_CENTER - bold.widthOfTextAtSize(signDate, FONT) / 2, y: signDateY, size: FONT, font: bold, color: COLOR.body });
  const signatureTop = signDateY - 17.2;
  let signatureBottom = signatureTop;
  if (signature) {
    const scaled = signature.scaleToFit(assets.signatureMaxWidth ?? SIGNATURE_BOX.width, assets.signatureMaxHeight ?? SIGNATURE_BOX.height);
    page.drawImage(signature, { x: SIGN_CENTER - scaled.width / 2, y: signatureTop - scaled.height, width: scaled.width, height: scaled.height });
    signatureBottom = signatureTop - scaled.height;
  } else {
    signatureBottom = signatureTop - SIGNATURE_BOX.height;
  }
  if (invoice.snapshotSignatureName) {
    const signName = safeText(invoice.snapshotSignatureName).toUpperCase();
    page.drawText(signName, { x: SIGN_CENTER - bold.widthOfTextAtSize(signName, FONT) / 2, y: signatureBottom - 17.3, size: FONT, font: bold, color: COLOR.body });
  }

  // Blok Keterangan di kolom kiri, dimulai sejajar baris Subtotal di kolom kanan.
  y = listHeadingBaseline;
  if (keteranganPoints.length && y - pointListDrop(keteranganPoints, LEFT_COLUMN.width) < MARGIN.bottom + 8) addPage();
  drawPointList("Keterangan", keteranganPoints, LEFT_COLUMN.x, LEFT_COLUMN.width);
  // Syarat & Ketentuan melanjutkan di bawah kedua kolom, selebar kolom kiri.
  const blockBottom = Math.min(y, signatureBottom - 10.35);
  y = keteranganPoints.length ? blockBottom : listHeadingBaseline;
  if (syaratPoints.length) {
    y -= 10.35;
    if (y - pointListDrop(syaratPoints, LEFT_COLUMN.width) < MARGIN.bottom + 8) addPage();
    drawPointList("Syarat & Ketentuan", syaratPoints, LEFT_COLUMN.x, LEFT_COLUMN.width);
  }

  document.setTitle(`Invoice ${invoice.invoiceNo}`);
  document.setAuthor(invoice.snapshotBusinessName ?? "AS Konveksi");
  return document.save();
}
