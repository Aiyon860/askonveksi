import { downloadFilename } from "@/lib/download-filename";
import { getIncomeForExport, getProjectExpensesBySalesOrders, hppProjectDescription } from "@/lib/finance/expense";
import { parseFinanceDateRange } from "@/lib/finance/date-range";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 80);
  const range = parseFinanceDateRange(params.get("from") ?? undefined, params.get("to") ?? undefined);
  const rawStatus = params.get("status");
  const status = rawStatus === "DP" || rawStatus === "LUNAS" || rawStatus === "DEPOSIT" ? rawStatus : "all";
  const hppStatus = params.get("hppStatus") === "COMPLETE" ? "COMPLETE" : params.get("hppStatus") === "INCOMPLETE" ? "INCOMPLETE" : "all";
  const rows = await getIncomeForExport({ query, from: range.start, to: range.end, status, hppStatus });
  const projectRows = await getProjectExpensesBySalesOrders(rows.map((row) => row.id));
  const projectDescription = new Map(rows.map((row) => [row.id, hppProjectDescription(projectRows.get(row.id) ?? [])]));
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Project");
  sheet.columns = ["Tanggal", "Customer", "Nama order", "Jenis busana", "Total QTY", "Kain", "Zipper", "Jahit", "Pres", "DTF/Plastisol", "Bordir", "Lain-lain", "Deskripsi", "Total HPP", "Harga Asli", "Diskon", "Pajak", "Total Invoice", "Laba Bersih", "Margin", "Deposit", "DP", "Lunas", "Keterangan", "Status"].map((header) => ({ header, key: header, width: header === "Deskripsi" ? 40 : 20 })); sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }];
  // Kolom Deskripsi multi-baris (\n) — wrapText agar tiap baris terlihat di Excel.
  sheet.getColumn("Deskripsi").alignment = { wrapText: true, vertical: "top" };
  rows.forEach((row) => sheet.addRow({ Tanggal: row.paidAt ? new Date(row.paidAt) : "", Customer: row.customer, "Nama order": row.orderName, "Jenis busana": row.garmentType, "Total QTY": row.quantity, Kain: row.kain ? Number(row.kain) : "", Zipper: row.zipper ? Number(row.zipper) : "", Jahit: row.jahit ? Number(row.jahit) : "", Pres: row.pres ? Number(row.pres) : "", "DTF/Plastisol": row.dtfPlastisol ? Number(row.dtfPlastisol) : "", Bordir: row.bordir ? Number(row.bordir) : "", "Lain-lain": row.lainnya ? Number(row.lainnya) : "", Deskripsi: projectDescription.get(row.id) ?? "", "Total HPP": row.hpp ? Number(row.hpp) : "", "Harga Asli": Number(row.originalPrice), Diskon: Number(row.discount), Pajak: Number(row.tax), "Total Invoice": Number(row.totalInvoice), "Laba Bersih": row.netProfit ? Number(row.netProfit) : "", Margin: row.margin ?? "", Deposit: row.deposit ? Number(row.deposit) : "-", DP: row.dp ? Number(row.dp) : "-", Lunas: row.settled ? Number(row.settled) : "-", Keterangan: row.remaining === "0" ? "Lunas" : `Sisa ${row.remaining}`, Status: row.hppStatus === "COMPLETE" ? "Lengkap" : "Belum Lengkap" }));
  return new Response(await workbook.xlsx.writeBuffer(), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${downloadFilename("project", "xlsx")}"` } });
}
