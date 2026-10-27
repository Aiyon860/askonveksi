"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { flashMessagePath, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { FINANCE_ROLES, hasRole, OWNER_ACTION_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { EXPENSE_CATEGORIES } from "@/lib/finance/expense-categories";
import { getPrismaClient } from "@/lib/prisma";
import { deletePaymentProof, uploadPaymentProof, type PaymentProof } from "@/lib/payment-proof";

function blankToUndefined(value: unknown) { return value == null || (typeof value === "string" && value.trim() === "") ? undefined : value; }
const expenseSchema = z.object({ id: z.string().cuid().optional(), purpose: z.string().trim().min(2, "Keperluan minimal 2 karakter.").max(500), spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."), amount: z.coerce.number().finite().positive("Nominal harus lebih dari 0."), category: z.enum(EXPENSE_CATEGORIES), paymentMethodId: z.string().trim().min(1, "Metode pembayaran wajib dipilih.").max(40), isReimbursable: z.boolean(), customerName: z.preprocess(blankToUndefined, z.string().trim().max(160).optional()), salesOrderId: z.preprocess(blankToUndefined, z.string().cuid().optional()) });
const idSchema = z.string().cuid();
const deleteExpenseSchema = z.object({ id: z.string().cuid(), reason: z.string().trim().max(500).optional() });
const HPP_KEYS = ["kain", "zipper", "jahit", "pres", "dtfPlastisol", "bordir", "lainnya"] as const;
// Batas server per jenis; UI menyembunyikan tombol tambah baris sebelum batas ini.
const HPP_ROW_LIMIT = 12;
const hppRowSchema = z.object({
  id: z.preprocess(blankToUndefined, z.string().cuid().optional()),
  amount: z.coerce.number().finite().nonnegative("Nominal tidak valid."),
  description: z.preprocess(blankToUndefined, z.string().trim().max(240, "Deskripsi maksimal 240 karakter.").optional()),
  spentAt: z.preprocess(blankToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal pengeluaran tidak valid.").optional()),
  method: z.preprocess(blankToUndefined, z.string().trim().max(40).optional()),
});
// Edit HPP multi-baris (R15): tiap jenis boleh punya banyak baris; nominal kosong/0
// diabaikan — baris existing yang dikosongkan justru dihapus (soft-delete).
const salesOrderProductCostSchema = z.object({
  productCostId: z.string().trim().min(1).max(64),
  version: z.coerce.number().int().positive(),
  rows: z.object({
    kain: z.array(hppRowSchema).max(HPP_ROW_LIMIT, "Maksimal 12 baris Kain."),
    zipper: z.array(hppRowSchema).max(HPP_ROW_LIMIT, "Maksimal 12 baris Zipper."),
    jahit: z.array(hppRowSchema).max(HPP_ROW_LIMIT, "Maksimal 12 baris Jahit."),
    pres: z.array(hppRowSchema).max(HPP_ROW_LIMIT, "Maksimal 12 baris Pres."),
    dtfPlastisol: z.array(hppRowSchema).max(HPP_ROW_LIMIT, "Maksimal 12 baris DTF/Plastisol."),
    bordir: z.array(hppRowSchema).max(HPP_ROW_LIMIT, "Maksimal 12 baris Bordir."),
    lainnya: z.array(hppRowSchema).max(HPP_ROW_LIMIT, "Maksimal 12 baris Lain-lain."),
  }),
});
const PATH = "/keuangan/pengeluaran";

// Pooler Supabase bisa lambat (ratusan ms per query). Default Prisma
// (maxWait 2s / timeout 5s) bisa berakhir P2028 "melewati batas waktu".
const FINANCE_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 20_000,
} as const;

function input(formData: FormData) { const id = formData.get("id"); return { id: typeof id === "string" && id ? id : undefined, purpose: formData.get("purpose"), spentAt: formData.get("spentAt"), amount: formData.get("amount"), category: formData.get("category"), paymentMethodId: formData.get("paymentMethodId"), isReimbursable: formData.get("isReimbursable") === "on", customerName: blankToUndefined(formData.get("customerName")), salesOrderId: blankToUndefined(formData.get("salesOrderId")) }; }
async function assertPaymentMethod(paymentMethodId: string) { const method = await getPrismaClient().paymentMethod.findFirst({ where: { id: paymentMethodId, isActive: true }, select: { id: true } }); if (!method) throw new UserFacingError("Metode pembayaran tidak ditemukan atau tidak aktif."); }
function date(value: string) { const result = new Date(`${value}T00:00:00.000Z`); if (Number.isNaN(result.getTime())) throw new UserFacingError("Tanggal tidak valid."); return result; }
async function audit(tx: Prisma.TransactionClient, actorId: string, entityId: string, action: string, changedFields: string[]) { await tx.auditEvent.create({ data: { actorId, entityType: "Expense", entityId, action, changedFields } }); }
function refresh() { revalidatePath("/keuangan", "layout"); revalidatePath("/keuangan/pengeluaran"); revalidatePath("/keuangan/pengeluaran/riwayat"); }

export async function createExpenseAction(formData: FormData) {
  return runRedirectingAction(PATH, async () => {
    const actor = await requireActor(FINANCE_ROLES); const parsed = expenseSchema.safeParse(input(formData));
    if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Data pengeluaran tidak valid.");
    const proof = await uploadPaymentProof(formData.get("proof"), actor.id);
    if (!proof) throw new UserFacingError("Bukti pengeluaran wajib dilampirkan.");
    await assertPaymentMethod(parsed.data.paymentMethodId);
    try { await getPrismaClient().$transaction(async (tx) => { const item = await tx.expense.create({ data: { purpose: parsed.data.purpose, spentAt: date(parsed.data.spentAt), amount: new Prisma.Decimal(parsed.data.amount), category: parsed.data.category, paymentMethodId: parsed.data.paymentMethodId, isReimbursable: parsed.data.isReimbursable, customerName: parsed.data.customerName ?? null, salesOrderId: parsed.data.salesOrderId ?? null, ...proof, createdById: actor.id } }); await audit(tx, actor.id, item.id, "EXPENSE_CREATED", ["purpose", "spentAt", "amount", "category", "paymentMethodId", "isReimbursable", "customerName", "proofPath"]); }, FINANCE_TRANSACTION_OPTIONS); } catch (error) { await deletePaymentProof(proof.proofPath); throw error; }
    refresh(); return flashMessagePath(PATH, "notice", "Pengeluaran berhasil dicatat.");
  });
}

export async function updateExpenseAction(formData: FormData) {
  return runRedirectingAction(PATH, async () => {
    const actor = await requireActor(FINANCE_ROLES); const parsed = expenseSchema.safeParse(input(formData));
    if (!parsed.success || !parsed.data.id) throw new UserFacingError(parsed.error?.issues[0]?.message ?? "Data pengeluaran tidak valid.");
    const id = parsed.data.id;
    const current = await getPrismaClient().expense.findUnique({ where: { id, deletedAt: null }, select: { reimbursedAt: true, proofPath: true, salesOrderId: true } });
    if (!current) throw new UserFacingError("Pengeluaran tidak ditemukan.");
    if (current.reimbursedAt) throw new UserFacingError("Pengeluaran yang sudah diganti tidak dapat diubah.");
    const proof = await uploadPaymentProof(formData.get("proof"), actor.id);
    if (!proof && !current.proofPath) throw new UserFacingError("Bukti pengeluaran wajib dilampirkan.");
    await assertPaymentMethod(parsed.data.paymentMethodId);
    try { await getPrismaClient().$transaction(async (tx) => { await tx.expense.update({ where: { id }, data: { purpose: parsed.data.purpose, spentAt: date(parsed.data.spentAt), amount: new Prisma.Decimal(parsed.data.amount), category: parsed.data.category, paymentMethodId: parsed.data.paymentMethodId, isReimbursable: parsed.data.isReimbursable, customerName: parsed.data.customerName ?? null, salesOrderId: parsed.data.salesOrderId ?? current.salesOrderId, ...(proof ?? {}) } }); await audit(tx, actor.id, id, "EXPENSE_UPDATED", ["purpose", "spentAt", "amount", "category", "paymentMethodId", "isReimbursable", "customerName", ...(proof ? ["proofPath"] : [])]); }, FINANCE_TRANSACTION_OPTIONS); } catch (error) { await deletePaymentProof(proof?.proofPath); throw error; }
    if (proof) await deletePaymentProof(current.proofPath);
    refresh(); return flashMessagePath(PATH, "notice", "Pengeluaran berhasil diperbarui.");
  });
}

export async function deleteExpenseAction(formData: FormData) {
  return runRedirectingAction(PATH, async () => {
    const actor = await requireActor(FINANCE_ROLES);
    const parsed = deleteExpenseSchema.safeParse({ id: formData.get("id"), reason: formData.get("reason") });
    if (!parsed.success) throw new UserFacingError("Pengeluaran tidak valid.");
    const current = await getPrismaClient().expense.findUnique({ where: { id: parsed.data.id }, select: { createdById: true, reimbursedAt: true, deletedAt: true } });
    if (!current || current.deletedAt) throw new UserFacingError("Pengeluaran tidak ditemukan.");
    if (current.createdById !== actor.id && !hasRole(actor.role, OWNER_ACTION_ROLES)) throw new UserFacingError("Anda hanya dapat menghapus pengeluaran sendiri.");
    if (current.reimbursedAt) throw new UserFacingError("Pengeluaran yang sudah diganti tidak dapat dihapus.");
    const reason = (parsed.data.reason ?? "").trim().slice(0, 500) || null;
    await getPrismaClient().$transaction(async (tx) => {
      await tx.expense.update({ where: { id: parsed.data.id }, data: { deletedAt: new Date(), deletedById: actor.id, deleteReason: reason } });
      await audit(tx, actor.id, parsed.data.id, "EXPENSE_DELETED", ["deletedAt", "deletedById"]);
    }, FINANCE_TRANSACTION_OPTIONS);
    refresh(); return flashMessagePath(PATH, "notice", "Pengeluaran dipindahkan ke riwayat hapus.");
  });
}

export async function restoreExpenseAction(formData: FormData) {
  return runRedirectingAction(PATH, async () => {
    const actor = await requireActor(FINANCE_ROLES);
    const parsed = idSchema.safeParse(formData.get("id")); if (!parsed.success) throw new UserFacingError("Pengeluaran tidak valid.");
    const current = await getPrismaClient().expense.findUnique({ where: { id: parsed.data }, select: { deletedAt: true } });
    if (!current?.deletedAt) throw new UserFacingError("Pengeluaran tidak ada di riwayat hapus.");
    await getPrismaClient().$transaction(async (tx) => {
      await tx.expense.update({ where: { id: parsed.data }, data: { deletedAt: null, deletedById: null, deleteReason: null } });
      await audit(tx, actor.id, parsed.data, "EXPENSE_RESTORED", ["deletedAt"]);
    }, FINANCE_TRANSACTION_OPTIONS);
    refresh(); return flashMessagePath(PATH, "notice", "Pengeluaran dikembalikan dari riwayat hapus.");
  });
}

export async function reimburseExpenseAction(formData: FormData) {
  return runRedirectingAction(PATH, async () => {
    const actor = await requireActor(FINANCE_ROLES); const parsed = idSchema.safeParse(formData.get("id")); if (!parsed.success) throw new UserFacingError("Pengeluaran tidak valid.");
    await getPrismaClient().$transaction(async (tx) => { const current = await tx.expense.findUnique({ where: { id: parsed.data }, select: { isReimbursable: true, reimbursedAt: true, deletedAt: true } }); if (!current || current.deletedAt) throw new UserFacingError("Pengeluaran tidak ditemukan."); if (!current.isReimbursable) throw new UserFacingError("Verifikasi hanya tersedia untuk pengeluaran yang bisa diganti."); if (current.reimbursedAt) throw new UserFacingError("Pengeluaran ini sudah ditandai diganti."); await tx.expense.update({ where: { id: parsed.data }, data: { reimbursedAt: new Date() } }); await audit(tx, actor.id, parsed.data, "EXPENSE_REIMBURSED", ["reimbursedAt"]); }, FINANCE_TRANSACTION_OPTIONS);
    refresh(); return flashMessagePath(PATH, "notice", "Pengeluaran ditandai sudah diganti.");
  });
}

const HPP_LABEL: Record<string, string> = { kain: "Kain", zipper: "Zipper", jahit: "Jahit", pres: "Pres", dtfPlastisol: "DTF/Plastisol", bordir: "Bordir", lainnya: "Lain-lain" };

type HppRowForm = { id?: string; amount: string; description?: string; spentAt?: string; method?: string; proof: FormDataEntryValue | null };

// Baca baris per jenis dari field bernama seragam amount_<key>_<i>, id_<key>_<i>, dst.
// Daftar berhenti saat amount_<key>_<i> tidak ada; lebih dari batas = tolak.
function readHppRows(formData: FormData, key: (typeof HPP_KEYS)[number]): HppRowForm[] {
  const rows: HppRowForm[] = [];
  for (let index = 0; index <= HPP_ROW_LIMIT; index++) {
    const amount = formData.get(`amount_${key}_${index}`);
    if (amount === null) break;
    if (index === HPP_ROW_LIMIT) throw new UserFacingError(`Maksimal ${HPP_ROW_LIMIT} baris ${HPP_LABEL[key]}.`);
    const id = formData.get(`id_${key}_${index}`);
    const description = formData.get(`description_${key}_${index}`);
    const spentAt = formData.get(`spentAt_${key}_${index}`);
    const method = formData.get(`method_${key}_${index}`);
    rows.push({
      id: typeof id === "string" && id ? id : undefined,
      amount: typeof amount === "string" ? amount : "",
      description: typeof description === "string" && description.trim() ? description : undefined,
      spentAt: typeof spentAt === "string" && spentAt ? spentAt : undefined,
      method: typeof method === "string" && method ? method : undefined,
      proof: formData.get(`proof_${key}_${index}`),
    });
  }
  return rows;
}

export async function updateSalesOrderProductCostAction(formData: FormData) {
  return runRedirectingAction("/keuangan/pemasukan", async () => {
    const actor = await requireActor(FINANCE_ROLES);
    const raw = Object.fromEntries(HPP_KEYS.map((key) => [key, readHppRows(formData, key)])) as Record<(typeof HPP_KEYS)[number], HppRowForm[]>;
    const parsed = salesOrderProductCostSchema.safeParse({
      productCostId: formData.get("productCostId"),
      version: formData.get("version"),
      rows: Object.fromEntries(HPP_KEYS.map((key) => [key, raw[key].map((row) => ({ id: row.id, amount: row.amount, description: row.description, spentAt: row.spentAt, method: row.method }))])),
    });
    if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Biaya HPP tidak valid.");
    const { productCostId, version, rows } = parsed.data;
    // Nominal kosong/0 = baris diabaikan; id baris existing yang dikosongkan = dihapus user.
    // Pakai baris mentah (raw) agar field File bukti tidak hilang saat zod parse.
    const plans = HPP_KEYS.flatMap((key) => raw[key].map((row) => ({ key, row }))).filter((plan) => plan.row.amount !== "" && Number(plan.row.amount) > 0);
    const filledIds = new Set(plans.map((plan) => plan.row.id).filter((id): id is string => Boolean(id)));
    const removedIds = new Set<string>(formData.getAll("removedId").map(String).filter(Boolean));
    for (const key of HPP_KEYS) for (const row of rows[key]) if (row.id && !filledIds.has(row.id)) removedIds.add(row.id);
    for (const id of filledIds) removedIds.delete(id);
    for (const plan of plans) {
      if (!plan.row.spentAt) throw new UserFacingError(`Tanggal pembayaran ${HPP_LABEL[plan.key]} wajib diisi.`);
      if (!plan.row.method) throw new UserFacingError(`Metode pembayaran ${HPP_LABEL[plan.key]} wajib dipilih.`);
    }
    await Promise.all([...new Set(plans.map((plan) => plan.row.method as string))].map((methodId) => assertPaymentMethod(methodId)));
    const prisma = getPrismaClient();
    // Hanya baris milik produk ini yang boleh diedit/dihapus. Produk lain pada
    // order yang sama tidak boleh tersentuh dari dialog HPP produk ini.
    const previous = await prisma.expense.findMany({ where: { salesOrderProductCostId: productCostId, category: "PROJECT", deletedAt: null }, select: { id: true, proofPath: true } });
    const previousById = new Map(previous.map((row) => [row.id, row]));
    const usedIds = new Set<string>();
    const claim = (id: string) => {
      if (!previousById.has(id)) throw new UserFacingError("Baris HPP lama tidak ditemukan. Muat ulang halaman.");
      if (usedIds.has(id)) throw new UserFacingError("Terdapat baris HPP ganda. Muat ulang halaman.");
      usedIds.add(id);
    };
    for (const plan of plans) if (plan.row.id) claim(plan.row.id);
    for (const id of removedIds) claim(id);
    // Unggah bukti baris terisi di luar transaksi; file lama baru dihapus setelah komit.
    const uploadedPaths: string[] = [];
    try {
      for (const plan of plans) {
        const uploaded = await uploadPaymentProof(plan.row.proof, actor.id);
        if (uploaded) {
          (plan as { proofUpload?: PaymentProof }).proofUpload = uploaded;
          uploadedPaths.push(uploaded.proofPath);
        }
      }
    } catch (error) {
      for (const path of uploadedPaths) await deletePaymentProof(path);
      throw error;
    }
    const supersededProofPaths: string[] = [];
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const productCost = await tx.salesOrderProductCost.findUnique({
          where: { id: productCostId },
          select: {
            id: true,
            salesOrderId: true,
            productName: true,
            salesOrder: { select: { id: true, status: true, snapshotCustomerName: true, snapshotCompanyName: true } },
          },
        });
        if (!productCost || productCost.salesOrder.status !== "ACTIVE") throw new UserFacingError("Order tidak aktif.");
        // Kolom agregat per jenis = jumlah baris terisi; jenis tanpa baris kembali null.
        const totals = Object.fromEntries(HPP_KEYS.map((key) => [key, plans.filter((plan) => plan.key === key).reduce((sum, plan) => sum + Number(plan.row.amount), 0)])) as Record<(typeof HPP_KEYS)[number], number>;
        const result = await tx.salesOrderProductCost.updateMany({
          where: { id: productCostId, version, salesOrder: { status: "ACTIVE" } },
          data: { ...Object.fromEntries(HPP_KEYS.map((key) => [key, totals[key] > 0 ? new Prisma.Decimal(totals[key]) : null])), version: { increment: 1 } },
        });
        if (result.count !== 1) throw new UserFacingError("Data HPP produk sudah berubah atau order tidak aktif. Muat ulang halaman.");
        // Agregat order dihitung ulang dari seluruh produk agar dashboard/workbook
        // tetap memakai satu baris per order. Dilakukan di database supaya dua
        // dialog produk yang tersimpan berdekatan tidak saling menimpa.
        await tx.salesOrderCost.upsert({ where: { salesOrderId: productCost.salesOrderId }, create: { salesOrderId: productCost.salesOrderId }, update: {} });
        await tx.$executeRaw`
          UPDATE "SalesOrderCost"
          SET
            "kain" = (SELECT NULLIF(SUM("kain"), 0) FROM "SalesOrderProductCost" WHERE "salesOrderId" = ${productCost.salesOrderId}),
            "zipper" = (SELECT NULLIF(SUM("zipper"), 0) FROM "SalesOrderProductCost" WHERE "salesOrderId" = ${productCost.salesOrderId}),
            "jahit" = (SELECT NULLIF(SUM("jahit"), 0) FROM "SalesOrderProductCost" WHERE "salesOrderId" = ${productCost.salesOrderId}),
            "pres" = (SELECT NULLIF(SUM("pres"), 0) FROM "SalesOrderProductCost" WHERE "salesOrderId" = ${productCost.salesOrderId}),
            "dtfPlastisol" = (SELECT NULLIF(SUM("dtfPlastisol"), 0) FROM "SalesOrderProductCost" WHERE "salesOrderId" = ${productCost.salesOrderId}),
            "bordir" = (SELECT NULLIF(SUM("bordir"), 0) FROM "SalesOrderProductCost" WHERE "salesOrderId" = ${productCost.salesOrderId}),
            "lainnya" = (SELECT NULLIF(SUM("lainnya"), 0) FROM "SalesOrderProductCost" WHERE "salesOrderId" = ${productCost.salesOrderId}),
            "updatedAt" = now()
          WHERE "salesOrderId" = ${productCost.salesOrderId}
        `;
        await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "SalesOrderProductCost", entityId: productCostId, action: "SALES_ORDER_PRODUCT_HPP_UPDATED", changedFields: [...HPP_KEYS] } });
        const customerName = productCost.salesOrder.snapshotCompanyName ?? productCost.salesOrder.snapshotCustomerName;
        // (1) Baris existing yang masih terisi: timpa in-place — tidak masuk Riwayat Hapus.
        for (const plan of plans) {
          if (!plan.row.id) continue;
          const proofUpload = (plan as { proofUpload?: PaymentProof }).proofUpload;
          const old = previousById.get(plan.row.id);
          await tx.expense.update({
            where: { id: plan.row.id },
            data: {
              amount: new Prisma.Decimal(plan.row.amount),
              spentAt: date(plan.row.spentAt as string),
              paymentMethodId: plan.row.method as string,
              description: plan.row.description ?? null,
              ...(proofUpload ?? {}),
            },
          });
          if (proofUpload && old?.proofPath && old.proofPath !== proofUpload.proofPath) supersededProofPaths.push(old.proofPath);
          await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "Expense", entityId: plan.row.id, action: "EXPENSE_UPDATED", changedFields: ["amount", "spentAt", "paymentMethodId", "description", ...(proofUpload ? ["proofPath"] : [])] } });
        }
        // (2) Baris baru.
        for (const plan of plans) {
          if (plan.row.id) continue;
          const proofUpload = (plan as { proofUpload?: PaymentProof }).proofUpload;
          const item = await tx.expense.create({
            data: {
              purpose: `HPP ${HPP_LABEL[plan.key] ?? plan.key} · ${customerName} · ${productCost.productName}`,
              description: plan.row.description ?? null,
              spentAt: date(plan.row.spentAt as string),
              amount: new Prisma.Decimal(plan.row.amount),
              category: "PROJECT",
              paymentMethodId: plan.row.method as string,
              isReimbursable: false,
              customerName,
              salesOrderId: productCost.salesOrderId,
              salesOrderProductCostId: productCostId,
              hppKey: plan.key,
              ...(proofUpload ?? {}),
              createdById: actor.id,
            },
          });
          await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "Expense", entityId: item.id, action: "EXPENSE_CREATED", changedFields: ["purpose", "description", "spentAt", "amount", "category", "salesOrderId", "salesOrderProductCostId", "proofPath"] } });
        }
        // (3) Baris yang dihapus user (dikosongkan/dihilangkan): soft-delete —
        // satu-satunya jalur yang masuk Riwayat Hapus (R16).
        for (const id of removedIds) {
          await tx.expense.update({ where: { id }, data: { deletedAt: new Date(), deletedById: actor.id, deleteReason: "Dihapus dari form Edit HPP." } });
          await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "Expense", entityId: id, action: "EXPENSE_DELETED", changedFields: ["deletedAt", "deletedById"] } });
        }
        return result;
      }, FINANCE_TRANSACTION_OPTIONS);
      // File bukti lama yang terganti dibersihkan setelah komit (best-effort).
      for (const path of supersededProofPaths) await deletePaymentProof(path).catch(() => undefined);
      if (updated.count) { revalidatePath("/keuangan/pemasukan"); revalidatePath("/keuangan/pengeluaran"); revalidatePath("/keuangan/pengeluaran/riwayat"); }
      return flashMessagePath("/keuangan/pemasukan", "notice", plans.length ? "Biaya HPP produk diperbarui dan otomatis masuk ke Pengeluaran kategori Project." : "Biaya HPP produk berhasil diperbarui.");
    } catch (error) {
      for (const path of uploadedPaths) await deletePaymentProof(path);
      throw error;
    }
  });
}

// Revisi Project — switch Status Lengkap/Belum Lengkap (hppComplete).
// Total HPP dihitung hanya saat hppComplete true; optimistic lock via version.
export async function toggleHppCompleteAction(formData: FormData) {
  return runRedirectingAction("/keuangan/pemasukan", async () => {
    const actor = await requireActor(FINANCE_ROLES);
    const parsed = z.object({
      salesOrderId: z.string().cuid(),
      version: z.coerce.number().int().positive(),
      hppComplete: z.boolean(),
    }).safeParse({
      salesOrderId: formData.get("salesOrderId"),
      version: formData.get("version"),
      hppComplete: formData.get("hppComplete") === "true",
    });
    if (!parsed.success) throw new UserFacingError("Status HPP tidak valid.");
    const { salesOrderId, version, hppComplete } = parsed.data;
    await getPrismaClient().$transaction(async (tx) => {
      const result = await tx.salesOrderCost.updateMany({
        where: { salesOrderId, version, salesOrder: { status: "ACTIVE" } },
        data: { hppComplete, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new UserFacingError("Data HPP sudah berubah. Muat ulang halaman.");
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "SalesOrder", entityId: salesOrderId, action: "HPP_COMPLETE_TOGGLED", changedFields: ["hppComplete"] } });
    }, FINANCE_TRANSACTION_OPTIONS);
    revalidatePath("/keuangan/pemasukan");
    return flashMessagePath("/keuangan/pemasukan", "notice", hppComplete ? "Status HPP ditandai Lengkap. Total HPP dihitung." : "Status HPP ditandai Belum Lengkap.");
  });
}
