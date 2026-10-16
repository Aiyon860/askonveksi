import "server-only";

import type ExcelJS from "exceljs";

import { UserFacingError } from "@/lib/actions/response";

export type BroadcastDateExcelRow = {
  rowNumber: number;
  name: string;
  whatsapp: string;
  orderDate: Date;
  companyName: string;
};

export const BROADCAST_DATE_MAX_BYTES = 2 * 1024 * 1024;
export const BROADCAST_DATE_MAX_ROWS = 2_000;

const XLSX_MAX_ENTRIES = 120;
const XLSX_MAX_UNCOMPRESSED_BYTES = 12 * 1024 * 1024;

function assertSafeXlsxArchive(bytes: Buffer) {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const minimumEocdSize = 22;
  const searchStart = Math.max(0, bytes.length - 65_557);
  let eocdOffset = -1;

  for (let offset = bytes.length - minimumEocdSize; offset >= searchStart; offset -= 1) {
    if (bytes.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) throw new UserFacingError("Struktur file Excel tidak valid.");

  const diskNumber = bytes.readUInt16LE(eocdOffset + 4);
  const centralDisk = bytes.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = bytes.readUInt16LE(eocdOffset + 8);
  const entryCount = bytes.readUInt16LE(eocdOffset + 10);
  const centralSize = bytes.readUInt32LE(eocdOffset + 12);
  const centralOffset = bytes.readUInt32LE(eocdOffset + 16);

  if (diskNumber || centralDisk || entriesOnDisk !== entryCount || !entryCount || entryCount > XLSX_MAX_ENTRIES) {
    throw new UserFacingError("Struktur file Excel tidak didukung.");
  }
  if (centralOffset + centralSize > eocdOffset || centralOffset + centralSize > bytes.length) {
    throw new UserFacingError("Struktur file Excel tidak valid.");
  }

  let offset = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== centralSignature) {
      throw new UserFacingError("Struktur file Excel tidak valid.");
    }

    const flags = bytes.readUInt16LE(offset + 8);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);

    if ((flags & 0x1) !== 0 || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new UserFacingError("File Excel terenkripsi atau ZIP64 tidak didukung.");
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > XLSX_MAX_UNCOMPRESSED_BYTES) {
      throw new UserFacingError("Isi file Excel terlalu besar setelah diekstrak.");
    }

    const fileNameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    if ("result" in value) return cellText(value.result as never);
    if ("text" in value) return String(value.text ?? "").trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("").trim();
    }
  }
  return String(value).trim();
}

function parseCellDate(cellValue: ExcelJS.CellValue): Date | null {
  if (!cellValue) return null;
  if (cellValue instanceof Date) {
    return isNaN(cellValue.getTime()) ? null : cellValue;
  }
  if (typeof cellValue === "number") {
    // Excel serial number (1 = 1900-01-01, leap year bug in Excel: day 60 is 1900-02-29)
    const utcDays = cellValue - 25569;
    const utcMillis = Math.round(utcDays * 86400 * 1000);
    const parsed = new Date(utcMillis);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  const text = cellText(cellValue).trim();
  if (!text) return null;

  // Coba format DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch.map(Number);
    const parsed = new Date(year, month - 1, day);
    if (!isNaN(parsed.getTime()) && parsed.getDate() === day && parsed.getMonth() === month - 1) {
      return parsed;
    }
  }

  // Coba format YYYY-MM-DD atau YYYY/MM/DD
  const ymdMatch = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(text);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch.map(Number);
    const parsed = new Date(year, month - 1, day);
    if (!isNaN(parsed.getTime()) && parsed.getDate() === day && parsed.getMonth() === month - 1) {
      return parsed;
    }
  }

  // Fallback standar JS Date parse
  const directDate = new Date(text);
  return isNaN(directDate.getTime()) ? null : directDate;
}

function columnIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.some((alias) => header.includes(alias)));
}

function optionalCell(row: ExcelJS.Row, index: number) {
  return index < 0 ? "" : cellText(row.getCell(index + 1).value);
}

export async function parseBroadcastDatesWorkbook(file: File): Promise<BroadcastDateExcelRow[]> {
  if (!file.size) throw new UserFacingError("Pilih file Excel tanggal terlebih dahulu.");
  if (file.size > BROADCAST_DATE_MAX_BYTES) throw new UserFacingError("File Excel maksimal 2 MB.");

  const name = file.name.toLocaleLowerCase("id-ID");
  if (!name.endsWith(".xlsx") && file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    throw new UserFacingError("File harus berformat XLSX (.xlsx).");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new UserFacingError("Isi file tidak sesuai format XLSX.");
  assertSafeXlsxArchive(bytes);

  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as never);
  } catch (error) {
    if (error instanceof UserFacingError) throw error;
    throw new UserFacingError("File Excel tanggal rusak atau tidak dapat dibaca.");
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new UserFacingError("File Excel tidak memiliki sheet data.");
  if (worksheet.actualRowCount > BROADCAST_DATE_MAX_ROWS + 1) {
    throw new UserFacingError(`Import tanggal maksimal ${BROADCAST_DATE_MAX_ROWS.toLocaleString("id-ID")} baris.`);
  }

  const header = worksheet.getRow(1);
  const headers = Array.from({ length: header.cellCount }, (_, index) =>
    cellText(header.getCell(index + 1).value).toLocaleLowerCase("id-ID")
  );

  const indexes = {
    name: columnIndex(headers, ["nama", "customer", "name"]),
    whatsapp: columnIndex(headers, ["whatsapp", "wa", "telepon", "phone", "hp", "nomor"]),
    orderDate: columnIndex(headers, ["tanggal", "tgl", "date", "order", "beli"]),
    companyName: columnIndex(headers, ["perusahaan", "komunitas", "instansi", "company"]),
  };

  if (indexes.orderDate < 0) {
    throw new UserFacingError("Header Excel harus memuat kolom Tanggal (misal: 'Tanggal Order' atau 'Tanggal').");
  }
  if (indexes.name < 0 && indexes.whatsapp < 0) {
    throw new UserFacingError("Header Excel harus memuat kolom Nama atau WhatsApp customer.");
  }

  const rows: BroadcastDateExcelRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const rawName = optionalCell(row, indexes.name);
    const rawWhatsapp = optionalCell(row, indexes.whatsapp);
    const rawCompany = optionalCell(row, indexes.companyName);
    const dateCell = indexes.orderDate >= 0 ? row.getCell(indexes.orderDate + 1).value : null;

    if (!rawName && !rawWhatsapp) return; // Baris kosong

    const parsedDate = parseCellDate(dateCell);
    if (!parsedDate) {
      throw new UserFacingError(`Baris ${rowNumber}: Format tanggal order '${cellText(dateCell)}' tidak valid. Gunakan format YYYY-MM-DD atau DD/MM/YYYY.`);
    }

    rows.push({
      rowNumber,
      name: rawName || rawWhatsapp,
      whatsapp: rawWhatsapp,
      orderDate: parsedDate,
      companyName: rawCompany,
    });
  });

  if (!rows.length) {
    throw new UserFacingError("File Excel tidak memuat data yang dapat diimpor.");
  }

  return rows;
}

export async function createBroadcastDateTemplate(): Promise<Buffer> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ERM Askonveksi";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Tanggal Order");
  worksheet.columns = [
    { header: "Nama Customer", key: "name", width: 28 },
    { header: "WhatsApp", key: "whatsapp", width: 20 },
    { header: "Tanggal Order", key: "orderDate", width: 18 },
    { header: "Perusahaan/Komunitas", key: "companyName", width: 30 },
  ];
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  worksheet.addRow({
    name: "Budi Santoso",
    whatsapp: "081234567890",
    orderDate: "2026-05-15",
    companyName: "PT Maju Bersama",
  });
  worksheet.addRow({
    name: "Siti Rahma",
    whatsapp: "085712345678",
    orderDate: "2026-06-20",
    companyName: "Komunitas Futsal Bandung",
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
