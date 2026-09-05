import "server-only";

import ExcelJS from "exceljs";

import { UserFacingError } from "@/lib/actions/response";
import { PURCHASE_ORDER_ROSTER_MAX_BYTES, PURCHASE_ORDER_ROSTER_MAX_ROWS } from "@/lib/crm/validation";

export type ImportedRosterRow = { memberId: string; name: string; size: string };

const XLSX_MAX_ENTRIES = 100;
const XLSX_MAX_UNCOMPRESSED_BYTES = 12 * 1024 * 1024;
const XLSX_MAX_COMPRESSION_RATIO = 100;

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
  if (eocdOffset < 0) throw new UserFacingError("Struktur file XLSX tidak valid.");

  const diskNumber = bytes.readUInt16LE(eocdOffset + 4);
  const centralDisk = bytes.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = bytes.readUInt16LE(eocdOffset + 8);
  const entryCount = bytes.readUInt16LE(eocdOffset + 10);
  const centralSize = bytes.readUInt32LE(eocdOffset + 12);
  const centralOffset = bytes.readUInt32LE(eocdOffset + 16);
  if (diskNumber || centralDisk || entriesOnDisk !== entryCount || !entryCount || entryCount > XLSX_MAX_ENTRIES) {
    throw new UserFacingError("Struktur file XLSX tidak didukung.");
  }
  if (centralOffset + centralSize > eocdOffset || centralOffset + centralSize > bytes.length) {
    throw new UserFacingError("Struktur file XLSX tidak valid.");
  }

  let offset = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== centralSignature) {
      throw new UserFacingError("Struktur file XLSX tidak valid.");
    }
    const flags = bytes.readUInt16LE(offset + 8);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const fileNameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    if ((flags & 0x1) !== 0 || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new UserFacingError("File XLSX terenkripsi atau ZIP64 tidak didukung.");
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > XLSX_MAX_UNCOMPRESSED_BYTES) {
      throw new UserFacingError("Isi file XLSX terlalu besar setelah diekstrak.");
    }
    if (compressedSize > 0 && uncompressedSize / compressedSize > XLSX_MAX_COMPRESSION_RATIO) {
      throw new UserFacingError("Rasio kompresi file XLSX tidak aman.");
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  if (offset !== centralOffset + centralSize) throw new UserFacingError("Struktur file XLSX tidak valid.");
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) {
      throw new UserFacingError("Roster Excel tidak boleh berisi formula.");
    }
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (quoted) throw new UserFacingError("Format CSV roster tidak valid.");
  values.push(current.trim());
  return values;
}

function rowsFromGrid(rows: string[][]) {
  if (!rows.length) return [];
  const normalizedHeaders = rows[0].map((value) => value.trim().toLocaleLowerCase("id-ID"));
  const idIndex = normalizedHeaders.findIndex((value) => value === "id");
  const nameIndex = normalizedHeaders.findIndex((value) => value === "nama" || value === "name");
  const sizeIndex = normalizedHeaders.findIndex((value) => value === "size" || value === "ukuran");
  if (idIndex < 0 || nameIndex < 0 || sizeIndex < 0) {
    throw new UserFacingError("Header roster harus memuat kolom ID, Nama, dan Size.");
  }

  const result = rows.slice(1).filter((row) => row.some((value) => value.trim())).map((row, index) => {
    const memberId = row[idIndex]?.trim() ?? "";
    const name = row[nameIndex]?.trim() ?? "";
    const size = row[sizeIndex]?.trim() ?? "";
    if (!memberId || !name || !size) throw new UserFacingError(`Baris roster ${index + 2} belum lengkap.`);
    if (memberId.length > 80 || name.length > 160 || size.length > 40) throw new UserFacingError(`Baris roster ${index + 2} terlalu panjang.`);
    return { memberId, name, size };
  });
  if (result.length > PURCHASE_ORDER_ROSTER_MAX_ROWS) throw new UserFacingError(`Roster maksimal ${PURCHASE_ORDER_ROSTER_MAX_ROWS.toLocaleString("id-ID")} baris.`);
  return result;
}

export async function parseRosterFile(file: File): Promise<ImportedRosterRow[]> {
  if (!file.size) return [];
  if (file.size > PURCHASE_ORDER_ROSTER_MAX_BYTES) throw new UserFacingError("File roster maksimal 2 MB.");
  const name = file.name.toLocaleLowerCase("id-ID");
  const bytes = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".csv") || file.type === "text/csv") {
    try {
      const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
      return rowsFromGrid(source.split(/\r?\n/).filter(Boolean).map(parseCsvLine));
    } catch (error) {
      if (error instanceof UserFacingError) throw error;
      throw new UserFacingError("CSV roster harus memakai encoding UTF-8 yang valid.");
    }
  }
  if (!name.endsWith(".xlsx") && file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    throw new UserFacingError("Roster harus berformat XLSX atau CSV.");
  }
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new UserFacingError("Isi file roster tidak sesuai format XLSX.");
  assertSafeXlsxArchive(bytes);

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as never);
  } catch (error) {
    if (error instanceof UserFacingError) throw error;
    throw new UserFacingError("File XLSX roster rusak atau tidak dapat dibaca.");
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new UserFacingError("File roster tidak memiliki sheet.");
  if (worksheet.actualRowCount > PURCHASE_ORDER_ROSTER_MAX_ROWS + 1) {
    throw new UserFacingError(`Roster maksimal ${PURCHASE_ORDER_ROSTER_MAX_ROWS.toLocaleString("id-ID")} baris.`);
  }
  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    rows.push(Array.from({ length: row.cellCount }, (_, index) => cellText(row.getCell(index + 1).value)));
  });
  return rowsFromGrid(rows);
}
