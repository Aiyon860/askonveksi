import { bulkUpdateGarmentSizesAction, createGarmentSizeAction } from "@/app/actions/master-data";
import { MasterDataPage } from "@/components/master-data-page";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { getGarmentSizes } from "@/lib/master-data";

export default async function GarmentSizesPage() {
  const items = await getGarmentSizes();
  return (
    <>
      <PageHeader title="Ukuran pakaian" description="Kelola pilihan ukuran untuk matriks PO dan roster customer." />
      <PageMessage />
      <MasterDataPage
        items={items}
        singularLabel="Ukuran pakaian"
        usageLabel="Pemakaian"
        createDescription="Ukuran baru langsung tersedia pada PO berikutnya. Data dokumen lama tetap memakai snapshot ukuran saat dibuat."
        createAction={createGarmentSizeAction}
        bulkUpdateAction={bulkUpdateGarmentSizesAction}
      />
    </>
  );
}
