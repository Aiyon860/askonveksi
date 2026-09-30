import { downloadFilename } from "@/lib/download-filename";
import { getExpensesForExport } from "@/lib/finance/expense";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/finance/expense-categories";
import { parseOptionalFinanceDateRange } from "@/lib/finance/date-range";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const range = parseOptionalFinanceDateRange(params.get("from") ?? undefined, params.get("to") ?? undefined);
  const category = Object.keys(EXPENSE_CATEGORY_LABEL).includes(params.get("category") ?? "") ? params.get("category") as keyof typeof EXPENSE_CATEGORY_LABEL : "all";
  const method = (params.get("method") ?? "all").trim().slice(0, 40) || "all";
  const rows = await getExpensesForExport({ query: (params.get("q") ?? "").trim().slice(0, 80), from: range.start, to: range.end, category, method, creatorId: params.get("creator") ?? "all" });
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Pengeluaran");
  sheet.columns = ["Tanggal", "Keperluan", "Kategori", "Metode", "Dicatat oleh", "Nominal", "Status Ganti"].map((header) => ({ header, key: header, width: 22 })); sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }];
  rows.forEach((row) => sheet.addRow({ Tanggal: row.spentAt, Keperluan: row.purpose, Kategori: EXPENSE_CATEGORY_LABEL[row.category], Metode: row.paymentMethod.name, "Dicatat oleh": row.createdBy.name, Nominal: Number(row.amount), "Status Ganti": row.isReimbursable ? row.reimbursedAt ? "Sudah diganti" : "Belum diganti" : "-" }));
  return new Response(await workbook.xlsx.writeBuffer(), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${downloadFilename("pengeluaran", "xlsx")}"` } });
}
