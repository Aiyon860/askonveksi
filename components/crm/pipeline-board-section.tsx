import { getCustomerOptions, getPipelineData } from "@/lib/crm/data";
import { getActivePaymentMethods, getCustomerFormOptions } from "@/lib/master-data";
import { PipelineBoardSectionClient } from "@/components/crm/pipeline-board-section-client";

export async function PipelineBoardSection() {
  const [{ opportunities, total, truncated, actorRole }, customers, formOptions, paymentMethods] = await Promise.all([
    getPipelineData(),
    getCustomerOptions(),
    getCustomerFormOptions(),
    getActivePaymentMethods(),
  ]);

  return (
    <PipelineBoardSectionClient
      initialData={{ opportunities, total, truncated, actorRole }}
      initialCustomers={customers}
      initialFormOptions={formOptions}
      paymentMethods={paymentMethods}
    />
  );
}
