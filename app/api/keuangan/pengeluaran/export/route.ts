import ExcelJS from "exceljs";

import { downloadFilename } from "@/lib/download-filename";
import { getExpensesForExport } from "@/lib/finance/expense";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/finance/expense-categories";
import { parseOptionalFinanceDateRange } from "@/lib/finance/date-range";
import { EXPENSE_METHOD_LABEL, EXPENSE_METHODS } from "@/lib/finance/expense-methods";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const range = parseOptionalFinanceDateRange(params.get("from") ?? undefined, params.get("to") ?? undefined);
  const category = Object.keys(EXPENSE_CATEGORY_LABEL).includes(params.get("category") ?? "") ? params.get("category") as keyof typeof EXPENSE_CATEGORY_LABEL : "all";
  const method = EXPENSE_METHODS.includes(params.get("method") as never) ? params.get("method") as (typeof EXPENSE_METHODS)[number] : "all";
  const rows = await getExpensesForExport({ query: (params.get("q") ?? "").trim().slice(0, 80), from: range.start, to: range.end, category, method, creatorId: params.get("creator") ?? "all" });
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Pengeluaran");
  sheet.columns = ["Tanggal", "Keperluan", "Kategori", "Metode", "Dicatat oleh", "Nominal", "Status Pribadi"].map((header) => ({ header, key: header, width: 22 })); sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }];
  rows.forEach((row) => sheet.addRow({ Tanggal: row.spentAt, Keperluan: row.purpose, Kategori: EXPENSE_CATEGORY_LABEL[row.category], Metode: EXPENSE_METHOD_LABEL[row.paymentMethod], "Dicatat oleh": row.createdBy.name, Nominal: Number(row.amount), "Status Pribadi": row.paymentMethod === "PRIBADI" ? row.reimbursedAt ? "Sudah diganti" : "Belum diganti" : "-" }));
  return new Response(await workbook.xlsx.writeBuffer(), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${downloadFilename("pengeluaran", "xlsx")}"` } });
}
