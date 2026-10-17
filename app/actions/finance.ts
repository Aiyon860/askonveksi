"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { flashMessagePath, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { FINANCE_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { EXPENSE_CATEGORIES } from "@/lib/finance/expense-categories";
import { getPrismaClient } from "@/lib/prisma";
import { deletePaymentProof, uploadPaymentProof } from "@/lib/payment-proof";

function blankToUndefined(value: unknown) { return value == null || (typeof value === "string" && value.trim() === "") ? undefined : value; }
const expenseSchema = z.object({ id: z.string().cuid().optional(), purpose: z.string().trim().min(2, "Keperluan minimal 2 karakter.").max(500), spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."), amount: z.coerce.number().finite().positive("Nominal harus lebih dari 0."), category: z.enum(EXPENSE_CATEGORIES), paymentMethodId: z.string().trim().min(1, "Metode pembayaran wajib dipilih.").max(40), isReimbursable: z.boolean(), customerName: z.preprocess(blankToUndefined, z.string().trim().max(160).optional()), salesOrderId: z.preprocess(blankToUndefined, z.string().cuid().optional()) });
const idSchema = z.string().cuid();
const deleteExpenseSchema = z.object({ id: z.string().cuid(), reason: z.string().trim().max(500).optional() });
const HPP_KEYS = ["kain", "zipper", "jahit", "pres", "dtfPlastisol", "bordir", "lainnya"] as const;
const optionalHppDate = z.preprocess(
  blankToUndefined,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal pengeluaran tidak valid.").optional(),
);
const optionalHppMethod = z.preprocess(
  blankToUndefined,
  z.string().trim().max(40).optional(),
);
const salesOrderCostSchema = z.object({ salesOrderId: z.string().cuid(), version: z.coerce.number().int().positive(), kain: z.coerce.number().finite().nonnegative(), zipper: z.coerce.number().finite().nonnegative(), jahit: z.coerce.number().finite().nonnegative(), pres: z.coerce.number().finite().nonnegative(), dtfPlastisol: z.coerce.number().finite().nonnegative(), bordir: z.coerce.number().finite().nonnegative(), lainnya: z.coerce.number().finite().nonnegative(), expenseMethodKain: optionalHppMethod, expenseMethodZipper: optionalHppMethod, expenseMethodJahit: optionalHppMethod, expenseMethodPres: optionalHppMethod, expenseMethodDtfPlastisol: optionalHppMethod, expenseMethodBordir: optionalHppMethod, expenseMethodLainnya: optionalHppMethod, expenseSpentAtKain: optionalHppDate, expenseSpentAtZipper: optionalHppDate, expenseSpentAtJahit: optionalHppDate, expenseSpentAtPres: optionalHppDate, expenseSpentAtDtfPlastisol: optionalHppDate, expenseSpentAtBordir: optionalHppDate, expenseSpentAtLainnya: optionalHppDate });
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
    if (current.createdById !== actor.id && actor.role !== "OWNER" && actor.role !== "DEVELOPER") throw new UserFacingError("Anda hanya dapat menghapus pengeluaran sendiri.");
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

export async function updateSalesOrderCostAction(formData: FormData) {
  return runRedirectingAction("/keuangan/pemasukan", async () => {
    const actor = await requireActor(FINANCE_ROLES);
    const parsed = salesOrderCostSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Biaya HPP tidak valid.");
    const { salesOrderId, version, expenseMethodKain, expenseMethodZipper, expenseMethodJahit, expenseMethodPres, expenseMethodDtfPlastisol, expenseMethodBordir, expenseMethodLainnya, expenseSpentAtKain, expenseSpentAtZipper, expenseSpentAtJahit, expenseSpentAtPres, expenseSpentAtDtfPlastisol, expenseSpentAtBordir, expenseSpentAtLainnya, ...costs } = parsed.data;
    const costValues = Object.fromEntries(HPP_KEYS.map((key) => [key, Number((costs as Record<string, unknown>)[key] ?? 0)])) as Record<(typeof HPP_KEYS)[number], number>;
    const costDates: Record<(typeof HPP_KEYS)[number], string | undefined> = { kain: expenseSpentAtKain, zipper: expenseSpentAtZipper, jahit: expenseSpentAtJahit, pres: expenseSpentAtPres, dtfPlastisol: expenseSpentAtDtfPlastisol, bordir: expenseSpentAtBordir, lainnya: expenseSpentAtLainnya };
    const costMethods: Record<(typeof HPP_KEYS)[number], string | undefined> = { kain: expenseMethodKain, zipper: expenseMethodZipper, jahit: expenseMethodJahit, pres: expenseMethodPres, dtfPlastisol: expenseMethodDtfPlastisol, bordir: expenseMethodBordir, lainnya: expenseMethodLainnya };
    const entries = HPP_KEYS.filter((key) => costValues[key] > 0);
    for (const key of entries) {
      if (!costDates[key]) throw new UserFacingError(`Tanggal pembayaran ${HPP_LABEL[key]} wajib diisi.`);
      if (!costMethods[key]) throw new UserFacingError(`Metode pembayaran ${HPP_LABEL[key]} wajib dipilih.`);
    }
    await Promise.all([...new Set(entries.map((key) => costMethods[key] as string))].map((methodId) => assertPaymentMethod(methodId)));
    const prisma = getPrismaClient();
    const previous = await prisma.expense.findMany({ where: { salesOrderId, category: "PROJECT", deletedAt: null }, select: { hppKey: true, purpose: true, proofPath: true, proofFileName: true, proofMimeType: true, proofSize: true } });
    const previousByKey = (key: string) => previous.find((row) => row.hppKey === key || row.purpose.startsWith(`HPP ${HPP_LABEL[key]} ·`));
    const uploadedPaths: string[] = [];
    const proofs = {} as Record<(typeof HPP_KEYS)[number], { proofPath: string; proofFileName: string; proofMimeType: string; proofSize: number }>;
    try {
      for (const key of entries) {
        const itemProof = await uploadPaymentProof(formData.get(`expenseProof_${key}`), actor.id);
        if (itemProof) {
          proofs[key] = itemProof;
          uploadedPaths.push(itemProof.proofPath);
          continue;
        }
        const old = previousByKey(key);
        if (!old?.proofPath || !old.proofFileName || !old.proofMimeType || old.proofSize == null) throw new UserFacingError(`Bukti TF ${HPP_LABEL[key]} wajib dilampirkan.`);
        proofs[key] = { proofPath: old.proofPath, proofFileName: old.proofFileName, proofMimeType: old.proofMimeType, proofSize: old.proofSize };
      }
    } catch (error) {
      for (const path of uploadedPaths) await deletePaymentProof(path);
      throw error;
    }
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const order = await tx.salesOrder.findUnique({
          where: { id: salesOrderId },
          select: { id: true, status: true, invoiceNo: true, snapshotCustomerName: true, snapshotCompanyName: true, purchaseOrder: { select: { productName: true } } },
        });
        if (!order || order.status !== "ACTIVE") throw new UserFacingError("Order tidak aktif.");
        const result = await tx.salesOrderCost.updateMany({ where: { salesOrderId, version, salesOrder: { status: "ACTIVE" } }, data: { ...Object.fromEntries(HPP_KEYS.map((key) => [key, new Prisma.Decimal(costValues[key])])), version: { increment: 1 } } });
        if (result.count !== 1) throw new UserFacingError("Data HPP sudah berubah atau order tidak aktif. Muat ulang halaman.");
        await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "SalesOrder", entityId: salesOrderId, action: "SALES_ORDER_HPP_UPDATED", changedFields: [...HPP_KEYS] } });
        const customerName = order.snapshotCompanyName ?? order.snapshotCustomerName;
        await tx.expense.updateMany({ where: { salesOrderId, category: "PROJECT", deletedAt: null }, data: { deletedAt: new Date(), deletedById: actor.id, deleteReason: "Digantikan sinkronisasi HPP terbaru." } });
        for (const key of entries) {
          const item = await tx.expense.create({
            data: {
              purpose: `HPP ${HPP_LABEL[key] ?? key} · ${customerName} · ${order.purchaseOrder.productName} · ${order.invoiceNo}`,
              spentAt: date(costDates[key] as string),
              amount: new Prisma.Decimal(costValues[key]),
              category: "PROJECT",
              paymentMethodId: costMethods[key] as string,
              isReimbursable: false,
              customerName,
              salesOrderId,
              hppKey: key,
              ...proofs[key],
              createdById: actor.id,
            },
          });
          await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "Expense", entityId: item.id, action: "EXPENSE_CREATED", changedFields: ["purpose", "spentAt", "amount", "category", "salesOrderId", "proofPath"] } });
        }
        return result;
      }, FINANCE_TRANSACTION_OPTIONS);
      if (updated.count) { revalidatePath("/keuangan/pemasukan"); revalidatePath("/keuangan/pengeluaran"); }
      return flashMessagePath("/keuangan/pemasukan", "notice", entries.length ? "Biaya HPP diperbarui dan otomatis masuk ke Pengeluaran (kategori Project)." : "Biaya HPP berhasil diperbarui.");
    } catch (error) {
      for (const path of uploadedPaths) await deletePaymentProof(path);
      throw error;
    }
  });
}
