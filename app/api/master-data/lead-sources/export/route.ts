import { createMasterDataWorkbook } from "@/lib/master-data-excel";
import { getLeadSources } from "@/lib/master-data";

export async function GET() {
  const items = await getLeadSources();
  const body = await createMasterDataWorkbook("Sumber lead", items);
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="sumber-lead.xlsx"',
    },
  });
}
