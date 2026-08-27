import type { OpportunityStage } from "@prisma/client";

export const PIPELINE_STAGES = [
  "LEAD",
  "FOLLOW_UP",
  "PENAWARAN",
  "DEAL",
  "BATAL",
] as const satisfies readonly OpportunityStage[];

export const STAGE_LABEL: Record<OpportunityStage, string> = {
  LEAD: "Lead",
  FOLLOW_UP: "Follow Up",
  PENAWARAN: "Penawaran",
  DEAL: "Deal",
  BATAL: "Batal",
};

export const OPEN_STAGES: OpportunityStage[] = ["LEAD", "FOLLOW_UP", "PENAWARAN"];

export const ROLE_LABEL = {
  OWNER: "Owner",
  ADMIN: "Admin",
  SALES: "Sales",
} as const;

export const QUOTATION_STATUS_LABEL = {
  DRAFT: "Draft",
  ISSUED: "Terbit",
  ACCEPTED: "Diterima",
  SUPERSEDED: "Digantikan",
} as const;

export const SALES_ORDER_STATUS_LABEL = {
  ACTIVE: "Aktif",
  CANCELLED: "Dibatalkan",
} as const;
