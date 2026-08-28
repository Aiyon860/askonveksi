import { createCustomerTypeAction, toggleCustomerTypeAction, updateCustomerTypeAction } from "@/app/actions/master-data";
import { MasterDataPage } from "@/components/master-data-page";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { getCustomerTypes } from "@/lib/master-data";

export default async function CustomerTypesPage() {
  const items = await getCustomerTypes();
  return (
    <>
      <PageHeader title="Jenis customer" description="Kelola klasifikasi customer yang dipakai secara konsisten pada CRM." />
      <PageMessage />
      <MasterDataPage
        items={items}
        singularLabel="Jenis customer"
        createDescription="Tambahkan klasifikasi baru tanpa mengubah data customer yang sudah ada."
        createAction={createCustomerTypeAction}
        updateAction={updateCustomerTypeAction}
        toggleAction={toggleCustomerTypeAction}
      />
    </>
  );
}
