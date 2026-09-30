import type { GarmentType, OpportunityStage } from "@prisma/client";

export const GARMENT_TYPE_LABEL: Record<GarmentType, string> = {
  JERSEY: "Jersey",
  NON_JERSEY: "Non-jersey",
  AKSESORI: "Aksesoris",
};

export const GARMENT_TYPE_OPTIONS: { value: GarmentType; label: string }[] = [
  { value: "JERSEY", label: GARMENT_TYPE_LABEL.JERSEY },
  { value: "NON_JERSEY", label: GARMENT_TYPE_LABEL.NON_JERSEY },
  { value: "AKSESORI", label: GARMENT_TYPE_LABEL.AKSESORI },
];

/** Urutan paksa kategori produk: Jersey, lalu Non-jersey, terakhir Aksesoris. */
export const GARMENT_TYPE_GROUP_RANK: Record<GarmentType, number> = {
  JERSEY: 0,
  NON_JERSEY: 1,
  AKSESORI: 2,
};

export function garmentTypeGroupRank(value: string | null | undefined): number {
  return value && value in GARMENT_TYPE_GROUP_RANK ? GARMENT_TYPE_GROUP_RANK[value as GarmentType] : 99;
}

/** Kelompokkan per jenis kategori tanpa mengubah urutan relatif di dalam grup (untuk drag & payload simpan). */
export function groupProductCategories<T>(items: T[], kindOf: (item: T) => string | null | undefined): T[] {
  return [...items].sort((a, b) => garmentTypeGroupRank(kindOf(a)) - garmentTypeGroupRank(kindOf(b)));
}

/** Urutan kanonik kategori produk: grup, lalu position, lalu nama. */
export function sortProductCategoryRows<T extends { name: string; position: number }>(
  items: T[],
  kindOf: (item: T) => string | null | undefined,
): T[] {
  return [...items].sort(
    (a, b) =>
      garmentTypeGroupRank(kindOf(a)) - garmentTypeGroupRank(kindOf(b))
      || a.position - b.position
      || a.name.localeCompare(b.name, "id"),
  );
}

export const PIPELINE_STAGES = [
  "FOLLOW_UP",
  "NEGOSIASI",
  "DEAL",
  "LOST",
] as const satisfies readonly OpportunityStage[];

export const STAGE_LABEL: Record<OpportunityStage, string> = {
  LEAD_BARU: "Prospek",
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

export const ROLE_LABEL = {
  DEVELOPER: "Developer",
  OWNER: "Owner",
  ADMIN_CUSTOMER: "Admin Customer",
  ADMIN_PRODUCTION: "Admin Produksi",
  KEUANGAN: "Keuangan",
  ADMIN: "Admin",
  SALES: "Sales",
  DESIGNER: "Desainer",
  PRODUCTION: "Produksi",
  QC: "QC",
} as const;

export const INVOICE_STATUS_LABEL = {
  DRAFT: "Draft",
  ISSUED: "Terbit",
  SUPERSEDED: "Digantikan",
  CANCELLED: "Dibatalkan",
} as const;

export const PURCHASE_ORDER_STATUS_LABEL = {
  DRAFT: "Draft",
  AGREED: "Disepakati",
  SUPERSEDED: "Digantikan",
  CANCELLED: "Dibatalkan",
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
