import { OpportunityStatusBadge } from "@/components/status-badge";
import { MetricGroup, MetricItem } from "@/components/ui/metric";
import { PIPELINE_STAGES } from "@/lib/crm/constants";
import type { PipelineOpportunity } from "@/lib/crm/data";

export function PipelineSummary({
  opportunities,
  total,
}: {
  opportunities: PipelineOpportunity[];
  total: number;
}) {
  return (
    <section aria-label="Ringkasan pipeline">
      <MetricGroup className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricItem label="Total peluang" value={total} tone="primary" emphasis />
        {PIPELINE_STAGES.map((stage) => (
          <MetricItem
            key={stage}
            label={<OpportunityStatusBadge stage={stage} />}
            value={opportunities.filter((opportunity) => opportunity.stage === stage).length}
          />
        ))}
      </MetricGroup>
    </section>
  );
}
