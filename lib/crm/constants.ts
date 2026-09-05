import type { OpportunityStage } from "@prisma/client";

export const PIPELINE_STAGES = [
  "LEAD_BARU",
  "FOLLOW_UP",
  "NEGOSIASI",
  "DEAL",
  "LOST",
] as const satisfies readonly OpportunityStage[];

export const STAGE_LABEL: Record<OpportunityStage, string> = {
  LEAD_BARU: "Lead Baru",
  FOLLOW_UP: "Follow Up",
  NEGOSIASI: "Negosiasi",
  DEAL: "Deal",
  LOST: "Lost",
};

export const OPEN_STAGES: OpportunityStage[] = [
  "LEAD_BARU",
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
  PRODUCTION: "Produksi",
  QC: "QC",
} as const;

export const INVOICE_STATUS_LABEL = {
  DRAFT: "Draft",
  ISSUED: "Terbit",
  SUPERSEDED: "Digantikan",
} as const;

export const PURCHASE_ORDER_STATUS_LABEL = {
  DRAFT: "Draft",
  AGREED: "Disepakati",
  SUPERSEDED: "Digantikan",
} as const;

export const DECORATION_METHODS = ["NONE", "TINTA", "SABLON", "BORDIR"] as const;

export type DecorationMethod = (typeof DECORATION_METHODS)[number];

export const DECORATION_METHOD_LABEL: Record<DecorationMethod, string> = {
  NONE: "Tanpa dekorasi",
  TINTA: "Tinta",
  SABLON: "Sablon",
  BORDIR: "Bordir",
};

export function decorationMethodLabel(value: string | null | undefined) {
  if (!value) return "-";
  return DECORATION_METHODS.includes(value as DecorationMethod)
    ? DECORATION_METHOD_LABEL[value as DecorationMethod]
    : value;
}

export const OPPORTUNITY_DETAIL_TABS = ["peluang", "po", "invoice", "deal", "aktivitas"] as const;

export type OpportunityDetailTab = (typeof OPPORTUNITY_DETAIL_TABS)[number];

export function parseOpportunityDetailTab(value: string | string[] | undefined): OpportunityDetailTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  return OPPORTUNITY_DETAIL_TABS.includes(candidate as OpportunityDetailTab)
    ? candidate as OpportunityDetailTab
    : "peluang";
}

export const PAYMENT_KIND_LABEL = {
  LUNAS: "Lunas",
  DP: "DP",
} as const;

export const SALES_ORDER_STATUS_LABEL = {
  ACTIVE: "Aktif",
  CANCELLED: "Dibatalkan",
} as const;

export const COMMUNICATION_CHANNEL_LABEL = {
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  PHONE: "Telepon",
  EMAIL: "Email",
  MEETING: "Pertemuan",
  OTHER: "Lainnya",
} as const;

export const COMMUNICATION_DIRECTION_LABEL = {
  INBOUND: "Masuk",
  OUTBOUND: "Keluar",
} as const;

export const COMMUNICATION_SYSTEM_EVENT_LABEL = {
  STAGE_CHANGED: "Perubahan status",
  PURCHASE_ORDER_AGREED: "PO disepakati",
  INVOICE_ISSUED: "Invoice terbit",
  DEAL_ORDER_CREATED: "Deal dan Sales Order",
  SALES_ORDER_CANCELLED: "Sales Order dibatalkan",
} as const;
