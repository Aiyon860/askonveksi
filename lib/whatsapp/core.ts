import { z } from "zod";

export const WHATSAPP_TEMPLATE_VARIABLES = [
  "business_name",
  "company_name",
  "customer_name",
  "invoice_due_date",
  "invoice_no",
  "invoice_total",
  "next_action",
  "opportunity_no",
  "opportunity_title",
  "sales_pic_name",
] as const;

export type WhatsAppTemplateVariables = Partial<Record<(typeof WHATSAPP_TEMPLATE_VARIABLES)[number], string>>;

export function normalizeWhatsAppNumber(input: string | null | undefined) {
  const digits = (input ?? "").replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  if (!/^[1-9]\d{7,14}$/.test(normalized)) return null;
  return normalized;
}

export function remoteJidForNumber(input: string) {
  const number = normalizeWhatsAppNumber(input);
  return number ? `${number}@s.whatsapp.net` : null;
}

const templateVariablePattern = /{{\s*([a-z_]+)\s*}}/g;

export function unknownTemplateVariables(body: string) {
  const allowed = new Set<string>(WHATSAPP_TEMPLATE_VARIABLES);
  return [...new Set([...body.matchAll(templateVariablePattern)].map((match) => match[1]).filter((name) => !allowed.has(name)))];
}

export function renderWhatsAppTemplate(body: string, variables: WhatsAppTemplateVariables) {
  const unknown = unknownTemplateVariables(body);
  if (unknown.length) throw new Error(`Variabel template tidak dikenal: ${unknown.join(", ")}.`);
  const rendered = body.replace(templateVariablePattern, (_, name: keyof WhatsAppTemplateVariables) => variables[name]?.trim() ?? "").trim();
  if (!rendered) throw new Error("Isi pesan tidak boleh kosong.");
  return rendered;
}

export function nextWhatsAppSendAt(reference: Date) {
  const jakarta = new Date(reference.getTime() + 7 * 60 * 60 * 1000);
  const year = jakarta.getUTCFullYear();
  const month = jakarta.getUTCMonth();
  const day = jakarta.getUTCDate();
  const hour = jakarta.getUTCHours();
  if (hour < 9) return new Date(Date.UTC(year, month, day, 2));
  if (hour >= 17) return new Date(Date.UTC(year, month, day + 1, 2));
  return reference;
}

export const whatsappAccountSchema = z.object({
  label: z.string().trim().min(2).max(80),
  phoneNumber: z.string().transform((value, context) => {
    const normalized = normalizeWhatsAppNumber(value);
    if (!normalized) context.addIssue({ code: "custom", message: "Nomor WhatsApp tidak valid." });
    return normalized ?? "";
  }),
});

export const whatsappTemplateSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(2).max(80),
  triggerType: z.enum(["MANUAL", "NEXT_ACTION", "REPEAT_ORDER", "REACTIVATION", "INVOICE_ISSUED", "INVOICE_DUE"]),
  body: z.string().trim().min(1).max(4000).refine((body) => unknownTemplateVariables(body).length === 0, "Template memakai variabel yang tidak dikenal."),
  isActive: z.boolean(),
  version: z.coerce.number().int().positive().optional(),
});

export const whatsappMessageSchema = z.object({
  conversationId: z.string().trim().min(12),
  text: z.string().trim().min(1).max(4000),
  templateId: z.string().trim().optional(),
});

