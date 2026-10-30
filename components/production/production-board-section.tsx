import { ProductionBoardSectionClient } from "@/components/production/production-board-section-client";
import type { ProductionPicOption } from "@/components/production/production-filters";
import type { ProductionBoardFilters } from "@/lib/production/board-filters";
import { getProductionBoard } from "@/lib/production/data";
import type { ProductionBoardGroup } from "@/lib/production/workflow";

export async function ProductionBoardSection({
  group,
  productCategoryId,
  filters,
  picOptions = [],
}: {
  group: ProductionBoardGroup;
  productCategoryId: string | null;
  filters?: ProductionBoardFilters;
  picOptions?: ProductionPicOption[];
}) {
  const initialData = await getProductionBoard({ group, productCategoryId, filters });

  return (
    <ProductionBoardSectionClient
      group={group}
      productCategoryId={productCategoryId}
      filters={filters}
      picOptions={picOptions}
      initialData={initialData}
    />
  );
}
