import "server-only";

import type { GarmentType } from "@prisma/client";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import type { Brand } from "@/lib/brand/config";
import { DEFAULT_BRAND } from "@/lib/brand/config";
import { decorationMethodsLabel, GARMENT_TYPE_LABEL } from "@/lib/crm/constants";
import { MIN_FONT_SIZE, clipPdfText, wrapPdfText } from "@/lib/crm/pdf-typography";
import { normalizeGarmentSizeName, sortGarmentSizeNames } from "@/lib/crm/size-aliases";

export type PurchaseOrderPdfVariant = "customer" | "penjahit";

type PurchaseOrderPdfData = {
  purchaseOrderNo: string;
  customerReference: string | null;
  revision: number;
  status: string;
  productName: string;
  instansi: string | null;
  pola: string | null;
  garmentType: GarmentType | null;
  productCategory: string | null;
  material: string;
  baseColor: string | null;
  color: string | null;
  variationColor: string | null;
  decorationMethod: string | null;
  decorationMethods: string[];
  orderDate: Date | null;
  deadline: Date | null;
  sampleSize: string | null;
  designNotes: string | null;
  notes: string | null;
  snapshotBusinessName: string | null;
  snapshotBusinessPhone: string | null;
  snapshotBusinessEmail: string | null;
  snapshotBusinessAddress: string | null;
  opportunity: { customer: { name: string; companyName: string | null } };
  items: Array<{ id: string; name: string; pola: string | null; baseColor: string | null; variationColor: string | null; garmentType: GarmentType | null; decorationMethods: string[]; designNotes: string | null; penjahitDeadline: Date | null; productCategory: { name: string } | null }>;
  sizes: Array<{ itemId: string; size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>;
  rosterEntries: Array<{ itemId: string; memberId: string; name: string; jabatan?: string | null; size: string; sleeveLength: "PENDEK" | "PANJANG" }>;
};

type PurchaseOrderPdfItem = PurchaseOrderPdfData["items"][number];

// `itemId` mengikat gambar ke produknya; lampiran PO tanpa `itemId` (mis. bukti) tampil di lembar ringkasan.
type PdfAsset = { kind: string; label: string; originalName: string; contentType: string; bytes: Uint8Array; itemId?: string | null };
const A4 = { width: 595.28, height: 841.89 };
const margin = 36;
const CONTENT_WIDTH = A4.width - margin * 2;
/** Sel logo di kiri tabel identitas; dua kolom data mengikuti proporsi gambar referensi. */
const HEADER_LOGO_CELL_WIDTH = 116;
const HEADER_LEFT_DATA_WIDTH = 226;
const HEADER_RIGHT_DATA_WIDTH = CONTENT_WIDTH - HEADER_LOGO_CELL_WIDTH - HEADER_LEFT_DATA_WIDTH;
const HEADER_DATA_COLUMN_WIDTHS = [HEADER_LEFT_DATA_WIDTH, HEADER_RIGHT_DATA_WIDTH] as const;
const HEADER_CELL_PADDING = 8;
const HEADER_BULLET_INDENT = 8;
const HEADER_ROW_MIN_HEIGHT = 34;
const HEADER_LINE_HEIGHT = 15;
const HEADER_POLA_ROW_HEIGHT = 32;
const TABLE_ROW_HEIGHT = 26;
const HEADING_BAR_HEIGHT = 26;
/** Baris roster per halaman A4; sisanya lanjut ke halaman berikutnya. */
const ROSTER_ROWS_PER_PAGE = 25;

/**
 * Daftar ukuran tetap pada size chart: semua kolom selalu dicetak lengkap walau PO
 * tidak memesan ukuran tersebut (qty 0 tetap tampil). Ukuran di luar daftar ini
 * (mis. 5XL/7XL/10XL) tetap ditambahkan dan diurutkan sebelum REQ.
 */
const SIZE_LADDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "REQ"] as const;

function normalizeSize(name: string) {
  return normalizeGarmentSizeName(name);
}

function safe(value: string) {
  // Tanda hubung panjang (—) WinAnsi valid, tapi lolos dari filter karakter → ubah dulu agar jadi "-".
  return value.replace(/[\r\n\t]+/g, " ").replace(/—/g, "-").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

/** Format tanggal PO memakai nama hari, mis. "Sabtu, 29 Agustus 2026". */
function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(value) : "-";
}

/** Merah penyorot baris "Deadline" — selalu dipakai agar deadline ter-highlight. */
const DEADLINE_RED = rgb(0.78, 0.12, 0.12);
const BORDER = rgb(0.12, 0.12, 0.12);
const GRID = rgb(0.72, 0.72, 0.72);
const NOTE_BG = rgb(0.9, 0.9, 0.9);
/** Askonveksi: navy gelap. SAGA: hijau army. */
const BRAND_BAR_BG = {
  ASKONVEKSI: rgb(0.12, 0.16, 0.2),
  SAGA: rgb(0.22, 0.3, 0.18),
} as const;

/** Sel tabel identitas: satu baris "Label : nilai", atau label + daftar bullet warna & baris Variasi. */
type HeaderCell = {
  label: string;
  value?: string;
  bullets?: string[];
  footerLine?: string;
  highlight?: boolean;
};

type HeaderLine = { indent?: number; runs: Array<{ text: string; bold: boolean }> };

export async function createPurchaseOrderPdf(
  data: PurchaseOrderPdfData,
  logoBytes: Uint8Array,
  assets: PdfAsset[],
  variant: PurchaseOrderPdfVariant = "customer",
  brand: Brand = DEFAULT_BRAND,
) {
  /**
   * Nomor PO yang dicetak: tanpa akhiran revisi (`-R2`, `-R3`, ...). Revisi tetap
   * tercatat di sistem (riwayat dokumen, audit, judul UI) tetapi tidak dicetak
   * pada dokumen customer maupun penjahit.
   */
  const documentNo = data.purchaseOrderNo.replace(/-R\d+$/i, "");
  const BAR_BG = BRAND_BAR_BG[brand];
  const poDecoration = data.decorationMethods.length
    ? data.decorationMethods
    : data.decorationMethod
      ? [data.decorationMethod]
      : [];
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logo = await document.embedPng(logoBytes);
  const embeddedAssets: Array<PdfAsset & { image: PDFImage | null }> = [];
  for (const asset of assets) {
    try {
      const image = asset.contentType === "image/png" ? await document.embedPng(asset.bytes) : asset.contentType === "image/jpeg" ? await document.embedJpg(asset.bytes) : null;
      embeddedAssets.push({ ...asset, image });
    } catch {
      embeddedAssets.push({ ...asset, image: null });
    }
  }

  function decorate(page: PDFPage, pageNumber: number) {
    const footer = `${safe(documentNo)} | Halaman ${pageNumber}`;
    page.drawText(safe(data.snapshotBusinessName ?? "AS Konveksi"), { x: margin, y: 22, size: MIN_FONT_SIZE, font: regular, color: rgb(0.42, 0.42, 0.42) });
    page.drawText(footer, { x: A4.width - margin - regular.widthOfTextAtSize(footer, MIN_FONT_SIZE), y: 22, size: MIN_FONT_SIZE, font: regular, color: rgb(0.42, 0.42, 0.42) });
    if (data.status === "DRAFT") page.drawText("DRAFT", { x: 155, y: 370, size: 82, font: bold, color: rgb(0.9, 0.9, 0.9), rotate: degrees(35), opacity: 0.45 });
  }

  let pageNumber = 1;
  let page = document.addPage([A4.width, A4.height]);
  decorate(page, pageNumber);
  let y = A4.height - margin;
  // Halaman yang benar-benar dipakai; sisanya (hanya footer) dibuang di akhir.
  const usedPages = new Set<PDFPage>();
  function markUsed() {
    usedPages.add(page);
  }
  // Halaman pertama selalu terpakai karena memuat kop dan judul.
  markUsed();

  function addPage() {
    pageNumber += 1;
    page = document.addPage([A4.width, A4.height]);
    decorate(page, pageNumber);
    y = A4.height - margin;
  }

  /** Titik tengah vertikal sel supaya teks 12 pt terlihat pas di tengah baris. */
  function cellBaseline(rowTop: number, rowHeight: number) {
    return rowTop - rowHeight / 2 - 4;
  }

  function centeredText(value: string, x: number, width: number, rowTop: number, rowHeight: number, font: PDFFont, color = rgb(0.12, 0.12, 0.12)) {
    page.drawText(value, { x: x + (width - font.widthOfTextAtSize(value, MIN_FONT_SIZE)) / 2, y: cellBaseline(rowTop, rowHeight), size: MIN_FONT_SIZE, font, color });
  }

  /** Bar judul gelap selebar konten, mis. "JUMLAH PRODUK" pada lembar aksesori. */
  function drawHeadingBar(label: string) {
    markUsed();
    page.drawRectangle({ x: margin, y: y - HEADING_BAR_HEIGHT, width: CONTENT_WIDTH, height: HEADING_BAR_HEIGHT, color: BAR_BG });
    page.drawText(clipPdfText(safe(label.toUpperCase()), bold, MIN_FONT_SIZE, CONTENT_WIDTH - 16), {
      x: margin + 8,
      y: y - HEADING_BAR_HEIGHT + 8,
      size: MIN_FONT_SIZE,
      font: bold,
      color: rgb(1, 1, 1),
    });
    y -= HEADING_BAR_HEIGHT;
  }

  /** Isi satu sel tabel identitas menjadi baris-baris siap gambar (dipotong sesuai lebar kolom). */
  function cellLines(cell: HeaderCell, maxWidth: number): HeaderLine[] {
    const hasMultilineColor = Boolean(cell.bullets?.length || cell.footerLine);
    if (!hasMultilineColor) {
      return wrapPdfText(safe(`${cell.label} : ${cell.value ?? "-"}`), cell.highlight ? bold : regular, MIN_FONT_SIZE, maxWidth)
        .slice(0, 2)
        .map((line) => ({ runs: [{ text: line, bold: false }] }));
    }
    const lines: HeaderLine[] = [{ runs: [{ text: `${safe(cell.label)} :`, bold: false }] }];
    const bulletWidth = Math.max(20, maxWidth - HEADER_BULLET_INDENT);
    for (const item of cell.bullets ?? []) {
      const bulletPrefix = "\u2022 ";
      const textWidth = Math.max(20, bulletWidth - regular.widthOfTextAtSize(bulletPrefix, MIN_FONT_SIZE));
      lines.push({
        indent: HEADER_BULLET_INDENT,
        runs: [{ text: `${bulletPrefix}${clipPdfText(safe(item), regular, MIN_FONT_SIZE, textWidth)}`, bold: false }],
      });
    }
    if (cell.footerLine) {
      lines.push({
        runs: [{ text: clipPdfText(safe(cell.footerLine), regular, MIN_FONT_SIZE, maxWidth), bold: false }],
      });
    }
    return lines;
  }

  /**
   * Kop ringkas 1:1 sesuai referensi: sel logo di kiri + tabel dua kolom tiga baris
   * (Nama/Bahan · Tgl Order/Warna · Deadline/Tinta-Bordir) + baris POLA menyatu di bawahnya.
   */
  function drawSheetHeader(item: PurchaseOrderPdfItem | null, freshPage: boolean) {
    if (freshPage) addPage();
    markUsed();
    const title = variant === "penjahit" ? "PURCHASE ORDER — PENJAHIT" : "PURCHASE ORDER";
    page.drawText(title, { x: margin, y: y - 12, size: 14, font: bold, color: rgb(0.12, 0.12, 0.12) });
    // Nomor PO saja — kata "Revisi" sengaja tidak dicetak (keputusan Owner).
    const meta = safe(documentNo);
    page.drawText(meta, { x: A4.width - margin - regular.widthOfTextAtSize(meta, MIN_FONT_SIZE), y: y - 12, size: MIN_FONT_SIZE, font: regular, color: rgb(0.3, 0.3, 0.3) });
    y -= 26;
    if (item) {
      page.drawText(clipPdfText(`Produk: ${safe(item.name)}`, regular, MIN_FONT_SIZE, CONTENT_WIDTH), { x: margin, y, size: MIN_FONT_SIZE, font: regular, color: rgb(0.3, 0.3, 0.3) });
      y -= 18;
    }

    const decoration = item?.decorationMethods.length ? item.decorationMethods : poDecoration;
    // Warna mengikuti produk: satu PO boleh memuat beberapa warna berbeda.
    // PO lama (item tanpa warna) jatuh ke kolom warna header supaya PDF lama tidak berubah.
    const colorItem = item ?? (data.items.length === 1 ? data.items[0] : null);
    const baseColor = colorItem?.baseColor ?? data.baseColor ?? data.color;
    const variationColor = colorItem?.variationColor ?? data.variationColor;
    const baseColorBullets = (baseColor ?? "")
      .split(/[,;\r\n]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    const trimmedVariation = variationColor?.trim() || "";

    // Varian penjahit (Sprint 11 R3): sel Deadline hanya berisi deadline penjahit per item
    // (null tampil "-"); lembar tunggal memakai satu-satunya produk. Varian customer tetap deadline PO.
    const penjahitItem = item ?? (variant === "penjahit" && data.items.length === 1 ? data.items[0] : null);
    const deadlineCell: HeaderCell =
      variant === "penjahit"
        ? { label: "Deadline", value: formatDate(penjahitItem?.penjahitDeadline ?? null), highlight: true }
        : { label: "Deadline", value: formatDate(data.deadline), highlight: true };

    const rows: [HeaderCell, HeaderCell][] = [
      [
        { label: "Nama", value: data.opportunity.customer.name },
        { label: "Bahan", value: data.material },
      ],
      [
        { label: "Tgl Order", value: formatDate(data.orderDate) },
        {
          label: "Warna",
          bullets: baseColorBullets,
          footerLine: trimmedVariation ? `Variasi: ${trimmedVariation}` : undefined,
        },
      ],
      [
        deadlineCell,
        { label: "Tinta / Bordir", value: decorationMethodsLabel(decoration) || "-" },
      ],
    ];

    const cellLinesByRow = rows.map((row) =>
      row.map((cell, columnIndex) => cellLines(cell, HEADER_DATA_COLUMN_WIDTHS[columnIndex] - HEADER_CELL_PADDING * 2)),
    );
    // Tinggi tiap baris mengikuti isinya (minimal 34 pt) supaya kop tetap ringkas.
    const rowHeights = cellLinesByRow.map((cells) => Math.max(HEADER_ROW_MIN_HEIGHT, ...cells.map((lines) => lines.length * HEADER_LINE_HEIGHT + 14)));
    const tableHeight = rowHeights.reduce((sum, height) => sum + height, 0);
    if (y - tableHeight - HEADER_POLA_ROW_HEIGHT - 18 < margin) {
      addPage();
      markUsed();
    }
    const tableTop = y;
    const tableBottom = tableTop - tableHeight;
    const rowTops: number[] = [];
    let cursorTop = tableTop;
    for (const height of rowHeights) {
      rowTops.push(cursorTop);
      cursorTop -= height;
    }

    page.drawRectangle({ x: margin, y: tableBottom, width: HEADER_LOGO_CELL_WIDTH, height: tableHeight, borderWidth: 0.8, borderColor: BORDER });
    const logoScale = logo.scaleToFit(HEADER_LOGO_CELL_WIDTH - 16, tableHeight - 20);
    page.drawImage(logo, {
      x: margin + (HEADER_LOGO_CELL_WIDTH - logoScale.width) / 2,
      y: tableBottom + (tableHeight - logoScale.height) / 2,
      width: logoScale.width,
      height: logoScale.height,
    });

    rows.forEach((row, rowIndex) => {
      const rowTop = rowTops[rowIndex];
      const rowHeight = rowHeights[rowIndex];
      const rowBottom = rowTop - rowHeight;
      let cellX = margin + HEADER_LOGO_CELL_WIDTH;
      row.forEach((cell, columnIndex) => {
        const cellWidth = HEADER_DATA_COLUMN_WIDTHS[columnIndex];
        page.drawRectangle({ x: cellX, y: rowBottom, width: cellWidth, height: rowHeight, borderWidth: 0.8, borderColor: BORDER });
        const lines = cellLinesByRow[rowIndex][columnIndex];
        const offset = Math.max(4, (rowHeight - lines.length * HEADER_LINE_HEIGHT) / 2);
        lines.forEach((line, lineIndex) => {
          let cursorX = cellX + HEADER_CELL_PADDING + (line.indent ?? 0);
          const lineY = rowTop - offset - 12 - lineIndex * HEADER_LINE_HEIGHT;
          for (const run of line.runs) {
            const font = cell.highlight || run.bold ? bold : regular;
            page.drawText(run.text, { x: cursorX, y: lineY, size: MIN_FONT_SIZE, font, color: cell.highlight ? DEADLINE_RED : rgb(0.12, 0.12, 0.12) });
            cursorX += font.widthOfTextAtSize(run.text, MIN_FONT_SIZE);
          }
        });
        cellX += cellWidth;
      });
    });

    // Judul POLA menyatu langsung di bawah tabel identitas (tanpa jeda) sesuai gambar referensi.
    const sheetPola = item?.pola || data.pola || data.productName;
    const polaText = clipPdfText(`POLA : ${safe(sheetPola.toUpperCase())}`, bold, 13, CONTENT_WIDTH - 24);
    const polaBottom = tableBottom - HEADER_POLA_ROW_HEIGHT;
    page.drawRectangle({ x: margin, y: polaBottom, width: CONTENT_WIDTH, height: HEADER_POLA_ROW_HEIGHT, borderWidth: 0.8, borderColor: BORDER, color: rgb(1, 1, 1) });
    page.drawText(polaText, { x: (A4.width - bold.widthOfTextAtSize(polaText, 13)) / 2, y: polaBottom + (HEADER_POLA_ROW_HEIGHT - 10) / 2, size: 13, font: bold, color: rgb(0.12, 0.12, 0.12) });
    y = polaBottom - 12;
  }

  /**
   * Gambar desain. `reservedBelow` menahan ruang untuk tabel ukuran supaya size chart
   * tetap dapat halaman yang sama (gambar dikecilkan bila perlu, sisanya pindah halaman).
   */
  function drawAssets(list: typeof embeddedAssets, heading: string | null, reservedBelow = 0) {
    if (!list.length) return;
    const boxWidth = CONTENT_WIDTH;
    let reserve = reservedBelow;
    for (const asset of list) {
      let boxHeight = 300;
      const available = y - (margin + 18) - reserve;
      if (available < boxHeight + 6) {
        if (reserve > 0 && available >= 156) {
          boxHeight = available - 6;
        } else {
          addPage();
          reserve = 0;
          boxHeight = 300;
          if (heading) {
            drawHeadingBar(heading);
            y -= 12;
          }
        }
      }
      const boxY = y - boxHeight;
      markUsed();
      page.drawRectangle({ x: margin, y: boxY, width: boxWidth, height: boxHeight, borderWidth: 0.75, borderColor: rgb(0.68, 0.68, 0.68) });
      if (asset.image) {
        const scaled = asset.image.scaleToFit(boxWidth - 12, boxHeight - 30);
        page.drawImage(asset.image, { x: margin + (boxWidth - scaled.width) / 2, y: boxY + 6, width: scaled.width, height: scaled.height });
      } else {
        page.drawText(asset.contentType === "application/pdf" ? "Lampiran PDF" : "Pratinjau tidak tersedia", { x: margin + 8, y: boxY + 44, size: MIN_FONT_SIZE, font: regular, color: rgb(0.42, 0.42, 0.42) });
        page.drawText(clipPdfText(safe(asset.originalName), regular, MIN_FONT_SIZE, boxWidth - 16), { x: margin + 8, y: boxY + 24, size: MIN_FONT_SIZE, font: regular, color: rgb(0.42, 0.42, 0.42) });
      }
      page.drawText(clipPdfText(safe(asset.label), bold, MIN_FONT_SIZE, boxWidth - 16), { x: margin + 8, y: boxY + boxHeight - 20, size: MIN_FONT_SIZE, font: bold });
      y -= boxHeight + 6;
    }
    y -= 4;
  }

  const isAccessory = data.garmentType === "AKSESORI";
  const totalQuantity = data.sizes.reduce((sum, item) => sum + item.quantity, 0);

  const SIZE_CHART_LABEL_WIDTH = 76;
  /** Cukup lebar untuk header "SUBTOTAL" pada blok lanjutan. */
  const SIZE_CHART_TOTAL_WIDTH = 70;
  const SIZE_CHART_NOTE_HEIGHT = 34;
  /** Label bagian di atas tabel saat kolom ukuran harus dipecah beberapa blok. */
  const SIZE_CHART_CAPTION_HEIGHT = 18;
  /** Lebar minimum kolom ukuran supaya label seperti "2XL"/"6XL" tidak terpotong. */
  const SIZE_CHART_MIN_CELL_WIDTH = 30;

  /**
   * Kolom size chart: daftar ukuran tetap (XS…4XL + REQ) selalu lengkap, ditambah
   * ukuran di luar daftar itu bila PO memakainya. Urutan mengikuti tangga baku
   * (custom N-XL sebelum REQ) supaya kolom kanan bisa 5XL/7XL/10XL lalu REQ.
   */
  function chartColumns(rows: Array<{ size: string; quantity: number }>) {
    const extras = [...new Set(rows.map((row) => normalizeSize(row.size)))]
      .filter((size) => size.length > 0 && !(SIZE_LADDER as readonly string[]).includes(size));
    return sortGarmentSizeNames([...SIZE_LADDER, ...extras]);
  }

  /** Lebar kolom yang dibutuhkan label terpanjang pada daftar ukuran (mis. "ALL SIZE"). */
  function chartCellWidth(columns: string[]) {
    const widest = Math.max(0, ...columns.map((column) => bold.widthOfTextAtSize(safe(column), MIN_FONT_SIZE)));
    return Math.max(SIZE_CHART_MIN_CELL_WIDTH, widest + 8);
  }

  /**
   * Bagi kolom ukuran menjadi beberapa blok hanya bila tidak muat satu baris. Pembagian
   * dibuat seimbang (mis. 14 ukuran → 7 + 7) supaya tidak ada blok berisi satu kolom saja.
   */
  function chartChunks(rows: Array<{ size: string; quantity: number }>) {
    const columns: string[] = chartColumns(rows);
    const available = CONTENT_WIDTH - SIZE_CHART_LABEL_WIDTH - SIZE_CHART_TOTAL_WIDTH;
    const perBlock = Math.max(1, Math.floor(available / chartCellWidth(columns)));
    const blockCount = Math.ceil(columns.length / perBlock);
    const perChunk = Math.ceil(columns.length / blockCount);
    const chunks: string[][] = [];
    for (let index = 0; index < columns.length; index += perChunk) chunks.push(columns.slice(index, index + perChunk));
    return chunks;
  }

  /**
   * Tinggi satu blok size chart: label bagian (bila dipecah), header, PENDEK, PANJANG,
   * dan baris NOTE yang hanya muncul sekali di blok terakhir.
   */
  function chartBlockHeight(blockIndex: number, blockCount: number) {
    const caption = blockCount > 1 ? SIZE_CHART_CAPTION_HEIGHT : 0;
    const note = blockIndex === blockCount - 1 ? SIZE_CHART_NOTE_HEIGHT : 0;
    return caption + TABLE_ROW_HEIGHT * 3 + note + 12;
  }

  /** Tinggi tabel ukuran untuk menahan ruang di halaman yang sama dengan gambar desain. */
  function measureModelTable(rows: Array<{ size: string; quantity: number }>) {
    const chunks = chartChunks(rows);
    return chunks.reduce((sum, _chunk, index) => sum + chartBlockHeight(index, chunks.length), 0);
  }

  /**
   * Size chart sesuai referensi: kolom label gelap (SIZE/PENDEK/PANJANG), kolom ukuran
   * di header gelap, total per baris, lalu baris NOTE dengan kotak total di kanan.
   */
  function drawModelTable(rows: Array<{ size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>, note: string | null) {
    const grandTotal = rows.reduce((sum, row) => sum + row.quantity, 0);
    const quantityFor = (size: string, sleeve: "PENDEK" | "PANJANG") =>
      rows.filter((row) => normalizeSize(row.size) === size && row.sleeveLength === sleeve).reduce((sum, row) => sum + row.quantity, 0);

    const chunks = chartChunks(rows);
    for (const [blockIndex, sizeChunk] of chunks.entries()) {
      const isLastBlock = blockIndex === chunks.length - 1;
      if (y - chartBlockHeight(blockIndex, chunks.length) < margin) addPage();
      markUsed();
      const cellWidth = (CONTENT_WIDTH - SIZE_CHART_LABEL_WIDTH - SIZE_CHART_TOTAL_WIDTH) / sizeChunk.length;
      const totalX = margin + CONTENT_WIDTH - SIZE_CHART_TOTAL_WIDTH;
      let rowTop = y;
      // Saat kolom tidak muat satu baris, tiap blok diberi nomor bagian agar jelas berlanjut.
      if (chunks.length > 1) {
        const caption = `TABEL UKURAN — BAGIAN ${blockIndex + 1} DARI ${chunks.length}`;
        page.drawText(clipPdfText(caption, bold, MIN_FONT_SIZE, CONTENT_WIDTH), { x: margin, y: rowTop - 13, size: MIN_FONT_SIZE, font: bold, color: rgb(0.42, 0.42, 0.42) });
        rowTop -= SIZE_CHART_CAPTION_HEIGHT;
      }

      const labelCell = (text: string) => {
        page.drawRectangle({ x: margin, y: rowTop - TABLE_ROW_HEIGHT, width: SIZE_CHART_LABEL_WIDTH, height: TABLE_ROW_HEIGHT, color: BAR_BG });
        centeredText(text, margin, SIZE_CHART_LABEL_WIDTH, rowTop, TABLE_ROW_HEIGHT, bold, rgb(1, 1, 1));
      };
      const sizeCell = (text: string, index: number) => {
        page.drawRectangle({ x: margin + SIZE_CHART_LABEL_WIDTH + index * cellWidth, y: rowTop - TABLE_ROW_HEIGHT, width: cellWidth, height: TABLE_ROW_HEIGHT, color: BAR_BG });
        centeredText(clipPdfText(text, bold, MIN_FONT_SIZE, cellWidth - 8), margin + SIZE_CHART_LABEL_WIDTH + index * cellWidth, cellWidth, rowTop, TABLE_ROW_HEIGHT, bold, rgb(1, 1, 1));
      };

      // Baris header: SIZE | kolom ukuran | TOTAL (blok antara memakai SUBTOTAL).
      labelCell("SIZE");
      sizeChunk.forEach((size, index) => sizeCell(safe(size), index));
      page.drawRectangle({ x: totalX, y: rowTop - TABLE_ROW_HEIGHT, width: SIZE_CHART_TOTAL_WIDTH, height: TABLE_ROW_HEIGHT, color: BAR_BG });
      centeredText(isLastBlock ? "TOTAL" : "SUBTOTAL", totalX, SIZE_CHART_TOTAL_WIDTH, rowTop, TABLE_ROW_HEIGHT, bold, rgb(1, 1, 1));
      rowTop -= TABLE_ROW_HEIGHT;

      for (const sleeve of ["PENDEK", "PANJANG"] as const) {
        labelCell(sleeve);
        let total = 0;
        sizeChunk.forEach((size, index) => {
          const quantity = quantityFor(size, sleeve);
          total += quantity;
          const cellX = margin + SIZE_CHART_LABEL_WIDTH + index * cellWidth;
          page.drawRectangle({ x: cellX, y: rowTop - TABLE_ROW_HEIGHT, width: cellWidth, height: TABLE_ROW_HEIGHT, borderWidth: 0.6, borderColor: GRID });
          if (quantity > 0) centeredText(clipPdfText(String(quantity), bold, MIN_FONT_SIZE, cellWidth - 8), cellX, cellWidth, rowTop, TABLE_ROW_HEIGHT, bold);
        });
        page.drawRectangle({ x: totalX, y: rowTop - TABLE_ROW_HEIGHT, width: SIZE_CHART_TOTAL_WIDTH, height: TABLE_ROW_HEIGHT, borderWidth: 0.6, borderColor: GRID });
        centeredText(String(total), totalX, SIZE_CHART_TOTAL_WIDTH, rowTop, TABLE_ROW_HEIGHT, bold);
        rowTop -= TABLE_ROW_HEIGHT;
      }

      // Baris NOTE + kotak total keseluruhan — hanya sekali, di blok terakhir.
      if (!isLastBlock) {
        y = rowTop - 12;
        continue;
      }
      const noteHeight = SIZE_CHART_NOTE_HEIGHT;
      const noteWidth = CONTENT_WIDTH - SIZE_CHART_TOTAL_WIDTH;
      page.drawRectangle({ x: margin, y: rowTop - noteHeight, width: noteWidth, height: noteHeight, color: NOTE_BG, borderWidth: 0.8, borderColor: BORDER });
      page.drawText("NOTE:", { x: margin + 8, y: cellBaseline(rowTop, noteHeight), size: MIN_FONT_SIZE, font: bold });
      if (note) {
        const noteText = clipPdfText(safe(note), regular, MIN_FONT_SIZE, noteWidth - 70);
        page.drawText(noteText, { x: margin + 62, y: cellBaseline(rowTop, noteHeight), size: MIN_FONT_SIZE, font: regular, color: rgb(0.28, 0.28, 0.28) });
      }
      page.drawRectangle({ x: totalX, y: rowTop - noteHeight, width: SIZE_CHART_TOTAL_WIDTH, height: noteHeight, borderWidth: 0.8, borderColor: BORDER });
      page.drawText(String(grandTotal), { x: totalX + (SIZE_CHART_TOTAL_WIDTH - bold.widthOfTextAtSize(String(grandTotal), 13)) / 2, y: cellBaseline(rowTop, noteHeight) - 1, size: 13, font: bold });
      y = rowTop - noteHeight - 12;
    }
  }

  /**
   * Catatan NOTE untuk satu produk: catatan produk selalu menang. Catatan desain umum
   * hanya dipakai sebagai fallback untuk data lama yang catatan produknya kosong.
   */
  function noteFor(item: PurchaseOrderPdfItem | undefined) {
    return item?.designNotes?.trim() || data.designNotes;
  }

  /**
   * Lembar aksesori hanya memuat jumlah produk. Catatan desain dicetak sebagai baris
   * NOTE tepat di bawah angka jumlah, mengikuti gaya baris NOTE pada size chart.
   */
  function drawAccessoryTotal(quantity: number, label: string | null, note: string | null) {
    // Sisakan ruang untuk bar judul, kotak jumlah, dan baris NOTE agar tidak
    // melewati dasar halaman.
    if (y < margin + (note ? 130 : 90)) addPage();
    markUsed();
    drawHeadingBar(label ?? "JUMLAH PRODUK");
    y -= 12;
    page.drawRectangle({ x: margin, y: y - TABLE_ROW_HEIGHT, width: CONTENT_WIDTH, height: TABLE_ROW_HEIGHT, borderWidth: 0.5, borderColor: GRID });
    page.drawText(String(quantity), { x: margin + 8, y: y - TABLE_ROW_HEIGHT + 8, size: MIN_FONT_SIZE, font: bold });
    y -= TABLE_ROW_HEIGHT;
    if (note) {
      // Baris NOTE menempel langsung di bawah kotak jumlah produk.
      y -= 10;
      page.drawRectangle({ x: margin, y: y - SIZE_CHART_NOTE_HEIGHT, width: CONTENT_WIDTH, height: SIZE_CHART_NOTE_HEIGHT, color: NOTE_BG, borderWidth: 0.8, borderColor: BORDER });
      page.drawText("NOTE:", { x: margin + 8, y: cellBaseline(y, SIZE_CHART_NOTE_HEIGHT), size: MIN_FONT_SIZE, font: bold });
      const noteText = clipPdfText(safe(note), regular, MIN_FONT_SIZE, CONTENT_WIDTH - 70);
      page.drawText(noteText, { x: margin + 62, y: cellBaseline(y, SIZE_CHART_NOTE_HEIGHT), size: MIN_FONT_SIZE, font: regular, color: rgb(0.28, 0.28, 0.28) });
      y -= SIZE_CHART_NOTE_HEIGHT;
    }
    y -= 10;
  }

  function drawProductSheet(item: PurchaseOrderPdfItem) {
    const quantity = data.sizes.filter((row) => row.itemId === item.id).reduce((sum, row) => sum + row.quantity, 0);
    const itemKind = item.productCategory?.name ?? (item.garmentType ? GARMENT_TYPE_LABEL[item.garmentType] : null);
    if ((item.garmentType ?? data.garmentType) === "AKSESORI") {
      // Aksesori tidak punya size chart, tapi desainnya tetap menempel di lembar produknya.
      // Desain penjahit sengaja dikecualikan: dicetak di halaman penuh tersendiri setelah lembar ini.
      drawAssets(embeddedAssets.filter((asset) => asset.itemId === item.id && asset.kind !== "PENJAHIT_DESIGN"), item.name);
      drawAccessoryTotal(quantity, `JUMLAH PRODUK — ${item.name.toUpperCase()}${itemKind ? ` (${itemKind.toUpperCase()})` : ""}`, noteFor(item));
      return;
    }
    const rows = data.sizes.filter((row) => row.itemId === item.id);
    // Size chart selalu ikut halaman gambar desain produk ini.
    drawAssets(embeddedAssets.filter((asset) => asset.itemId === item.id && asset.kind !== "PENJAHIT_DESIGN"), item.name, measureModelTable(rows));
    drawModelTable(rows, noteFor(item));
    // Lembar ringkasan lama (yang dulu memuat sampel) sudah dihapus, jadi ukuran sampel
    // dicetak ulang di tiap lembar produk penjahit — termasuk PO multi-produk.
    if (variant === "penjahit") drawSampleSizeLine();
  }

  /**
   * Baris "Sample ukuran M 1 PCS" khusus PDF penjahit; dokumen customer tidak memuatnya.
   * Sampel selalu 1 pcs, sehingga satuannya ditulis eksplisit di baris yang sama.
   */
  function drawSampleSizeLine() {
    if (!data.sampleSize) return;
    // Jangan sampai baris ini jatuh di luar area cetak halaman terakhir.
    if (y - 22 < margin) addPage();
    markUsed();
    page.drawText(`Sample ukuran ${safe(data.sampleSize)} 1 PCS`, { x: margin, y: y - 4, size: MIN_FONT_SIZE, font: bold });
    y -= 22;
  }

  /**
   * Revisi: gambar Desain Penjahit dicetak di halaman tersendiri 1 halaman penuh (tanpa judul)
   * tepat setelah lembar produknya — tidak menimpa gambar desain produksi di lembar produk.
   */
  function drawPenjahitDesignSheet(item: PurchaseOrderPdfItem) {
    if (variant !== "penjahit") return;
    for (const asset of embeddedAssets) {
      if (asset.kind !== "PENJAHIT_DESIGN" || asset.itemId !== item.id || !asset.image) continue;
      addPage();
      markUsed();
      const scale = Math.min(CONTENT_WIDTH / asset.image.width, (A4.height - margin * 2 - 24) / asset.image.height);
      const width = asset.image.width * scale;
      const height = asset.image.height * scale;
      page.drawImage(asset.image, { x: (A4.width - width) / 2, y: (A4.height - height) / 2, width, height });
    }
  }

  /**
   * Roster pemakai dicetak per produk, tepat setelah lembar produknya (dan halaman desain
   * penjahitnya), supaya nama pemakai jersey tetap di dekat jersey dan tidak menumpuk
   * bersama produk lain di halaman terakhir. Satu halaman memuat ROSTER_ROWS_PER_PAGE baris;
   * sisanya lanjut ke halaman berikutnya dengan judul "lanjutan".
   */
  function drawRosterPages(entries: PurchaseOrderPdfData["rosterEntries"], productName: string | null) {
    if (!entries.length) return;
    // Tanpa kolom "Produk": satu halaman roster hanya untuk satu produk, jadi nama produk
    // cukup di judul dan kolom Nama mendapat ruang lebih lebar.
    // Jabatan hanya dicetak bila minimal satu baris mengisinya; baris lain diberi "-"
    // agar kolom tetap lurus dan tidak terlihat bolong.
    type RosterColumn = { key: "memberId" | "name" | "jabatan" | "size" | "sleeve"; header: string; x: number; width: number; align?: "center" };
    const hasJabatan = entries.some((entry) => entry.jabatan?.trim());
    const columns: RosterColumn[] = hasJabatan
      ? [
          { key: "memberId", header: "ID", x: 6, width: 52 },
          { key: "name", header: "Nama", x: 58, width: 196 },
          { key: "jabatan", header: "Jabatan", x: 254, width: 124, align: "center" },
          { key: "size", header: "Size", x: 378, width: 58 },
          { key: "sleeve", header: "Lengan", x: 436, width: 87 },
        ]
      : [
          { key: "memberId", header: "ID", x: 6, width: 64 },
          { key: "name", header: "Nama", x: 72, width: 296 },
          { key: "size", header: "Size", x: 372, width: 66 },
          { key: "sleeve", header: "Lengan", x: 442, width: 81 },
        ];
    const title = productName ? `ROSTER PEMAKAI — ${safe(productName.toUpperCase())}` : "ROSTER PEMAKAI";
    const poNo = safe(documentNo);
    for (let offset = 0; offset < entries.length; offset += ROSTER_ROWS_PER_PAGE) {
      addPage();
      markUsed();
      const heading = clipPdfText(
        offset === 0 ? `${title} (${entries.length})` : `${title} (lanjutan)`,
        bold,
        15,
        CONTENT_WIDTH - regular.widthOfTextAtSize(poNo, MIN_FONT_SIZE) - 12,
      );
      page.drawText(heading, { x: margin, y, size: 15, font: bold });
      page.drawText(poNo, { x: A4.width - margin - regular.widthOfTextAtSize(poNo, MIN_FONT_SIZE), y, size: MIN_FONT_SIZE, font: regular });
      y -= 30;
      page.drawRectangle({ x: margin, y: y - TABLE_ROW_HEIGHT, width: CONTENT_WIDTH, height: TABLE_ROW_HEIGHT, color: BAR_BG });
      columns.forEach((column) => {
        const text = clipPdfText(column.header, bold, MIN_FONT_SIZE, column.width - 8);
        const textWidth = bold.widthOfTextAtSize(text, MIN_FONT_SIZE);
        page.drawText(text, {
          x: margin + column.x + (column.align === "center" ? (column.width - textWidth) / 2 : 0),
          y: y - TABLE_ROW_HEIGHT + 8,
          size: MIN_FONT_SIZE,
          font: bold,
          color: rgb(1, 1, 1),
        });
      });
      y -= TABLE_ROW_HEIGHT;
      entries.slice(offset, offset + ROSTER_ROWS_PER_PAGE).forEach((entry) => {
        page.drawRectangle({ x: margin, y: y - TABLE_ROW_HEIGHT, width: CONTENT_WIDTH, height: TABLE_ROW_HEIGHT, borderWidth: 0.5, borderColor: rgb(0.82, 0.82, 0.82) });
        const cells: Record<RosterColumn["key"], string> = {
          memberId: safe(entry.memberId),
          name: safe(entry.name),
          jabatan: safe(entry.jabatan?.trim() || "-"),
          size: safe(entry.size),
          sleeve: entry.sleeveLength === "PENDEK" ? "Pendek" : "Panjang",
        };
        columns.forEach((column) => {
          const text = clipPdfText(cells[column.key], regular, MIN_FONT_SIZE, column.width - 8);
          const textWidth = regular.widthOfTextAtSize(text, MIN_FONT_SIZE);
          page.drawText(text, {
            x: margin + column.x + (column.align === "center" ? (column.width - textWidth) / 2 : 0),
            y: y - TABLE_ROW_HEIGHT + 8,
            size: MIN_FONT_SIZE,
            font: regular,
          });
        });
        y -= TABLE_ROW_HEIGHT;
      });
    }
  }

  const showPerItem = data.items.length > 1;
  if (showPerItem) {
    // Tiap produk satu lembar mandiri: kop + identitas PO diulang, gambar desain menempel di lembar produknya.
    let sheetIndex = 0;
    for (const item of data.items) {
      drawSheetHeader(item, sheetIndex > 0);
      sheetIndex += 1;
      drawProductSheet(item);
      // Revisi: desain penjahit produk ini langsung mengikuti di halaman penuh berikutnya.
      drawPenjahitDesignSheet(item);
      // Roster ikut blok produknya, jadi halaman lanyard tidak lagi diselingi nama jersey.
      drawRosterPages(data.rosterEntries.filter((entry) => entry.itemId === item.id), item.name);
    }
    // Revisi: lembar penutup "Total keseluruhan" dihapus untuk kedua varian (customer & penjahit) —
    // PDF berhenti setelah lembar produk terakhir.
  } else {
    drawSheetHeader(null, false);
    if (isAccessory) {
      drawAssets(embeddedAssets.filter((asset) => asset.kind !== "PENJAHIT_DESIGN"), null);
      drawAccessoryTotal(totalQuantity, null, noteFor(data.items[0]));
    } else {
      const aggregated = new Map<string, { size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>();
      for (const row of data.sizes) {
        const key = `${row.sleeveLength}:${row.size}`;
        const current = aggregated.get(key);
        if (current) current.quantity += row.quantity;
        else aggregated.set(key, { size: row.size, sleeveLength: row.sleeveLength, quantity: row.quantity });
      }
      const rows = [...aggregated.values()];
      drawAssets(embeddedAssets.filter((asset) => asset.kind !== "PENJAHIT_DESIGN"), null, measureModelTable(rows));
      drawModelTable(rows, noteFor(data.items[0]));
      // Revisi: ukuran sampel hanya dicetak di PDF penjahit — dokumen customer tidak memuatnya.
      if (variant === "penjahit") drawSampleSizeLine();
    }
    // Revisi: halaman Catatan penuh dihapus. Catatan desain non-aksesori sudah tampil
    // di baris NOTE size chart, sedangkan aksesori tampil di bawah jumlah produk.
    // Revisi: lembar penuh desain penjahit untuk PO satu produk mengikuti setelah seluruh lembar produk.
    if (data.items.length === 1) drawPenjahitDesignSheet(data.items[0]);
  }

  // PO satu produk: roster tetap di halaman penutup seperti sebelumnya. Baris roster lama
  // (itemId "" dari sebelum roster per produk) juga ikut di sini agar tidak hilang.
  const rosterItemIds = new Set(data.items.map((item) => item.id));
  drawRosterPages(
    showPerItem ? data.rosterEntries.filter((entry) => !rosterItemIds.has(entry.itemId)) : data.rosterEntries,
    showPerItem ? null : data.items[0]?.name ?? null,
  );
  // Buang halaman yang hanya memuat footer supaya PO tidak menyisakan halaman kosong.
  const keepPages = new Set(usedPages);
  for (const candidate of document.getPages()) {
    if (!keepPages.has(candidate)) document.removePage(document.getPages().indexOf(candidate));
  }

  document.setTitle(`PO ${data.purchaseOrderNo}`);
  document.setAuthor(data.snapshotBusinessName ?? "AS Konveksi");
  return document.save();
}
