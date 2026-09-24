import { z } from "zod";

const coordinate = z.number().finite().min(0).max(2_000);

export const designAnnotationsSchema = z.array(z.object({
  id: z.string().min(1).max(64),
  targetX: coordinate,
  targetY: coordinate,
  textX: coordinate,
  textY: coordinate,
  text: z.string().trim().min(1).max(120).transform((value) => value.toUpperCase()),
  fontSize: z.number().int().min(12).max(48),
})).min(1, "Tambahkan minimal satu keterangan.").max(50);

export type DesignAnnotation = z.infer<typeof designAnnotationsSchema>[number];
