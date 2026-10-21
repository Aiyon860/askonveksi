import { getExpensesForExport } from "@/lib/finance/expense";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/finance/expense-categories";
import { parseOptionalFinanceDateRange } from "@/lib/finance/date-range";
import { buildExpenseExportLines } from "@/lib/finance/expense-export";

// Route data (JSON) untuk export Pengeluaran — pembuatan .xlsx terjadi 100% di browser
// lewat ExpenseExportButton, sehingga filter yang dikirim klien = isi file hasil unduhan.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const range = parseOptionalFinanceDateRange(params.get("from") ?? undefined, params.get("to") ?? undefined);
  const category = Object.keys(EXPENSE_CATEGORY_LABEL).includes(params.get("category") ?? "") ? params.get("category") as keyof typeof EXPENSE_CATEGORY_LABEL : "all";
  const rawType = params.get("expenseType");
  const expenseType = rawType === "OPERASIONAL" || rawType === "PROJECT" ? rawType : "all";
  const method = (params.get("method") ?? "all").trim().slice(0, 40) || "all";
  const order = params.get("order") === "asc" ? "asc" : "desc";
  const { rows, truncated } = await getExpensesForExport({ query: (params.get("q") ?? "").trim().slice(0, 80), customer: (params.get("customer") ?? "").trim().slice(0, 80), from: range.start, to: range.end, category, expenseType, method, creatorId: params.get("creator") ?? "all", order });
  return Response.json({ lines: buildExpenseExportLines(rows, truncated) }, { headers: { "Cache-Control": "no-store" } });
}
