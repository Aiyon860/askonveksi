import type { OpportunityStage, QuotationStatus, SalesOrderStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { QUOTATION_STATUS_LABEL, SALES_ORDER_STATUS_LABEL, STAGE_LABEL } from "@/lib/crm/constants";
import {
  CUSTOMER_ACTIVITY_LABELS,
  type CustomerActivityStatus,
} from "@/lib/crm/reminder-types";

export function OpportunityStatusBadge({ stage }: { stage: OpportunityStage }) {
  const variant = stage === "LOST" ? "destructive" : stage === "DEAL" ? "success" : stage === "LEAD_BARU" || stage === "DIHUBUNGI" ? "info" : stage === "FOLLOW_UP" || stage === "NEGOSIASI" ? "warning" : "highlight";
  return <Badge variant={variant}>{STAGE_LABEL[stage]}</Badge>;
}

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  const variant = status === "ACCEPTED" ? "success" : status === "ISSUED" ? "info" : status === "SUPERSEDED" ? "outline" : "warning";
  return <Badge variant={variant}>{QUOTATION_STATUS_LABEL[status]}</Badge>;
}

export function SalesOrderStatusBadge({ status }: { status: SalesOrderStatus }) {
  return <Badge variant={status === "ACTIVE" ? "success" : "destructive"}>{SALES_ORDER_STATUS_LABEL[status]}</Badge>;
}

export function CustomerActivityBadge({
  status,
  archived = false,
}: {
  status: CustomerActivityStatus;
  archived?: boolean;
}) {
  if (archived) return <Badge variant="outline">Diarsipkan</Badge>;
  const variant = status === "TIDAK_AKTIF"
    ? "destructive"
    : status === "POTENSI_REPEAT"
      ? "warning"
      : status === "AKTIF"
        ? "success"
        : "outline";
  return <Badge variant={variant}>{CUSTOMER_ACTIVITY_LABELS[status]}</Badge>;
}
