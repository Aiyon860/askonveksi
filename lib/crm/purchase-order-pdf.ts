import "server-only";

import type { GarmentType } from "@prisma/client";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import { decorationMethodsLabel, GARMENT_TYPE_LABEL } from "@/lib/crm/constants";
import { MIN_FONT_SIZE, clipPdfText, wrapPdfText } from "@/lib/crm/pdf-typography";

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
  rosterEntries: Array<{ itemId: string; memberId: string; name: string; size: string; sleeveLength: "PENDEK" | "PANJANG" }>;
};

type PurchaseOrderPdfItem = PurchaseOrderPdfData["items"][number];

// `itemId` mengikat gambar ke produknya; lampiran PO tanpa `itemId` (mis. bukti) tampil di lembar ringkasan.
type PdfAsset = { kind: string; label: string; originalName: string; contentType: string; bytes: Uint8Array; itemId?: string | null };
const A4 = { width: 595.28, height: 841.89 };
const margin = 36;
const CONTENT_WIDTH = A4.width - margin * 2;
/** Sel logo di kiri tabel identitas; sisanya dibagi dua kolom data. */
const HEADER_LOGO_CELL_WIDTH = 100;
const HEADER_CELL_PADDING = 8;
const HEADER_ROW_MIN_HEIGHT = 34;
const HEADER_LINE_HEIGHT = 15;
const TABLE_ROW_HEIGHT = 26;
const HEADING_BAR_HEIGHT = 26;
/** Baris roster per halaman A4; sisanya lanjut ke halaman berikutnya. */
const ROSTER_ROWS_PER_PAGE = 25;

/**
 * Daftar ukuran tetap pada size chart (sesuai referensi Owner): semua kolom selalu
 * dicetak lengkap walau PO tidak memesan ukuran tersebut. Ukuran di luar daftar ini
 * tetap ditambahkan sebagai kolom tambahan supaya jumlahnya tidak pernah hilang.
 */
const SIZE_LADDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"] as const;
const SIZE_ALIASES: Record<string, string> = { XXL: "2XL", XXXL: "3XL", "3X": "3XL", XXXXL: "4XL", XXXXXL: "5XL" };

function normalizeSize(name: string) {
  const upper = name.trim().toUpperCase().replace(/\s+/g, " ");
  return SIZE_ALIASES[upper] ?? upper;
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
const BAR_BG = rgb(0.12, 0.16, 0.2);
const NOTE_BG = rgb(0.9, 0.9, 0.9);

/** Sel tabel identitas: satu baris "Label : nilai", atau label + beberapa baris tambahan. */
type HeaderCell = {
  label: string;
  value?: string;
  extraLines?: Array<{ label: string; value: string }>;
  highlight?: boolean;
};

type HeaderLine = Array<{ text: string; bold: boolean }>;

export async function createPurchaseOrderPdf(data: PurchaseOrderPdfData, logoBytes: Uint8Array, assets: PdfAsset[], variant: PurchaseOrderPdfVariant = "customer") {
  /**
   * Nomor PO yang dicetak: tanpa akhiran revisi (`-R2`, `-R3`, ...). Revisi tetap
   * tercatat di sistem (riwayat dokumen, audit, judul UI) tetapi tidak dicetak
   * pada dokumen customer maupun penjahit.
   */
  const documentNo = data.purchaseOrderNo.replace(/-R\d+$/i, "");
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

/**
   * Paragraf "Label: nilai". Tinggi blok dihitung lebih dulu supaya label tidak pernah
   * tertinggal sendirian di dasar halaman (penyebab halaman kosong berikutnya).
   */
  function drawParagraph(label: string, value: string) {
    const lines = wrapPdfText(safe(value), regular, MIN_FONT_SIZE, CONTENT_WIDTH);
    const blockHeight = 16 + lines.length * 16 + 6;
    if (y - blockHeight < margin) addPage();
    markUsed();
    page.drawText(`${safe(label)}:`, { x: margin, y, size: MIN_FONT_SIZE, font: bold });
    y -= 16;
    for (const line of lines) {
      page.drawText(line, { x: margin, y, size: MIN_FONT_SIZE, font: regular, color: rgb(0.28, 0.28, 0.28) });
      y -= 16;
    }
    y -= 6;
  }

  /** Isi satu sel tabel identitas menjadi baris-baris siap gambar (dipotong sesuai lebar kolom). */
  function cellLines(cell: HeaderCell, maxWidth: number): HeaderLine[] {
    if (!cell.extraLines?.length) {
      return wrapPdfText(safe(`${cell.label} : ${cell.value ?? "-"}`), cell.highlight ? bold : regular, MIN_FONT_SIZE, maxWidth)
        .slice(0, 2)
        .map((line) => [{ text: line, bold: false }]);
    }
    const lines: HeaderLine[] = [[{ text: `${safe(cell.label)} :`, bold: false }]];
    for (const extra of cell.extraLines) {
      const prefix = `${safe(extra.label)}: `;
      const available = Math.max(20, maxWidth - bold.widthOfTextAtSize(prefix, MIN_FONT_SIZE));
      lines.push([
        { text: prefix, bold: true },
        { text: clipPdfText(safe(extra.value), regular, MIN_FONT_SIZE, available), bold: false },
      ]);
    }
    return lines;
  }

  /**
   * Kop ringkas sesuai referensi: sel logo di kiri + tabel dua kolom tiga baris
   * (Nama/Bahan · Tgl Order/Warna · Deadline/Tinta-Bordir). Baris tambahan hanya
   * dipakai bila datanya ada, sehingga kop tidak memakan tempat ke bawah.
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

    const garmentType = item?.garmentType ?? data.garmentType;
    // Kategori per produk boleh kosong di form; jatuhkan ke kategori level PO
    // (pilihan "PDH / PDL" user tersimpan di sana) supaya tidak tercetak "-".
    const category = item?.productCategory?.name ?? data.productCategory ?? "-";
    const decoration = item?.decorationMethods.length ? item.decorationMethods : poDecoration;
    // Warna mengikuti produk: satu PO boleh memuat beberapa warna berbeda.
    // PO lama (item tanpa warna) jatuh ke kolom warna header supaya PDF lama tidak berubah.
    const colorItem = item ?? (data.items.length === 1 ? data.items[0] : null);
    const baseColor = colorItem?.baseColor ?? data.baseColor ?? data.color;
    const variationColor = colorItem?.variationColor ?? data.variationColor;

    // Varian penjahit (Sprint 11 R3): sel Deadline hanya berisi deadline penjahit per item
    // (null tampil "-"); lembar tunggal memakai satu-satunya produk. Varian customer tetap deadline PO.
    const penjahitItem = item ?? (variant === "penjahit" && data.items.length === 1 ? data.items[0] : null);
    const deadlineCell: HeaderCell =
      variant === "penjahit"
        ? { label: "Deadline", value: formatDate(penjahitItem?.penjahitDeadline ?? null), highlight: true }
        : { label: "Deadline", value: formatDate(data.deadline), highlight: true };

    const rows: Array<[HeaderCell, HeaderCell]> = [
      [
        { label: "Nama", value: data.opportunity.customer.name },
        { label: "Bahan", value: data.material },
      ],
      [
        { label: "Tgl Order", value: formatDate(data.orderDate) },
        {
          label: "Warna",
          extraLines: [
            ...(baseColor ? [{ label: "Warna Base", value: baseColor }] : []),
            ...(variationColor ? [{ label: "Warna List", value: variationColor }] : []),
          ],
        },
      ],
      [
        deadlineCell,
        { label: "Tinta / Bordir", value: decorationMethodsLabel(decoration) || "-" },
      ],
    ];
    // Data pelengkap hanya muncul kalau terisi supaya kop tetap ringkas.
    if (data.opportunity.customer.companyName || data.instansi) {
      rows.push([
        { label: "Perusahaan", value: data.opportunity.customer.companyName ?? "-" },
        { label: "Instansi", value: data.instansi ?? "-" },
      ]);
    }
    if (garmentType || category !== "-") {
      rows.push([
        { label: "Jenis pakaian", value: garmentType ? GARMENT_TYPE_LABEL[garmentType] : "-" },
        { label: "Kategori", value: category },
      ]);
    }

    const dataColumnWidth = (CONTENT_WIDTH - HEADER_LOGO_CELL_WIDTH) / 2;
    const cellTextWidth = dataColumnWidth - HEADER_CELL_PADDING * 2;
    const cellLinesByRow = rows.map((row) => row.map((cell) => cellLines(cell, cellTextWidth)));
    // Tinggi tiap baris mengikuti isinya (minimal 34 pt) supaya kop tetap ringkas.
    const rowHeights = cellLinesByRow.map((cells) => Math.max(HEADER_ROW_MIN_HEIGHT, ...cells.map((lines) => lines.length * HEADER_LINE_HEIGHT + 12)));
    const tableHeight = rowHeights.reduce((sum, height) => sum + height, 0);
    if (y - tableHeight - 46 < margin) {
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
    const logoScale = logo.scaleToFit(HEADER_LOGO_CELL_WIDTH - 18, tableHeight - 22);
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
      row.forEach((cell, columnIndex) => {
        const cellX = margin + HEADER_LOGO_CELL_WIDTH + columnIndex * dataColumnWidth;
        page.drawRectangle({ x: cellX, y: rowBottom, width: dataColumnWidth, height: rowHeight, borderWidth: 0.8, borderColor: BORDER });
        const lines = cellLinesByRow[rowIndex][columnIndex];
        const offset = Math.max(4, (rowHeight - lines.length * HEADER_LINE_HEIGHT) / 2);
        lines.forEach((runs, lineIndex) => {
          let cursorX = cellX + HEADER_CELL_PADDING;
          const lineY = rowTop - offset - 12 - lineIndex * HEADER_LINE_HEIGHT;
          for (const run of runs) {
            const font = cell.highlight || run.bold ? bold : regular;
            page.drawText(run.text, { x: cursorX, y: lineY, size: MIN_FONT_SIZE, font, color: cell.highlight ? DEADLINE_RED : rgb(0.12, 0.12, 0.12) });
            cursorX += font.widthOfTextAtSize(run.text, MIN_FONT_SIZE);
          }
        });
      });
    });
    y = tableBottom - 12;

    // Judul POLA: bar bergaris dengan teks di tengah — pola milik produk di lembar ini
    // (revisi: pola per produk; fallback ke pola lama / nama produk level PO).
    const sheetPola = item?.pola || data.pola || data.productName;
    const polaText = clipPdfText(`POLA : ${safe(sheetPola.toUpperCase())}`, bold, 13, CONTENT_WIDTH - 24);
    page.drawRectangle({ x: margin, y: y - 28, width: CONTENT_WIDTH, height: 28, borderWidth: 0.8, borderColor: BORDER, color: rgb(1, 1, 1) });
    page.drawText(polaText, { x: (A4.width - bold.widthOfTextAtSize(polaText, 13)) / 2, y: y - 19, size: 13, font: bold, color: rgb(0.12, 0.12, 0.12) });
    y -= 40;
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
  const SIZE_CHART_TOTAL_WIDTH = 62;
  const SIZE_COLUMNS_PER_CHUNK = 9;
  const SIZE_CHART_NOTE_HEIGHT = 34;

  /**
   * Kolom size chart: daftar ukuran tetap (XS…5XL) selalu lengkap sesuai referensi,
   * ditambah ukuran di luar daftar itu bila PO memakainya supaya jumlah tidak hilang.
   */
  function chartColumns(rows: Array<{ size: string }>) {
    const extras = [...new Set(rows.map((row) => normalizeSize(row.size)))]
      .filter((size) => size.length > 0 && !(SIZE_LADDER as readonly string[]).includes(size))
      .sort((left, right) => left.localeCompare(right, "id-ID"));
    return [...SIZE_LADDER, ...extras];
  }

  function chartChunks(rows: Array<{ size: string }>) {
    const columns: string[] = chartColumns(rows);
    const chunks: string[][] = [];
    for (let index = 0; index < columns.length; index += SIZE_COLUMNS_PER_CHUNK) chunks.push(columns.slice(index, index + SIZE_COLUMNS_PER_CHUNK));
    return chunks;
  }

  /** Tinggi satu blok size chart (header + PENDEK + PANJANG + baris NOTE). */
  function chartBlockHeight() {
    return TABLE_ROW_HEIGHT * 3 + SIZE_CHART_NOTE_HEIGHT + 12;
  }

  /** Tinggi tabel ukuran untuk menahan ruang di halaman yang sama dengan gambar desain. */
  function measureModelTable(rows: Array<{ size: string }>) {
    return chartChunks(rows).length * chartBlockHeight();
  }

  /**
   * Size chart sesuai referensi: kolom label gelap (SIZE/PENDEK/PANJANG), kolom ukuran
   * di header gelap, total per baris, lalu baris NOTE dengan kotak total di kanan.
   */
  function drawModelTable(rows: Array<{ size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>, note: string | null) {
    const grandTotal = rows.reduce((sum, row) => sum + row.quantity, 0);
    const quantityFor = (size: string, sleeve: "PENDEK" | "PANJANG") =>
      rows.filter((row) => normalizeSize(row.size) === size && row.sleeveLength === sleeve).reduce((sum, row) => sum + row.quantity, 0);

    for (const sizeChunk of chartChunks(rows)) {
      if (y - chartBlockHeight() < margin) addPage();
      markUsed();
      const cellWidth = (CONTENT_WIDTH - SIZE_CHART_LABEL_WIDTH - SIZE_CHART_TOTAL_WIDTH) / sizeChunk.length;
      const totalX = margin + CONTENT_WIDTH - SIZE_CHART_TOTAL_WIDTH;
      let rowTop = y;

      const labelCell = (text: string) => {
        page.drawRectangle({ x: margin, y: rowTop - TABLE_ROW_HEIGHT, width: SIZE_CHART_LABEL_WIDTH, height: TABLE_ROW_HEIGHT, color: BAR_BG });
        centeredText(text, margin, SIZE_CHART_LABEL_WIDTH, rowTop, TABLE_ROW_HEIGHT, bold, rgb(1, 1, 1));
      };
      const sizeCell = (text: string, index: number) => {
        page.drawRectangle({ x: margin + SIZE_CHART_LABEL_WIDTH + index * cellWidth, y: rowTop - TABLE_ROW_HEIGHT, width: cellWidth, height: TABLE_ROW_HEIGHT, color: BAR_BG });
        centeredText(clipPdfText(text, bold, MIN_FONT_SIZE, cellWidth - 8), margin + SIZE_CHART_LABEL_WIDTH + index * cellWidth, cellWidth, rowTop, TABLE_ROW_HEIGHT, bold, rgb(1, 1, 1));
      };

      // Baris header: SIZE | kolom ukuran | TOTAL
      labelCell("SIZE");
      sizeChunk.forEach((size, index) => sizeCell(safe(size), index));
      page.drawRectangle({ x: totalX, y: rowTop - TABLE_ROW_HEIGHT, width: SIZE_CHART_TOTAL_WIDTH, height: TABLE_ROW_HEIGHT, color: BAR_BG });
      centeredText("TOTAL", totalX, SIZE_CHART_TOTAL_WIDTH, rowTop, TABLE_ROW_HEIGHT, bold, rgb(1, 1, 1));
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

      // Baris NOTE + kotak total keseluruhan.
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

  function drawAccessoryTotal(quantity: number, label: string | null) {
    if (y < margin + 90) addPage();
    markUsed();
    drawHeadingBar(label ?? "JUMLAH PRODUK");
    y -= 12;
    page.drawRectangle({ x: margin, y: y - TABLE_ROW_HEIGHT, width: CONTENT_WIDTH, height: TABLE_ROW_HEIGHT, borderWidth: 0.5, borderColor: GRID });
    page.drawText(String(quantity), { x: margin + 8, y: y - TABLE_ROW_HEIGHT + 8, size: MIN_FONT_SIZE, font: bold });
    y -= TABLE_ROW_HEIGHT + 10;
  }

  function drawProductSheet(item: PurchaseOrderPdfItem) {
    const quantity = data.sizes.filter((row) => row.itemId === item.id).reduce((sum, row) => sum + row.quantity, 0);
    const itemKind = item.productCategory?.name ?? (item.garmentType ? GARMENT_TYPE_LABEL[item.garmentType] : null);
    if ((item.garmentType ?? data.garmentType) === "AKSESORI") {
      // Aksesori tidak punya size chart, tapi desainnya tetap menempel di lembar produknya.
      // Desain penjahit sengaja dikecualikan: dicetak di halaman penuh tersendiri setelah lembar ini.
      drawAssets(embeddedAssets.filter((asset) => asset.itemId === item.id && asset.kind !== "PENJAHIT_DESIGN"), item.name);
      drawAccessoryTotal(quantity, `JUMLAH PRODUK — ${item.name.toUpperCase()}${itemKind ? ` (${itemKind.toUpperCase()})` : ""}`);
      return;
    }
    const rows = data.sizes.filter((row) => row.itemId === item.id);
    // Size chart selalu ikut halaman gambar desain produk ini.
    drawAssets(embeddedAssets.filter((asset) => asset.itemId === item.id && asset.kind !== "PENJAHIT_DESIGN"), item.name, measureModelTable(rows));
    drawModelTable(rows, item.designNotes);
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
    const columns = [
      { key: "memberId" as const, header: "ID", x: 6, width: 64 },
      { key: "name" as const, header: "Nama", x: 72, width: 296 },
      { key: "size" as const, header: "Size", x: 372, width: 66 },
      { key: "sleeve" as const, header: "Lengan", x: 442, width: 81 },
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
        page.drawText(clipPdfText(column.header, bold, MIN_FONT_SIZE, column.width - 8), {
          x: margin + column.x,
          y: y - TABLE_ROW_HEIGHT + 8,
          size: MIN_FONT_SIZE,
          font: bold,
          color: rgb(1, 1, 1),
        });
      });
      y -= TABLE_ROW_HEIGHT;
      entries.slice(offset, offset + ROSTER_ROWS_PER_PAGE).forEach((entry) => {
        page.drawRectangle({ x: margin, y: y - TABLE_ROW_HEIGHT, width: CONTENT_WIDTH, height: TABLE_ROW_HEIGHT, borderWidth: 0.5, borderColor: rgb(0.82, 0.82, 0.82) });
        const cells: Record<(typeof columns)[number]["key"], string> = {
          memberId: safe(entry.memberId),
          name: safe(entry.name),
          size: safe(entry.size),
          sleeve: entry.sleeveLength === "PENDEK" ? "Pendek" : "Panjang",
        };
        columns.forEach((column) => {
          page.drawText(clipPdfText(cells[column.key], regular, MIN_FONT_SIZE, column.width - 8), {
            x: margin + column.x,
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
      drawAccessoryTotal(totalQuantity, null);
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
      drawModelTable(rows, data.designNotes);
      page.drawText(`Sampel ukuran: ${safe(data.sampleSize ?? "-")}`, { x: margin, y: y - 4, size: MIN_FONT_SIZE, font: bold });
      y -= 22;
    }
    drawParagraph("Catatan", data.notes ?? "-");
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
