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

const expenseSchema = z.object({ id: z.string().cuid().optional(), purpose: z.string().trim().min(2, "Keperluan minimal 2 karakter.").max(500), spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."), amount: z.coerce.number().finite().positive("Nominal harus lebih dari 0."), category: z.enum(EXPENSE_CATEGORIES), paymentMethodId: z.string().trim().min(1, "Metode pembayaran wajib dipilih.").max(40), isReimbursable: z.boolean() });
const idSchema = z.string().cuid();
const salesOrderCostSchema = z.object({ salesOrderId: z.string().cuid(), version: z.coerce.number().int().positive(), kain: z.coerce.number().finite().nonnegative(), zipper: z.coerce.number().finite().nonnegative(), jahit: z.coerce.number().finite().nonnegative(), pres: z.coerce.number().finite().nonnegative(), dtfPlastisol: z.coerce.number().finite().nonnegative(), bordir: z.coerce.number().finite().nonnegative(), lainnya: z.coerce.number().finite().nonnegative() });
const PATH = "/keuangan/pengeluaran";

function input(formData: FormData) { const id = formData.get("id"); return { id: typeof id === "string" && id ? id : undefined, purpose: formData.get("purpose"), spentAt: formData.get("spentAt"), amount: formData.get("amount"), category: formData.get("category"), paymentMethodId: formData.get("paymentMethodId"), isReimbursable: formData.get("isReimbursable") === "on" }; }
async function assertPaymentMethod(paymentMethodId: string) { const method = await getPrismaClient().paymentMethod.findFirst({ where: { id: paymentMethodId, isActive: true }, select: { id: true } }); if (!method) throw new UserFacingError("Metode pembayaran tidak ditemukan atau tidak aktif."); }
function date(value: string) { const result = new Date(`${value}T00:00:00.000Z`); if (Number.isNaN(result.getTime())) throw new UserFacingError("Tanggal tidak valid."); return result; }
async function audit(tx: Prisma.TransactionClient, actorId: string, entityId: string, action: string, changedFields: string[]) { await tx.auditEvent.create({ data: { actorId, entityType: "Expense", entityId, action, changedFields } }); }
function refresh() { revalidatePath("/keuangan", "layout"); revalidatePath("/keuangan/pengeluaran"); }

export async function createExpenseAction(formData: FormData) {
  return runRedirectingAction(PATH, async () => {
    const actor = await requireActor(FINANCE_ROLES); const parsed = expenseSchema.safeParse(input(formData));
    if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Data pengeluaran tidak valid.");
    const proof = await uploadPaymentProof(formData.get("proof"), actor.id);
    if (!proof) throw new UserFacingError("Bukti pengeluaran wajib dilampirkan.");
    await assertPaymentMethod(parsed.data.paymentMethodId);
    try { await getPrismaClient().$transaction(async (tx) => { const item = await tx.expense.create({ data: { ...parsed.data, ...proof, spentAt: date(parsed.data.spentAt), amount: new Prisma.Decimal(parsed.data.amount), createdById: actor.id } }); await audit(tx, actor.id, item.id, "EXPENSE_CREATED", ["purpose", "spentAt", "amount", "category", "paymentMethodId", "isReimbursable", "proofPath"]); }); } catch (error) { await deletePaymentProof(proof.proofPath); throw error; }
    refresh(); return flashMessagePath(PATH, "notice", "Pengeluaran berhasil dicatat.");
  });
}

export async function updateExpenseAction(formData: FormData) {
  return runRedirectingAction(PATH, async () => {
    const actor = await requireActor(FINANCE_ROLES); const parsed = expenseSchema.safeParse(input(formData));
    if (!parsed.success || !parsed.data.id) throw new UserFacingError(parsed.error?.issues[0]?.message ?? "Data pengeluaran tidak valid.");
    const id = parsed.data.id;
    const current = await getPrismaClient().expense.findUnique({ where: { id }, select: { reimbursedAt: true, proofPath: true } });
    if (!current) throw new UserFacingError("Pengeluaran tidak ditemukan.");
    if (current.reimbursedAt) throw new UserFacingError("Pengeluaran yang sudah diganti tidak dapat diubah.");
    const proof = await uploadPaymentProof(formData.get("proof"), actor.id);
    if (!proof && !current.proofPath) throw new UserFacingError("Bukti pengeluaran wajib dilampirkan.");
    await assertPaymentMethod(parsed.data.paymentMethodId);
    try { await getPrismaClient().$transaction(async (tx) => { await tx.expense.update({ where: { id }, data: { purpose: parsed.data.purpose, spentAt: date(parsed.data.spentAt), amount: new Prisma.Decimal(parsed.data.amount), category: parsed.data.category, paymentMethodId: parsed.data.paymentMethodId, isReimbursable: parsed.data.isReimbursable, ...(proof ?? {}) } }); await audit(tx, actor.id, id, "EXPENSE_UPDATED", ["purpose", "spentAt", "amount", "category", "paymentMethodId", "isReimbursable", ...(proof ? ["proofPath"] : [])]); }); } catch (error) { await deletePaymentProof(proof?.proofPath); throw error; }
    if (proof) await deletePaymentProof(current.proofPath);
    refresh(); return flashMessagePath(PATH, "notice", "Pengeluaran berhasil diperbarui.");
  });
}

export async function deleteExpenseAction(formData: FormData) {
  return runRedirectingAction(PATH, async () => {
    const actor = await requireActor(FINANCE_ROLES); const parsed = idSchema.safeParse(formData.get("id")); if (!parsed.success) throw new UserFacingError("Pengeluaran tidak valid.");
    const current = await getPrismaClient().expense.findUnique({ where: { id: parsed.data }, select: { createdById: true, reimbursedAt: true, proofPath: true } }); if (!current || current.createdById !== actor.id) throw new UserFacingError("Anda hanya dapat menghapus pengeluaran sendiri."); if (current.reimbursedAt) throw new UserFacingError("Pengeluaran yang sudah diganti tidak dapat dihapus."); await getPrismaClient().$transaction(async (tx) => { await tx.expense.delete({ where: { id: parsed.data } }); await audit(tx, actor.id, parsed.data, "EXPENSE_DELETED", []); }); await deletePaymentProof(current.proofPath);
    refresh(); return flashMessagePath(PATH, "notice", "Pengeluaran berhasil dihapus.");
  });
}

export async function reimburseExpenseAction(formData: FormData) {
  return runRedirectingAction(PATH, async () => {
    const actor = await requireActor(FINANCE_ROLES); const parsed = idSchema.safeParse(formData.get("id")); if (!parsed.success) throw new UserFacingError("Pengeluaran tidak valid.");
    await getPrismaClient().$transaction(async (tx) => { const current = await tx.expense.findUnique({ where: { id: parsed.data }, select: { isReimbursable: true, reimbursedAt: true } }); if (!current) throw new UserFacingError("Pengeluaran tidak ditemukan."); if (!current.isReimbursable) throw new UserFacingError("Verifikasi hanya tersedia untuk pengeluaran yang bisa diganti."); if (current.reimbursedAt) throw new UserFacingError("Pengeluaran ini sudah ditandai diganti."); await tx.expense.update({ where: { id: parsed.data }, data: { reimbursedAt: new Date() } }); await audit(tx, actor.id, parsed.data, "EXPENSE_REIMBURSED", ["reimbursedAt"]); });
    refresh(); return flashMessagePath(PATH, "notice", "Pengeluaran ditandai sudah diganti.");
  });
}

export async function updateSalesOrderCostAction(formData: FormData) {
  return runRedirectingAction("/keuangan/pemasukan", async () => {
    const actor = await requireActor(FINANCE_ROLES);
    const parsed = salesOrderCostSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Biaya HPP tidak valid.");
    const { salesOrderId, version, ...costs } = parsed.data;
    const updated = await getPrismaClient().$transaction(async (tx) => {
      const result = await tx.salesOrderCost.updateMany({ where: { salesOrderId, version, salesOrder: { status: "ACTIVE" } }, data: { ...Object.fromEntries(Object.entries(costs).map(([key, value]) => [key, new Prisma.Decimal(value)])), version: { increment: 1 } } });
      if (result.count !== 1) throw new UserFacingError("Data HPP sudah berubah atau order tidak aktif. Muat ulang halaman.");
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "SalesOrder", entityId: salesOrderId, action: "SALES_ORDER_HPP_UPDATED", changedFields: Object.keys(costs) } });
      return result;
    });
    if (updated.count) revalidatePath("/keuangan/pemasukan");
    return flashMessagePath("/keuangan/pemasukan", "notice", "Biaya HPP berhasil diperbarui.");
  });
}
