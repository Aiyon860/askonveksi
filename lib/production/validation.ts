import { z } from "zod";

const id = z.string().cuid();
const workOrderId = z.string().trim().min(10).max(40);
const version = z.coerce.number().int().positive();
const stage = z.enum(["POTONG", "BORDIR", "SABLON", "PRINTING", "JAHIT", "QC", "PACKING", "PENGIRIMAN", "TEST_PRINT", "PERSETUJUAN_SAMPEL", "LAYOUT_PRODUKSI", "PRINT", "CUTTING", "SELESAI"]);

export const moveProductionSchema = z.object({
  workOrderId,
  version,
  targetStage: stage,
  decision: z.enum(["ADVANCE", "SKIP", "SAMPLE_REJECT", "QC_REJECT", "REVERT"]).default("ADVANCE"),
  // Kendala opsional untuk semua jenis perpindahan proses.
  note: z.string().trim().max(2000).optional(),
});

export const updateProductionObstacleSchema = z.object({
  workOrderId,
  obstacle: z.string().trim().max(2000).optional(),
});

export const assignProductionStepSchema = z.object({
  workOrderId,
  stepId: id,
  assigneeId: id,
});

export const addProductionNoteSchema = z.object({
  workOrderId,
  note: z.string().trim().min(2, "Catatan minimal 2 karakter.").max(2000),
});

export const reopenProductionSchema = z.object({
  workOrderId,
  version,
  targetStage: stage,
  note: z.string().trim().min(3, "Alasan minimal 3 karakter.").max(2000),
});
