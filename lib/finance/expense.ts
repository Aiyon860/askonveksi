import "server-only";

import { Prisma } from "@prisma/client";

import { FINANCE_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/crm/format";
import { getPrismaClient } from "@/lib/prisma";
import { jakartaDateKey } from "@/lib/finance/date-range";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, type ExpenseCategory, type ExpenseTypeFilter } from "@/lib/finance/expense-categories";

export { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, type ExpenseCategory, type ExpenseTypeFilter };

export type ExpenseListState = { query: string; customer: string; from: Date | null; to: Date | null; category: ExpenseCategory | "all"; expenseType: ExpenseTypeFilter; method: string | "all"; creatorId: string | "all"; order: "asc" | "desc"; page: number; pageSize: number };

function expenseWhere(state: Omit<ExpenseListState, "order" | "page" | "pageSize">, includeDeleted = false) {
  const query = state.query.trim().slice(0, 80);
  const customer = state.customer.trim().slice(0, 80);
  const dateOnly = (value: Date | null) => value && new Date(value.getTime() + 7 * 60 * 60 * 1000);
  const from = dateOnly(state.from);
  const to = dateOnly(state.to);
  return {
    ...(includeDeleted ? {} : { deletedAt: null }),
    ...(query ? { OR: [{ purpose: { contains: query, mode: "insensitive" as const } }, { customerName: { contains: query, mode: "insensitive" as const } }] } : {}),
    ...(customer ? { customerName: { contains: customer, mode: "insensitive" as const } } : {}),
    ...(from && to ? { spentAt: { gte: from, lt: to } } : {}),
    ...(state.category === "all" ? {} : { category: state.category }),
    ...(state.expenseType === "all" ? {} : state.expenseType === "PROJECT" ? { category: "PROJECT" as const } : { category: { not: "PROJECT" as const } }),
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
  const [dates, creators, totalAgg] = await Promise.all([
    prisma.expense.groupBy({ by: ["spentAt"], where, orderBy: { spentAt: bounded.order } }),
    prisma.appUser.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);
  const pageDates = dates.slice((bounded.page - 1) * bounded.pageSize, bounded.page * bounded.pageSize).map((item) => item.spentAt);
  const items = pageDates.length ? await prisma.expense.findMany({ where: { ...where, spentAt: { in: pageDates } }, select: { id: true, purpose: true, description: true, spentAt: true, amount: true, category: true, paymentMethodId: true, paymentMethod: { select: { name: true } }, isReimbursable: true, reimbursedAt: true, createdById: true, proofPath: true, proofMimeType: true, salesOrderId: true, customerName: true, hppKey: true, salesOrder: { select: { invoiceNo: true, snapshotCustomerName: true, snapshotCompanyName: true, purchaseOrder: { select: { productName: true } } } }, createdBy: { select: { name: true } } }, orderBy: [{ spentAt: bounded.order }, { createdAt: "desc" }] }) : [];
  const grouped = new Map(pageDates.map((spentAt) => [spentAt.getTime(), { spentAt, items: [] as typeof items }]));
  items.forEach((item) => grouped.get(item.spentAt.getTime())?.items.push(item));
  const groups = [...grouped.values()].map((group) => {
    const mapped = group.items.map((item) => ({ ...item, amount: item.amount.toString(), category: item.category as ExpenseCategory }));
    const operasional = mapped.filter((item) => item.category !== "PROJECT");
    const byProject = new Map<string, typeof mapped>();
    mapped.filter((item) => item.category === "PROJECT").forEach((item) => {
      const key = item.salesOrderId ?? "none";
      byProject.set(key, [...(byProject.get(key) ?? []), item]);
    });
    const projects = [...byProject.entries()].map(([key, projectItems]) => {
      const subtotal = projectItems.reduce((sum, item) => sum.add(new Prisma.Decimal(item.amount)), new Prisma.Decimal(0)).toString();
      return { key, label: projectGroupLabel(projectItems[0].salesOrder, projectItems[0].customerName), subtotal, items: projectItems };
    });
    return { spentAt: group.spentAt, operasional, projects };
  });
  return { groups, total: dates.length, creators, pageCount: Math.max(1, Math.ceil(dates.length / bounded.pageSize)), totalAmount: (totalAgg._sum.amount ?? new Prisma.Decimal(0)).toString() };
}

export function projectGroupLabel(salesOrder: { invoiceNo: string; snapshotCustomerName: string; snapshotCompanyName: string | null; purchaseOrder: { productName: string } } | null, customerName: string | null) {
  if (!salesOrder) return customerName ? `Tanpa project · ${customerName}` : "Tanpa project";
  const customer = salesOrder.snapshotCompanyName ?? salesOrder.snapshotCustomerName;
  return `${customer} · ${salesOrder.purchaseOrder.productName} · ${salesOrder.invoiceNo}`;
}

// Ekspor dibagi per halaman (offset/limit) supaya bisa tanpa batas tanpa memuat
// seluruh tabel ke memori server sekaligus; file .xlsx dibuat di browser.
export type ExportPageRequest = { offset: number; limit: number };

export async function getExpensesForExport(state: Omit<ExpenseListState, "page" | "pageSize">, page: ExportPageRequest) {
  await requireActor(FINANCE_ROLES);
  // Ekspor mengikuti tabel: tanpa filter memakai jendela 90 hari yang sama (bukan seluruh riwayat),
  // dan memakai urutan sort yang sedang aktif di halaman.
  const bounded = !state.from && !state.to
    ? { ...state, ...defaultExpenseWindow() }
    : state;
  const where = expenseWhere(bounded);
  const prisma = getPrismaClient();
  // Urutan id sebagai tiebreaker agar paging offset stabil untuk data bertanggal sama.
  const [fetched, total] = await Promise.all([
    prisma.expense.findMany({ where, select: { purpose: true, description: true, spentAt: true, category: true, paymentMethod: { select: { name: true } }, isReimbursable: true, amount: true, proofPath: true, createdBy: { select: { name: true } }, reimbursedAt: true, customerName: true, salesOrder: { select: { invoiceNo: true, snapshotCustomerName: true, snapshotCompanyName: true, purchaseOrder: { select: { productName: true } } } } }, orderBy: [{ spentAt: bounded.order }, { createdAt: "desc" }, { id: "asc" }], skip: page.offset, take: page.limit }),
    page.offset === 0 ? prisma.expense.count({ where }) : Promise.resolve(null),
  ]);
  const rows = fetched.map((row) => ({ ...row, spentAt: row.spentAt.toISOString().slice(0, 10), reimbursedAt: row.reimbursedAt ? row.reimbursedAt.toISOString() : null, amount: row.amount.toString(), category: row.category as ExpenseCategory, project: row.category === "PROJECT" ? projectGroupLabel(row.salesOrder, row.customerName) : "" }));
  return { rows, total };
}

export async function getDeletedExpensesForExport(page: ExportPageRequest) {
  await requireActor(FINANCE_ROLES);
  const prisma = getPrismaClient();
  const where = { deletedAt: { not: null } } satisfies Prisma.ExpenseWhereInput;
  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      select: { id: true, purpose: true, spentAt: true, amount: true, category: true, customerName: true, deleteReason: true, deletedAt: true, createdBy: { select: { name: true } }, deletedBy: { select: { name: true } } },
      orderBy: [{ deletedAt: "desc" }, { id: "asc" }],
      skip: page.offset,
      take: page.limit,
    }),
    page.offset === 0 ? prisma.expense.count({ where }) : Promise.resolve(null),
  ]);
  return { items, total };
}

export async function getDeletedExpenses(page: number, pageSize: number) {
  await requireActor(FINANCE_ROLES);
  const prisma = getPrismaClient();
  const where = { deletedAt: { not: null } } satisfies Prisma.ExpenseWhereInput;
  const [total, items] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      select: { id: true, purpose: true, spentAt: true, amount: true, category: true, customerName: true, deleteReason: true, deletedAt: true, createdBy: { select: { name: true } }, deletedBy: { select: { name: true } } },
      orderBy: { deletedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    items: items.map((item) => ({ ...item, amount: item.amount.toString(), category: item.category as ExpenseCategory })),
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type IncomeListState = { query: string; from: Date | null; to: Date | null; status: "all" | "DP" | "LUNAS" | "DEPOSIT"; hppStatus: "all" | "COMPLETE" | "INCOMPLETE"; page: number; pageSize: number };

function incomeWhere(state: Omit<IncomeListState, "page" | "pageSize">) {
  const query = state.query.trim().slice(0, 80);
  const transactionWhere = { status: "ACTIVE" as const, ...(state.from && state.to ? { paidAt: { gte: state.from, lt: state.to } } : {}) };
  return {
    status: "ACTIVE" as const,
    invoice: { status: "ISSUED" as const },
    payment: { is: { transactions: { some: transactionWhere }, ...(state.status === "all" ? {} : { kind: state.status }) } },
    ...(state.hppStatus === "all" ? {} : state.hppStatus === "COMPLETE" ? { cost: { is: { hppComplete: true } } } : { NOT: { cost: { is: { hppComplete: true } } } }),
    ...(query ? { OR: [
      { invoiceNo: { contains: query, mode: "insensitive" as const } },
      { snapshotCustomerName: { contains: query, mode: "insensitive" as const } },
      { snapshotCompanyName: { contains: query, mode: "insensitive" as const } },
      { purchaseOrder: { productName: { contains: query, mode: "insensitive" as const } } },
    ] } : {}),
  } satisfies Prisma.SalesOrderWhereInput;
}

function mapIncome(order: Awaited<ReturnType<typeof getIncomeOrders>>[number]) {
  const payment = order.payment;
  const transactions = payment?.transactions ?? [];
  const paid = transactions.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
  const dp = payment && (payment.kind === "DP" || payment.kind === "DEPOSIT") ? transactions.filter((item) => !item.paymentTermId && !item.isDeposit).reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0)) : null;
  const depositAmount = transactions.filter((item) => item.isDeposit).reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
  const settled = payment ? (payment.kind === "LUNAS" ? transactions.filter((item) => !item.paymentTermId).reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0)) : transactions.filter((item) => item.paymentTermId).reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0))) : new Prisma.Decimal(0);
  const costs = order.cost;
  // Status Lengkap = switch manual hppComplete (revisi). Total HPP = jumlah kolom terisi; null dianggap 0.
  const complete = Boolean(costs?.hppComplete);
  let hpp: Prisma.Decimal | null = null;
  if (complete && costs) {
    hpp = new Prisma.Decimal(0);
    for (const key of HPP_ROW_ORDER) hpp = hpp.add(costs[key] ?? 0);
  }
  const netProfit = hpp ? order.invoice.total.sub(hpp) : null;
  const margin = netProfit && !order.invoice.total.isZero() ? netProfit.div(order.invoice.total).toNumber() : null;
  const latest = transactions.reduce<Date | null>((date, item) => !date || item.paidAt > date ? item.paidAt : date, null);
  return { id: order.id, invoiceNo: order.invoiceNo, customer: order.snapshotCompanyName ?? order.snapshotCustomerName, orderName: order.purchaseOrder.productName, garmentType: order.purchaseOrder.productCategory?.name ?? order.purchaseOrder.garmentType ?? "-", quantity: order.invoice.items.reduce((sum, item) => sum + item.quantity, 0), kain: costs?.kain?.toString() ?? null, zipper: costs?.zipper?.toString() ?? null, jahit: costs?.jahit?.toString() ?? null, pres: costs?.pres?.toString() ?? null, dtfPlastisol: costs?.dtfPlastisol?.toString() ?? null, bordir: costs?.bordir?.toString() ?? null, lainnya: costs?.lainnya?.toString() ?? null, costVersion: costs?.version ?? null, hppComplete: costs?.hppComplete ?? false, hpp: hpp?.toString() ?? null, originalPrice: order.invoice.subtotal.toString(), discount: order.invoice.totalDiscount.toString(), tax: order.invoice.taxAmount.toString(), netProfit: netProfit?.toString() ?? null, margin, totalInvoice: order.invoice.total.toString(), dp: dp?.isZero() ? null : dp?.toString() ?? null, deposit: depositAmount.isZero() ? null : depositAmount.toString(), settled: settled.isZero() ? null : settled.toString(), paid: paid.toString(), remaining: Prisma.Decimal.max(order.invoice.total.sub(paid), 0).toString(), paidAt: latest?.toISOString() ?? null, acceptedAt: order.acceptedAt.toISOString(), paymentKind: payment?.kind ?? null, hppStatus: complete ? "COMPLETE" as const : "INCOMPLETE" as const };
}

async function getIncomeOrders(where: Prisma.SalesOrderWhereInput, skip?: number, take?: number) {
  return getPrismaClient().salesOrder.findMany({
    where,
    select: {
      id: true, invoiceNo: true, snapshotCustomerName: true, snapshotCompanyName: true, acceptedAt: true,
      purchaseOrder: { select: { productName: true, garmentType: true, productCategory: { select: { name: true } } } },
      invoice: { select: { subtotal: true, total: true, totalDiscount: true, taxAmount: true, items: { select: { quantity: true } } } },
      cost: { select: { kain: true, zipper: true, jahit: true, pres: true, dtfPlastisol: true, bordir: true, lainnya: true, hppComplete: true, version: true } },
      payment: { select: { kind: true, transactions: { where: { status: "ACTIVE" }, select: { amount: true, paidAt: true, paymentTermId: true, isDeposit: true } } } },
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

export async function getIncomeForExport(state: Omit<IncomeListState, "page" | "pageSize">, page: ExportPageRequest) {
  await requireActor(FINANCE_ROLES);
  const where = incomeWhere(state);
  const [fetched, total] = await Promise.all([
    getIncomeOrders(where, page.offset, page.limit),
    page.offset === 0 ? getPrismaClient().salesOrder.count({ where }) : Promise.resolve(null),
  ]);
  const rows = fetched.map(mapIncome);
  const projectExpenses = await getProjectExpensesBySalesOrders(rows.map((row) => row.id));
  return {
    rows: rows.map((row) => ({ ...row, projectDescription: hppProjectDescription(projectExpenses.get(row.id) ?? []) })),
    total,
  };
}

export type WorkbookProject = {
  id: string;
  invoiceNo: string;
  customer: string;
  productName: string;
  garmentType: string;
  quantity: number;
  acceptedAt: string | null;
  kain: number;
  zipper: number;
  jahit: number;
  pres: number;
  dtfPlastisol: number;
  bordir: number;
  lainnya: number;
  totalHpp: number;
  hppComplete: boolean;
  totalInvoice: number;
  netProfit: number | null;
  margin: number | null;
  deposit: number;
  dp: number;
  settled: number;
  paid: number;
  remaining: number;
  periodPaid: number;
  statusBayar: "LUNAS" | "DP" | "DEPOSIT" | "BELUM BAYAR";
  latestPaidAt: string | null;
};

/**
 * Project untuk workbook: semua project aktif dengan invoice terbit, bukan
 * hanya yang punya pembayaran pada periode. Rentang tanggal hanya membatasi
 * kolom "Pembayaran Periode".
 */
export async function getProjectsForWorkbook(start: Date, end: Date): Promise<WorkbookProject[]> {
  await requireActor(FINANCE_ROLES);
  const orders = await getIncomeOrders({ status: "ACTIVE", invoice: { status: "ISSUED" } });
  return orders.map((order) => {
    const item = mapIncome(order);
    const payment = order.payment;
    const transactions = payment?.transactions ?? [];
    // Kolom deposit, DP, dan pelunasan dibuat saling eksklusif agar jumlahnya
    // sama dengan total dibayar dan tidak menghitung transaksi yang sama dua kali.
    const deposit = transactions
      .filter((transaction) => transaction.isDeposit)
      .reduce((sum, transaction) => sum.add(transaction.amount), new Prisma.Decimal(0));
    const dp = payment && payment.kind !== "LUNAS"
      ? transactions
        .filter((transaction) => !transaction.isDeposit && !transaction.paymentTermId)
        .reduce((sum, transaction) => sum.add(transaction.amount), new Prisma.Decimal(0))
      : new Prisma.Decimal(0);
    const settled = transactions
      .filter((transaction) => !transaction.isDeposit && (payment?.kind === "LUNAS" || Boolean(transaction.paymentTermId)))
      .reduce((sum, transaction) => sum.add(transaction.amount), new Prisma.Decimal(0));
    const periodPaid = transactions
      .filter((transaction) => transaction.paidAt >= start && transaction.paidAt < end)
      .reduce((sum, transaction) => sum.add(transaction.amount), new Prisma.Decimal(0));
    const totalHpp = HPP_ROW_ORDER.reduce((sum, key) => {
      const value = item[key];
      return value === null ? sum : sum.add(value);
    }, new Prisma.Decimal(0));
    const remaining = Number(item.remaining);
    const paid = Number(item.paid);
    const statusBayar: WorkbookProject["statusBayar"] = remaining <= 0
      ? "LUNAS"
      : paid <= 0
        ? "BELUM BAYAR"
        : deposit.greaterThan(0) && dp.isZero() && settled.isZero()
          ? "DEPOSIT"
          : "DP";
    return {
      id: item.id,
      invoiceNo: item.invoiceNo,
      customer: item.customer,
      productName: item.orderName,
      garmentType: item.garmentType,
      quantity: item.quantity,
      acceptedAt: jakartaDateKey(new Date(item.acceptedAt)),
      kain: Number(item.kain ?? 0),
      zipper: Number(item.zipper ?? 0),
      jahit: Number(item.jahit ?? 0),
      pres: Number(item.pres ?? 0),
      dtfPlastisol: Number(item.dtfPlastisol ?? 0),
      bordir: Number(item.bordir ?? 0),
      lainnya: Number(item.lainnya ?? 0),
      totalHpp: totalHpp.toNumber(),
      hppComplete: item.hppComplete,
      totalInvoice: Number(item.totalInvoice),
      netProfit: item.netProfit === null ? null : Number(item.netProfit),
      margin: item.margin,
      deposit: deposit.toNumber(),
      dp: dp.toNumber(),
      settled: settled.toNumber(),
      paid,
      remaining,
      periodPaid: periodPaid.toNumber(),
      statusBayar,
      latestPaidAt: item.paidAt ? jakartaDateKey(new Date(item.paidAt)) : null,
    };
  });
}

export type ProjectExpensePrefill = { id: string; hppKey: string | null; purpose: string; description: string | null; amount: string; spentAt: string; paymentMethodId: string; proofPath: string | null; proofFileName: string | null; proofMimeType: string | null };

export async function getProjectExpensesBySalesOrders(salesOrderIds: string[]) {
  await requireActor(FINANCE_ROLES);
  if (!salesOrderIds.length) return new Map<string, ProjectExpensePrefill[]>();
  const rows = await getPrismaClient().expense.findMany({
    where: { salesOrderId: { in: salesOrderIds }, category: "PROJECT", deletedAt: null },
    select: { id: true, salesOrderId: true, hppKey: true, purpose: true, description: true, amount: true, spentAt: true, paymentMethodId: true, proofPath: true, proofFileName: true, proofMimeType: true },
    orderBy: { createdAt: "asc" },
  });
  const grouped = new Map<string, ProjectExpensePrefill[]>();
  for (const row of rows) {
    const list = grouped.get(row.salesOrderId ?? "") ?? [];
    list.push({ id: row.id, hppKey: row.hppKey, purpose: row.purpose, description: row.description, amount: row.amount.toString(), spentAt: row.spentAt.toISOString().slice(0, 10), paymentMethodId: row.paymentMethodId, proofPath: row.proofPath, proofFileName: row.proofFileName, proofMimeType: row.proofMimeType });
    grouped.set(row.salesOrderId ?? "", list);
  }
  return grouped;
}

const HPP_ROW_ORDER = ["kain", "zipper", "jahit", "pres", "dtfPlastisol", "bordir", "lainnya"] as const;
const HPP_ROW_LABEL: Record<string, string> = { kain: "Kain", zipper: "Zipper", jahit: "Jahit", pres: "Pres", dtfPlastisol: "DTF/Plastisol", bordir: "Bordir", lainnya: "Lain-lain" };

// R17 revisi — kolom Deskripsi multi-baris, satu baris per pengeluaran:
//   Kain 1 (Rp 150.000): bahan katun
//   Zipper 1 (Rp 25.000)
// Nomor urut per jenis, urut createdAt asc (dari query). Tanpa deskripsi = tanpa bagian ": …".
export function hppProjectDescription(rows: ProjectExpensePrefill[]): string {
  const lines: string[] = [];
  for (const key of HPP_ROW_ORDER) {
    let sequence = 0;
    for (const row of rows) {
      if (row.hppKey !== key) continue;
      sequence += 1;
      const amount = formatCurrency(row.amount);
      lines.push(row.description ? `${HPP_ROW_LABEL[key]} ${sequence} (${amount}): ${row.description}` : `${HPP_ROW_LABEL[key]} ${sequence} (${amount})`);
    }
  }
  return lines.join("\n");
}
