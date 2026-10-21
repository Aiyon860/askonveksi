import { EXPENSE_CATEGORY_LABEL, type ExpenseCategory } from "@/lib/finance/expense-categories";

// Bentuk baris ekspor pengeluaran (JSON-safe — serialisasi dari route data ke klien).
// Definisi kolom + penyusunan baris dipakai klien saat membuat workbook di browser;
// file .xlsx TIDAK pernah memuat gambar (hanya teks/angka — lihat test R14).
export type ExpenseExportRow = {
  spentAt: string;
  purpose: string;
  description: string | null;
  category: ExpenseCategory;
  paymentMethod: { name: string };
  isReimbursable: boolean;
  amount: string;
  proofPath: string | null;
  createdBy: { name: string };
  reimbursedAt: string | null;
  customerName: string | null;
  project: string;
};

export const EXPENSE_EXPORT_COLUMNS = [
  "Tanggal",
  "Keperluan",
  "Customer",
  "Project",
  "Kategori",
  "Metode",
  "Bukti",
  "Dicatat oleh",
  "Nominal",
  "Deskripsi",
  "Status Ganti",
] as const;

export type ExpenseExportLine = { values: Record<string, string | number | Date>; bold?: boolean };

export function buildExpenseExportLines(rows: ExpenseExportRow[], truncated: boolean): ExpenseExportLine[] {
  const lines: ExpenseExportLine[] = rows.map((row) => ({
    values: {
      Tanggal: new Date(`${row.spentAt}T00:00:00.000Z`),
      Keperluan: row.purpose,
      Customer: row.customerName ?? "",
      Project: row.project,
      Kategori: EXPENSE_CATEGORY_LABEL[row.category],
      Metode: row.paymentMethod.name,
      Bukti: row.proofPath ? "Ada" : "-",
      "Dicatat oleh": row.createdBy.name,
      Nominal: Number(row.amount),
      Deskripsi: row.description ?? "",
      "Status Ganti": row.isReimbursable ? row.reimbursedAt ? "Sudah diganti" : "Belum diganti" : "-",
    },
  }));
  const projectTotals = new Map<string, number>();
  rows.forEach((row) => {
    if (row.project) projectTotals.set(row.project, (projectTotals.get(row.project) ?? 0) + Number(row.amount));
  });
  if (projectTotals.size) {
    lines.push({ values: {} });
    projectTotals.forEach((total, project) => {
      lines.push({ values: { Keperluan: `Subtotal Project: ${project}`, Nominal: total }, bold: true });
    });
  }
  if (truncated) {
    lines.push({ values: {} });
    lines.push({ values: { Keperluan: "Data dipotong pada 5.000 baris. Persempit filter tanggal untuk memuat lebih banyak." }, bold: true });
  }
  return lines;
}
