import ExcelJS from "exceljs";

import { downloadFilename } from "@/lib/download-filename";
import { getIncomeForExport } from "@/lib/finance/expense";
import { parseFinanceDateRange } from "@/lib/finance/date-range";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 80);
  const range = parseFinanceDateRange(params.get("from") ?? undefined, params.get("to") ?? undefined);
  const status = params.get("status") === "DP" ? "DP" : params.get("status") === "LUNAS" ? "LUNAS" : "all";
  const rows = await getIncomeForExport({ query, from: range.start, to: range.end, status });
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Pemasukan");
  sheet.columns = ["Customer", "Nama order", "Jenis busana", "Total QTY", "Total HPP", "Diskon", "Keuntungan", "Laba Bersih", "Margin", "DP", "Lunas", "Keterangan"].map((header) => ({ header, key: header, width: 20 })); sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }];
  rows.forEach((row) => sheet.addRow({ Customer: row.customer, "Nama order": row.orderName, "Jenis busana": row.garmentType, "Total QTY": row.quantity, "Total HPP": Number(row.hpp), Diskon: Number(row.discount), Keuntungan: Number(row.profit), "Laba Bersih": Number(row.netProfit), Margin: row.margin, DP: row.dp ? Number(row.dp) : "-", Lunas: row.settled ? Number(row.settled) : "-", Keterangan: row.remaining === "0" ? "Lunas" : `Sisa ${row.remaining}` }));
  return new Response(await workbook.xlsx.writeBuffer(), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${downloadFilename("pemasukan", "xlsx")}"` } });
}
