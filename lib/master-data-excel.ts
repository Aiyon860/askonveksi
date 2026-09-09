import "server-only";

import ExcelJS from "exceljs";

import { UserFacingError } from "@/lib/actions/response";

export type MasterDataExcelRow = {
  name: string;
  description: string | null;
};

export const MASTER_DATA_EXCEL_MAX_BYTES = 1 * 1024 * 1024;
export const MASTER_DATA_EXCEL_MAX_ROWS = 1_000;

const XLSX_MAX_ENTRIES = 100;
const XLSX_MAX_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;
const XLSX_MAX_COMPRESSION_RATIO = 100;

export async function createMasterDataWorkbook(title: string, rows: MasterDataExcelRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ERM Askonveksi";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(title);
  worksheet.columns = [
    { header: "No", key: "number", width: 8 },
    { header: "Nama", key: "name", width: 32 },
    { header: "Deskripsi", key: "description", width: 60 },
  ];
  worksheet.getRow(1).font = { bold: true };
  rows.forEach((row, index) => {
    worksheet.addRow({ number: index + 1, name: row.name, description: row.description ?? "" });
  });

  return workbook.xlsx.writeBuffer();
}

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
    const fileNameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    if ((flags & 0x1) !== 0 || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new UserFacingError("File Excel terenkripsi atau ZIP64 tidak didukung.");
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > XLSX_MAX_UNCOMPRESSED_BYTES) {
      throw new UserFacingError("Isi file Excel terlalu besar setelah diekstrak.");
    }
    if (compressedSize > 0 && uncompressedSize / compressedSize > XLSX_MAX_COMPRESSION_RATIO) {
      throw new UserFacingError("Rasio kompresi file Excel tidak aman.");
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  if (offset !== centralOffset + centralSize) throw new UserFacingError("Struktur file Excel tidak valid.");
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) {
      throw new UserFacingError("Excel Data Master tidak boleh berisi formula.");
    }
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
}

export async function parseMasterDataWorkbook(file: File, maxNameLength: number): Promise<MasterDataExcelRow[]> {
  if (!file.size) throw new UserFacingError("Pilih file Excel terlebih dahulu.");
  if (file.size > MASTER_DATA_EXCEL_MAX_BYTES) throw new UserFacingError("File Excel maksimal 1 MB.");
  const name = file.name.toLocaleLowerCase("id-ID");
  if (!name.endsWith(".xlsx") && file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    throw new UserFacingError("File Data Master harus berformat XLSX.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new UserFacingError("Isi file tidak sesuai format XLSX.");
  assertSafeXlsxArchive(bytes);

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as never);
  } catch (error) {
    if (error instanceof UserFacingError) throw error;
    throw new UserFacingError("File Excel rusak atau tidak dapat dibaca.");
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new UserFacingError("File Excel tidak memiliki sheet.");
  if (worksheet.actualRowCount > MASTER_DATA_EXCEL_MAX_ROWS + 1) {
    throw new UserFacingError(`Data Master maksimal ${MASTER_DATA_EXCEL_MAX_ROWS.toLocaleString("id-ID")} baris.`);
  }

  const header = worksheet.getRow(1);
  const headers = Array.from({ length: header.cellCount }, (_, index) => cellText(header.getCell(index + 1).value).toLocaleLowerCase("id-ID"));
  const nameIndex = headers.findIndex((value) => value === "nama" || value === "name");
  const descriptionIndex = headers.findIndex((value) => value === "deskripsi" || value === "description");
  if (nameIndex < 0) throw new UserFacingError("Header Excel harus memuat kolom Nama.");

  const rows: MasterDataExcelRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const itemName = cellText(row.getCell(nameIndex + 1).value);
    const description = descriptionIndex < 0 ? "" : cellText(row.getCell(descriptionIndex + 1).value);
    if (!itemName && !description) return;
    if (itemName.length < 2) throw new UserFacingError(`Nama pada baris ${rowNumber} minimal 2 karakter.`);
    if (itemName.length > maxNameLength) throw new UserFacingError(`Nama pada baris ${rowNumber} maksimal ${maxNameLength} karakter.`);
    if (description.length > 500) throw new UserFacingError(`Deskripsi pada baris ${rowNumber} maksimal 500 karakter.`);
    rows.push({ name: itemName, description: description || null });
  });

  if (!rows.length) throw new UserFacingError("File Excel tidak memiliki data untuk diimpor.");
  if (rows.length > MASTER_DATA_EXCEL_MAX_ROWS) throw new UserFacingError(`Data Master maksimal ${MASTER_DATA_EXCEL_MAX_ROWS.toLocaleString("id-ID")} baris.`);
  const normalizedNames = rows.map((row) => row.name.toLocaleLowerCase("id-ID"));
  if (new Set(normalizedNames).size !== normalizedNames.length) throw new UserFacingError("Nama pada file Excel tidak boleh duplikat.");
  return rows;
}
