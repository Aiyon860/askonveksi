import { createMasterDataWorkbook } from "@/lib/master-data-excel";
import { getLeadSources } from "@/lib/master-data";
import { downloadFilename } from "@/lib/download-filename";

export async function GET() {
  const items = await getLeadSources();
  const body = await createMasterDataWorkbook("Sumber lead", items.map((item) => ({ name: item.name, description: item.description, usageCount: item._count.customers })), undefined, "Jumlah customer");
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${downloadFilename("sumber-lead", "xlsx")}"`,
    },
  });
}
