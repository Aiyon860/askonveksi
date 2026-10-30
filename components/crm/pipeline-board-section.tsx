import { getCustomerOptions, getPipelineData } from "@/lib/crm/data";
import { getActiveProductCategories } from "@/lib/master-data";
import { PipelineBoardSectionClient } from "@/components/crm/pipeline-board-section-client";

export async function PipelineBoardSection() {
  const [{ opportunities, total, truncated, actorRole }, customers, categories] = await Promise.all([
    getPipelineData(),
    getCustomerOptions(),
    getActiveProductCategories(),
  ]);

  return (
    <PipelineBoardSectionClient
      initialData={{ opportunities, total, truncated, actorRole }}
      initialCustomers={customers}
      initialCategories={categories.map(({ id, name, garmentType }) => ({ id, name, garmentType }))}
    />
  );
}
