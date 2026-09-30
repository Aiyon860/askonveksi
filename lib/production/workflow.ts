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

export function nextProductionStage(sequence: readonly ProductionStage[], current: ProductionStage) {
  const index = sequence.indexOf(current);
  return index >= 0 ? sequence[index + 1] ?? null : null;
}

export function isStageRole(role: AppRole) {
  return role === "DEVELOPER" || role === "OWNER" || role === "ADMIN_PRODUCTION";
}
