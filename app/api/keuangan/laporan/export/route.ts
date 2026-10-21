import { downloadFilename } from "@/lib/download-filename";
import { parseOptionalFinanceDateRange } from "@/lib/finance/date-range";
import { getFinanceReport } from "@/lib/finance/report";
import { formatCurrency, formatDate } from "@/lib/crm/format";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const range = parseOptionalFinanceDateRange(params.get("from") ?? undefined, params.get("to") ?? undefined);
  const report = await getFinanceReport({ from: range.start, to: range.end });
  // Dynamic agar exceljs (~30MB) tak masuk bundle dingin 600M.
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Laporan");
  sheet.columns = ["Tanggal", "Pemasukan", "Pengeluaran"].map((header) => ({ header, key: header, width: 34 })); sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }];
  report.groups.forEach((group) => { const rows = Math.max(group.income.length, group.expenses.length); for (let index = 0; index < rows; index += 1) sheet.addRow({ Tanggal: index === 0 ? group.date : "", Pemasukan: group.income[index] ? `${group.income[index].label} — ${formatCurrency(group.income[index].amount)}` : "", Pengeluaran: group.expenses[index] ? `${group.expenses[index].label} — ${formatCurrency(group.expenses[index].amount)}` : "" }); });
  // Ringkasan 4 kartu halaman ikut terexport (bukan cuma detail), format rupiah sama.
  const periodLabel = range.from && range.to ? `dari ${formatDate(range.from)} ke ${formatDate(range.to)}` : "seluruh waktu";
  const summary: Array<{ label: string; column: "Pemasukan" | "Pengeluaran"; value: string }> = [
    { label: "Total Pemasukan Keseluruhan", column: "Pemasukan", value: report.allIncome },
    { label: "Total Pengeluaran Keseluruhan", column: "Pengeluaran", value: report.allExpense },
    { label: `Total Pendapatan ${periodLabel}`, column: "Pemasukan", value: report.totalIncome },
    { label: `Total Pengeluaran ${periodLabel}`, column: "Pengeluaran", value: report.totalExpense },
  ];
  sheet.addRow({});
  summary.forEach((item) => { const row = sheet.addRow({ Tanggal: item.label, [item.column]: formatCurrency(item.value) }); row.font = { bold: true }; });
  return new Response(await workbook.xlsx.writeBuffer(), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${downloadFilename("laporan-keuangan", "xlsx")}"` } });
}
