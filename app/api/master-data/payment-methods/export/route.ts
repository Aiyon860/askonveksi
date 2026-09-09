import { createMasterDataWorkbook } from "@/lib/master-data-excel";
import { getPaymentMethods } from "@/lib/master-data";
import { downloadFilename } from "@/lib/download-filename";

export async function GET() {
  const items = await getPaymentMethods();
  const body = await createMasterDataWorkbook("Metode pembayaran", items);
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${downloadFilename("metode-pembayaran", "xlsx")}"`,
    },
  });
}
