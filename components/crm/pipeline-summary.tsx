import { STAGE_SUMMARY_CLASS, STAGE_TEXT_CLASS } from "@/components/crm/stage-theme";
import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
import type { PipelineOpportunity } from "@/lib/crm/data";
import { cn } from "@/lib/utils";

export function PipelineSummary({
  opportunities,
  total,
}: {
  opportunities: PipelineOpportunity[];
  total: number;
}) {
  return (
    <section aria-label="Ringkasan pipeline" className="grid gap-3">
      <dl className="rounded-xl border border-primary/15 bg-primary/5 p-4">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-sm font-medium text-muted-foreground">Total peluang</dt>
          <dd className="font-mono text-2xl font-semibold tabular-nums text-primary">{total}</dd>
        </div>
      </dl>

      <dl className="grid auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1 xl:grid-cols-8 xl:auto-cols-auto xl:grid-flow-row xl:overflow-visible">
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage} className={cn("rounded-xl border p-4", STAGE_SUMMARY_CLASS[stage])}>
            <dt className="text-xs text-muted-foreground">{STAGE_LABEL[stage]}</dt>
            <dd className={cn("mt-2 font-mono text-xl font-semibold tabular-nums", STAGE_TEXT_CLASS[stage])}>
              {opportunities.filter((opportunity) => opportunity.stage === stage).length}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
