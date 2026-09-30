import { downloadFilename } from "@/lib/download-filename";
import { GARMENT_TYPE_LABEL } from "@/lib/crm/constants";
import { getProductCategories } from "@/lib/master-data";
import { createMasterDataWorkbook, PRODUCT_CATEGORY_EXCEL_KIND } from "@/lib/master-data-excel";

export async function GET() {
  const items = await getProductCategories();
  const rows = items.map((item) => ({ name: item.name, description: null, kind: GARMENT_TYPE_LABEL[item.kind] }));
  const body = await createMasterDataWorkbook("Kategori produk", rows, PRODUCT_CATEGORY_EXCEL_KIND);
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${downloadFilename("kategori-produk", "xlsx")}"`,
    },
  });
}
