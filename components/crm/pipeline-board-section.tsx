import { getCustomerOptions, getPipelineData } from "@/lib/crm/data";
import { PipelineBoardSectionClient } from "@/components/crm/pipeline-board-section-client";

export async function PipelineBoardSection() {
  const [{ opportunities, total, truncated, actorRole }, customers] = await Promise.all([
    getPipelineData(),
    getCustomerOptions(),
  ]);

  return (
    <PipelineBoardSectionClient
      initialData={{ opportunities, total, truncated, actorRole }}
      initialCustomers={customers}
    />
  );
}
