import "server-only";

import {
  INVOICE_COLUMNS,
  LAPORAN_COLUMNS,
  MUTASI_COLUMNS,
  PENGELUARAN_COLUMNS,
  PENGELUARAN_TERHAPUS_COLUMNS,
  PROJECT_COLUMNS,
  RINCIAN_HPP_COLUMNS,
  loadInvoice,
  loadLaporan,
  loadMutasi,
  loadPengeluaran,
  loadPengeluaranTerhapus,
  loadProject,
  loadRincianHpp,
} from "@/lib/export/datasets/finance";
import {
  CUSTOMER_COLUMNS,
  FOLLOW_UP_COLUMNS,
  KOMUNIKASI_COLUMNS,
  PELUANG_COLUMNS,
  loadCustomer,
  loadFollowUp,
  loadKomunikasi,
  loadPeluang,
} from "@/lib/export/datasets/crm";
import {
  DETAIL_DESAIN_COLUMNS,
  PRODUKSI_COLUMNS,
  PURCHASE_ORDER_COLUMNS,
  SALES_ORDER_COLUMNS,
  loadDetailDesain,
  loadProduksi,
  loadPurchaseOrder,
  loadSalesOrder,
} from "@/lib/export/datasets/orders";
import { ABSENSI_COLUMNS, loadAbsensi } from "@/lib/export/datasets/hr";
import {
  MASTER_COLUMNS,
  loadJenisCustomer,
  loadKategoriProduk,
  loadMetodePembayaran,
  loadSumberLead,
  loadUkuranPakaian,
} from "@/lib/export/datasets/master";
import type { ExportColumn, ExportDatasetResult } from "@/lib/export/types";

type ExportLoaderInput = {
  searchParams: URLSearchParams;
  page: { offset: number; limit: number };
};

export type ExportDatasetDefinition = {
  title: string;
  sheetName: string;
  /** Subjek nama file; di-slug oleh downloadFilename(). */
  subject: string;
  columns: ExportColumn[];
  /** false = loader mengembalikan seluruh baris dalam satu respons (tanpa offset). */
  paged?: boolean;
  load: (input: ExportLoaderInput) => Promise<ExportDatasetResult>;
};

export const EXPORT_DATASETS = {
  pengeluaran: {
    title: "Pengeluaran",
    sheetName: "Pengeluaran",
    subject: "pengeluaran",
    columns: PENGELUARAN_COLUMNS,
    load: loadPengeluaran,
  },
  project: {
    title: "Project / Pemasukan",
    sheetName: "Project",
    subject: "project",
    columns: PROJECT_COLUMNS,
    load: loadProject,
  },
  laporan: {
    title: "Laporan Keuangan",
    sheetName: "Laporan",
    subject: "laporan-keuangan",
    columns: LAPORAN_COLUMNS,
    paged: false,
    load: loadLaporan,
  },
  invoice: {
    title: "Invoice",
    sheetName: "Invoice",
    subject: "invoice",
    columns: INVOICE_COLUMNS,
    load: loadInvoice,
  },
  "mutasi-pembayaran": {
    title: "Mutasi Pembayaran",
    sheetName: "Mutasi Pembayaran",
    subject: "mutasi-pembayaran",
    columns: MUTASI_COLUMNS,
    load: loadMutasi,
  },
  "pengeluaran-terhapus": {
    title: "Riwayat Hapus Pengeluaran",
    sheetName: "Pengeluaran Hapus",
    subject: "riwayat-hapus-pengeluaran",
    columns: PENGELUARAN_TERHAPUS_COLUMNS,
    load: loadPengeluaranTerhapus,
  },
  "rincian-hpp": {
    title: "Rincian HPP",
    sheetName: "Rincian HPP",
    subject: "rincian-hpp",
    columns: RINCIAN_HPP_COLUMNS,
    load: loadRincianHpp,
  },
  absensi: {
    title: "Laporan Absensi",
    sheetName: "Absensi",
    subject: "laporan-absensi",
    columns: ABSENSI_COLUMNS,
    paged: false,
    load: loadAbsensi,
  },
  customer: {
    title: "Customer",
    sheetName: "Customer",
    subject: "customer",
    columns: CUSTOMER_COLUMNS,
    load: loadCustomer,
  },
  peluang: {
    title: "Peluang / Prospek",
    sheetName: "Peluang",
    subject: "peluang",
    columns: PELUANG_COLUMNS,
    load: loadPeluang,
  },
  "follow-up": {
    title: "Follow-up",
    sheetName: "Follow-up",
    subject: "follow-up",
    columns: FOLLOW_UP_COLUMNS,
    load: loadFollowUp,
  },
  komunikasi: {
    title: "Riwayat Komunikasi",
    sheetName: "Komunikasi",
    subject: "riwayat-komunikasi",
    columns: KOMUNIKASI_COLUMNS,
    load: loadKomunikasi,
  },
  "purchase-order": {
    title: "Purchase Order",
    sheetName: "Purchase Order",
    subject: "purchase-order",
    columns: PURCHASE_ORDER_COLUMNS,
    load: loadPurchaseOrder,
  },
  "sales-order": {
    title: "Sales Order",
    sheetName: "Sales Order",
    subject: "sales-order",
    columns: SALES_ORDER_COLUMNS,
    load: loadSalesOrder,
  },
  produksi: {
    title: "Produksi",
    sheetName: "Produksi",
    subject: "produksi",
    columns: PRODUKSI_COLUMNS,
    load: loadProduksi,
  },
  "detail-desain": {
    title: "Detail Desain",
    sheetName: "Detail Desain",
    subject: "detail-desain",
    columns: DETAIL_DESAIN_COLUMNS,
    load: loadDetailDesain,
  },
  "master-jenis-customer": {
    title: "Jenis Customer",
    sheetName: "Jenis Customer",
    subject: "jenis-customer",
    columns: MASTER_COLUMNS.jenisCustomer,
    paged: false,
    load: loadJenisCustomer,
  },
  "master-sumber-lead": {
    title: "Sumber Lead",
    sheetName: "Sumber Lead",
    subject: "sumber-lead",
    columns: MASTER_COLUMNS.sumberLead,
    paged: false,
    load: loadSumberLead,
  },
  "master-kategori-produk": {
    title: "Kategori Produk",
    sheetName: "Kategori Produk",
    subject: "kategori-produk",
    columns: MASTER_COLUMNS.kategoriProduk,
    paged: false,
    load: loadKategoriProduk,
  },
  "master-ukuran-pakaian": {
    title: "Ukuran Pakaian",
    sheetName: "Ukuran Pakaian",
    subject: "ukuran-pakaian",
    columns: MASTER_COLUMNS.ukuranPakaian,
    paged: false,
    load: loadUkuranPakaian,
  },
  "master-metode-pembayaran": {
    title: "Metode Pembayaran",
    sheetName: "Metode Pembayaran",
    subject: "metode-pembayaran",
    columns: MASTER_COLUMNS.metodePembayaran,
    paged: false,
    load: loadMetodePembayaran,
  },
} as const satisfies Record<string, ExportDatasetDefinition>;

export type ExportDatasetId = keyof typeof EXPORT_DATASETS;

export function isExportDatasetId(value: string): value is ExportDatasetId {
  return Object.prototype.hasOwnProperty.call(EXPORT_DATASETS, value);
}
