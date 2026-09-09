import { OpportunityStatusBadge } from "@/components/status-badge";
import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/crm/constants";
import type { PipelineOpportunity } from "@/lib/crm/data";
import { cn } from "@/lib/utils";

export function PipelineSummary({
  opportunities,
  total,
  className,
}: {
  opportunities: PipelineOpportunity[];
  total: number;
  className?: string;
}) {
  const counts = PIPELINE_STAGES.map((stage) => ({
    stage,
    count: opportunities.filter((opportunity) => opportunity.stage === stage).length,
  }));

  return (
    <section
      aria-label="Ringkasan pipeline"
      className={cn("flex min-h-9 min-w-0 items-center gap-4 overflow-x-auto py-1 text-sm", className)}
    >
      <div className="flex shrink-0 items-baseline gap-2">
        <span className="text-muted-foreground">Total peluang</span>
        <span className="font-mono text-lg font-semibold tabular-nums text-primary">{total}</span>
      </div>
      <div className="flex min-w-max items-center gap-3">
        {counts.map(({ stage, count }) => (
          <div key={stage} className="flex items-center gap-2" aria-label={`${count} peluang ${STAGE_LABEL[stage]}`}>
            <OpportunityStatusBadge stage={stage} />
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
