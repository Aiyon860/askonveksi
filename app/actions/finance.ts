"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { flashMessagePath, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { FINANCE_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { EXPENSE_CATEGORIES } from "@/lib/finance/expense-categories";
import { EXPENSE_METHODS } from "@/lib/finance/expense-methods";
import { getPrismaClient } from "@/lib/prisma";

const expenseSchema = z.object({ id: z.string().cuid().optional(), purpose: z.string().trim().min(2, "Keperluan minimal 2 karakter.").max(500), spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."), amount: z.coerce.number().finite().positive("Nominal harus lebih dari 0."), category: z.enum(EXPENSE_CATEGORIES), paymentMethod: z.enum(EXPENSE_METHODS) });
const idSchema = z.string().cuid();
const PATH = "/keuangan/pengeluaran";

function input(formData: FormData) { const id = formData.get("id"); return { id: typeof id === "string" && id ? id : undefined, purpose: formData.get("purpose"), spentAt: formData.get("spentAt"), amount: formData.get("amount"), category: formData.get("category"), paymentMethod: formData.get("paymentMethod") }; }
function date(value: string) { const result = new Date(`${value}T00:00:00.000Z`); if (Number.isNaN(result.getTime())) throw new UserFacingError("Tanggal tidak valid."); return result; }
async function audit(tx: Prisma.TransactionClient, actorId: string, entityId: string, action: string, changedFields: string[]) { await tx.auditEvent.create({ data: { actorId, entityType: "Expense", entityId, action, changedFields } }); }
function refresh() { revalidatePath("/keuangan", "layout"); revalidatePath("/keuangan/pengeluaran"); }

export async function createExpenseAction(formData: FormData) {
  return runRedirectingAction(PATH, async () => {
    const actor = await requireActor(FINANCE_ROLES); const parsed = expenseSchema.safeParse(input(formData));
    if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Data pengeluaran tidak valid.");
    await getPrismaClient().$transaction(async (tx) => { const item = await tx.expense.create({ data: { ...parsed.data, spentAt: date(parsed.data.spentAt), amount: new Prisma.Decimal(parsed.data.amount), createdById: actor.id } }); await audit(tx, actor.id, item.id, "EXPENSE_CREATED", ["purpose", "spentAt", "amount", "category", "paymentMethod"]); });
    refresh(); return flashMessagePath(PATH, "notice", "Pengeluaran berhasil dicatat.");
  });
}

export async function updateExpenseAction(formData: FormData) {
  return runRedirectingAction(PATH, async () => {
    const actor = await requireActor(FINANCE_ROLES); const parsed = expenseSchema.safeParse(input(formData));
    if (!parsed.success || !parsed.data.id) throw new UserFacingError(parsed.error?.issues[0]?.message ?? "Data pengeluaran tidak valid.");
    const id = parsed.data.id;
    await getPrismaClient().$transaction(async (tx) => { const current = await tx.expense.findUnique({ where: { id }, select: { createdById: true, reimbursedAt: true } }); if (!current || current.createdById !== actor.id) throw new UserFacingError("Anda hanya dapat mengubah pengeluaran sendiri."); if (current.reimbursedAt) throw new UserFacingError("Pengeluaran yang sudah diganti tidak dapat diubah."); await tx.expense.update({ where: { id }, data: { purpose: parsed.data.purpose, spentAt: date(parsed.data.spentAt), amount: new Prisma.Decimal(parsed.data.amount), category: parsed.data.category, paymentMethod: parsed.data.paymentMethod } }); await audit(tx, actor.id, id, "EXPENSE_UPDATED", ["purpose", "spentAt", "amount", "category", "paymentMethod"]); });
    refresh(); return flashMessagePath(PATH, "notice", "Pengeluaran berhasil diperbarui.");
  });
}

export async function deleteExpenseAction(formData: FormData) {
  return runRedirectingAction(PATH, async () => {
    const actor = await requireActor(FINANCE_ROLES); const parsed = idSchema.safeParse(formData.get("id")); if (!parsed.success) throw new UserFacingError("Pengeluaran tidak valid.");
    await getPrismaClient().$transaction(async (tx) => { const current = await tx.expense.findUnique({ where: { id: parsed.data }, select: { createdById: true, reimbursedAt: true } }); if (!current || current.createdById !== actor.id) throw new UserFacingError("Anda hanya dapat menghapus pengeluaran sendiri."); if (current.reimbursedAt) throw new UserFacingError("Pengeluaran yang sudah diganti tidak dapat dihapus."); await tx.expense.delete({ where: { id: parsed.data } }); await audit(tx, actor.id, parsed.data, "EXPENSE_DELETED", []); });
    refresh(); return flashMessagePath(PATH, "notice", "Pengeluaran berhasil dihapus.");
  });
}

export async function reimburseExpenseAction(formData: FormData) {
  return runRedirectingAction(PATH, async () => {
    const actor = await requireActor(FINANCE_ROLES); const parsed = idSchema.safeParse(formData.get("id")); if (!parsed.success) throw new UserFacingError("Pengeluaran tidak valid.");
    await getPrismaClient().$transaction(async (tx) => { const current = await tx.expense.findUnique({ where: { id: parsed.data }, select: { createdById: true, paymentMethod: true, reimbursedAt: true } }); if (!current || current.createdById !== actor.id) throw new UserFacingError("Anda hanya dapat memverifikasi pengeluaran sendiri."); if (current.paymentMethod !== "PRIBADI") throw new UserFacingError("Verifikasi hanya tersedia untuk metode Pribadi."); if (current.reimbursedAt) throw new UserFacingError("Pengeluaran ini sudah ditandai diganti."); await tx.expense.update({ where: { id: parsed.data }, data: { reimbursedAt: new Date() } }); await audit(tx, actor.id, parsed.data, "EXPENSE_REIMBURSED", ["reimbursedAt"]); });
    refresh(); return flashMessagePath(PATH, "notice", "Pengeluaran Pribadi ditandai sudah diganti.");
  });
}
