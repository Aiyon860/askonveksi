import { ProductionBoardSectionClient } from "@/components/production/production-board-section-client";
import { getProductionBoard } from "@/lib/production/data";
import type { ProductionBoardGroup } from "@/lib/production/workflow";

export async function ProductionBoardSection({
  group,
  productCategoryId,
}: {
  group: ProductionBoardGroup;
  productCategoryId: string | null;
}) {
  const initialData = await getProductionBoard({ group, productCategoryId });

  return <ProductionBoardSectionClient group={group} productCategoryId={productCategoryId} initialData={initialData} />;
}
