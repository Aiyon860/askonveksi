import { bulkUpdatePaymentMethodsAction, createPaymentMethodAction, importPaymentMethodsAction } from "@/app/actions/master-data";
import { MasterDataPage } from "@/components/master-data-page";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { getPaymentMethods } from "@/lib/master-data";

export default async function PaymentMethodsPage() {
  const items = await getPaymentMethods();
  return (
    <>
      <PageHeader title="Metode pembayaran" description="Kelola kanal penerimaan uang yang dipilih saat mencatat pembayaran invoice." />
      <PageMessage />
      <MasterDataPage
        items={items}
        singularLabel="Metode pembayaran"
        usageLabel="Transaksi"
        createDescription="Metode baru langsung tersedia saat Admin mencatat pembayaran berikutnya."
        createAction={createPaymentMethodAction}
        bulkUpdateAction={bulkUpdatePaymentMethodsAction}
        importAction={importPaymentMethodsAction}
        exportHref="/api/master-data/payment-methods/export"
      />
    </>
  );
}
