import { parsePeriodBounds } from "@/lib/crm/period";

import { AI_RANGE_PRESETS, type AiBrandScope, resolveAiBrand } from "@/lib/ai/scope";

/**
 * Parsing parameter API AI — modul murni (tanpa Prisma/Next) supaya validasi
 * bisa diuji langsung dan dipakai bersama oleh REST maupun tool MCP.
 */

/** Kesalahan yang aman ditampilkan ke pemanggil API (tanpa detail internal). */
export class AiRequestError extends Error {
  // Field biasa (bukan parameter property) agar bisa dijalankan Node type-strip saat test.
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AiRequestError";
    this.status = status;
  }
}

export type AiPeriod = ReturnType<typeof parsePeriodBounds>;

export type AiQuery = {
  brand: AiBrandScope;
  range: AiPeriod;
  limit: number;
  granularity: "day" | "week" | "month";
  groupBy: "city" | "source" | "type" | "lifecycle";
};

function single(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key);
  return value && value.trim() !== "" ? value.trim() : undefined;
}

export function parseAiQuery(searchParams: URLSearchParams, options?: { defaultPreset?: string }): AiQuery {
  const preset = single(searchParams, "preset") ?? single(searchParams, "range");
  if (
    preset &&
    !(AI_RANGE_PRESETS as readonly string[]).includes(preset) &&
    !["custom", "today", "yesterday"].includes(preset)
  ) {
    throw new AiRequestError(
      `Preset periode tidak dikenal. Pilihan: ${[...AI_RANGE_PRESETS, "today", "yesterday"].join(", ")}.`,
    );
  }

  const from = single(searchParams, "from");
  const to = single(searchParams, "to");
  const isDate = (value: string | undefined) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
  if ((from && !isDate(from)) || (to && !isDate(to))) {
    throw new AiRequestError("Parameter from/to harus berformat YYYY-MM-DD.");
  }
  if ((from && !to) || (!from && to)) {
    throw new AiRequestError("Isi from dan to sekaligus, atau pakai preset.");
  }

  const range = parsePeriodBounds({ range: preset ?? options?.defaultPreset ?? "30d", from, to });

  const rawLimit = Number(single(searchParams, "limit") ?? 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50) : 10;

  const rawGranularity = single(searchParams, "granularity");
  if (rawGranularity && !["day", "week", "month"].includes(rawGranularity)) {
    throw new AiRequestError("Granularity harus day, week, atau month.");
  }

  const rawGroupBy = single(searchParams, "groupBy");
  if (rawGroupBy && !["city", "source", "type", "lifecycle"].includes(rawGroupBy)) {
    throw new AiRequestError("groupBy harus city, source, type, atau lifecycle.");
  }

  return {
    brand: resolveAiBrand(single(searchParams, "brand")),
    range,
    limit,
    granularity: (rawGranularity as AiQuery["granularity"] | undefined) ?? "month",
    groupBy: (rawGroupBy as AiQuery["groupBy"] | undefined) ?? "city",
  };
}
