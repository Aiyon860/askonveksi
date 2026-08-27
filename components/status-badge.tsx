import type { OpportunityStage, QuotationStatus, SalesOrderStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { QUOTATION_STATUS_LABEL, SALES_ORDER_STATUS_LABEL, STAGE_LABEL } from "@/lib/crm/constants";

export function OpportunityStatusBadge({ stage }: { stage: OpportunityStage }) {
  const variant = stage === "BATAL" ? "destructive" : stage === "DEAL" ? "success" : stage === "LEAD" ? "info" : stage === "FOLLOW_UP" ? "warning" : "highlight";
  return <Badge variant={variant}>{STAGE_LABEL[stage]}</Badge>;
}

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  const variant = status === "ACCEPTED" ? "success" : status === "ISSUED" ? "info" : status === "SUPERSEDED" ? "outline" : "warning";
  return <Badge variant={variant}>{QUOTATION_STATUS_LABEL[status]}</Badge>;
}

export function SalesOrderStatusBadge({ status }: { status: SalesOrderStatus }) {
  return <Badge variant={status === "ACTIVE" ? "success" : "destructive"}>{SALES_ORDER_STATUS_LABEL[status]}</Badge>;
}
