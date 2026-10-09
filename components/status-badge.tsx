import type { OpportunityStage, InvoiceStatus, PurchaseOrderStatus, SalesOrderStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS_LABEL, PURCHASE_ORDER_STATUS_LABEL, SALES_ORDER_STATUS_LABEL, STAGE_LABEL } from "@/lib/crm/constants";
import {
  CUSTOMER_ACTIVITY_LABELS,
  type CustomerActivityStatus,
} from "@/lib/crm/reminder-types";

export function OpportunityStatusBadge({ stage, className }: { stage: OpportunityStage; className?: string }) {
  const variant = stage === "LOST" ? "destructive" : stage === "DEAL" ? "success" : stage === "NEGOSIASI" ? "warning" : stage === "FOLLOW_UP" ? "highlight" : "info";
  return <Badge variant={variant} className={className}>{STAGE_LABEL[stage]}</Badge>;
}

export function ProspectStatusBadge({ stage, className }: { stage: OpportunityStage; className?: string }) {
  const lost = stage === "LOST";
  return <Badge variant={lost ? "destructive" : "info"} className={className}>{lost ? STAGE_LABEL.LOST : STAGE_LABEL.LEAD_BARU}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const variant = status === "ISSUED" ? "info" : status === "SUPERSEDED" ? "outline" : status === "CANCELLED" ? "destructive" : "warning";
  return <Badge variant={variant}>{INVOICE_STATUS_LABEL[status]}</Badge>;
}

export function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const variant = status === "AGREED" ? "success" : status === "SUPERSEDED" ? "outline" : status === "CANCELLED" ? "destructive" : "warning";
  return <Badge variant={variant}>{PURCHASE_ORDER_STATUS_LABEL[status]}</Badge>;
}

export function SalesOrderStatusBadge({ status }: { status: SalesOrderStatus }) {
  return <Badge variant={status === "ACTIVE" ? "success" : "destructive"}>{SALES_ORDER_STATUS_LABEL[status]}</Badge>;
}

export function SalesOrderInvoicePaymentBadge({ status }: { status: "PAID" | "UNPAID" }) {
  return <Badge variant={status === "PAID" ? "success" : "destructive"}>{status === "PAID" ? "Lunas" : "Belum Lunas"}</Badge>;
}

export function SalesOrderWoStatusBadge({ status }: { status: "DONE" | "ONGOING" | "NONE" }) {
  if (status === "DONE") return <Badge variant="success">Selesai</Badge>;
  if (status === "ONGOING") return <Badge variant="warning">Belum Selesai</Badge>;
  return <Badge variant="secondary">Belum ada WO</Badge>;
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
    : status === "AKTIF"
        ? "success"
        : "outline";
  return <Badge variant={variant}>{CUSTOMER_ACTIVITY_LABELS[status]}</Badge>;
}
