import "server-only";

import { PDFDocument, StandardFonts, degrees, rgb, type PDFImage, type PDFPage } from "pdf-lib";

import { decorationMethodLabel } from "@/lib/crm/constants";

type PurchaseOrderPdfData = {
  purchaseOrderNo: string;
  customerReference: string | null;
  revision: number;
  status: string;
  productName: string;
  garmentType: string | null;
  material: string;
  baseColor: string | null;
  color: string | null;
  variationColor: string | null;
  decorationMethod: string | null;
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
  sizes: Array<{ size: string; sleeveLength: "PENDEK" | "PANJANG"; quantity: number }>;
  rosterEntries: Array<{ memberId: string; name: string; size: string }>;
};

type PdfAsset = { kind: string; label: string; originalName: string; contentType: string; bytes: Uint8Array };
const A4 = { width: 595.28, height: 841.89 };
const margin = 36;

function safe(value: string) {
  return value.replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(value) : "-";
}

export async function createPurchaseOrderPdf(data: PurchaseOrderPdfData, logoBytes: Uint8Array, assets: PdfAsset[]) {
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
    page.drawText(safe(data.snapshotBusinessName ?? "AS Konveksi"), { x: margin, y: 20, size: 7, font: regular, color: rgb(0.42, 0.42, 0.42) });
    page.drawText(`${safe(data.purchaseOrderNo)} | Halaman ${pageNumber}`, { x: 420, y: 20, size: 7, font: regular, color: rgb(0.42, 0.42, 0.42) });
    if (data.status === "DRAFT") page.drawText("DRAFT", { x: 155, y: 370, size: 82, font: bold, color: rgb(0.9, 0.9, 0.9), rotate: degrees(35), opacity: 0.45 });
  }

  let pageNumber = 1;
  let page = document.addPage([A4.width, A4.height]);
  decorate(page, pageNumber);
  let y = A4.height - margin;
  const logoScale = logo.scaleToFit(115, 48);
  page.drawImage(logo, { x: margin, y: y - logoScale.height, width: logoScale.width, height: logoScale.height });
  page.drawText("PURCHASE ORDER", { x: 370, y: y - 6, size: 17, font: bold, color: rgb(0.12, 0.12, 0.12) });
  page.drawText(safe(data.purchaseOrderNo), { x: 370, y: y - 24, size: 9, font: regular });
  page.drawText(`Revisi ${data.revision}`, { x: 370, y: y - 38, size: 8, font: regular });
  y -= 68;

  const rows = [
    ["Customer", data.opportunity.customer.name], ["Perusahaan", data.opportunity.customer.companyName ?? "-"],
    ["Referensi customer", data.customerReference ?? "-"], ["Tanggal order", formatDate(data.orderDate)],
    ["Deadline", formatDate(data.deadline)], ["Jenis pakaian", data.garmentType === "JERSEY" ? "Jersey" : data.garmentType === "NON_JERSEY" ? "Non-jersey" : "-"],
    ["Bahan", data.material], ["Warna dasar", data.baseColor ?? data.color ?? "-"],
    ["Warna variasi", data.variationColor ?? "-"], ["Metode dekorasi", decorationMethodLabel(data.decorationMethod)],
  ];
  rows.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + column * 262;
    const rowY = y - row * 25;
    page.drawText(label, { x, y: rowY, size: 7, font: bold, color: rgb(0.34, 0.34, 0.34) });
    page.drawText(safe(value), { x, y: rowY - 11, size: 9, font: regular });
  });
  y -= Math.ceil(rows.length / 2) * 25 + 10;
  page.drawRectangle({ x: margin, y: y - 22, width: A4.width - margin * 2, height: 26, color: rgb(0.12, 0.16, 0.2) });
  page.drawText(`POLA: ${safe(data.productName.toUpperCase())}`, { x: margin + 10, y: y - 13, size: 11, font: bold, color: rgb(1, 1, 1) });
  y -= 38;

  const visibleAssets = embeddedAssets;
  if (visibleAssets.length) {
    const boxWidth = 250;
    const boxHeight = 112;
    visibleAssets.forEach((asset, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = margin + column * 262;
      const boxY = y - row * 126 - boxHeight;
      page.drawRectangle({ x, y: boxY, width: boxWidth, height: boxHeight, borderWidth: 0.75, borderColor: rgb(0.68, 0.68, 0.68) });
      if (asset.image) {
        const scaled = asset.image.scaleToFit(boxWidth - 12, boxHeight - 30);
        page.drawImage(asset.image, { x: x + (boxWidth - scaled.width) / 2, y: boxY + 6, width: scaled.width, height: scaled.height });
      } else {
        page.drawText(asset.contentType === "application/pdf" ? "Lampiran PDF" : "Pratinjau tidak tersedia", { x: x + 8, y: boxY + 42, size: 8, font: regular, color: rgb(0.42, 0.42, 0.42) });
        page.drawText(safe(asset.originalName), { x: x + 8, y: boxY + 28, size: 7, font: regular, color: rgb(0.42, 0.42, 0.42) });
      }
      page.drawText(safe(asset.label), { x: x + 6, y: boxY + boxHeight - 13, size: 7, font: bold });
    });
    y -= Math.ceil(visibleAssets.length / 2) * 126 + 4;
  }

  const sizeNames = [...new Set(data.sizes.map((item) => item.size))];
  const chunks: string[][] = [];
  for (let index = 0; index < sizeNames.length; index += 8) chunks.push(sizeNames.slice(index, index + 8));
  for (const sizeChunk of chunks) {
    if (y < 125) {
      pageNumber += 1;
      page = document.addPage([A4.width, A4.height]);
      decorate(page, pageNumber);
      y = A4.height - margin;
    }
    const labelWidth = 72;
    const cellWidth = (A4.width - margin * 2 - labelWidth - 52) / sizeChunk.length;
    const totalWidth = A4.width - margin * 2;
    page.drawRectangle({ x: margin, y: y - 22, width: totalWidth, height: 22, color: rgb(0.12, 0.12, 0.12) });
    page.drawText("MODEL", { x: margin + 7, y: y - 14, size: 7, font: bold, color: rgb(1, 1, 1) });
    sizeChunk.forEach((size, index) => page.drawText(safe(size), { x: margin + labelWidth + index * cellWidth + 5, y: y - 14, size: 7, font: bold, color: rgb(1, 1, 1) }));
    page.drawText("TOTAL", { x: A4.width - margin - 44, y: y - 14, size: 7, font: bold, color: rgb(1, 1, 1) });
    y -= 22;
    for (const sleeve of ["PENDEK", "PANJANG"] as const) {
      page.drawRectangle({ x: margin, y: y - 22, width: totalWidth, height: 22, borderWidth: 0.5, borderColor: rgb(0.75, 0.75, 0.75) });
      page.drawText(sleeve === "PENDEK" ? "Pendek" : "Panjang", { x: margin + 7, y: y - 14, size: 7, font: bold });
      let total = 0;
      sizeChunk.forEach((size, index) => {
        const quantity = data.sizes.find((item) => item.sleeveLength === sleeve && item.size === size)?.quantity ?? 0;
        total += quantity;
        page.drawText(String(quantity), { x: margin + labelWidth + index * cellWidth + 5, y: y - 14, size: 8, font: regular });
      });
      page.drawText(String(total), { x: A4.width - margin - 35, y: y - 14, size: 8, font: bold });
      y -= 22;
    }
    y -= 10;
  }
  page.drawText(`Sampel ukuran: ${safe(data.sampleSize ?? "-")}`, { x: margin, y, size: 9, font: bold });
  page.drawText(`Total: ${data.sizes.reduce((sum, item) => sum + item.quantity, 0)}`, { x: A4.width - margin - 70, y, size: 9, font: bold });
  y -= 18;
  page.drawText(`Catatan desain: ${safe(data.designNotes ?? "-")}`, { x: margin, y, size: 8, font: regular });
  y -= 14;
  page.drawText(`Catatan: ${safe(data.notes ?? "-")}`, { x: margin, y, size: 8, font: regular });

  if (data.rosterEntries.length) {
    for (let offset = 0; offset < data.rosterEntries.length; offset += 25) {
      pageNumber += 1;
      page = document.addPage([A4.width, A4.height]);
      decorate(page, pageNumber);
      y = A4.height - margin;
      page.drawText("ROSTER PEMAKAI", { x: margin, y, size: 15, font: bold });
      page.drawText(safe(data.purchaseOrderNo), { x: 405, y, size: 9, font: regular });
      y -= 28;
      page.drawRectangle({ x: margin, y: y - 22, width: A4.width - margin * 2, height: 22, color: rgb(0.12, 0.16, 0.2) });
      page.drawText("ID", { x: margin + 8, y: y - 14, size: 8, font: bold });
      page.drawText("Nama", { x: 190, y: y - 14, size: 8, font: bold });
      page.drawText("Size", { x: 500, y: y - 14, size: 8, font: bold });
      y -= 22;
      data.rosterEntries.slice(offset, offset + 25).forEach((entry) => {
        page.drawRectangle({ x: margin, y: y - 26, width: A4.width - margin * 2, height: 26, borderWidth: 0.5, borderColor: rgb(0.82, 0.82, 0.82) });
        page.drawText(safe(entry.memberId), { x: margin + 8, y: y - 17, size: 8, font: regular });
        page.drawText(safe(entry.name), { x: 190, y: y - 17, size: 8, font: regular });
        page.drawText(safe(entry.size), { x: 500, y: y - 17, size: 8, font: regular });
        y -= 26;
      });
    }
  }
  document.setTitle(`PO ${data.purchaseOrderNo}`);
  document.setAuthor(data.snapshotBusinessName ?? "AS Konveksi");
  return document.save();
}
