import { saveInvoiceSettingsAction } from "@/app/actions/master-data";
import { InvoiceSettingsEditor } from "@/components/invoice-settings-editor";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { requireOwnerAreaPage } from "@/lib/auth/owner-area";
import { getInvoiceSetting, getInvoiceSettingPoints } from "@/lib/master-data";

export default async function InvoiceSettingsPage() {
  await requireOwnerAreaPage();
  const [points, setting] = await Promise.all([getInvoiceSettingPoints(), getInvoiceSetting()]);
  return (
    <>
      <PageHeader
        title="Pengaturan invoice"
        description="Poin Keterangan dan Syarat & Ketentuan yang dicetak pada PDF invoice. Enter membuat poin baru, Shift+Enter menambah baris dalam poin yang sama, dan teks bisa ditebalkan, dimiringkan, digarisbawahi, atau diperbesar per bagian yang diblok. Tombol Lihat pratinjau PDF menampilkan hasil dengan data contoh tanpa perlu menyimpan dulu."
      />
      <PageMessage />
      <InvoiceSettingsEditor
        initialSignatureWidth={setting.signatureWidth}
        initialSignatureHeight={setting.signatureHeight}
        initialPoints={points.map((point) => ({
          id: point.id,
          section: point.section,
          text: point.text,
        }))}
        saveAction={saveInvoiceSettingsAction}
      />
    </>
  );
}
