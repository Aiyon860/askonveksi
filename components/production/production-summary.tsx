"use client";

import { STAGE_BADGE_VARIANT } from "@/components/production/stage-theme";
import { Badge } from "@/components/ui/badge";
import { MetricGroup, MetricItem } from "@/components/ui/metric";
import {
  productionStagesForGroup,
  RETUR_COLUMN,
  stageLabelForGroup,
  type ProductionBoardColumn,
  type ProductionBoardGroup,
} from "@/lib/production/workflow";

type SummaryItem = {
  currentStage: string;
  status: string;
  deadline: string;
  needsRepair: boolean;
};

export function ProductionSummary({
  group,
  items,
  total,
}: {
  group: ProductionBoardGroup;
  items: SummaryItem[];
  total: number;
}) {
  const stages: ProductionBoardColumn[] = [...productionStagesForGroup(group), RETUR_COLUMN];
  const today = new Date().setHours(0, 0, 0, 0);
  const overdue = items.filter((item) => item.status === "ACTIVE" && new Date(item.deadline).getTime() < today).length;
  const needsRepair = items.filter((item) => item.needsRepair).length;
  const retur = needsRepair;

  return (
    <section aria-label="Ringkasan produksi" className="grid gap-3">
      <MetricGroup className="sm:grid-cols-3">
        <MetricItem label="Total Work Order" value={total} emphasis />
        <MetricItem label="Terlambat" value={overdue} />
        <MetricItem label="Retur" value={retur} />
      </MetricGroup>

      {/* Satu baris selalu: kolom menyusut (badge + angka diperkecil), scroll horizontal hanya darurat layar sangat sempit. */}
      <MetricGroup className="grid-flow-col auto-cols-[minmax(0,1fr)] overflow-x-auto">
        {stages.map((stage) => (
          <MetricItem
            key={stage}
            className="min-h-20 min-w-0 gap-2 p-2.5 sm:p-3 [&_dd]:text-lg [&_dt]:text-xs"
            label={<Badge variant={STAGE_BADGE_VARIANT[stage]} className="max-w-full truncate px-1.5 text-[11px]">{stage === RETUR_COLUMN ? "Retur" : stageLabelForGroup(stage, group)}</Badge>}
            value={stage === RETUR_COLUMN ? needsRepair : items.filter((item) => item.currentStage === stage).length}
          />
        ))}
      </MetricGroup>
    </section>
  );
}
