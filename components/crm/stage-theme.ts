import type { OpportunityStage } from "@prisma/client";

export const STAGE_SURFACE_CLASS: Record<OpportunityStage, string> = {
  LEAD_BARU: "border-info/20 bg-info/5",
  DIHUBUNGI: "border-info/20 bg-info/5",
  KEBUTUHAN_TERGALI: "border-highlight/20 bg-highlight/5",
  PENAWARAN: "border-highlight/20 bg-highlight/5",
  FOLLOW_UP: "border-warning/20 bg-warning/5",
  NEGOSIASI: "border-warning/20 bg-warning/5",
  DEAL: "border-success/20 bg-success/5",
  LOST: "border-destructive/20 bg-destructive/5",
};

export const STAGE_TEXT_CLASS: Record<OpportunityStage, string> = {
  LEAD_BARU: "text-info",
  DIHUBUNGI: "text-info",
  KEBUTUHAN_TERGALI: "text-highlight",
  PENAWARAN: "text-highlight",
  FOLLOW_UP: "text-warning",
  NEGOSIASI: "text-warning",
  DEAL: "text-success",
  LOST: "text-destructive",
};

export const STAGE_SUMMARY_CLASS: Record<OpportunityStage, string> = {
  LEAD_BARU: "bg-info/5",
  DIHUBUNGI: "bg-info/5",
  KEBUTUHAN_TERGALI: "bg-highlight/5",
  PENAWARAN: "bg-highlight/5",
  FOLLOW_UP: "bg-warning/5",
  NEGOSIASI: "bg-warning/5",
  DEAL: "bg-success/5",
  LOST: "bg-destructive/5",
};
