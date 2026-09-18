import { z } from "zod";

export const CAMPAIGN_VARIABLES = ["customer_name", "company_name", "business_name"] as const;

const variablePattern = /{{\s*([a-z_]+)\s*}}/g;

export function unknownCampaignVariables(body: string) {
  const allowed = new Set<string>(CAMPAIGN_VARIABLES);
  const unknown = [...new Set([...body.matchAll(variablePattern)].map((match) => match[1]).filter((name) => !allowed.has(name)))];
  const remainder = body.replace(variablePattern, "");
  return remainder.includes("{{") || remainder.includes("}}") ? [...unknown, "format tidak valid"] : unknown;
}

export function renderCampaignMessage(body: string, values: Record<(typeof CAMPAIGN_VARIABLES)[number], string>) {
  if (unknownCampaignVariables(body).length) throw new Error("Variabel campaign tidak valid.");
  return body.replace(variablePattern, (_, name: (typeof CAMPAIGN_VARIABLES)[number]) => values[name].trim()).trim();
}

export function parseJakartaDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const result = new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
  const jakarta = new Date(result.getTime() + 7 * 60 * 60 * 1000);
  if (jakarta.getUTCFullYear() !== year || jakarta.getUTCMonth() !== month - 1 || jakarta.getUTCDate() !== day || jakarta.getUTCHours() !== hour || jakarta.getUTCMinutes() !== minute) return null;
  return result;
}

export function jakartaDateTimeInput(value: Date) {
  const jakarta = new Date(value.getTime() + 7 * 60 * 60 * 1000);
  return `${jakarta.getUTCFullYear()}-${String(jakarta.getUTCMonth() + 1).padStart(2, "0")}-${String(jakarta.getUTCDate()).padStart(2, "0")}T${String(jakarta.getUTCHours()).padStart(2, "0")}:${String(jakarta.getUTCMinutes()).padStart(2, "0")}`;
}

export const campaignFieldsSchema = z.object({
  name: z.string().trim().min(2, "Nama campaign minimal 2 karakter.").max(120),
  body: z.string().trim().min(1, "Isi pesan wajib diisi.").max(4000)
    .refine((body) => unknownCampaignVariables(body).length === 0, "Pesan memakai variabel yang tidak didukung."),
  scheduledAt: z.string().trim().refine((value) => parseJakartaDateTime(value) !== null, "Tanggal dan jam mulai WIB tidak valid."),
});

export const updateCampaignSchema = campaignFieldsSchema.extend({
  campaignId: z.string().trim().min(10).max(40),
  version: z.coerce.number().int().positive(),
});

export const campaignTestSchema = z.object({
  body: campaignFieldsSchema.shape.body,
  phoneNumber: z.string().trim().min(1, "Nomor WhatsApp tujuan test wajib diisi.").max(32),
});

export const toggleCampaignSchema = z.object({
  campaignId: z.string().trim().min(10).max(40),
  version: z.coerce.number().int().positive(),
  enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const deleteCampaignSchema = z.object({
  campaignId: z.string().trim().min(10).max(40),
  version: z.coerce.number().int().positive(),
});
