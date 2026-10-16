import { saveInvoiceSettingsAction } from "@/app/actions/master-data";
import { InvoiceSettingsEditor } from "@/components/invoice-settings-editor";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { getInvoiceSettingPoints } from "@/lib/master-data";

export default async function InvoiceSettingsPage() {
  const points = await getInvoiceSettingPoints();
  return (
    <>
      <PageHeader
        title="Pengaturan invoice"
        description="Poin Keterangan dan Syarat & Ketentuan yang dicetak pada PDF invoice. Urutan poin bisa diatur manual dan tiap poin bisa ditebalkan."
      />
      <PageMessage />
      <InvoiceSettingsEditor
        initialPoints={points.map((point) => ({
          id: point.id,
          section: point.section,
          text: point.text,
          bold: point.isBold,
        }))}
        saveAction={saveInvoiceSettingsAction}
      />
    </>
  );
}
