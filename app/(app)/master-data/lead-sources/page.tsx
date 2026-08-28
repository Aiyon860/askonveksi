import { bulkUpdateLeadSourcesAction, createLeadSourceAction } from "@/app/actions/master-data";
import { MasterDataPage } from "@/components/master-data-page";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { getLeadSources } from "@/lib/master-data";

export default async function LeadSourcesPage() {
  const items = await getLeadSources();
  return (
    <>
      <PageHeader title="Sumber lead" description="Jaga asal lead tetap seragam agar pelaporan CRM dapat dipercaya." />
      <PageMessage />
      <MasterDataPage
        items={items}
        singularLabel="Sumber lead"
        createDescription="Tambahkan kanal perolehan lead yang benar-benar digunakan tim."
        createAction={createLeadSourceAction}
        bulkUpdateAction={bulkUpdateLeadSourcesAction}
      />
    </>
  );
}
