import "server-only";

import { FINANCE_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  getProjectsForWorkbook,
  projectGroupLabel,
  type ExpenseCategory,
  type WorkbookProject,
} from "@/lib/finance/expense";
import { jakartaDateKey, type FinanceDateRange } from "@/lib/finance/date-range";
import type { FinanceWorkbookScope } from "@/lib/export/workbook-types";

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export type WorkbookExpense = {
  id: string;
  spentAt: string;
  purpose: string;
  description: string;
  category: ExpenseCategory;
  categoryLabel: string;
  kind: "PROJECT" | "OPERASIONAL";
  amount: number;
  customerProject: string;
  reference: string;
  method: string;
  proof: string;
  createdBy: string;
  createdAt: string;
};

export type WorkbookPayment = {
  id: string;
  paidAt: string;
  amount: number;
  kind: "DEPOSIT" | "DP" | "PELUNASAN" | "PEMBAYARAN";
  customer: string;
  invoiceNo: string;
  productName: string;
  createdAt: string;
};

export type FinanceWorkbookPeriod = {
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  label: string;
  rangeLabel: string;
  monthLabel: string;
  monthTitle: string;
  endDateLabel: string;
};

export type FinanceWorkbookData = {
  scope: FinanceWorkbookScope;
  period: FinanceWorkbookPeriod;
  projects: WorkbookProject[];
  expenses: WorkbookExpense[];
  payments: WorkbookPayment[];
  categories: Array<{ key: ExpenseCategory; label: string }>;
  generatedAt: string;
};

function dateKeyLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return `${String(day).padStart(2, "0")} ${MONTHS_ID[month - 1]} ${year}`;
}

function financePeriod(range: FinanceDateRange): FinanceWorkbookPeriod {
  const [year, month] = range.to.split("-").map(Number);
  const fromLabel = dateKeyLabel(range.from);
  const toLabel = dateKeyLabel(range.to);
  const monthTitle = `${MONTHS_ID[month - 1]} ${year}`;
  const sameMonth = range.from.slice(0, 7) === range.to.slice(0, 7);
  const rangeLabel = range.from === range.to
    ? fromLabel.toUpperCase()
    : sameMonth
      ? `${range.from.slice(8, 10)} S/D ${range.to.slice(8, 10)} ${monthTitle.toUpperCase()}`
      : `${fromLabel.toUpperCase()} S/D ${toLabel.toUpperCase()}`;
  return {
    from: range.from,
    to: range.to,
    fromLabel,
    toLabel,
    label: range.from === range.to ? fromLabel : `${fromLabel} – ${toLabel}`,
    rangeLabel,
    monthLabel: monthTitle.toUpperCase(),
    monthTitle,
    endDateLabel: toLabel,
  };
}

function expenseDate(value: Date) {
  return new Date(value.getTime() + 7 * 60 * 60 * 1000);
}

async function getWorkbookExpenses(range: FinanceDateRange): Promise<WorkbookExpense[]> {
  const rows = await getPrismaClient().expense.findMany({
    where: {
      deletedAt: null,
      spentAt: { gte: expenseDate(range.start), lt: expenseDate(range.end) },
    },
    select: {
      id: true,
      purpose: true,
      description: true,
      spentAt: true,
      amount: true,
      category: true,
      customerName: true,
      proofPath: true,
      createdAt: true,
      paymentMethod: { select: { name: true } },
      createdBy: { select: { name: true } },
      salesOrder: {
        select: {
          invoiceNo: true,
          snapshotCustomerName: true,
          snapshotCompanyName: true,
          purchaseOrder: { select: { productName: true } },
        },
      },
    },
    orderBy: [{ spentAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => {
    const category = row.category as ExpenseCategory;
    return {
      id: row.id,
      spentAt: row.spentAt.toISOString().slice(0, 10),
      purpose: row.purpose,
      description: row.description ?? "",
      category,
      categoryLabel: EXPENSE_CATEGORY_LABEL[category] ?? category,
      kind: category === "PROJECT" ? "PROJECT" : "OPERASIONAL",
      amount: row.amount.toNumber(),
      customerProject: category === "PROJECT" ? projectGroupLabel(row.salesOrder, row.customerName) : row.customerName ?? "-",
      reference: row.salesOrder?.invoiceNo ?? "-",
      method: row.paymentMethod.name,
      proof: row.proofPath ? "Ada" : "-",
      createdBy: row.createdBy.name,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

async function getWorkbookPayments(range: FinanceDateRange): Promise<WorkbookPayment[]> {
  const rows = await getPrismaClient().paymentTransaction.findMany({
    where: {
      status: "ACTIVE",
      paidAt: { gte: range.start, lt: range.end },
      payment: {
        salesOrder: {
          status: "ACTIVE",
          invoice: { status: "ISSUED" },
        },
      },
    },
    select: {
      id: true,
      amount: true,
      paidAt: true,
      isDeposit: true,
      paymentTermId: true,
      createdAt: true,
      payment: {
        select: {
          kind: true,
          salesOrder: {
            select: {
              invoiceNo: true,
              snapshotCustomerName: true,
              snapshotCompanyName: true,
              purchaseOrder: { select: { productName: true } },
            },
          },
        },
      },
    },
    orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => {
    const order = row.payment.salesOrder;
    // Sumber kas mengikuti jenis transaksi, bukan hanya jenis rencana pembayaran.
    // Dengan begitu termin pada rencana DEPOSIT tetap tampil sebagai pelunasan.
    const kind: WorkbookPayment["kind"] = row.isDeposit
      ? "DEPOSIT"
      : row.paymentTermId
        ? "PELUNASAN"
        : row.payment.kind === "DP" || row.payment.kind === "DEPOSIT"
          ? "DP"
          : row.payment.kind === "LUNAS"
            ? "PELUNASAN"
            : "PEMBAYARAN";
    return {
      id: row.id,
      paidAt: jakartaDateKey(row.paidAt),
      amount: row.amount.toNumber(),
      kind,
      customer: order.snapshotCompanyName ?? order.snapshotCustomerName,
      invoiceNo: order.invoiceNo,
      productName: order.purchaseOrder.productName,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

export async function getFinanceWorkbookData({
  scope,
  range,
}: {
  scope: FinanceWorkbookScope;
  range: FinanceDateRange;
}): Promise<FinanceWorkbookData> {
  await requireActor(FINANCE_ROLES);
  const includeProjects = scope !== "pengeluaran";
  const includeExpenses = scope !== "pemasukan";
  const includePayments = scope !== "pemasukan";
  const [projects, expenses, payments] = await Promise.all([
    includeProjects ? getProjectsForWorkbook(range.start, range.end) : Promise.resolve([]),
    includeExpenses ? getWorkbookExpenses(range) : Promise.resolve([]),
    includePayments ? getWorkbookPayments(range) : Promise.resolve([]),
  ]);
  return {
    scope,
    period: financePeriod(range),
    projects,
    expenses,
    payments,
    categories: EXPENSE_CATEGORIES.map((key) => ({ key, label: EXPENSE_CATEGORY_LABEL[key] })),
    generatedAt: `${new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(new Date())} WIB`,
  };
}
