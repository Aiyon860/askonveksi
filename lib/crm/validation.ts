import { z } from "zod";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const optionalPositiveInteger = z.preprocess(
  (value) => (value === "" || value === null ? undefined : Number(value)),
  z.number().int().positive().max(10_000_000).optional(),
);

const requiredVersion = z.preprocess(
  (value) => Number(value),
  z.number().int().positive(),
);

export const entityIdSchema = z.string().trim().min(10).max(40);

export const customerFieldsSchema = z
  .object({
    name: z.string().trim().min(2, "Nama customer minimal 2 karakter.").max(160),
    companyName: optionalText(160),
    whatsapp: optionalText(32),
    email: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.email("Format email tidak valid.").trim().max(320).optional(),
    ),
    instagram: optionalText(80),
    address: optionalText(2000),
  })
  .refine((value) => Boolean(value.whatsapp || value.email || value.instagram), {
    message: "Isi minimal satu kontak: WhatsApp, email, atau Instagram.",
  });

export const createCustomerSchema = customerFieldsSchema;

export const updateCustomerSchema = customerFieldsSchema.and(
  z.object({
    customerId: entityIdSchema,
    version: requiredVersion,
  }),
);

export const archiveCustomerSchema = z.object({
  customerId: entityIdSchema,
  version: requiredVersion,
});

export const createOpportunitySchema = z.object({
  customerId: entityIdSchema,
  title: z.string().trim().min(3, "Judul peluang minimal 3 karakter.").max(180),
  estimatedQuantity: optionalPositiveInteger,
  estimatedValue: optionalText(20).refine(
    (value) => !value || /^\d{1,16}(?:\.\d{1,2})?$/.test(value),
    "Estimasi nilai tidak valid.",
  ),
  deadline: optionalText(10),
});

export const updateOpportunitySchema = z.object({
  opportunityId: entityIdSchema,
  version: requiredVersion,
  title: z.string().trim().min(3).max(180),
  estimatedQuantity: optionalPositiveInteger,
  estimatedValue: optionalText(20).refine(
    (value) => !value || /^\d{1,16}(?:\.\d{1,2})?$/.test(value),
    "Estimasi nilai tidak valid.",
  ),
  deadline: optionalText(10),
});

export const moveOpportunitySchema = z
  .object({
    opportunityId: entityIdSchema,
    version: requiredVersion,
    stage: z.enum(["LEAD", "FOLLOW_UP", "PENAWARAN", "BATAL"]),
    followUpAt: optionalText(32),
    cancelReason: optionalText(1000),
  })
  .superRefine((value, context) => {
    if (value.stage === "FOLLOW_UP" && !value.followUpAt) {
      context.addIssue({ code: "custom", path: ["followUpAt"], message: "Tanggal follow-up wajib diisi." });
    }
    if (value.stage === "BATAL" && !value.cancelReason) {
      context.addIssue({ code: "custom", path: ["cancelReason"], message: "Alasan batal wajib diisi." });
    }
  });

export const addNoteSchema = z.object({
  opportunityId: entityIdSchema,
  content: z.string().trim().min(2, "Catatan terlalu pendek.").max(4000),
});

export const quotationItemSchema = z.object({
  description: z.string().trim().min(2).max(240),
  quantity: z.coerce.number().int().positive().max(10_000_000),
  unitPrice: z.string().trim().regex(/^\d{1,16}(?:\.\d{1,2})?$/, "Harga satuan tidak valid."),
});

export const quotationDraftSchema = z.object({
  opportunityId: entityIdSchema,
  quotationId: entityIdSchema.optional(),
  version: requiredVersion.optional(),
  discountType: z.enum(["NONE", "NOMINAL", "PERCENTAGE"]),
  discountValue: z.string().trim().regex(/^\d{1,16}(?:\.\d{1,2})?$/),
  items: z.array(quotationItemSchema).min(1, "Minimal satu item penawaran.").max(50),
});

export const quotationIdSchema = z.object({
  quotationId: entityIdSchema,
  version: requiredVersion,
});

export const acceptQuotationSchema = quotationIdSchema.extend({
  acceptedAt: z.string().trim().min(1, "Tanggal penerimaan wajib diisi."),
  acceptanceReference: z.string().trim().min(3, "Referensi penerimaan wajib diisi.").max(2000),
});

export const ACCEPTANCE_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPTANCE_PROOF_MAX_BYTES = 5 * 1024 * 1024;

export const reverseSalesOrderSchema = z.object({
  salesOrderId: entityIdSchema,
  cancelReason: z.string().trim().min(5, "Alasan pembatalan minimal 5 karakter.").max(2000),
});

export const loginSchema = z.object({
  email: z.email("Email tidak valid.").trim().max(320),
  password: z.string().min(1).max(128),
});

export const strongPasswordSchema = z
  .string()
  .min(12, "Password minimal 12 karakter.")
  .max(128)
  .regex(/[a-z]/, "Password harus memiliki huruf kecil.")
  .regex(/[A-Z]/, "Password harus memiliki huruf besar.")
  .regex(/[0-9]/, "Password harus memiliki angka.")
  .regex(/[^A-Za-z0-9]/, "Password harus memiliki simbol.");

export const updatePasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sama.",
  });

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email("Email tidak valid.").trim().max(320),
  role: z.enum(["OWNER", "ADMIN", "SALES"]),
  temporaryPassword: strongPasswordSchema,
});

export const toggleUserSchema = z.object({
  userId: entityIdSchema,
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export function firstValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Data yang dikirim tidak valid.";
}
