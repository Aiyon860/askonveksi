import { Prisma } from "@prisma/client";

export type SalesPerformanceRow = {
  salesId: string | null;
  salesName: string;
  isActive: boolean | null;
  leadCount: number;
  followUpCount: number;
  quotationCount: number;
  dealCount: number;
  revenue: string;
};

function hasActivity(row: SalesPerformanceRow) {
  return (
    row.leadCount > 0 ||
    row.followUpCount > 0 ||
    row.quotationCount > 0 ||
    row.dealCount > 0 ||
    !new Prisma.Decimal(row.revenue).isZero()
  );
}

function compareRows(a: SalesPerformanceRow, b: SalesPerformanceRow) {
  const revenueComparison = new Prisma.Decimal(b.revenue).comparedTo(a.revenue);
  if (revenueComparison !== 0) return revenueComparison;
  if (b.dealCount !== a.dealCount) return b.dealCount - a.dealCount;
  if (b.quotationCount !== a.quotationCount) return b.quotationCount - a.quotationCount;
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
      quotationCount: result.quotationCount + row.quotationCount,
      dealCount: result.dealCount + row.dealCount,
      revenue: result.revenue.plus(row.revenue),
    }),
    {
      leadCount: 0,
      followUpCount: 0,
      quotationCount: 0,
      dealCount: 0,
      revenue: new Prisma.Decimal(0),
    },
  );

  return {
    rows,
    totals: {
      leadCount: totals.leadCount,
      followUpCount: totals.followUpCount,
      quotationCount: totals.quotationCount,
      dealCount: totals.dealCount,
      revenue: totals.revenue.toString(),
    },
  };
}
