import { createMasterDataWorkbook } from "@/lib/master-data-excel";
import { getCustomerTypes } from "@/lib/master-data";

export async function GET() {
  const items = await getCustomerTypes();
  const body = await createMasterDataWorkbook("Jenis customer", items);
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="jenis-customer.xlsx"',
    },
  });
}
