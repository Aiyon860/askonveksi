import { BRANDS, type Brand } from "@/lib/brand/config";

/** Cakupan brand untuk analitik AI. ALL = gabungan kedua brand. */
export type AiBrandScope = Brand | "ALL";

/** Preset periode yang diterima; sama dengan filter di halaman Analytics. */
export const AI_RANGE_PRESETS = [
  "this-month",
  "last-month",
  "7d",
  "30d",
  "this-year",
  "all",
] as const;

/** Brand tak dikenal jatuh ke brand default, bukan membuka kedua brand. */
export function resolveAiBrand(raw: string | null | undefined): AiBrandScope {
  const value = (raw ?? "").trim().toUpperCase();
  if (value === "ALL" || value === "SEMUA") return "ALL";
  return (BRANDS as readonly string[]).includes(value) ? (value as Brand) : "ASKONVEKSI";
}
