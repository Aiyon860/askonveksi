import "server-only";

import { Prisma } from "@prisma/client";

import { FINANCE_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

export type FinanceReportState = { from: Date | null; to: Date | null };

function dateKey(date: Date) { return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10); }
function expenseDate(value: Date | null) { return value && new Date(value.getTime() + 7 * 60 * 60 * 1000); }

export async function getFinanceReport(state: FinanceReportState) {
  await requireActor(FINANCE_ROLES);
  const prisma = getPrismaClient();
  const paymentWhere = {
    status: "ACTIVE" as const,
    payment: { salesOrder: { status: "ACTIVE" as const, invoice: { status: "ISSUED" as const } } },
    ...(state.from && state.to ? { paidAt: { gte: state.from, lt: state.to } } : {}),
  } satisfies Prisma.PaymentTransactionWhereInput;
  const expenseWhere = state.from && state.to ? { spentAt: { gte: expenseDate(state.from)!, lt: expenseDate(state.to)! } } : {};
  const basePaymentWhere = { status: "ACTIVE" as const, payment: { salesOrder: { status: "ACTIVE" as const, invoice: { status: "ISSUED" as const } } } } satisfies Prisma.PaymentTransactionWhereInput;
  const [payments, expenses, allPaymentTotal, allExpenseTotal] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: paymentWhere,
      select: {
        id: true, amount: true, paidAt: true,
        payment: { select: { salesOrder: { select: { invoiceNo: true, snapshotCustomerName: true, snapshotCompanyName: true, purchaseOrder: { select: { productName: true } } } } } },
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.expense.findMany({ where: expenseWhere, select: { id: true, purpose: true, amount: true, spentAt: true }, orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }] }),
    prisma.paymentTransaction.aggregate({ where: basePaymentWhere, _sum: { amount: true } }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
  ]);
  const groups = new Map<string, { date: string; income: { id: string; label: string; query: string; amount: string }[]; expenses: { id: string; label: string; amount: string }[] }>();
  const groupFor = (date: string) => { const current = groups.get(date); if (current) return current; const next = { date, income: [], expenses: [] }; groups.set(date, next); return next; };
  payments.forEach((item) => { const order = item.payment.salesOrder; groupFor(dateKey(item.paidAt)).income.push({ id: item.id, label: `${order.snapshotCompanyName ?? order.snapshotCustomerName} · ${order.purchaseOrder.productName}`, query: order.invoiceNo, amount: item.amount.toString() }); });
  expenses.forEach((item) => groupFor(item.spentAt.toISOString().slice(0, 10)).expenses.push({ id: item.id, label: item.purpose, amount: item.amount.toString() }));
  const totalIncome = payments.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
  const totalExpense = expenses.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
  return { groups: [...groups.values()].sort((a, b) => b.date.localeCompare(a.date)), allIncome: (allPaymentTotal._sum.amount ?? new Prisma.Decimal(0)).toString(), allExpense: (allExpenseTotal._sum.amount ?? new Prisma.Decimal(0)).toString(), totalIncome: totalIncome.toString(), totalExpense: totalExpense.toString() };
}
