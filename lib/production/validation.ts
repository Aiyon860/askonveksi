import { z } from "zod";

const id = z.string().cuid();
const workOrderId = z.string().trim().min(10).max(40);
const version = z.coerce.number().int().positive();
const stage = z.enum(["POTONG", "BORDIR", "SABLON", "PRINTING", "JAHIT", "QC", "PACKING", "PENGIRIMAN", "TEST_PRINT", "PERSETUJUAN_SAMPEL", "LAYOUT_PRODUKSI", "PRINT", "CUTTING", "SELESAI"]);

export const moveProductionSchema = z.object({
  workOrderId,
  version,
  targetStage: stage,
  decision: z.enum(["ADVANCE", "SKIP", "SAMPLE_REJECT", "QC_REJECT"]).default("ADVANCE"),
  note: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  if (value.decision !== "ADVANCE" && (!value.note || value.note.length < 3)) {
    context.addIssue({ code: "custom", path: ["note"], message: "Alasan minimal 3 karakter." });
  }
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

export const configureLegacyProductionSchema = z.object({
  salesOrderId: id,
  productionRoute: z.enum(["JERSEY", "NON_JERSEY"]),
  productionProductName: z.string().trim().min(2).max(160),
  productionDeadline: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
});
