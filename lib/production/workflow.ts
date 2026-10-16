import type { AppRole, ProductionRoute, ProductionStage } from "@prisma/client";

export const PRODUCTION_ROUTE_LABEL: Record<ProductionRoute, string> = {
  JERSEY: "Jersey",
  NON_JERSEY: "Non-Jersey",
};

/** Grup filter bertingkat di halaman Produksi: Jersey, Non-Jersey, Aksesoris. */
export type ProductionBoardGroup = ProductionRoute | "AKSESORI";

export const PRODUCTION_BOARD_GROUPS: ProductionBoardGroup[] = ["JERSEY", "NON_JERSEY", "AKSESORI"];

export const PRODUCTION_BOARD_GROUP_LABEL: Record<ProductionBoardGroup, string> = {
  JERSEY: "Jersey",
  NON_JERSEY: "Non-Jersey",
  AKSESORI: "Aksesoris",
};

export function parseProductionBoardGroup(value: string | string[] | undefined): ProductionBoardGroup {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "NON_JERSEY" || candidate === "AKSESORI" || candidate === "JERSEY" ? candidate : "JERSEY";
}

/**
 * Kolom kanban per grup. Aksesoris sengaja memakai tahapan Non-Jersey
 * (Work Order aksesoris dibuat dengan route NON_JERSEY).
 */
export function stageRouteForGroup(group: ProductionBoardGroup): ProductionRoute {
  return group === "JERSEY" ? "JERSEY" : "NON_JERSEY";
}

export const PRODUCTION_STAGE_LABEL: Record<ProductionStage, string> = {
  POTONG: "Potong",
  BORDIR: "Bordir",
  SABLON: "Sablon",
  PRINTING: "Printing",
  JAHIT: "Jahit",
  QC: "QC",
  PACKING: "Packing",
  PENGIRIMAN: "Pengiriman",
  TEST_PRINT: "Test Print",
  PERSETUJUAN_SAMPEL: "Persetujuan Sampel",
  LAYOUT_PRODUKSI: "Layout Design",
  PRINT: "Print",
  CUTTING: "Cutting",
  SELESAI: "Selesai",
};

export function productionStages(route: ProductionRoute): ProductionStage[] {
  if (route === "JERSEY") {
    return ["TEST_PRINT", "PERSETUJUAN_SAMPEL", "LAYOUT_PRODUKSI", "PRINT", "CUTTING", "QC", "SELESAI"];
  }

  return ["POTONG", "BORDIR", "SABLON", "PRINTING", "JAHIT", "QC", "PACKING", "PENGIRIMAN", "SELESAI"];
}

/**
 * G1 — Jalur Aksesori 5 stage: Produksi-QC-Packing-Pengiriman-Selesai.
 * Tanpa migrasi DB: memakai enum existing, tahap "Produksi" dipetakan ke JAHIT
 * (label diganti per grup via `stageLabelForGroup`). Work Order menyimpan
 * `stageSequence`-nya sendiri, jadi WO lama 9 stage tetap valid.
 */
export const AKSESORI_STAGE_SEQUENCE: ProductionStage[] = ["JAHIT", "QC", "PACKING", "PENGIRIMAN", "SELESAI"];

/**
 * Kolom "Retur": bukan ProductionStage DB, melainkan rumah khusus untuk WO
 * ACTIVE yang ditandai needsRepair. Kartu Retur berdiam di kolom ini sampai
 * Admin menyeretnya keluar ke kolom tahap mana pun; badge Retur di kartu
 * (repairReason) tetap menempel walaupun kartu sudah Selesai.
 */
export const RETUR_COLUMN = "RETUR" as const;
export type ProductionBoardColumn = ProductionStage | typeof RETUR_COLUMN;
export const RETUR_COLUMN_LABEL = "Retur";

/** Kolom kanban per grup. AKSESORI = 5 stage (G1). */
export function productionStagesForGroup(group: ProductionBoardGroup): ProductionStage[] {
  if (group === "AKSESORI") return [...AKSESORI_STAGE_SEQUENCE];
  return productionStages(stageRouteForGroup(group));
}

/**
 * Kolom kanban per grup. AKSESORI = 5 stage (G1).
 * Kolom efektif = sequence grup + stage legacy yang masih dipakai kartu lama,
 * supaya WO Aksesori lama (9 stage) tidak hilang dari board — plus kolom
 * Retur di paling kanan sebagai pantauan khusus.
 */
export function boardStagesForGroup(group: ProductionBoardGroup, usedStages: readonly ProductionStage[]): ProductionBoardColumn[] {
  const base = productionStagesForGroup(group);
  const extra = usedStages.filter((stage) => !base.includes(stage));
  return [...base, ...extra, RETUR_COLUMN];
}

/** Label kolom: tahap per grup + kolom virtual Retur. */
export function boardColumnLabel(column: ProductionBoardColumn, group: ProductionBoardGroup): string {
  if (column === RETUR_COLUMN) return RETUR_COLUMN_LABEL;
  return stageLabelForGroup(column, group);
}

/** Label tahap per grup: JAHIT tampil sebagai "Produksi" di jalur Aksesori. */
export function stageLabelForGroup(stage: ProductionStage, group: ProductionBoardGroup): string {
  if (group === "AKSESORI" && stage === "JAHIT") return "Produksi";
  return PRODUCTION_STAGE_LABEL[stage];
}

export function nextProductionStage(sequence: readonly ProductionStage[], current: ProductionStage) {
  const index = sequence.indexOf(current);
  return index >= 0 ? sequence[index + 1] ?? null : null;
}

export function isStageRole(role: AppRole) {
  return role === "DEVELOPER" || role === "OWNER" || role === "ADMIN_PO";
}
