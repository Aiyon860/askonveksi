import { z } from "zod";

export const WHATSAPP_TEMPLATE_VARIABLES = [
  "business_name",
  "company_name",
  "customer_name",
  "invoice_due_date",
  "invoice_no",
  "invoice_total",
  "payment_amount",
  "payment_due_date",
  "payment_label",
  "next_action",
  "opportunity_no",
  "opportunity_title",
  "sales_pic_name",
] as const;

export type WhatsAppTemplateVariables = Partial<Record<(typeof WHATSAPP_TEMPLATE_VARIABLES)[number], string>>;

export const DEFAULT_INVOICE_ISSUED_TEMPLATE = "Halo {{customer_name}}, invoice {{invoice_no}} dari {{business_name}} sebesar {{invoice_total}} telah diterbitkan. Batas pembayaran: {{invoice_due_date}}. Dokumen invoice terlampir. Mohon konfirmasi setelah pembayaran. Terima kasih.";
export const DEFAULT_INVOICE_DUE_TEMPLATE = "Halo {{customer_name}}, pengingat pembayaran {{payment_label}} untuk invoice {{invoice_no}} sebesar {{payment_amount}} jatuh tempo pada {{payment_due_date}}. Mohon konfirmasi setelah pembayaran. Terima kasih.";
export const DEFAULT_ORDER_REMINDER_TEMPLATE = "Halo {{customer_name}}, sudah enam bulan sejak order terakhir di {{business_name}}. Jika ada kebutuhan produksi baru, balas pesan ini dan kami akan membuat order baru dari awal.";

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

export function renderInvoiceIssuedTemplate(body: string, variables: WhatsAppTemplateVariables) {
  const source = variables.invoice_due_date?.trim()
    ? body
    : body.replace(/\s*Batas pembayaran:\s*{{\s*invoice_due_date\s*}}\s*\.\s*/i, " ");
  return renderWhatsAppTemplate(source, variables).replace(/\s{2,}/g, " ");
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
  triggerType: z.enum(["MANUAL", "NEXT_ACTION", "REACTIVATION", "INVOICE_ISSUED", "INVOICE_DUE"]),
  body: z.string().trim().min(1).max(4000).refine((body) => unknownTemplateVariables(body).length === 0, "Template memakai variabel yang tidak dikenal."),
  isActive: z.boolean(),
  version: z.coerce.number().int().positive().optional(),
});

export const whatsappMessageSchema = z.object({
  conversationId: z.string().trim().min(12),
  text: z.string().trim().min(1).max(4000),
  templateId: z.string().trim().optional(),
});
