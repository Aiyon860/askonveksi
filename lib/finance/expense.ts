import "server-only";

import { Prisma } from "@prisma/client";

import { FINANCE_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, type ExpenseCategory } from "@/lib/finance/expense-categories";
import { EXPENSE_METHODS, EXPENSE_METHOD_LABEL, type ExpenseMethod } from "@/lib/finance/expense-methods";

export { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, EXPENSE_METHODS, EXPENSE_METHOD_LABEL, type ExpenseCategory, type ExpenseMethod };

export type ExpenseListState = { query: string; from: Date | null; to: Date | null; category: ExpenseCategory | "all"; method: ExpenseMethod | "all"; creatorId: string | "all"; order: "asc" | "desc"; page: number; pageSize: number };

function expenseWhere(state: Omit<ExpenseListState, "order" | "page" | "pageSize">) {
  const query = state.query.trim().slice(0, 80);
  const dateOnly = (value: Date | null) => value && new Date(value.getTime() + 7 * 60 * 60 * 1000);
  const from = dateOnly(state.from);
  const to = dateOnly(state.to);
  return {
    ...(query ? { purpose: { contains: query, mode: "insensitive" as const } } : {}),
    ...(from && to ? { spentAt: { gte: from, lt: to } } : {}),
    ...(state.category === "all" ? {} : { category: state.category }),
    ...(state.method === "all" ? {} : { paymentMethod: state.method }),
    ...(state.creatorId === "all" ? {} : { createdById: state.creatorId }),
  } satisfies Prisma.ExpenseWhereInput;
}

export async function getExpenses(state: ExpenseListState) {
  await requireActor(FINANCE_ROLES);
  const where = expenseWhere(state);
  const prisma = getPrismaClient();
  const [dates, creators] = await Promise.all([
    prisma.expense.groupBy({ by: ["spentAt"], where, orderBy: { spentAt: state.order } }),
    prisma.appUser.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const pageDates = dates.slice((state.page - 1) * state.pageSize, state.page * state.pageSize).map((item) => item.spentAt);
  const items = pageDates.length ? await prisma.expense.findMany({ where: { ...where, spentAt: { in: pageDates } }, select: { id: true, purpose: true, spentAt: true, amount: true, category: true, paymentMethod: true, reimbursedAt: true, createdById: true, proofPath: true, proofMimeType: true, createdBy: { select: { name: true } } }, orderBy: [{ spentAt: state.order }, { createdAt: "desc" }] }) : [];
  const grouped = new Map(pageDates.map((spentAt) => [spentAt.getTime(), { spentAt, items: [] as typeof items }]));
  items.forEach((item) => grouped.get(item.spentAt.getTime())?.items.push(item));
  return { groups: [...grouped.values()].map((group) => ({ ...group, items: group.items.map((item) => ({ ...item, amount: item.amount.toString(), category: item.category as ExpenseCategory, paymentMethod: item.paymentMethod as ExpenseMethod })) })), total: dates.length, creators, pageCount: Math.max(1, Math.ceil(dates.length / state.pageSize)) };
}

export async function getExpensesForExport(state: Omit<ExpenseListState, "order" | "page" | "pageSize">) {
  await requireActor(FINANCE_ROLES);
  const rows = await getPrismaClient().expense.findMany({ where: expenseWhere(state), select: { purpose: true, spentAt: true, category: true, paymentMethod: true, amount: true, createdBy: { select: { name: true } }, reimbursedAt: true }, orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }] });
  return rows.map((row) => ({ ...row, amount: row.amount.toString(), category: row.category as ExpenseCategory, paymentMethod: row.paymentMethod as ExpenseMethod }));
}

export type IncomeListState = { query: string; from: Date | null; to: Date | null; status: "all" | "DP" | "LUNAS"; hppStatus: "all" | "COMPLETE" | "INCOMPLETE"; page: number; pageSize: number };

function incomeWhere(state: IncomeListState) {
  const query = state.query.trim().slice(0, 80);
  const transactionWhere = { status: "ACTIVE" as const, ...(state.from && state.to ? { paidAt: { gte: state.from, lt: state.to } } : {}) };
  return {
    status: "ACTIVE" as const,
    invoice: { status: "ISSUED" as const },
    payment: { is: { transactions: { some: transactionWhere }, ...(state.status === "all" ? {} : { kind: state.status }) } },
    ...(state.hppStatus === "all" ? {} : { cost: { is: state.hppStatus === "COMPLETE" ? { kain: { not: null }, zipper: { not: null }, jahit: { not: null }, pres: { not: null }, dtfPlastisol: { not: null }, bordir: { not: null }, lainnya: { not: null } } : { OR: [{ kain: null }, { zipper: null }, { jahit: null }, { pres: null }, { dtfPlastisol: null }, { bordir: null }, { lainnya: null }] } } }),
    ...(query ? { OR: [
      { invoiceNo: { contains: query, mode: "insensitive" as const } },
      { snapshotCustomerName: { contains: query, mode: "insensitive" as const } },
      { snapshotCompanyName: { contains: query, mode: "insensitive" as const } },
      { purchaseOrder: { productName: { contains: query, mode: "insensitive" as const } } },
    ] } : {}),
  } satisfies Prisma.SalesOrderWhereInput;
}

function mapIncome(order: Awaited<ReturnType<typeof getIncomeOrders>>[number]) {
  const transactions = order.payment!.transactions;
  const paid = transactions.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
  const dp = order.payment!.kind === "DP" ? transactions.filter((item) => !item.paymentTermId).reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0)) : null;
  const settled = order.payment!.kind === "LUNAS" ? transactions.filter((item) => !item.paymentTermId).reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0)) : transactions.filter((item) => item.paymentTermId).reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
  const costs = order.cost;
  const complete = Boolean(costs && [costs.kain, costs.zipper, costs.jahit, costs.pres, costs.dtfPlastisol, costs.bordir, costs.lainnya].every((value) => value !== null));
  const hpp = complete ? [costs!.kain!, costs!.zipper!, costs!.jahit!, costs!.pres!, costs!.dtfPlastisol!, costs!.bordir!, costs!.lainnya!].reduce((sum, value) => sum.add(value), new Prisma.Decimal(0)) : null;
  const netProfit = hpp ? order.invoice.total.sub(hpp) : null;
  const margin = netProfit && !order.invoice.total.isZero() ? netProfit.div(order.invoice.total).toNumber() : null;
  const latest = transactions.reduce<Date | null>((date, item) => !date || item.paidAt > date ? item.paidAt : date, null);
  return { id: order.id, invoiceNo: order.invoiceNo, customer: order.snapshotCompanyName ?? order.snapshotCustomerName, orderName: order.purchaseOrder.productName, garmentType: order.purchaseOrder.garmentType ?? "-", quantity: order.invoice.items.reduce((sum, item) => sum + item.quantity, 0), kain: costs?.kain?.toString() ?? null, zipper: costs?.zipper?.toString() ?? null, jahit: costs?.jahit?.toString() ?? null, pres: costs?.pres?.toString() ?? null, dtfPlastisol: costs?.dtfPlastisol?.toString() ?? null, bordir: costs?.bordir?.toString() ?? null, lainnya: costs?.lainnya?.toString() ?? null, costVersion: costs?.version ?? null, hpp: hpp?.toString() ?? null, discount: order.invoice.totalDiscount.toString(), netProfit: netProfit?.toString() ?? null, margin, totalInvoice: order.invoice.total.toString(), dp: dp?.isZero() ? null : dp?.toString() ?? null, settled: settled.isZero() ? null : settled.toString(), remaining: Prisma.Decimal.max(order.invoice.total.sub(paid), 0).toString(), paidAt: latest?.toISOString() ?? null, hppStatus: complete ? "COMPLETE" as const : "INCOMPLETE" as const };
}

async function getIncomeOrders(where: Prisma.SalesOrderWhereInput, skip?: number, take?: number) {
  return getPrismaClient().salesOrder.findMany({
    where,
    select: {
      id: true, invoiceNo: true, snapshotCustomerName: true, snapshotCompanyName: true,
      purchaseOrder: { select: { productName: true, garmentType: true } },
      invoice: { select: { total: true, totalDiscount: true, items: { select: { quantity: true } } } },
      cost: { select: { kain: true, zipper: true, jahit: true, pres: true, dtfPlastisol: true, bordir: true, lainnya: true, version: true } },
      payment: { select: { kind: true, transactions: { where: { status: "ACTIVE" }, select: { amount: true, paidAt: true, paymentTermId: true } } } },
    },
    orderBy: [{ acceptedAt: "desc" }, { id: "asc" }],
    ...(skip === undefined ? {} : { skip, take }),
  });
}

export async function getIncome(state: IncomeListState) {
  await requireActor(FINANCE_ROLES);
  const where = incomeWhere(state);
  const [items, total] = await Promise.all([getIncomeOrders(where, (state.page - 1) * state.pageSize, state.pageSize), getPrismaClient().salesOrder.count({ where })]);
  return { items: items.map(mapIncome), total, pageCount: Math.max(1, Math.ceil(total / state.pageSize)) };
}

export async function getIncomeForExport(state: Omit<IncomeListState, "page" | "pageSize">) {
  await requireActor(FINANCE_ROLES);
  return (await getIncomeOrders(incomeWhere({ ...state, page: 1, pageSize: 1 }))).map(mapIncome);
}
