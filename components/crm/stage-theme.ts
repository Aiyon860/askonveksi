import type { OpportunityStage } from "@prisma/client";

export const STAGE_SURFACE_CLASS: Record<OpportunityStage, string> = {
  LEAD_BARU: "border-info/20 bg-info-surface",
  FOLLOW_UP: "border-highlight/20 bg-highlight-surface",
  NEGOSIASI: "border-warning/20 bg-warning-surface",
  DEAL: "border-success/20 bg-success-surface",
  LOST: "border-destructive/20 bg-destructive-surface",
};

export const STAGE_TEXT_CLASS: Record<OpportunityStage, string> = {
  LEAD_BARU: "text-info-surface-foreground",
  FOLLOW_UP: "text-highlight-surface-foreground",
  NEGOSIASI: "text-warning-surface-foreground",
  DEAL: "text-success-surface-foreground",
  LOST: "text-destructive-surface-foreground",
};

export const STAGE_SUMMARY_CLASS: Record<OpportunityStage, string> = {
  LEAD_BARU: "bg-info-surface",
  FOLLOW_UP: "bg-highlight-surface",
  NEGOSIASI: "bg-warning-surface",
  DEAL: "bg-success-surface",
  LOST: "bg-destructive-surface",
};
