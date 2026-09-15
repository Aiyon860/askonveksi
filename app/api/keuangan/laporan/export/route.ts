import ExcelJS from "exceljs";

import { downloadFilename } from "@/lib/download-filename";
import { parseOptionalFinanceDateRange } from "@/lib/finance/date-range";
import { getFinanceReport } from "@/lib/finance/report";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const range = parseOptionalFinanceDateRange(params.get("from") ?? undefined, params.get("to") ?? undefined);
  const report = await getFinanceReport({ from: range.start, to: range.end });
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Laporan");
  sheet.columns = ["Tanggal", "Pemasukan", "Pengeluaran"].map((header) => ({ header, key: header, width: 34 })); sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }];
  report.groups.forEach((group) => { const rows = Math.max(group.income.length, group.expenses.length); for (let index = 0; index < rows; index += 1) sheet.addRow({ Tanggal: index === 0 ? group.date : "", Pemasukan: group.income[index] ? `${group.income[index].label} — Rp ${group.income[index].amount}` : "", Pengeluaran: group.expenses[index] ? `${group.expenses[index].label} — Rp ${group.expenses[index].amount}` : "" }); });
  return new Response(await workbook.xlsx.writeBuffer(), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${downloadFilename("laporan-keuangan", "xlsx")}"` } });
}
