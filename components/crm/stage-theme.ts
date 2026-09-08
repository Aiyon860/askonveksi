import type { OpportunityStage } from "@prisma/client";

export const STAGE_SURFACE_CLASS: Record<OpportunityStage, string> = {
  LEAD_BARU: "border-border bg-muted/30",
  FOLLOW_UP: "border-border bg-muted/30",
  NEGOSIASI: "border-border bg-muted/30",
  DEAL: "border-border bg-muted/30",
  LOST: "border-border bg-muted/30",
};

export const STAGE_TEXT_CLASS: Record<OpportunityStage, string> = {
  LEAD_BARU: "text-primary",
  FOLLOW_UP: "text-primary",
  NEGOSIASI: "text-warning",
  DEAL: "text-success",
  LOST: "text-destructive",
};

export const STAGE_SUMMARY_CLASS: Record<OpportunityStage, string> = {
  LEAD_BARU: "bg-card",
  FOLLOW_UP: "bg-card",
  NEGOSIASI: "bg-card",
  DEAL: "bg-card",
  LOST: "bg-card",
};
