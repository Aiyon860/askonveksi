import { ProductionBoardSectionClient } from "@/components/production/production-board-section-client";
import type { ProductionPicOption } from "@/components/production/production-filters";
import {
  EMPTY_PRODUCTION_BOARD_FILTERS,
  type ProductionBoardFilters,
  type ProductionCategoryScope,
} from "@/lib/production/board-filters";
import { getProductionBoard, getProductionSearchSuggestions } from "@/lib/production/data";
import type { ProductionBoardGroup } from "@/lib/production/workflow";

export async function ProductionBoardSection({
  group,
  productCategoryId,
  categoryParam,
  categoryName,
  categories,
  filters,
  picOptions = [],
}: {
  group: ProductionBoardGroup;
  productCategoryId: string | null;
  categoryParam: string | null;
  categoryName?: string | null;
  categories: ProductionCategoryScope[];
  filters?: ProductionBoardFilters;
  picOptions?: ProductionPicOption[];
}) {
  const initialData = await getProductionBoard({ group, productCategoryId, filters });
  const searchSuggestions =
    initialData.items.length === 0
      ? await getProductionSearchSuggestions({
          group,
          productCategoryId,
          filters: filters ?? EMPTY_PRODUCTION_BOARD_FILTERS,
          categories,
        })
      : [];

  return (
    <ProductionBoardSectionClient
      group={group}
      productCategoryId={productCategoryId}
      categoryParam={categoryParam}
      categoryName={categoryName}
      searchSuggestions={searchSuggestions}
      filters={filters}
      picOptions={picOptions}
      initialData={initialData}
    />
  );
}
