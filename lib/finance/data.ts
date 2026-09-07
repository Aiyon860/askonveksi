import "server-only";

import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";

import { FINANCE_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { parseFinanceDateRange } from "@/lib/finance/date-range";

const FINANCE_TABLE_LIMIT = 50;

export type FinanceOverviewData = Awaited<ReturnType<typeof getCachedFinanceOverviewData>>;

const getCachedFinanceOverviewData = unstable_cache(
  async ({ from, to, start, end, label }: { from: string; to: string; start: Date; end: Date; label: string }) => {
    const prisma = getPrismaClient();
    const paymentWhere = {
      status: "ACTIVE",
      paidAt: { gte: start, lt: end },
      payment: { salesOrder: { status: "ACTIVE" } },
    } satisfies Prisma.PaymentTransactionWhereInput;
    const orderWhere = {
      status: "ACTIVE",
      acceptedAt: { gte: start, lt: end },
    } satisfies Prisma.SalesOrderWhereInput;
    const outstandingWhere = {
      salesOrder: { status: "ACTIVE" },
      outstandingAmount: { gt: 0 },
    } satisfies Prisma.DealPaymentWhereInput;

    const [
      moneyIn,
      dealOrderValue,
      outstanding,
      transactions,
      outstandingOrders,
    ] = await Promise.all([
      prisma.paymentTransaction.aggregate({ where: paymentWhere, _sum: { amount: true }, _count: true }),
      prisma.salesOrder.aggregate({ where: orderWhere, _sum: { total: true }, _count: true }),
      prisma.dealPayment.aggregate({ where: outstandingWhere, _sum: { outstandingAmount: true }, _count: true }),
      prisma.paymentTransaction.findMany({
        where: paymentWhere,
        select: {
          id: true,
          paymentTermId: true,
          amount: true,
          paidAt: true,
          reference: true,
          createdBy: { select: { name: true } },
          payment: {
            select: {
              kind: true,
              salesOrder: {
                select: {
                  id: true,
                  salesOrderNo: true,
                  snapshotCustomerName: true,
                  snapshotCompanyName: true,
                },
              },
            },
          },
        },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        take: FINANCE_TABLE_LIMIT,
      }),
      prisma.dealPayment.findMany({
        where: outstandingWhere,
        select: {
          id: true,
          outstandingAmount: true,
          salesOrder: {
            select: {
              id: true,
              salesOrderNo: true,
              snapshotCustomerName: true,
              snapshotCompanyName: true,
              total: true,
              acceptedAt: true,
            },
          },
          transactions: {
            where: { status: "ACTIVE" },
            select: { amount: true },
          },
        },
        orderBy: [{ salesOrder: { acceptedAt: "desc" } }, { id: "asc" }],
        take: FINANCE_TABLE_LIMIT,
      }),
    ]);

    return {
      range: { from, to, label },
      totals: {
        moneyIn: moneyIn._sum.amount?.toString() ?? "0",
        transactionCount: moneyIn._count,
        dealOrderValue: dealOrderValue._sum.total?.toString() ?? "0",
        dealOrderCount: dealOrderValue._count,
        outstandingAmount: outstanding._sum.outstandingAmount?.toString() ?? "0",
        outstandingOrderCount: outstanding._count,
      },
      transactions: transactions.map((item) => ({
        id: item.id,
        salesOrderId: item.payment.salesOrder.id,
        salesOrderNo: item.payment.salesOrder.salesOrderNo,
        customerName: item.payment.salesOrder.snapshotCompanyName ?? item.payment.salesOrder.snapshotCustomerName,
        paymentKind: item.payment.kind,
        transactionKind: item.paymentTermId ? "Termin" : "Pembayaran awal",
        amount: item.amount.toString(),
        paidAt: item.paidAt.toISOString(),
        reference: item.reference,
        createdByName: item.createdBy.name,
      })),
      outstandingOrders: outstandingOrders.map((item) => {
        const paidAmount = item.transactions.reduce(
          (sum, transaction) => sum.add(transaction.amount),
          new Prisma.Decimal(0),
        );

        return {
          id: item.id,
          salesOrderId: item.salesOrder.id,
          salesOrderNo: item.salesOrder.salesOrderNo,
          customerName: item.salesOrder.snapshotCompanyName ?? item.salesOrder.snapshotCustomerName,
          total: item.salesOrder.total.toString(),
          paidAmount: paidAmount.toString(),
          outstandingAmount: item.outstandingAmount.toString(),
          acceptedAt: item.salesOrder.acceptedAt.toISOString(),
        };
      }),
      limits: {
        transactions: FINANCE_TABLE_LIMIT,
        outstandingOrders: FINANCE_TABLE_LIMIT,
      },
    };
  },
  ["finance-overview"],
  { tags: ["finance-overview"], revalidate: 30 },
);

export async function getFinanceOverviewData(params: {
  from?: string | string[];
  to?: string | string[];
}) {
  await requireActor(FINANCE_ROLES);
  const range = parseFinanceDateRange(params.from, params.to);

  return getCachedFinanceOverviewData({
    from: range.from,
    to: range.to,
    start: range.start,
    end: range.end,
    label: range.label,
  });
}
