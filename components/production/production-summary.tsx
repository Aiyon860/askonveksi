"use client";

import type { ProductionRoute } from "@prisma/client";

import { STAGE_BADGE_VARIANT } from "@/components/production/stage-theme";
import { Badge } from "@/components/ui/badge";
import { MetricGroup, MetricItem } from "@/components/ui/metric";
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
      <MetricGroup className="sm:grid-cols-3">
        <MetricItem label="Total Work Order" value={total} tone="primary" emphasis />
        <MetricItem label="Terlambat" value={overdue} tone="danger" />
        <MetricItem label="Perlu perbaikan" value={needsRepair} tone="danger" />
      </MetricGroup>

      <MetricGroup
        className={cn(
          "grid-cols-2 sm:grid-cols-3",
          route === "JERSEY" ? "xl:grid-cols-7" : "xl:grid-cols-9",
        )}
      >
        {stages.map((stage) => (
          <MetricItem
            key={stage}
            label={<Badge variant={STAGE_BADGE_VARIANT[stage]}>{PRODUCTION_STAGE_LABEL[stage]}</Badge>}
            value={items.filter((item) => item.currentStage === stage).length}
          />
        ))}
      </MetricGroup>
    </section>
  );
}
