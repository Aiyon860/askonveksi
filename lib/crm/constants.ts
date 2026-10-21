import type { GarmentType, OpportunityStage } from "@prisma/client";

// Batas versi desain per produk PO (desain awal + 3 revisi). Dipakai form unggah dan aksi server.
export const DESIGN_REVISION_LIMIT = 4;

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

/**
 * Pintu masuk halaman detail peluang hanya untuk Negosiasi dan seterusnya.
 * Peluang tahap Follow Up masih kualifikasi: judulnya bukan tautan di kanban
 * dan daftar mana pun, dan kartunya diberi permukaan redup supaya bedanya
 * terlihat sebelum dicoba diklik.
 */
export function canOpenOpportunityDetail(stage: string) {
  return stage !== "FOLLOW_UP";
}

export const OPEN_STAGES: OpportunityStage[] = [
  "LEAD_BARU",
  "FOLLOW_UP",
  "NEGOSIASI",
];

export const ROLE_LABEL = {
  DEVELOPER: "Developer",
  OWNER: "Owner",
  ADMIN_CUSTOMER: "Admin Customer",
  ADMIN_PO: "Admin PO",
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

export const DECORATION_METHODS = ["NONE", "PRINTING", "SABLON_DTF", "SABLON_PLASTISOL", "SABLON_RUBBER", "BORDIR"] as const;

// Nilai lawas tetap dikenali agar data lama tampil benar (termasuk Tinta yang sudah dihapus dari opsi).
const LEGACY_DECORATION_METHODS = ["NONE", "TINTA", "SABLON", "BORDIR"] as const;

export type DecorationMethod = (typeof DECORATION_METHODS)[number];

export const DECORATION_METHOD_LABEL: Record<DecorationMethod, string> = {
  NONE: "Tanpa dekorasi",
  PRINTING: "Printing",
  SABLON_DTF: "Sablon DTF",
  SABLON_PLASTISOL: "Sablon Plastisol",
  SABLON_RUBBER: "Sablon Rubber",
  BORDIR: "Bordir",
};

const LEGACY_DECORATION_METHOD_LABEL: Record<string, string> = {
  NONE: "Tanpa dekorasi",
  TINTA: "Tinta",
  SABLON: "Sablon",
  BORDIR: "Bordir",
};

export function decorationMethodLabel(value: string | null | undefined) {
  if (!value) return "-";
  if (DECORATION_METHODS.includes(value as DecorationMethod)) return DECORATION_METHOD_LABEL[value as DecorationMethod];
  if ((LEGACY_DECORATION_METHODS as readonly string[]).includes(value)) return LEGACY_DECORATION_METHOD_LABEL[value] ?? value;
  return value;
}

export function decorationMethodsLabel(values: Array<string> | null | undefined) {
  if (!values?.length) return "-";
  return values.map((value) => decorationMethodLabel(value)).join(", ");
}

// Printing memakai tarif/bucket Tinta.
export function decorationCostBucket(value: string | null | undefined) {
  return value === "PRINTING" ? "TINTA" : value;
}

// Tab peluang dimulai dari PO: kualifikasi disimpan saat peluang dibuat dan
// halaman detail (dibuka dari kartu Negosiasi ke atas) fokus ke dokumen kerja.
// R10: tab Deal dilebur ke Invoice — tab "deal" tidak lagi ada.
export const OPPORTUNITY_DETAIL_TABS = ["po", "invoice", "aktivitas"] as const;

export type OpportunityDetailTab = (typeof OPPORTUNITY_DETAIL_TABS)[number];

export function parseOpportunityDetailTab(value: string | string[] | undefined): OpportunityDetailTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  // Tautan lama `?tab=deal` (bookmark/riwayat) diarahkan ke tab Invoice, bukan jatuh ke PO.
  if (candidate === "deal") return "invoice";
  return OPPORTUNITY_DETAIL_TABS.includes(candidate as OpportunityDetailTab)
    ? candidate as OpportunityDetailTab
    : "po";
}

export const PAYMENT_KIND_LABEL = {
  LUNAS: "Lunas",
  DP: "DP",
  DEPOSIT: "Deposit",
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
