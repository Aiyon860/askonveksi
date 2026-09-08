import type { ProductionRoute } from "@prisma/client";

import { ProductionBoardSectionClient } from "@/components/production/production-board-section-client";
import { getProductionBoard } from "@/lib/production/data";

export async function ProductionBoardSection({ route }: { route: ProductionRoute }) {
  const initialData = await getProductionBoard(route);

  return <ProductionBoardSectionClient route={route} initialData={initialData} />;
}
