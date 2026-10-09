import "server-only";

import { Prisma } from "@prisma/client";

import { FINANCE_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, type ExpenseCategory } from "@/lib/finance/expense-categories";

export { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, type ExpenseCategory };

export type ExpenseListState = { query: string; from: Date | null; to: Date | null; category: ExpenseCategory | "all"; method: string | "all"; creatorId: string | "all"; order: "asc" | "desc"; page: number; pageSize: number };

function expenseWhere(state: Omit<ExpenseListState, "order" | "page" | "pageSize">) {
  const query = state.query.trim().slice(0, 80);
  const dateOnly = (value: Date | null) => value && new Date(value.getTime() + 7 * 60 * 60 * 1000);
  const from = dateOnly(state.from);
  const to = dateOnly(state.to);
  return {
    ...(query ? { purpose: { contains: query, mode: "insensitive" as const } } : {}),
    ...(from && to ? { spentAt: { gte: from, lt: to } } : {}),
    ...(state.category === "all" ? {} : { category: state.category }),
    ...(state.method === "all" ? {} : { paymentMethodId: state.method }),
    ...(state.creatorId === "all" ? {} : { createdById: state.creatorId }),
  } satisfies Prisma.ExpenseWhereInput;
}

// Jendela default memakai presisi tanggal WIB: 90 hari kalender terakhir + hari ini.
// Kolom spentAt bertipe DATE sehingga jam pada batas waktu dipangkas Postgres saat
// dibandingkan — batas atas harus keesokan hari agar pengeluaran hari ini ikut tampil.
function defaultExpenseWindow() {
  const DAY_MS = 86_400_000;
  const JAKARTA_MS = 7 * 3_600_000;
  const todayStart = Math.floor((Date.now() + JAKARTA_MS) / DAY_MS) * DAY_MS - JAKARTA_MS;
  return { from: new Date(todayStart - 90 * DAY_MS), to: new Date(todayStart + DAY_MS) };
}

export async function getExpenses(state: ExpenseListState) {
  await requireActor(FINANCE_ROLES);
  // ponytail: default 90 hari agar groupBy spentAt tak scan full-table di VPS 1GB. User tetap bisa pilih range lebih luas.
  const bounded = !state.from && !state.to
    ? { ...state, ...defaultExpenseWindow() }
    : state;
  const where = expenseWhere(bounded);
  const prisma = getPrismaClient();
  const [dates, creators] = await Promise.all([
    prisma.expense.groupBy({ by: ["spentAt"], where, orderBy: { spentAt: bounded.order } }),
    prisma.appUser.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const pageDates = dates.slice((bounded.page - 1) * bounded.pageSize, bounded.page * bounded.pageSize).map((item) => item.spentAt);
  const items = pageDates.length ? await prisma.expense.findMany({ where: { ...where, spentAt: { in: pageDates } }, select: { id: true, purpose: true, spentAt: true, amount: true, category: true, paymentMethodId: true, paymentMethod: { select: { name: true } }, isReimbursable: true, reimbursedAt: true, createdById: true, proofPath: true, proofMimeType: true, createdBy: { select: { name: true } } }, orderBy: [{ spentAt: bounded.order }, { createdAt: "desc" }] }) : [];
  const grouped = new Map(pageDates.map((spentAt) => [spentAt.getTime(), { spentAt, items: [] as typeof items }]));
  items.forEach((item) => grouped.get(item.spentAt.getTime())?.items.push(item));
  return { groups: [...grouped.values()].map((group) => ({ ...group, items: group.items.map((item) => ({ ...item, amount: item.amount.toString(), category: item.category as ExpenseCategory })) })), total: dates.length, creators, pageCount: Math.max(1, Math.ceil(dates.length / bounded.pageSize)) };
}

export async function getExpensesForExport(state: Omit<ExpenseListState, "order" | "page" | "pageSize">) {
  await requireActor(FINANCE_ROLES);
  // ponytail: cap 5000 baris agar export tak OOM di 600M. Minta filter tanggal untuk data lebih besar.
  const rows = await getPrismaClient().expense.findMany({ where: expenseWhere(state), select: { purpose: true, spentAt: true, category: true, paymentMethod: { select: { name: true } }, isReimbursable: true, amount: true, createdBy: { select: { name: true } }, reimbursedAt: true }, orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }], take: 5000 });
  return rows.map((row) => ({ ...row, amount: row.amount.toString(), category: row.category as ExpenseCategory }));
}

export type IncomeListState = { query: string; from: Date | null; to: Date | null; status: "all" | "DP" | "LUNAS"; hppStatus: "all" | "COMPLETE" | "INCOMPLETE"; page: number; pageSize: number };

function incomeWhere(state: Omit<IncomeListState, "page" | "pageSize">) {
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
  return { id: order.id, invoiceNo: order.invoiceNo, customer: order.snapshotCompanyName ?? order.snapshotCustomerName, orderName: order.purchaseOrder.productName, garmentType: order.purchaseOrder.productCategory?.name ?? "-", quantity: order.invoice.items.reduce((sum, item) => sum + item.quantity, 0), kain: costs?.kain?.toString() ?? null, zipper: costs?.zipper?.toString() ?? null, jahit: costs?.jahit?.toString() ?? null, pres: costs?.pres?.toString() ?? null, dtfPlastisol: costs?.dtfPlastisol?.toString() ?? null, bordir: costs?.bordir?.toString() ?? null, lainnya: costs?.lainnya?.toString() ?? null, costVersion: costs?.version ?? null, hpp: hpp?.toString() ?? null, originalPrice: order.invoice.subtotal.toString(), discount: order.invoice.totalDiscount.toString(), netProfit: netProfit?.toString() ?? null, margin, totalInvoice: order.invoice.total.toString(), dp: dp?.isZero() ? null : dp?.toString() ?? null, settled: settled.isZero() ? null : settled.toString(), remaining: Prisma.Decimal.max(order.invoice.total.sub(paid), 0).toString(), paidAt: latest?.toISOString() ?? null, hppStatus: complete ? "COMPLETE" as const : "INCOMPLETE" as const };
}

async function getIncomeOrders(where: Prisma.SalesOrderWhereInput, skip?: number, take?: number) {
  return getPrismaClient().salesOrder.findMany({
    where,
    select: {
      id: true, invoiceNo: true, snapshotCustomerName: true, snapshotCompanyName: true,
      purchaseOrder: { select: { productName: true, productCategory: { select: { name: true } } } },
      invoice: { select: { subtotal: true, total: true, totalDiscount: true, items: { select: { quantity: true } } } },
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
  // Fix: sebelumnya pageSize 1 sehingga export hanya 1 baris. Cap 5000 agar muat 600M.
  return (await getIncomeOrders(incomeWhere(state), 0, 5000)).map(mapIncome);
}
