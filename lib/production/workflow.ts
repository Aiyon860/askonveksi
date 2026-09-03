import type { AppRole, ProductionRoute, ProductionStage } from "@prisma/client";

export const PRODUCTION_ROUTE_LABEL: Record<ProductionRoute, string> = {
  JERSEY: "Jersey",
  NON_JERSEY: "Non-Jersey",
};

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

export function isStageRole(role: AppRole, stage: ProductionStage) {
  if (role === "OWNER" || role === "ADMIN") return true;
  return stage === "QC" ? role === "QC" : role === "PRODUCTION";
}
