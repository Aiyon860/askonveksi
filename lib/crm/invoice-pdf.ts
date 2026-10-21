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
    discountType?: string | null;
    discountPercent?: { toString(): string } | string | null;
    discountAmount?: { toString(): string } | string | null;
    total: { toString(): string };
    addons?: Array<{ label: string; description?: string | null; unitAmount: { toString(): string }; qty?: number }>;
  }>;
  salesOrder: { payment: { kind?: string; transactions: Array<{ amount: { toString(): string }; status: string }> } | null } | null;
};

const A4 = { width: 595.28, height: 841.89 };
const margin = 48;
const CONTENT_WIDTH = A4.width - margin * 2;

/** Biru judul dan nama pada template; navy untuk kepala tabel. */
const TEMPLATE_BLUE = rgb(0.12, 0.32, 0.64);
const TABLE_HEAD_BG = rgb(0.18, 0.24, 0.3);
const ZEBRA_BG = rgb(0.95, 0.96, 0.97);
const GRID_LINE = rgb(0.84, 0.84, 0.84);
const RULE_LINE = rgb(0.25, 0.25, 0.25);

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

/** Tanggal tanda tangan gaya template: 19 Sep, 2026. */
function signatureDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).formatToParts(value);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("day")} ${pick("month")}, ${pick("year")}`;
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

  function rightText(value: string, right: number, size = MIN_FONT_SIZE, font = regular, color = rgb(0.12, 0.12, 0.12)) {
    const safeValue = safeText(value);
    page.drawText(safeValue, { x: right - font.widthOfTextAtSize(safeValue, size), y, size, font, color });
  }

  /** Judul seksi bergaris bawah gaya template ("Info Perusahaan", "Keterangan", ...). */
  function sectionTitle(title: string, x: number, width: number, color = rgb(0.12, 0.12, 0.12)) {
    page.drawText(safeText(title), { x, y, size: MIN_FONT_SIZE, font: bold, color });
    y -= 6;
    page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 1, color: RULE_LINE });
    y -= 14;
  }

  /** Blok poin berurutan dari master "Pengaturan invoice" (tiap poin bisa bold). */
  function drawPointList(title: string, points: PdfInvoiceSettingPoint[], x = margin, width = CONTENT_WIDTH) {
    if (!points.length) return;
    ensure(70);
    sectionTitle(title, x, width);
    points.forEach((point, index) => {
      const font = point.isBold ? bold : regular;
      // Poin bisa multi-baris (textarea master): pecah manual per \n dulu, baru wrap tiap segmen.
      const lines = String(point.text ?? "").split(/\r?\n/).flatMap((segment) => wrap(segment, font, MIN_FONT_SIZE, width - 22));
      ensure(lines.length * 16 + 10);
      page.drawText(`${index + 1}.`, { x, y, size: MIN_FONT_SIZE, font: regular, color: rgb(0.4, 0.4, 0.4) });
      lines.forEach((line, lineIndex) => {
        page.drawText(line || " ", { x: x + 22, y: y - lineIndex * 16, size: MIN_FONT_SIZE, font, color: rgb(0.12, 0.12, 0.12) });
      });
      y -= lines.length * 16 + 6;
    });
    y -= 10;
  }

  const issueDate = invoice.issuedAt ?? invoice.createdAt;
  const totalPaid = invoice.salesOrder?.payment?.transactions.filter((item) => item.status === "ACTIVE").reduce((sum, item) => sum + Number(item.amount.toString()), 0) ?? 0;
  const amountDue = Math.max(0, Number(invoice.total.toString()) - totalPaid);

  addPage();
  if (invoice.status === "DRAFT") page.drawText("DRAFT", { x: 150, y: 370, size: 82, font: bold, color: rgb(0.9, 0.9, 0.9), rotate: degrees(35), opacity: 0.45 });

  // Kop: logo kiri, judul + blok referensi kanan.
  const scaledLogo = logo.scaleToFit(150, 52);
  const headerTop = y;
  page.drawImage(logo, { x: margin, y: y - scaledLogo.height, width: scaledLogo.width, height: scaledLogo.height });
  const headerRight = A4.width - margin;
  page.drawText("Invoice", { x: headerRight - bold.widthOfTextAtSize("Invoice", 20), y: y - 18, size: 20, font: bold, color: TEMPLATE_BLUE });
  y -= 34;
  const metaRows: Array<[string, string]> = [
    ["Referensi", safeText(invoice.invoiceNo)],
    ["Tanggal", slashDate(issueDate)],
    ["Tgl. Jatuh Tempo", slashDate(invoice.dueAt)],
  ];
  const metaValueWidth = Math.max(...metaRows.map(([, value]) => regular.widthOfTextAtSize(value, MIN_FONT_SIZE)));
  for (const [label, value] of metaRows) {
    rightText(value, headerRight, MIN_FONT_SIZE);
    const labelWidth = regular.widthOfTextAtSize(label, MIN_FONT_SIZE);
    page.drawText(safeText(label), { x: headerRight - metaValueWidth - 16 - labelWidth, y, size: MIN_FONT_SIZE, font: regular, color: rgb(0.35, 0.35, 0.35) });
    y -= 18;
  }
  y = Math.min(y, headerTop - scaledLogo.height) - 22;

  // Dua kolom info: perusahaan kiri, customer kanan.
  const infoGap = 24;
  const infoWidth = (CONTENT_WIDTH - infoGap) / 2;
  const customerX = margin + infoWidth + infoGap;
  const infoTop = y;
  let leftY = y;
  let rightY = y;
  const infoLines = (lines: string[], x: number, fromY: number, color = rgb(0.3, 0.3, 0.3)) => {
    let cursor = fromY;
    for (const line of lines) {
      page.drawText(line, { x, y: cursor, size: MIN_FONT_SIZE, font: regular, color });
      cursor -= 16;
    }
    return cursor;
  };
  page.drawText("Info Perusahaan", { x: margin, y: leftY, size: MIN_FONT_SIZE, font: bold });
  leftY -= 6;
  page.drawLine({ start: { x: margin, y: leftY }, end: { x: margin + infoWidth, y: leftY }, thickness: 1, color: RULE_LINE });
  leftY -= 16;
  page.drawText(clipPdfText(safeText(invoice.snapshotBusinessName ?? "AS Konveksi"), bold, MIN_FONT_SIZE, infoWidth), { x: margin, y: leftY, size: MIN_FONT_SIZE, font: bold, color: TEMPLATE_BLUE });
  leftY -= 18;
  const businessLines = [
    ...wrap(invoice.snapshotBusinessAddress ?? "-", regular, MIN_FONT_SIZE, infoWidth),
    `Telp: ${invoice.snapshotBusinessPhone ?? "-"}`,
    `Email: ${invoice.snapshotBusinessEmail ?? "-"}`,
  ];
  leftY = infoLines(businessLines, margin, leftY) - 4;
  page.drawText("Tagihan Untuk", { x: customerX, y: rightY, size: MIN_FONT_SIZE, font: bold });
  rightY -= 6;
  page.drawLine({ start: { x: customerX, y: rightY }, end: { x: customerX + infoWidth, y: rightY }, thickness: 1, color: RULE_LINE });
  rightY -= 16;
  const customerName = invoice.snapshotCompanyName ?? invoice.snapshotCustomerName;
  page.drawText(clipPdfText(safeText(customerName), bold, MIN_FONT_SIZE, infoWidth), { x: customerX, y: rightY, size: MIN_FONT_SIZE, font: bold, color: TEMPLATE_BLUE });
  rightY -= 18;
  rightY = infoLines([`Telp: ${invoice.snapshotWhatsapp ?? "-"}`], customerX, rightY) - 4;
  void infoTop;
  y = Math.min(leftY, rightY) - 16;

  // Tabel barang gaya template: kepala navy, baris zebra, garis antar kolom.
  // Teks panjang dibungkus ke bawah (wrap), bukan dipotong "...".
  const tableRight = A4.width - margin;
  const tableColumns = [
    { key: "product", label: "Produk", width: 80, align: "left" as const },
    { key: "description", label: "Deskripsi", width: 90, align: "left" as const },
    { key: "qty", label: "Qty", width: 32, align: "center" as const },
    { key: "price", label: "Harga", width: 80, align: "right" as const },
    { key: "disc", label: "Disc", width: 82, align: "center" as const },
    { key: "tax", label: "Pajak", width: 40, align: "center" as const },
    { key: "total", label: "Jumlah", width: CONTENT_WIDTH - 80 - 90 - 32 - 80 - 82 - 40, align: "right" as const },
  ];
  const TABLE_HEADER_HEIGHT = 24;
  const TABLE_ROW_MIN = 24;
  function columnX(index: number) {
    return margin + tableColumns.slice(0, index).reduce((sum, column) => sum + column.width, 0);
  }
  function drawTableGridlines(rowTop: number, rowHeight: number) {
    tableColumns.forEach((column, index) => {
      if (index === 0) return;
      const lineX = columnX(index);
      page.drawLine({ start: { x: lineX, y: rowTop }, end: { x: lineX, y: rowTop - rowHeight }, thickness: 0.5, color: GRID_LINE });
    });
  }
  function drawTableHeader() {
    ensure(TABLE_HEADER_HEIGHT + 8);
    page.drawRectangle({ x: margin, y: y - TABLE_HEADER_HEIGHT, width: CONTENT_WIDTH, height: TABLE_HEADER_HEIGHT, color: TABLE_HEAD_BG });
    tableColumns.forEach((column, index) => {
      const cellX = columnX(index);
      const label = clipPdfText(column.label, bold, MIN_FONT_SIZE, column.width - 8);
      const textWidth = bold.widthOfTextAtSize(label, MIN_FONT_SIZE);
      const textX = column.align === "left" ? cellX + 6 : column.align === "right" ? cellX + column.width - 6 - textWidth : cellX + (column.width - textWidth) / 2;
      page.drawText(label, { x: textX, y: y - TABLE_HEADER_HEIGHT + 6, size: MIN_FONT_SIZE, font: bold, color: rgb(1, 1, 1) });
    });
    y -= TABLE_HEADER_HEIGHT;
  }
  function drawTableCell(index: number, value: string, baselineY: number, font: PDFFont, color = rgb(0.12, 0.12, 0.12)) {
    const column = tableColumns[index];
    const cellX = columnX(index);
    const clipped = clipPdfText(safeText(value), font, MIN_FONT_SIZE, column.width - 10);
    const textWidth = font.widthOfTextAtSize(clipped, MIN_FONT_SIZE);
    const textX = column.align === "left" ? cellX + 6 : column.align === "right" ? cellX + column.width - 6 - textWidth : cellX + (column.width - textWidth) / 2;
    page.drawText(clipped, { x: textX, y: baselineY, size: MIN_FONT_SIZE, font, color });
  }
  type TableRow = { cells: string[][]; lines: number; addon: boolean };
  const tableRows: TableRow[] = [];
  const wrapCell = (value: string, columnIndex: number) => wrap(value || "-", regular, MIN_FONT_SIZE, tableColumns[columnIndex].width - 12);
  for (const item of invoice.items) {
    const productLines = wrapCell(item.productName ?? "-", 0);
    const descLines = wrapCell(item.description || "-", 1);
    tableRows.push({
      cells: [
        productLines,
        descLines,
        [String(item.quantity)],
        [templateNumber(item.unitPrice.toString())],
        [templateNumber(item.discountAmount?.toString() ?? "0")],
        ["-"],
        [templateNumber(item.total.toString())],
      ],
      lines: Math.max(productLines.length, descLines.length),
      addon: false,
    });
    for (const addon of item.addons ?? []) {
      const addonQty = addon.qty ?? item.quantity;
      const addonTotal = Number(addon.unitAmount.toString()) * addonQty;
      const addonProductLines = wrapCell(`+ ${addon.label}`, 0);
      const addonDescText = addon.description?.trim() || "-";
      const addonDescLines = wrapCell(addonDescText, 1);
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
        addon: true,
      });
    }
  }
  drawTableHeader();
  tableRows.forEach((row, rowIndex) => {
    const rowHeight = Math.max(TABLE_ROW_MIN, row.lines * 16 + 8);
    if (y - rowHeight < margin + 20) {
      addPage();
      drawTableHeader();
    }
    const rowTop = y;
    if (rowIndex % 2 === 1) page.drawRectangle({ x: margin, y: rowTop - rowHeight, width: CONTENT_WIDTH, height: rowHeight, color: ZEBRA_BG });
    page.drawRectangle({ x: margin, y: rowTop - rowHeight, width: CONTENT_WIDTH, height: rowHeight, borderWidth: 0.5, borderColor: GRID_LINE });
    drawTableGridlines(rowTop, rowHeight);
    const topPad = Math.max(4, (rowHeight - row.lines * 16) / 2);
    const firstBaseline = rowTop - topPad - 12;
    const middleBaseline = rowTop - rowHeight / 2 - 4;
    const gray = row.addon ? rgb(0.35, 0.35, 0.35) : undefined;
    row.cells.forEach((cellLines, cellIndex) => {
      if (cellIndex <= 1) {
        cellLines.forEach((line, lineIndex) => {
          drawTableCell(cellIndex, line, firstBaseline - lineIndex * 16, regular, gray);
        });
        return;
      }
      drawTableCell(cellIndex, cellLines[0] ?? "", middleBaseline, regular, gray);
    });
    y = rowTop - rowHeight;
  });

  // Halaman ringkasan gaya template: Keterangan kiri, angka kanan.
  addPage();
  const summaryWidth = 218;
  const summaryX = A4.width - margin - summaryWidth;
  const listWidth = summaryX - margin - 20;
  const summaryTop = y;
  const settingPoints = assets.settingPoints ?? [];
  drawPointList("Keterangan", settingPoints.filter((point) => point.section === "KETERANGAN"), margin, listWidth);
  const listBottom = y;
  y = summaryTop;
  const summaryRows: Array<{ label: string; value: string; bold?: boolean }> = [
    { label: "Subtotal", value: templateMoney(invoice.subtotal.toString()) },
    { label: "Pajak", value: templateMoney(invoice.taxAmount.toString()) },
    { label: "Total", value: templateMoney(invoice.total.toString()) },
    { label: "Lunas", value: totalPaid > 0 ? `Rp (${templateNumber(totalPaid)})` : templateMoney(0) },
  ];
  for (const row of summaryRows) {
    page.drawText(safeText(row.label), { x: summaryX, y, size: MIN_FONT_SIZE, font: row.bold ? bold : regular });
    rightText(row.value, tableRight, MIN_FONT_SIZE, row.bold ? bold : regular);
    y -= 18;
  }
  // Garis di atas baris total dengan jeda cukup supaya tidak menimpa huruf.
  y -= 4;
  page.drawLine({ start: { x: summaryX, y }, end: { x: tableRight, y }, thickness: 1, color: RULE_LINE });
  y -= 18;
  page.drawText("Jumlah Tertagih:", { x: summaryX, y, size: MIN_FONT_SIZE, font: bold });
  rightText(templateMoney(amountDue), tableRight, MIN_FONT_SIZE, bold);
  y -= 26;
  // Tanda tangan di tengah kolom angka: tanggal, gambar, nama terang.
  const signCenter = summaryX + summaryWidth / 2;
  const signDate = signatureDate(issueDate);
  page.drawText(signDate, { x: signCenter - regular.widthOfTextAtSize(signDate, MIN_FONT_SIZE) / 2, y, size: MIN_FONT_SIZE, font: regular });
  y -= 14;
  if (signature) {
    const scaled = signature.scaleToFit(450, 138);
    page.drawImage(signature, { x: signCenter - scaled.width / 2, y: y - scaled.height, width: scaled.width, height: scaled.height });
    y -= scaled.height + 12;
  } else {
    y -= 34;
  }
  if (invoice.snapshotSignatureName) {
    const signName = safeText(invoice.snapshotSignatureName).toUpperCase();
    page.drawText(signName, { x: signCenter - bold.widthOfTextAtSize(signName, MIN_FONT_SIZE) / 2, y, size: MIN_FONT_SIZE, font: bold });
    y -= 16;
  }
  y = Math.min(y, listBottom) - 10;
  // Syarat & Ketentuan selebar kolom kiri saja (separuh halaman) seperti template.
  drawPointList("Syarat & Ketentuan", settingPoints.filter((point) => point.section === "SYARAT_KETENTUAN"), margin, listWidth);

  document.setTitle(`Invoice ${invoice.invoiceNo}`);
  document.setAuthor(invoice.snapshotBusinessName ?? "AS Konveksi");
  return document.save();
}
