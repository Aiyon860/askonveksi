import "server-only";

import { Prisma } from "@prisma/client";

import { requireActor } from "@/lib/auth/session";
import { CRM_VIEW_ROLES, FINANCE_ROLES } from "@/lib/auth/permissions";
import { INVOICE_STATUS_LABEL, PAYMENT_KIND_LABEL } from "@/lib/crm/constants";
import { formatCurrency, formatDate } from "@/lib/crm/format";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/finance/expense-categories";
import { expenseGroupLabel } from "@/lib/finance/expense-group-label";
import {
  getDeletedExpensesForExport,
  getExpensesForExport,
  getIncomeForExport,
  type ExportPageRequest,
} from "@/lib/finance/expense";
import { getFinanceReport } from "@/lib/finance/report";
import { getPrismaClient } from "@/lib/prisma";
import { exportDate, exportDateKey, exportDateTime, exportFilterSummary, exportRange, exportText } from "@/lib/export/params";
import type { ExportColumn, ExportDatasetResult, ExportRow } from "@/lib/export/types";

type LoadInput = { searchParams: URLSearchParams; page: ExportPageRequest };

function row(cells: ExportRow["cells"], bold = false): ExportRow {
  return bold ? { cells, bold: true } : { cells };
}

/* ------------------------------- Pengeluaran ------------------------------- */

export const PENGELUARAN_COLUMNS: ExportColumn[] = [
  { header: "Tanggal", format: "date", width: 14 },
  { header: "Keperluan", width: 40 },
  { header: "Customer", width: 24 },
  { header: "Project", width: 36 },
  { header: "Kategori", width: 18 },
  { header: "Metode", width: 16 },
  { header: "Bukti", width: 9 },
  { header: "Dicatat oleh", width: 20 },
  { header: "Nominal", format: "currency", width: 16 },
  { header: "Deskripsi", width: 34 },
  { header: "Status Ganti", width: 16 },
];

export async function loadPengeluaran({ searchParams, page }: LoadInput): Promise<ExportDatasetResult> {
  const from = exportDate(searchParams.get("from"));
  const to = exportDate(searchParams.get("to"));
  const category = Object.keys(EXPENSE_CATEGORY_LABEL).includes(searchParams.get("category") ?? "")
    ? (searchParams.get("category") as keyof typeof EXPENSE_CATEGORY_LABEL)
    : "all";
  const rawType = searchParams.get("expenseType");
  const expenseType = rawType === "OPERASIONAL" || rawType === "PROJECT" ? rawType : "all";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const { rows, total } = await getExpensesForExport(
    {
      query: exportText(searchParams.get("q")),
      customer: exportText(searchParams.get("customer")),
      from,
      to,
      category,
      expenseType,
      method: exportText(searchParams.get("method"), 40) || "all",
      creatorId: exportText(searchParams.get("creator"), 40) || "all",
      order,
    },
    page,
  );
  return {
    rows: rows.map((item) => row([
      item.spentAt,
      item.purpose,
      item.customerName ?? "",
      item.project,
      EXPENSE_CATEGORY_LABEL[item.category],
      item.paymentMethod.name,
      item.proofPath ? "Ada" : "-",
      item.createdBy.name,
      Number(item.amount),
      item.description ?? "",
      item.isReimbursable ? (item.reimbursedAt ? "Sudah diganti" : "Belum diganti") : "-",
    ])),
    total,
    filterSummary: exportFilterSummary([
      from && to ? `${exportDateKey(from)} s.d. ${exportDateKey(to)}` : "90 hari terakhir",
      category !== "all" ? EXPENSE_CATEGORY_LABEL[category] : null,
      expenseType !== "all" ? (expenseType === "PROJECT" ? "Project" : "Operasional") : null,
      `Urutan tanggal ${order === "asc" ? "terlama" : "terbaru"}`,
    ]),
    notes: ["Baris subtotal per project tidak diikutkan karena file dibuat per halaman data."],
  };
}

/* --------------------------------- Project -------------------------------- */

export const PROJECT_COLUMNS: ExportColumn[] = [
  { header: "Tanggal", format: "date", width: 14 },
  { header: "Customer", width: 26 },
  { header: "Nama order", width: 28 },
  { header: "Jenis busana", width: 18 },
  { header: "Total QTY", format: "number", width: 10 },
  { header: "Kain", format: "currency", width: 14 },
  { header: "Zipper", format: "currency", width: 14 },
  { header: "Jahit", format: "currency", width: 14 },
  { header: "Pres", format: "currency", width: 14 },
  { header: "DTF/Plastisol", format: "currency", width: 16 },
  { header: "Bordir", format: "currency", width: 14 },
  { header: "Lain-lain", format: "currency", width: 14 },
  { header: "Deskripsi", width: 40 },
  { header: "Total HPP", format: "currency", width: 16 },
  { header: "Harga Asli", format: "currency", width: 16 },
  { header: "Diskon", format: "currency", width: 14 },
  { header: "Pajak", format: "currency", width: 14 },
  { header: "Total Invoice", format: "currency", width: 16 },
  { header: "Laba Bersih", format: "currency", width: 16 },
  { header: "Margin %", format: "percent", width: 10 },
  { header: "Deposit", format: "currency", width: 14 },
  { header: "DP", format: "currency", width: 14 },
  { header: "Lunas", format: "currency", width: 14 },
  { header: "Keterangan", width: 18 },
  { header: "Status", width: 15 },
];

export async function loadProject({ searchParams, page }: LoadInput): Promise<ExportDatasetResult> {
  const from = exportDate(searchParams.get("from"));
  const to = exportDate(searchParams.get("to"));
  const rawStatus = searchParams.get("status");
  const status = rawStatus === "DP" || rawStatus === "LUNAS" || rawStatus === "DEPOSIT" ? rawStatus : "all";
  const hppStatus = searchParams.get("hppStatus") === "COMPLETE"
    ? "COMPLETE"
    : searchParams.get("hppStatus") === "INCOMPLETE"
      ? "INCOMPLETE"
      : "all";
  const { rows, total } = await getIncomeForExport(
    { query: exportText(searchParams.get("q")), from, to, status, hppStatus },
    page,
  );
  return {
    rows: rows.map((item) => row([
      item.paidAt ? item.paidAt.slice(0, 10) : null,
      item.customer,
      item.orderName,
      item.garmentType,
      item.quantity,
      item.kain ? Number(item.kain) : null,
      item.zipper ? Number(item.zipper) : null,
      item.jahit ? Number(item.jahit) : null,
      item.pres ? Number(item.pres) : null,
      item.dtfPlastisol ? Number(item.dtfPlastisol) : null,
      item.bordir ? Number(item.bordir) : null,
      item.lainnya ? Number(item.lainnya) : null,
      item.projectDescription,
      item.hpp ? Number(item.hpp) : null,
      Number(item.originalPrice),
      Number(item.discount),
      Number(item.tax),
      Number(item.totalInvoice),
      item.netProfit ? Number(item.netProfit) : null,
      item.margin === null ? null : Math.round(item.margin * 10000) / 100,
      item.deposit ? Number(item.deposit) : null,
      item.dp ? Number(item.dp) : null,
      item.settled ? Number(item.settled) : null,
      item.remaining === "0" ? "Lunas" : `Sisa ${formatCurrency(item.remaining)}`,
      item.hppStatus === "COMPLETE" ? "Lengkap" : "Belum Lengkap",
    ])),
    total,
    filterSummary: exportFilterSummary([
      from && to ? `${exportDateKey(from)} s.d. ${exportDateKey(to)}` : "semua tanggal",
      status === "all" ? null : `Status ${status}`,
      hppStatus === "all" ? null : hppStatus === "COMPLETE" ? "HPP lengkap" : "HPP belum lengkap",
    ]),
  };
}

/* -------------------------------- Laporan --------------------------------- */

export const LAPORAN_COLUMNS: ExportColumn[] = [
  { header: "Tanggal", width: 34 },
  { header: "Pemasukan", width: 46 },
  { header: "Pengeluaran", width: 46 },
];

export async function loadLaporan({ searchParams }: LoadInput): Promise<ExportDatasetResult> {
  const from = exportDate(searchParams.get("from"));
  const to = exportDate(searchParams.get("to"));
  const report = await getFinanceReport({ from, to });
  const rows: ExportRow[] = [];
  for (const group of report.groups) {
    // Pengeluaran satu baris per tanggal (mengikuti halaman laporan); pemasukan tetap per transaksi.
    const count = Math.max(group.income.length, 1);
    for (let index = 0; index < count; index += 1) {
      rows.push(row([
        index === 0 ? group.date : "",
        group.income[index] ? `${group.income[index].label} — ${formatCurrency(group.income[index].amount)}` : "",
        index === 0 && group.expenses.length ? `${expenseGroupLabel(group.date)} — ${formatCurrency(group.expenseTotal)}` : "",
      ]));
    }
  }
  const periodLabel = from && to ? `dari ${formatDate(from)} ke ${formatDate(to)}` : "seluruh waktu";
  rows.push(row([]));
  rows.push(row(["Total Pemasukan Keseluruhan", formatCurrency(report.allIncome), ""], true));
  rows.push(row(["Total Pengeluaran Keseluruhan", "", formatCurrency(report.allExpense)], true));
  rows.push(row([`Total Pendapatan ${periodLabel}`, formatCurrency(report.totalIncome), ""], true));
  rows.push(row([`Total Pengeluaran ${periodLabel}`, "", formatCurrency(report.totalExpense)], true));
  return {
    rows,
    total: rows.length,
    filterSummary: from && to ? `${exportDateKey(from)} s.d. ${exportDateKey(to)}` : "seluruh waktu",
  };
}

/* --------------------------------- Invoice -------------------------------- */

export const INVOICE_COLUMNS: ExportColumn[] = [
  { header: "No. Invoice", width: 20 },
  { header: "Dibuat", format: "date", width: 14 },
  { header: "Diterbitkan", format: "date", width: 14 },
  { header: "Jatuh tempo", format: "date", width: 14 },
  { header: "Customer", width: 26 },
  { header: "Perusahaan", width: 26 },
  { header: "No. PO", width: 20 },
  { header: "Status invoice", width: 16 },
  { header: "Status bayar", width: 16 },
  { header: "Jumlah item", format: "number", width: 11 },
  { header: "Total QTY", format: "number", width: 10 },
  { header: "Subtotal", format: "currency", width: 16 },
  { header: "Diskon", format: "currency", width: 14 },
  { header: "Pajak", format: "currency", width: 14 },
  { header: "Total", format: "currency", width: 16 },
  { header: "Sisa tagihan", format: "currency", width: 16 },
  { header: "Dibuat oleh", width: 20 },
];

const INVOICE_STATUS_FILTERS = ["DRAFT", "ISSUED", "SUPERSEDED", "CANCELLED"] as const;

function invoicePaymentLabel(invoice: {
  status: string;
  salesOrder: { status: string; payment: { outstandingAmount: Prisma.Decimal; transactions: { id: string }[] } | null } | null;
  pendingPayment: { kind: string } | null;
}) {
  if (invoice.salesOrder?.status === "ACTIVE") {
    if (!invoice.salesOrder.payment) return "Belum diatur";
    if (invoice.salesOrder.payment.outstandingAmount.equals(0)) return "Lunas";
    return invoice.salesOrder.payment.transactions.length ? "Dibayar sebagian" : "Belum bayar";
  }
  if (invoice.pendingPayment) return `Menunggu ${PAYMENT_KIND_LABEL[invoice.pendingPayment.kind as keyof typeof PAYMENT_KIND_LABEL] ?? invoice.pendingPayment.kind}`;
  return "Belum dijadwalkan";
}

export async function loadInvoice({ searchParams, page }: LoadInput): Promise<ExportDatasetResult> {
  await requireActor(CRM_VIEW_ROLES);
  const query = exportText(searchParams.get("q"));
  const rawStatus = searchParams.get("status");
  const status = INVOICE_STATUS_FILTERS.find((item) => item === rawStatus);
  const rawPayment = searchParams.get("payment");
  const payment = rawPayment === "PAID" || rawPayment === "UNPAID" || rawPayment === "NO_SALES_ORDER" ? rawPayment : undefined;
  const paymentWhere = payment === "PAID"
    ? { salesOrder: { is: { status: "ACTIVE" as const, payment: { is: { outstandingAmount: 0 } } } } }
    : payment === "UNPAID"
      ? { salesOrder: { is: { status: "ACTIVE" as const, payment: { is: { outstandingAmount: { gt: 0 } } } } } }
      : payment === "NO_SALES_ORDER"
        ? { OR: [{ salesOrder: null }, { salesOrder: { is: { status: "CANCELLED" as const } } }] }
        : {};
  const from = exportDate(searchParams.get("from"));
  const to = exportDate(searchParams.get("to"));
  const range = exportRange(from, to);
  const where = {
    ...paymentWhere,
    ...(status ? { status } : {}),
    ...(range ? { createdAt: { gte: range.start, lt: range.end } } : {}),
    ...(query
      ? {
          OR: [
            { invoiceNo: { contains: query, mode: "insensitive" as const } },
            { snapshotCustomerName: { contains: query, mode: "insensitive" as const } },
            { snapshotCompanyName: { contains: query, mode: "insensitive" as const } },
            { purchaseOrder: { purchaseOrderNo: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  } satisfies Prisma.InvoiceWhereInput;
  const prisma = getPrismaClient();
  const select = {
    invoiceNo: true,
    createdAt: true,
    issuedAt: true,
    dueAt: true,
    status: true,
    snapshotCustomerName: true,
    snapshotCompanyName: true,
    subtotal: true,
    totalDiscount: true,
    taxAmount: true,
    total: true,
    createdBy: { select: { name: true } },
    purchaseOrder: { select: { purchaseOrderNo: true } },
    salesOrder: {
      select: {
        status: true,
        payment: {
          select: {
            outstandingAmount: true,
            transactions: { where: { paymentTermId: null, status: "ACTIVE" as const }, select: { id: true }, take: 1 },
          },
        },
      },
    },
    pendingPayment: { select: { kind: true } },
    items: { select: { quantity: true } },
  } satisfies Prisma.InvoiceSelect;
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      select,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: page.offset,
      take: page.limit,
    }),
    page.offset === 0 ? prisma.invoice.count({ where }) : Promise.resolve(null),
  ]);
  return {
    rows: items.map((item) => row([
      item.invoiceNo,
      exportDateKey(item.createdAt),
      exportDateKey(item.issuedAt),
      exportDateKey(item.dueAt),
      item.snapshotCustomerName,
      item.snapshotCompanyName ?? "",
      item.purchaseOrder.purchaseOrderNo,
      INVOICE_STATUS_LABEL[item.status],
      invoicePaymentLabel(item),
      item.items.length,
      item.items.reduce((sum, line) => sum + line.quantity, 0),
      Number(item.subtotal),
      Number(item.totalDiscount),
      Number(item.taxAmount),
      Number(item.total),
      item.salesOrder?.payment ? Number(item.salesOrder.payment.outstandingAmount) : null,
      item.createdBy.name,
    ])),
    total,
    filterSummary: exportFilterSummary([
      from && to ? `${exportDateKey(from)} s.d. ${exportDateKey(to)}` : "semua tanggal",
      status ? INVOICE_STATUS_LABEL[status] : null,
      payment === "PAID" ? "Lunas" : payment === "UNPAID" ? "Belum terbayar" : payment === "NO_SALES_ORDER" ? "Belum ada sales order" : null,
      query ? `Pencarian: ${query}` : null,
    ]),
  };
}

/* --------------------------------- Mutasi --------------------------------- */

export const MUTASI_COLUMNS: ExportColumn[] = [
  { header: "Tanggal bayar", format: "datetime", width: 18 },
  { header: "No. Invoice", width: 20 },
  { header: "Customer", width: 26 },
  { header: "Perusahaan", width: 26 },
  { header: "Project", width: 28 },
  { header: "Jenis", width: 16 },
  { header: "Termin ke", format: "number", width: 10 },
  { header: "Jatuh tempo", format: "date", width: 14 },
  { header: "Nominal", format: "currency", width: 16 },
  { header: "Metode", width: 16 },
  { header: "Referensi", width: 20 },
  { header: "Bukti", width: 9 },
  { header: "Status", width: 12 },
  { header: "Dibatalkan pada", format: "datetime", width: 18 },
  { header: "Alasan batal", width: 30 },
  { header: "Dicatat oleh", width: 20 },
  { header: "Catatan", width: 30 },
];

export async function loadMutasi({ searchParams, page }: LoadInput): Promise<ExportDatasetResult> {
  await requireActor(FINANCE_ROLES);
  const query = exportText(searchParams.get("q"));
  const from = exportDate(searchParams.get("from"));
  const to = exportDate(searchParams.get("to"));
  const range = exportRange(from, to);
  const rawStatus = searchParams.get("status");
  const status = rawStatus === "ACTIVE" || rawStatus === "VOIDED" ? rawStatus : undefined;
  const method = exportText(searchParams.get("method"), 40);
  const where = {
    ...(status ? { status } : {}),
    ...(range ? { paidAt: { gte: range.start, lt: range.end } } : {}),
    ...(method ? { paymentMethodId: method } : {}),
    ...(query
      ? {
          OR: [
            { reference: { contains: query, mode: "insensitive" as const } },
            { note: { contains: query, mode: "insensitive" as const } },
            { payment: { salesOrder: { invoiceNo: { contains: query, mode: "insensitive" as const } } } },
            { payment: { salesOrder: { snapshotCustomerName: { contains: query, mode: "insensitive" as const } } } },
            { payment: { salesOrder: { snapshotCompanyName: { contains: query, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  } satisfies Prisma.PaymentTransactionWhereInput;
  const prisma = getPrismaClient();
  const [items, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where,
      select: {
        amount: true,
        paidAt: true,
        isDeposit: true,
        status: true,
        reference: true,
        note: true,
        proofPath: true,
        voidedAt: true,
        voidReason: true,
        paymentMethod: { select: { name: true } },
        createdBy: { select: { name: true } },
        paymentTerm: { select: { position: true, dueAt: true } },
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
      orderBy: [{ paidAt: "desc" }, { id: "asc" }],
      skip: page.offset,
      take: page.limit,
    }),
    page.offset === 0 ? prisma.paymentTransaction.count({ where }) : Promise.resolve(null),
  ]);
  return {
    rows: items.map((item) => {
      const order = item.payment.salesOrder;
      return row([
        exportDateTime(item.paidAt),
        order.invoiceNo,
        order.snapshotCustomerName,
        order.snapshotCompanyName ?? "",
        order.purchaseOrder.productName,
        item.isDeposit ? "Deposit" : item.paymentTerm ? "Termin" : PAYMENT_KIND_LABEL[item.payment.kind],
        item.paymentTerm?.position ?? null,
        exportDateKey(item.paymentTerm?.dueAt ?? null),
        Number(item.amount),
        item.paymentMethod?.name ?? "",
        item.reference ?? "",
        item.proofPath ? "Ada" : "-",
        item.status === "ACTIVE" ? "Aktif" : "Dibatalkan",
        exportDateTime(item.voidedAt),
        item.voidReason ?? "",
        item.createdBy.name,
        item.note ?? "",
      ]);
    }),
    total,
    filterSummary: exportFilterSummary([
      from && to ? `${exportDateKey(from)} s.d. ${exportDateKey(to)}` : "semua tanggal",
      status ? (status === "ACTIVE" ? "Aktif" : "Dibatalkan") : null,
      query ? `Pencarian: ${query}` : null,
    ]),
  };
}

/* --------------------------- Riwayat hapus expense ------------------------- */

export const PENGELUARAN_TERHAPUS_COLUMNS: ExportColumn[] = [
  { header: "Keperluan", width: 40 },
  { header: "Customer", width: 24 },
  { header: "Kategori", width: 18 },
  { header: "Tanggal pakai", format: "date", width: 14 },
  { header: "Nominal", format: "currency", width: 16 },
  { header: "Dicatat oleh", width: 20 },
  { header: "Dihapus oleh", width: 20 },
  { header: "Dihapus pada", format: "datetime", width: 18 },
  { header: "Alasan hapus", width: 34 },
];

export async function loadPengeluaranTerhapus({ page }: LoadInput): Promise<ExportDatasetResult> {
  const { items, total } = await getDeletedExpensesForExport(page);
  return {
    rows: items.map((item) => row([
      item.purpose,
      item.customerName ?? "",
      EXPENSE_CATEGORY_LABEL[item.category as keyof typeof EXPENSE_CATEGORY_LABEL],
      exportDateKey(item.spentAt),
      Number(item.amount),
      item.createdBy.name,
      item.deletedBy?.name ?? "",
      exportDateTime(item.deletedAt),
      item.deleteReason ?? "",
    ])),
    total,
    filterSummary: "Semua pengeluaran terhapus",
  };
}

/* ------------------------------- Rincian HPP ------------------------------ */

const HPP_LABEL: Record<string, string> = {
  kain: "Kain",
  zipper: "Zipper",
  jahit: "Jahit",
  pres: "Pres",
  dtfPlastisol: "DTF/Plastisol",
  bordir: "Bordir",
  lainnya: "Lain-lain",
};

export const RINCIAN_HPP_COLUMNS: ExportColumn[] = [
  { header: "Tanggal", format: "date", width: 14 },
  { header: "Customer", width: 26 },
  { header: "No. Invoice", width: 20 },
  { header: "Produk", width: 26 },
  { header: "Jenis HPP", width: 16 },
  { header: "Deskripsi", width: 36 },
  { header: "Nominal", format: "currency", width: 16 },
  { header: "Metode", width: 16 },
  { header: "Bukti", width: 9 },
  { header: "Dicatat oleh", width: 20 },
  { header: "Status ganti", width: 16 },
];

export async function loadRincianHpp({ searchParams, page }: LoadInput): Promise<ExportDatasetResult> {
  await requireActor(FINANCE_ROLES);
  const query = exportText(searchParams.get("q"));
  const from = exportDate(searchParams.get("from"));
  const to = exportDate(searchParams.get("to"));
  const range = exportRange(from, to);
  const where = {
    category: "PROJECT" as const,
    deletedAt: null,
    ...(range ? { spentAt: { gte: range.start, lt: range.end } } : {}),
    ...(query
      ? {
          OR: [
            { purpose: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
            { customerName: { contains: query, mode: "insensitive" as const } },
            { salesOrder: { invoiceNo: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  } satisfies Prisma.ExpenseWhereInput;
  const prisma = getPrismaClient();
  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      select: {
        spentAt: true,
        description: true,
        amount: true,
        hppKey: true,
        customerName: true,
        isReimbursable: true,
        reimbursedAt: true,
        proofPath: true,
        paymentMethod: { select: { name: true } },
        createdBy: { select: { name: true } },
        salesOrder: { select: { invoiceNo: true, purchaseOrder: { select: { productName: true } } } },
      },
      orderBy: [{ spentAt: "desc" }, { id: "asc" }],
      skip: page.offset,
      take: page.limit,
    }),
    page.offset === 0 ? prisma.expense.count({ where }) : Promise.resolve(null),
  ]);
  return {
    rows: items.map((item) => row([
      exportDateKey(item.spentAt),
      item.customerName ?? "",
      item.salesOrder?.invoiceNo ?? "",
      item.salesOrder?.purchaseOrder.productName ?? "",
      item.hppKey ? HPP_LABEL[item.hppKey] ?? item.hppKey : "",
      item.description ?? "",
      Number(item.amount),
      item.paymentMethod.name,
      item.proofPath ? "Ada" : "-",
      item.createdBy.name,
      item.isReimbursable ? (item.reimbursedAt ? "Sudah diganti" : "Belum diganti") : "-",
    ])),
    total,
    filterSummary: exportFilterSummary([
      from && to ? `${exportDateKey(from)} s.d. ${exportDateKey(to)}` : "semua tanggal",
      query ? `Pencarian: ${query}` : null,
    ]),
  };
}
