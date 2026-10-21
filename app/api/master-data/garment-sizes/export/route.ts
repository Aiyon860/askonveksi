import { createMasterDataWorkbook } from "@/lib/master-data-excel";
import { getGarmentSizes } from "@/lib/master-data";
import { downloadFilename } from "@/lib/download-filename";

export async function GET() {
  const items = await getGarmentSizes();
  const body = await createMasterDataWorkbook("Ukuran pakaian", items.map((item) => ({ name: item.name, description: item.description, usageCount: item._count.customers })), undefined, "Pemakaian");
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${downloadFilename("ukuran-pakaian", "xlsx")}"`,
    },
  });
}
