import ExcelJS from "exceljs";

import { CRM_OPERATOR_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { downloadFilename } from "@/lib/download-filename";
import { getPrismaClient } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try { await requireActor(CRM_OPERATOR_ROLES); } catch { return new Response("Anda tidak memiliki akses ke template roster.", { status: 403 }); }
  const sizes = await getPrismaClient().garmentSize.findMany({
    where: { isActive: true },
    select: { name: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ERM Askonveksi";
  const roster = workbook.addWorksheet("Roster");
  roster.columns = [
    { header: "ID", key: "id", width: 20 },
    { header: "Nama", key: "name", width: 32 },
    { header: "Ukuran", key: "size", width: 18 },
    { header: "Panjang Lengan", key: "sleeveLength", width: 20 },
  ];
  roster.getRow(1).font = { bold: true };
  roster.getColumn(1).numFmt = "@";
  roster.views = [{ state: "frozen", ySplit: 1 }];
  const example = workbook.addWorksheet("Contoh");
  example.addRow(["ID", "Nama", "Ukuran", "Panjang Lengan"]);
  example.addRow(["A-001", "Contoh Pemakai", sizes[0]?.name ?? "Isi ukuran aktif", "Pendek"]);
  example.addRow(["A-002", "Contoh Pemakai 2", sizes[0]?.name ?? "Isi ukuran aktif", "Panjang"]);
  example.getRow(1).font = { bold: true };
  const options = workbook.addWorksheet("Ukuran Aktif");
  options.addRow(["Ukuran yang dapat dipakai di sheet Roster"]);
  for (const size of sizes) options.addRow([size.name]);

  return new Response(await workbook.xlsx.writeBuffer(), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${downloadFilename("template-roster-po", "xlsx")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
