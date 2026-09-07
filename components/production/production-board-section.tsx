import type { ProductionRoute } from "@prisma/client";

import { LegacyProductionSetup } from "@/components/production/legacy-production-setup";
import { ProductionBoard } from "@/components/production/production-board";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getProductionBoard } from "@/lib/production/data";

export async function ProductionBoardSection({ route }: { route: ProductionRoute }) {
  const { items, total, truncated, legacyOrders } = await getProductionBoard(route);

  return (
    <>
      <LegacyProductionSetup orders={legacyOrders} />
      {truncated ? <Alert><AlertTitle>Board menampilkan 500 Work Order terbaru</AlertTitle><AlertDescription>Total {total} Work Order pada jalur ini. Buka Sales Order terkait untuk menelusuri data lama.</AlertDescription></Alert> : null}
      <ProductionBoard route={route} items={items} />
    </>
  );
}
