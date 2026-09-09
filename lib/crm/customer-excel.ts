import "server-only";

import ExcelJS from "exceljs";

import { UserFacingError } from "@/lib/actions/response";

export type CustomerExcelRow = {
  rowNumber: number;
  customerNo: string;
  name: string;
  companyName: string;
  customerTypeName: string;
  leadSourceName: string;
  salesPicName: string;
  whatsapp: string;
  email: string;
  instagram: string;
  city: string;
  address: string;
  notes: string;
};

export type CustomerExcelExportRow = Omit<CustomerExcelRow, "rowNumber"> & {
  archivedAt: Date | null;
};

export const CUSTOMER_EXCEL_MAX_BYTES = 1 * 1024 * 1024;
export const CUSTOMER_EXCEL_MAX_ROWS = 1_000;

const XLSX_MAX_ENTRIES = 120;
const XLSX_MAX_UNCOMPRESSED_BYTES = 12 * 1024 * 1024;
const XLSX_MAX_COMPRESSION_RATIO = 100;

const COLUMNS = [
  { header: "No. customer", key: "customerNo", width: 18 },
  { header: "Nama", key: "name", width: 32 },
  { header: "Perusahaan/komunitas", key: "companyName", width: 32 },
  { header: "Jenis customer", key: "customerTypeName", width: 22 },
  { header: "Sumber lead", key: "leadSourceName", width: 22 },
  { header: "Sales/PIC", key: "salesPicName", width: 24 },
  { header: "WhatsApp", key: "whatsapp", width: 20 },
  { header: "Email", key: "email", width: 34 },
  { header: "Instagram", key: "instagram", width: 22 },
  { header: "Kota", key: "city", width: 20 },
  { header: "Alamat", key: "address", width: 44 },
  { header: "Catatan", key: "notes", width: 44 },
  { header: "Status arsip", key: "archiveStatus", width: 16 },
] as const;

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
      throw new UserFacingError("Excel Customer tidak boleh berisi formula.");
    }
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
}

function columnIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.includes(header));
}

function optionalCell(row: ExcelJS.Row, index: number) {
  return index < 0 ? "" : cellText(row.getCell(index + 1).value);
}

function assertLength(rowNumber: number, label: string, value: string, max: number) {
  if (value.length > max) {
    throw new UserFacingError(`${label} pada baris ${rowNumber} maksimal ${max.toLocaleString("id-ID")} karakter.`);
  }
}

export async function createCustomerWorkbook(rows: CustomerExcelExportRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ERM Askonveksi";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Customer");
  worksheet.columns = COLUMNS as never;
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  rows.forEach((row) => {
    worksheet.addRow({
      ...row,
      archiveStatus: row.archivedAt ? "Diarsipkan" : "Aktif",
    });
  });

  return workbook.xlsx.writeBuffer();
}

export async function parseCustomerWorkbook(file: File): Promise<CustomerExcelRow[]> {
  if (!file.size) throw new UserFacingError("Pilih file Excel customer terlebih dahulu.");
  if (file.size > CUSTOMER_EXCEL_MAX_BYTES) throw new UserFacingError("File Excel customer maksimal 1 MB.");

  const name = file.name.toLocaleLowerCase("id-ID");
  if (!name.endsWith(".xlsx") && file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    throw new UserFacingError("File customer harus berformat XLSX.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new UserFacingError("Isi file tidak sesuai format XLSX.");
  assertSafeXlsxArchive(bytes);

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as never);
  } catch (error) {
    if (error instanceof UserFacingError) throw error;
    throw new UserFacingError("File Excel customer rusak atau tidak dapat dibaca.");
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new UserFacingError("File Excel customer tidak memiliki sheet.");
  if (worksheet.actualRowCount > CUSTOMER_EXCEL_MAX_ROWS + 1) {
    throw new UserFacingError(`Import customer maksimal ${CUSTOMER_EXCEL_MAX_ROWS.toLocaleString("id-ID")} baris.`);
  }

  const header = worksheet.getRow(1);
  const headers = Array.from({ length: header.cellCount }, (_, index) => cellText(header.getCell(index + 1).value).toLocaleLowerCase("id-ID"));
  const indexes = {
    customerNo: columnIndex(headers, ["no. customer", "no customer", "nomor customer", "customer no", "customer number"]),
    name: columnIndex(headers, ["nama", "name", "nama customer"]),
    companyName: columnIndex(headers, ["perusahaan/komunitas", "perusahaan", "komunitas", "company", "company name"]),
    customerTypeName: columnIndex(headers, ["jenis customer", "customer type", "tipe customer"]),
    leadSourceName: columnIndex(headers, ["sumber lead", "lead source"]),
    salesPicName: columnIndex(headers, ["sales/pic", "sales pic", "pic", "sales"]),
    whatsapp: columnIndex(headers, ["whatsapp", "wa", "nomor telepon", "telepon", "phone"]),
    email: columnIndex(headers, ["email", "e-mail"]),
    instagram: columnIndex(headers, ["instagram", "ig", "sosial media", "social media"]),
    city: columnIndex(headers, ["kota", "city"]),
    address: columnIndex(headers, ["alamat", "address"]),
    notes: columnIndex(headers, ["catatan", "notes"]),
  };

  if (indexes.name < 0) throw new UserFacingError("Header Excel harus memuat kolom Nama.");
  if (indexes.customerTypeName < 0) throw new UserFacingError("Header Excel harus memuat kolom Jenis customer.");

  const rows: CustomerExcelRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const item = {
      rowNumber,
      customerNo: optionalCell(row, indexes.customerNo),
      name: optionalCell(row, indexes.name),
      companyName: optionalCell(row, indexes.companyName),
      customerTypeName: optionalCell(row, indexes.customerTypeName),
      leadSourceName: optionalCell(row, indexes.leadSourceName),
      salesPicName: optionalCell(row, indexes.salesPicName),
      whatsapp: optionalCell(row, indexes.whatsapp),
      email: optionalCell(row, indexes.email),
      instagram: optionalCell(row, indexes.instagram).replace(/^@/, ""),
      city: optionalCell(row, indexes.city),
      address: optionalCell(row, indexes.address),
      notes: optionalCell(row, indexes.notes),
    };

    if (!item.name && !item.companyName && !item.whatsapp && !item.email && !item.instagram) return;
    if (item.name.length < 2) throw new UserFacingError(`Nama customer pada baris ${rowNumber} minimal 2 karakter.`);
    if (!item.customerTypeName) throw new UserFacingError(`Jenis customer pada baris ${rowNumber} wajib diisi.`);
    if (!item.whatsapp && !item.email && !item.instagram) {
      throw new UserFacingError(`Baris ${rowNumber} wajib berisi minimal satu kontak: WhatsApp, email, atau Instagram.`);
    }

    assertLength(rowNumber, "No. customer", item.customerNo, 24);
    assertLength(rowNumber, "Nama customer", item.name, 160);
    assertLength(rowNumber, "Perusahaan/komunitas", item.companyName, 160);
    assertLength(rowNumber, "Jenis customer", item.customerTypeName, 80);
    assertLength(rowNumber, "Sumber lead", item.leadSourceName, 80);
    assertLength(rowNumber, "Sales/PIC", item.salesPicName, 120);
    assertLength(rowNumber, "WhatsApp", item.whatsapp, 32);
    assertLength(rowNumber, "Email", item.email, 320);
    assertLength(rowNumber, "Instagram", item.instagram, 80);
    assertLength(rowNumber, "Kota", item.city, 120);
    assertLength(rowNumber, "Alamat", item.address, 2000);
    assertLength(rowNumber, "Catatan", item.notes, 4000);

    rows.push(item);
  });

  if (!rows.length) throw new UserFacingError("File Excel customer tidak memiliki data untuk diimpor.");
  if (rows.length > CUSTOMER_EXCEL_MAX_ROWS) {
    throw new UserFacingError(`Import customer maksimal ${CUSTOMER_EXCEL_MAX_ROWS.toLocaleString("id-ID")} baris.`);
  }

  return rows;
}
