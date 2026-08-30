import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { NewLeadForm } from "@/components/crm/new-lead-form";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { PipelineSummary } from "@/components/crm/pipeline-summary";
import { PageHeader } from "@/components/page-header";
import { PageMessage } from "@/components/page-message";
import { getCustomerOptions, getPipelineData } from "@/lib/crm/data";
import { getCustomerFormOptions } from "@/lib/master-data";

export default async function CRMPage() {
  const [{ opportunities, total, truncated }, customers, formOptions] = await Promise.all([
    getPipelineData(),
    getCustomerOptions(),
    getCustomerFormOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Pipeline CRM"
        description="Gerakkan setiap peluang berdasarkan langkah berikutnya. Deal hanya selesai setelah quotation diterima dan Sales Order terbentuk."
        action={<NewLeadForm customers={customers} {...formOptions} />}
      />
      <PageMessage />

      <PipelineSummary opportunities={opportunities} total={total} />

      {truncated ? (
        <Alert>
          <AlertTitle>Board menampilkan 500 peluang terbaru</AlertTitle>
          <AlertDescription>Gunakan halaman customer untuk menelusuri data lama.</AlertDescription>
        </Alert>
      ) : null}

      <PipelineBoard opportunities={opportunities} />
    </>
  );
}
