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

const optionalMoney = (label: string) => optionalText(20).refine(
  (value) => !value || /^\d{1,16}(?:\.\d{1,2})?$/.test(value),
  `${label} tidak valid.`,
);

const requiredVersion = z.preprocess(
  (value) => Number(value),
  z.number().int().positive(),
);

export const entityIdSchema = z.string().trim().min(10).max(40);

const optionalEntityId = z.preprocess(
  (value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value),
  entityIdSchema.optional(),
);

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
    city: optionalText(120),
    notes: optionalText(4000),
    customerTypeId: entityIdSchema,
    leadSourceId: optionalEntityId,
    salesPicId: optionalEntityId,
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

export const masterDataFieldsSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(80),
  description: optionalText(500),
  position: z.coerce.number().int().min(0).max(10_000),
});

export const sortableMasterDataFieldsSchema = masterDataFieldsSchema.omit({ position: true });

export const bulkUpdateMasterDataSchema = z
  .array(sortableMasterDataFieldsSchema.extend({ id: entityIdSchema }))
  .min(1, "Minimal satu data harus tersedia.")
  .max(1_000, "Terlalu banyak data untuk diperbarui sekaligus.");

export const opportunityFieldsSchema = z.object({
  title: z.string().trim().min(3, "Judul peluang minimal 3 karakter.").max(180),
  leadSourceId: optionalEntityId,
  salesPicId: optionalEntityId,
  productName: optionalText(120),
  needPurpose: optionalText(500),
  designStatus: z.preprocess(
    (value) => (value === null || value === "" ? undefined : value),
    z.enum(["SUDAH_ADA", "BELUM_ADA", "PERLU_DIBANTU"]).optional(),
  ),
  specification: optionalText(2000),
  customerBudget: optionalMoney("Budget customer"),
  leadScore: z.coerce.number().int().min(0, "Skor minimal 0.").max(100, "Skor maksimal 100."),
  estimatedQuantity: optionalPositiveInteger,
  estimatedValue: optionalMoney("Estimasi nilai"),
  deadline: optionalText(10),
  nextAction: optionalText(500),
  nextActionAt: optionalText(32),
}).superRefine((value, context) => {
  if (Boolean(value.nextAction) !== Boolean(value.nextActionAt)) {
    context.addIssue({
      code: "custom",
      path: value.nextAction ? ["nextActionAt"] : ["nextAction"],
      message: "Next action dan jadwal harus diisi bersamaan.",
    });
  }
});

export const createOpportunitySchema = opportunityFieldsSchema.and(z.object({
  customerId: entityIdSchema,
}));

export const updateOpportunitySchema = opportunityFieldsSchema.and(z.object({
  opportunityId: entityIdSchema,
  version: requiredVersion,
}));

export const moveOpportunitySchema = z
  .object({
    opportunityId: entityIdSchema,
    version: requiredVersion,
    stage: z.enum(["LEAD_BARU", "DIHUBUNGI", "KEBUTUHAN_TERGALI", "PENAWARAN", "FOLLOW_UP", "NEGOSIASI", "LOST"]),
    cancelReason: optionalText(1000),
  })
  .superRefine((value, context) => {
    if (value.stage === "LOST" && !value.cancelReason) {
      context.addIssue({ code: "custom", path: ["cancelReason"], message: "Alasan lost wajib diisi." });
    }
  });

export const recordFollowUpResultSchema = z.object({
  opportunityId: entityIdSchema,
  version: requiredVersion,
  content: z.string().trim().min(2, "Hasil follow-up terlalu pendek.").max(4000),
  contactedAt: z.string().trim().min(1, "Waktu kontak wajib diisi."),
  channel: z.enum(["WHATSAPP", "INSTAGRAM", "PHONE", "EMAIL", "MEETING", "OTHER"]),
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  nextAction: optionalText(500),
  nextActionAt: optionalText(32),
  stage: z.enum(["DIHUBUNGI", "KEBUTUHAN_TERGALI", "PENAWARAN", "FOLLOW_UP", "NEGOSIASI", "LOST"]),
  cancelReason: optionalText(1000),
}).superRefine((value, context) => {
  if (value.stage === "LOST") {
    if (!value.cancelReason) context.addIssue({ code: "custom", path: ["cancelReason"], message: "Alasan lost wajib diisi." });
    return;
  }
  if (!value.nextAction || !value.nextActionAt) {
    context.addIssue({ code: "custom", path: ["nextAction"], message: "Opportunity terbuka wajib memiliki next action dan jadwal." });
  }
});

export const publicLeadSchema = z.object({
  submissionKey: z.uuid(),
  name: z.string().trim().min(2).max(160),
  whatsapp: z.string().trim().min(8).max(32),
  productName: z.string().trim().min(2).max(120),
  estimatedQuantity: optionalPositiveInteger,
  deadline: optionalText(10),
  city: optionalText(120),
  website: optionalText(200),
});

export const addCommunicationActivitySchema = z
  .object({
    context: z.enum(["customer", "opportunity"]),
    customerId: entityIdSchema,
    opportunityId: optionalEntityId,
    channel: z.enum(["INTERNAL_NOTE", "WHATSAPP", "INSTAGRAM", "PHONE", "EMAIL", "MEETING", "OTHER"]),
    direction: z.preprocess(
      (value) => (value === null || value === "" ? undefined : value),
      z.enum(["INBOUND", "OUTBOUND"]).optional(),
    ),
    occurredAt: z.string().trim().min(1, "Waktu aktivitas wajib diisi."),
    content: z.string().trim().min(2, "Ringkasan terlalu pendek.").max(4000),
  })
  .superRefine((value, context) => {
    if (value.context === "opportunity" && !value.opportunityId) {
      context.addIssue({ code: "custom", path: ["opportunityId"], message: "Peluang wajib tersedia." });
    }
    if (value.channel === "INTERNAL_NOTE" && value.direction) {
      context.addIssue({ code: "custom", path: ["direction"], message: "Catatan internal tidak memiliki arah komunikasi." });
    }
    if (value.channel !== "INTERNAL_NOTE" && !value.direction) {
      context.addIssue({ code: "custom", path: ["direction"], message: "Arah komunikasi wajib dipilih." });
    }
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

export const updateUserSchema = z.object({
  userId: entityIdSchema,
  updatedAt: z.string().datetime(),
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
  email: z.email("Email tidak valid.").trim().max(320),
  role: z.enum(["OWNER", "ADMIN", "SALES"]),
});

export const toggleUserSchema = z.object({
  userId: entityIdSchema,
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export function firstValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Data yang dikirim tidak valid.";
}
