import type { OpportunityStage } from "@prisma/client";

export const STAGE_SURFACE_CLASS: Record<OpportunityStage, string> = {
  LEAD: "border-info/20 bg-info/5",
  FOLLOW_UP: "border-warning/20 bg-warning/5",
  PENAWARAN: "border-highlight/20 bg-highlight/5",
  DEAL: "border-success/20 bg-success/5",
  BATAL: "border-destructive/20 bg-destructive/5",
};

export const STAGE_TEXT_CLASS: Record<OpportunityStage, string> = {
  LEAD: "text-info",
  FOLLOW_UP: "text-warning",
  PENAWARAN: "text-highlight",
  DEAL: "text-success",
  BATAL: "text-destructive",
};

export const STAGE_SUMMARY_CLASS: Record<OpportunityStage, string> = {
  LEAD: "bg-info/5",
  FOLLOW_UP: "bg-warning/5",
  PENAWARAN: "bg-highlight/5",
  DEAL: "bg-success/5",
  BATAL: "bg-destructive/5",
};
