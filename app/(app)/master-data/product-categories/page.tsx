import {
  bulkUpdateProductCategoriesAction,
  createProductCategoryAction,
  deleteProductCategoryAction,
  importProductCategoriesAction,
} from "@/app/actions/master-data";
import { MasterDataPage } from "@/components/master-data-page";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { GARMENT_TYPE_OPTIONS } from "@/lib/crm/constants";
import { getProductCategories } from "@/lib/master-data";

export default async function ProductCategoriesPage() {
  const items = await getProductCategories();
  return (
    <>
      <PageHeader
        title="Kategori produk"
        description="Kelola kategori produk yang tersedia pada detail peluang dan form Purchase Order."
      />
      <PageMessage />
      <MasterDataPage
        items={items}
        singularLabel="Kategori produk"
        nameLabel="Nama kategori"
        kindLabel="Jenis kategori"
        kindOptions={GARMENT_TYPE_OPTIONS}
        usageLabel="Pemakaian"
        excelHint="kolom Nama dan Jenis Kategori"
        createDescription="Kategori baru langsung tersedia di form PO. Jenis kategori menentukan apakah kategori tersebut berjenis Jersey atau Non-jersey."
        createAction={createProductCategoryAction}
        bulkUpdateAction={bulkUpdateProductCategoriesAction}
        deleteAction={deleteProductCategoryAction}
        importAction={importProductCategoriesAction}
        exportHref="/api/master-data/product-categories/export"
        maxNameLength={80}
      />
    </>
  );
}
