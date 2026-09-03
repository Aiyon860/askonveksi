import { Prisma } from "@prisma/client";

export type SalesPerformanceRow = {
  salesId: string | null;
  salesName: string;
  isActive: boolean | null;
  leadCount: number;
  followUpCount: number;
  invoiceCount: number;
  dealCount: number;
  revenue: string;
};

function hasActivity(row: SalesPerformanceRow) {
  return (
    row.leadCount > 0 ||
    row.followUpCount > 0 ||
    row.invoiceCount > 0 ||
    row.dealCount > 0 ||
    !new Prisma.Decimal(row.revenue).isZero()
  );
}

function compareRows(a: SalesPerformanceRow, b: SalesPerformanceRow) {
  const revenueComparison = new Prisma.Decimal(b.revenue).comparedTo(a.revenue);
  if (revenueComparison !== 0) return revenueComparison;
  if (b.dealCount !== a.dealCount) return b.dealCount - a.dealCount;
  if (b.invoiceCount !== a.invoiceCount) return b.invoiceCount - a.invoiceCount;
  if (b.followUpCount !== a.followUpCount) return b.followUpCount - a.followUpCount;
  if (b.leadCount !== a.leadCount) return b.leadCount - a.leadCount;
  return a.salesName.localeCompare(b.salesName, "id-ID");
}

export function finalizeSalesPerformanceRows(rawRows: SalesPerformanceRow[]) {
  const rows = rawRows
    .filter((row) => row.isActive === true || hasActivity(row))
    .sort(compareRows);

  const totals = rows.reduce(
    (result, row) => ({
      leadCount: result.leadCount + row.leadCount,
      followUpCount: result.followUpCount + row.followUpCount,
      invoiceCount: result.invoiceCount + row.invoiceCount,
      dealCount: result.dealCount + row.dealCount,
      revenue: result.revenue.plus(row.revenue),
    }),
    {
      leadCount: 0,
      followUpCount: 0,
      invoiceCount: 0,
      dealCount: 0,
      revenue: new Prisma.Decimal(0),
    },
  );

  return {
    rows,
    totals: {
      leadCount: totals.leadCount,
      followUpCount: totals.followUpCount,
      invoiceCount: totals.invoiceCount,
      dealCount: totals.dealCount,
      revenue: totals.revenue.toString(),
    },
  };
}
