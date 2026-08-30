import type { OpportunityStage } from "@prisma/client";

export const PIPELINE_STAGES = [
  "LEAD_BARU",
  "DIHUBUNGI",
  "KEBUTUHAN_TERGALI",
  "PENAWARAN",
  "FOLLOW_UP",
  "NEGOSIASI",
  "DEAL",
  "LOST",
] as const satisfies readonly OpportunityStage[];

export const STAGE_LABEL: Record<OpportunityStage, string> = {
  LEAD_BARU: "Lead Baru",
  DIHUBUNGI: "Dihubungi",
  KEBUTUHAN_TERGALI: "Kebutuhan Tergali",
  PENAWARAN: "Penawaran",
  FOLLOW_UP: "Follow Up",
  NEGOSIASI: "Negosiasi",
  DEAL: "Deal",
  LOST: "Lost",
};

export const OPEN_STAGES: OpportunityStage[] = [
  "LEAD_BARU",
  "DIHUBUNGI",
  "KEBUTUHAN_TERGALI",
  "PENAWARAN",
  "FOLLOW_UP",
  "NEGOSIASI",
];

export const DESIGN_STATUS_LABEL = {
  SUDAH_ADA: "Sudah ada",
  BELUM_ADA: "Belum ada",
  PERLU_DIBANTU: "Perlu dibantu",
} as const;

export function leadClassification(score: number) {
  if (score >= 80) return "HOT" as const;
  if (score >= 50) return "WARM" as const;
  return "COLD" as const;
}

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
