import { z } from "zod";

const coordinate = z.number().finite().min(0).max(2_000);

const baseFields = {
  id: z.string().min(1).max(64),
  textX: coordinate,
  textY: coordinate,
  text: z.string().trim().max(120).transform((value) => value.toUpperCase()),
  fontSize: z.number().int().min(12).max(48),
};

// Callout lama tidak menyimpan `type`, sehingga field ini opsional dan
// dinormalkan menjadi "callout" agar data lama tetap terbaca.
const calloutAnnotationSchema = z.object({
  type: z.literal("callout").optional(),
  targetX: coordinate,
  targetY: coordinate,
  ...baseFields,
}).transform((value) => ({ ...value, type: "callout" as const }));

const arrowAnnotationSchema = z.object({
  type: z.literal("arrow"),
  points: z.tuple([coordinate, coordinate, coordinate, coordinate]),
  ...baseFields,
});

// Teks berdiri sendiri: hanya teks, tanpa garis atau panah penunjuk.
const textAnnotationSchema = z.object({
  type: z.literal("text"),
  ...baseFields,
});

export const designAnnotationsSchema = z
  .array(z.union([arrowAnnotationSchema, calloutAnnotationSchema, textAnnotationSchema]))
  .min(1, "Tambahkan minimal satu keterangan.")
  .max(50);

export type DesignArrow = z.infer<typeof arrowAnnotationSchema>;
export type DesignCallout = z.infer<typeof calloutAnnotationSchema>;
export type DesignText = z.infer<typeof textAnnotationSchema>;
export type DesignAnnotation = DesignArrow | DesignCallout | DesignText;
export type AnnotationPoint = DesignArrow["points"];
