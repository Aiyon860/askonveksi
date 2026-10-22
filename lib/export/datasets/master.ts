import "server-only";

import { GARMENT_TYPE_LABEL } from "@/lib/crm/constants";
import { getCustomerTypes, getGarmentSizes, getLeadSources, getPaymentMethods, getProductCategories } from "@/lib/master-data";
import type { ExportColumn, ExportDatasetResult, ExportRow } from "@/lib/export/types";

function row(cells: ExportRow["cells"]): ExportRow {
  return { cells };
}

const NAME_COLUMNS: ExportColumn[] = [
  { header: "No", format: "number", width: 8 },
  { header: "Nama", width: 32 },
  { header: "Deskripsi", width: 60 },
  { header: "Pemakaian", format: "number", width: 16 },
];

const PRODUCT_CATEGORY_COLUMNS: ExportColumn[] = [
  { header: "No", format: "number", width: 8 },
  { header: "Nama", width: 32 },
  { header: "Jenis Kategori", width: 20 },
  { header: "Pemakaian", format: "number", width: 16 },
];

function autoNumberColumns(columns: ExportColumn[], usageHeader = "Pemakaian"): ExportColumn[] {
  return columns.map((column) => (column.header === "Pemakaian" ? { ...column, header: usageHeader } : column));
}

export async function loadJenisCustomer(): Promise<ExportDatasetResult> {
  const items = await getCustomerTypes();
  return {
    rows: items.map((item, index) => row([index + 1, item.name, item.description ?? "", item._count.customers])),
    total: items.length,
    filterSummary: "Semua jenis customer",
  };
}

export async function loadSumberLead(): Promise<ExportDatasetResult> {
  const items = await getLeadSources();
  return {
    rows: items.map((item, index) => row([index + 1, item.name, item.description ?? "", item._count.customers])),
    total: items.length,
    filterSummary: "Semua sumber lead",
  };
}

export async function loadKategoriProduk(): Promise<ExportDatasetResult> {
  const items = await getProductCategories();
  return {
    rows: items.map((item, index) => row([index + 1, item.name, GARMENT_TYPE_LABEL[item.kind], item._count.customers])),
    total: items.length,
    filterSummary: "Semua kategori produk",
  };
}

export async function loadUkuranPakaian(): Promise<ExportDatasetResult> {
  const items = await getGarmentSizes();
  return {
    rows: items.map((item, index) => row([index + 1, item.name, item.description ?? "", item._count.customers])),
    total: items.length,
    filterSummary: "Semua ukuran pakaian",
  };
}

export async function loadMetodePembayaran(): Promise<ExportDatasetResult> {
  const items = await getPaymentMethods();
  return {
    rows: items.map((item, index) => row([index + 1, item.name, item.description ?? "", item._count.customers])),
    total: items.length,
    filterSummary: "Semua metode pembayaran",
  };
}

export const MASTER_COLUMNS = {
  jenisCustomer: autoNumberColumns(NAME_COLUMNS, "Jumlah customer"),
  sumberLead: autoNumberColumns(NAME_COLUMNS, "Jumlah customer"),
  kategoriProduk: PRODUCT_CATEGORY_COLUMNS,
  ukuranPakaian: autoNumberColumns(NAME_COLUMNS, "Transaksi"),
  metodePembayaran: autoNumberColumns(NAME_COLUMNS, "Transaksi"),
};
