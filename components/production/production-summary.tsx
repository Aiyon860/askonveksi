"use client";

import type { ProductionRoute } from "@prisma/client";

import { STAGE_SUMMARY_CLASS, STAGE_TEXT_CLASS } from "@/components/production/stage-theme";
import { PRODUCTION_STAGE_LABEL, productionStages } from "@/lib/production/workflow";
import { cn } from "@/lib/utils";

type SummaryItem = {
  currentStage: string;
  status: string;
  deadline: string;
  needsRepair: boolean;
};

export function ProductionSummary({
  route,
  items,
  total,
}: {
  route: ProductionRoute;
  items: SummaryItem[];
  total: number;
}) {
  const stages = productionStages(route);
  const today = new Date().setHours(0, 0, 0, 0);
  const overdue = items.filter((item) => item.status === "ACTIVE" && new Date(item.deadline).getTime() < today).length;
  const needsRepair = items.filter((item) => item.needsRepair).length;

  return (
    <section aria-label="Ringkasan produksi" className="grid gap-3">
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
          <dt className="text-xs text-muted-foreground">Total Work Order</dt>
          <dd className="mt-2 font-mono text-xl font-semibold tabular-nums text-primary">{total}</dd>
        </div>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <dt className="text-xs text-muted-foreground">Terlambat</dt>
          <dd className="mt-2 font-mono text-xl font-semibold tabular-nums text-destructive">{overdue}</dd>
        </div>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <dt className="text-xs text-muted-foreground">Perlu perbaikan</dt>
          <dd className="mt-2 font-mono text-xl font-semibold tabular-nums text-destructive">{needsRepair}</dd>
        </div>
      </dl>

      <dl
        className={cn(
          "grid auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1 xl:auto-cols-auto xl:grid-flow-row xl:overflow-visible",
          route === "JERSEY" ? "xl:grid-cols-7" : "xl:grid-cols-9",
        )}
      >
        {stages.map((stage) => (
          <div key={stage} className={cn("rounded-xl border p-4", STAGE_SUMMARY_CLASS[stage])}>
            <dt className="text-xs text-muted-foreground">{PRODUCTION_STAGE_LABEL[stage]}</dt>
            <dd className={cn("mt-2 font-mono text-xl font-semibold tabular-nums", STAGE_TEXT_CLASS[stage])}>
              {items.filter((item) => item.currentStage === stage).length}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
