import "server-only";

import { Prisma } from "@prisma/client";
import { DASHBOARD_ROLES, FINANCE_ROLES, hasRole } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/crm/format";

export type DashboardQueryParams = {
  mode?: string | string[];
  from?: string | string[];
  to?: string | string[];
  range?: string | string[];
  sourceId?: string | string[];
  categoryId?: string | string[];
};

// Cakupan data dashboard per peran. FULL = Owner/Developer/Keuangan,
// CUSTOMER = Admin Customer (data pelanggan & CRM), PRODUCTION = Admin PO
// (data order, produk, dan produksi). Nilai uang tetap disamarkan lewat
// maskFinancialData untuk semua role non-Keuangan.
export type DashboardScope = "FULL" | "CUSTOMER" | "PRODUCTION";

export function resolveDashboardScope(role: string): DashboardScope {
  if (role === "ADMIN_CUSTOMER") return "CUSTOMER";
  if (role === "ADMIN_PO") return "PRODUCTION";
  return "FULL";
}

export type FullDashboardData = {
  actor: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
  dashboardScope: DashboardScope;
  canViewFinancialData: boolean;
  period: {
    from: string;
    to: string;
    label: string;
    preset: string;
  };
  filters: {
    sourceId: string;
    categoryId: string;
  };
  filterMeta: {
    leadSources: Array<{ id: string; name: string }>;
    productCategories: Array<{ id: string; name: string }>;
  };
  summary: {
    totalLead: number;
    prevLead: number;
    leadGrowth: number;

    totalDeal: number;
    prevDeal: number;
    dealGrowth: number;

    totalOrder: number;
    prevOrder: number;
    orderGrowth: number;

    totalOmzet: string;
    totalOmzetNum: number;
    prevOmzet: string;
    omzetGrowth: number;

    totalVolumePcs: number;
    prevVolumePcs: number;
    volumeGrowth: number;

    winRate: number;
    prevWinRate: number;
    winRateGrowth: number;
  };
  trendData: Array<{
    date: string;
    fullDate: string;
    omzet: number;
    orders: number;
    leads: number;
    pcs: number;
  }>;
  leadSourcesDonut: Array<{
    name: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  categoryProgress: Array<{
    name: string;
    count: number;
    pcs: number;
    percentage: number;
  }>;
  leadSourceTable: Array<{
    no: number;
    sourceId: string;
    name: string;
    leadCount: number;
    dealCount: number;
    orderCount: number;
    revenue: string;
    revenueNum: number;
    conversionRate: number;
  }>;
  categoryRevenueDonut: Array<{
    name: string;
    revenue: string;
    revenueNum: number;
    percentage: number;
    color: string;
  }>;
  recentOrders: Array<{
    id: string;
    orderNo: string;
    customerName: string;
    productName: string;
    totalQty: number;
    status: string;
    total: string;
    totalNum: number;
    createdAt: string;
    formattedDate: string;
  }>;
  insights: {
    omzetStatus: { title: string; description: string; positive: boolean };
    topLeadSource: { title: string; description: string };
    bestSellingCategory: { title: string; description: string };
    recommendation: { title: string; description: string };
  };
  conversionFunnel: Array<{
    stage: string;
    label: string;
    count: number;
    percentage: number;
    dropOffRate: number;
  }>;
  customerSegmentation: Array<{
    type: string;
    orderCount: number;
    revenue: string;
    revenueNum: number;
    percentage: number;
  }>;
  retention: {
    newCustomerCount: number;
    repeatCustomerCount: number;
    repeatRate: number;
    totalActiveCustomers: number;
  };
  topCustomers: Array<{
    id: string;
    name: string;
    companyName: string | null;
    customerType: string;
    orderCount: number;
    revenue: string;
    revenueNum: number;
    lastOrderDate: string | null;
    whatsapp: string | null;
  }>;
  channelEfficiency: Array<{
    channel: string;
    leadCount: number;
    dealCount: number;
    orderCount: number;
    revenue: string;
    winRate: number;
    status: "Sangat Efektif" | "Potensial" | "Perlu Ditingkatkan";
  }>;
  picPerformance: Array<{
    picId: string;
    picName: string;
    leadCount: number;
    dealCount: number;
    revenue: string;
    revenueNum: number;
    winRate: number;
  }>;
  operational: {
    activeWorkOrders: number;
    stages: Array<{
      stage: string;
      label: string;
      count: number;
    }>;
    approachingDeadlineCount: number;
    overdueCount: number;
  };
  cashflow: {
    moneyInThisMonth: string;
    moneyInNum: number;
    outstandingAmount: string;
    outstandingNum: number;
    outstandingOrderCount: number;
  };
  urgentActions: Array<{
    id: string;
    title: string;
    customerName: string;
    nextAction: string;
    nextActionAt: string;
    isOverdue: boolean;
  }>;
};

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function toJakartaDate(date: Date) {
  return new Date(date.getTime() + JAKARTA_OFFSET_MS);
}

function parsePeriodBounds(params: DashboardQueryParams) {
  const rangePreset = typeof params.range === "string" ? params.range : (Array.isArray(params.range) ? params.range[0] : "this-month");
  const rawFrom = typeof params.from === "string" ? params.from : (Array.isArray(params.from) ? params.from[0] : undefined);
  const rawTo = typeof params.to === "string" ? params.to : (Array.isArray(params.to) ? params.to[0] : undefined);

  const now = new Date();
  const shifted = toJakartaDate(now);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();

  let start: Date | null = null;
  let end: Date | null = null;
  let prevStart: Date | null = null;
  let prevEnd: Date | null = null;
  let label = "Bulan Ini";
  let preset = rangePreset || "this-month";

  if (rawFrom && rawTo) {
    preset = "custom";
    const [fy, fm, fd] = rawFrom.split("-").map(Number);
    const [ty, tm, td] = rawTo.split("-").map(Number);
    start = new Date(Date.UTC(fy, fm - 1, fd) - JAKARTA_OFFSET_MS);
    end = new Date(Date.UTC(ty, tm - 1, td + 1) - JAKARTA_OFFSET_MS);
    const duration = end.getTime() - start.getTime();
    prevEnd = start;
    prevStart = new Date(start.getTime() - duration);
    label = `${rawFrom} s/d ${rawTo}`;
  } else if (rangePreset === "today") {
    start = new Date(Date.UTC(y, m, d) - JAKARTA_OFFSET_MS);
    end = new Date(start.getTime() + 24 * 3600 * 1000);
    prevEnd = start;
    prevStart = new Date(start.getTime() - 24 * 3600 * 1000);
    label = "Hari Ini";
  } else if (rangePreset === "yesterday") {
    end = new Date(Date.UTC(y, m, d) - JAKARTA_OFFSET_MS);
    start = new Date(end.getTime() - 24 * 3600 * 1000);
    prevEnd = start;
    prevStart = new Date(start.getTime() - 24 * 3600 * 1000);
    label = "Kemarin";
  } else if (rangePreset === "7d") {
    end = new Date(Date.UTC(y, m, d + 1) - JAKARTA_OFFSET_MS);
    start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
    prevEnd = start;
    prevStart = new Date(start.getTime() - 7 * 24 * 3600 * 1000);
    label = "7 Hari Terakhir";
  } else if (rangePreset === "30d") {
    end = new Date(Date.UTC(y, m, d + 1) - JAKARTA_OFFSET_MS);
    start = new Date(end.getTime() - 30 * 24 * 3600 * 1000);
    prevEnd = start;
    prevStart = new Date(start.getTime() - 30 * 24 * 3600 * 1000);
    label = "30 Hari Terakhir";
  } else if (rangePreset === "last-month") {
    start = new Date(Date.UTC(y, m - 1, 1) - JAKARTA_OFFSET_MS);
    end = new Date(Date.UTC(y, m, 1) - JAKARTA_OFFSET_MS);
    prevStart = new Date(Date.UTC(y, m - 2, 1) - JAKARTA_OFFSET_MS);
    prevEnd = start;
    const lastMonthDate = new Date(Date.UTC(y, m - 1, 1));
    label = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(lastMonthDate);
  } else if (rangePreset === "this-year") {
    start = new Date(Date.UTC(y, 0, 1) - JAKARTA_OFFSET_MS);
    end = new Date(Date.UTC(y + 1, 0, 1) - JAKARTA_OFFSET_MS);
    prevStart = new Date(Date.UTC(y - 1, 0, 1) - JAKARTA_OFFSET_MS);
    prevEnd = start;
    label = `Tahun ${y}`;
  } else if (rangePreset === "all") {
    start = null;
    end = null;
    prevStart = null;
    prevEnd = null;
    label = "Semua Waktu";
  } else {
    // "this-month" default
    preset = "this-month";
    start = new Date(Date.UTC(y, m, 1) - JAKARTA_OFFSET_MS);
    end = new Date(Date.UTC(y, m + 1, 1) - JAKARTA_OFFSET_MS);
    prevStart = new Date(Date.UTC(y, m - 1, 1) - JAKARTA_OFFSET_MS);
    prevEnd = start;
    const monthFormatter = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
    const firstDay = new Date(Date.UTC(y, m, 1));
    const lastDay = new Date(Date.UTC(y, m + 1, 0));
    label = `${monthFormatter.format(firstDay)} - ${monthFormatter.format(lastDay)}`;
  }

  const toYMD = (d: Date | null) => (d ? toJakartaDate(d).toISOString().slice(0, 10) : "");

  return {
    start,
    end,
    prevStart,
    prevEnd,
    label,
    preset,
    from: toYMD(start),
    to: toYMD(end ? new Date(end.getTime() - 1000) : null),
  };
}

function calcGrowth(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

// Nilai uang tidak boleh sampai ke role non-Keuangan; tampilkan placeholder netral.
const MASKED_MONEY = "—";

function maskFinancialData(data: FullDashboardData): FullDashboardData {
  // Segmentasi tetap bisa dibandingkan tanpa nominal: pakai porsi jumlah order.
  const totalSegmentOrders = data.customerSegmentation.reduce((acc, segment) => acc + segment.orderCount, 0);
  // Insight kategori dihitung dari volume (pcs), bukan omzet.
  const topCategoryByVolume = [...data.categoryProgress].sort((a, b) => b.pcs - a.pcs)[0];
  // Sumber lead teratas dihitung dari jumlah lead, bukan kontribusi omzet.
  const topLeadSourceByLeads = [...data.leadSourcesDonut].sort((a, b) => b.count - a.count)[0];
  return {
    ...data,
    summary: {
      ...data.summary,
      totalOmzet: MASKED_MONEY,
      totalOmzetNum: 0,
      prevOmzet: MASKED_MONEY,
      omzetGrowth: 0,
    },
    trendData: data.trendData.map((point) => ({ ...point, omzet: 0 })),
    leadSourceTable: data.leadSourceTable.map((row) => ({ ...row, revenue: MASKED_MONEY, revenueNum: 0 })),
    categoryRevenueDonut: data.categoryRevenueDonut.map((row) => {
      // Porsi kategori memakai jumlah order agar tetap bermakna tanpa nominal.
      const progress = data.categoryProgress.find((item) => item.name === row.name);
      return { ...row, revenue: MASKED_MONEY, revenueNum: 0, percentage: progress?.percentage ?? 0 };
    }),
    recentOrders: data.recentOrders.map((order) => ({ ...order, total: MASKED_MONEY, totalNum: 0 })),
    customerSegmentation: data.customerSegmentation.map((segment) => ({
      ...segment,
      revenue: MASKED_MONEY,
      revenueNum: 0,
      percentage: totalSegmentOrders > 0 ? Math.round((segment.orderCount / totalSegmentOrders) * 100) : 0,
    })),
    topCustomers: data.topCustomers.map((customer) => ({ ...customer, revenue: MASKED_MONEY, revenueNum: 0 })),
    channelEfficiency: data.channelEfficiency.map((channel) => ({ ...channel, revenue: MASKED_MONEY })),
    picPerformance: data.picPerformance.map((pic) => ({ ...pic, revenue: MASKED_MONEY, revenueNum: 0 })),
    cashflow: {
      ...data.cashflow,
      moneyInThisMonth: MASKED_MONEY,
      moneyInNum: 0,
      outstandingAmount: MASKED_MONEY,
      outstandingNum: 0,
    },
    insights: {
      ...data.insights,
      omzetStatus: {
        ...data.insights.omzetStatus,
        title: "Performa Omzet",
        description: "Data omzet hanya tersedia untuk role Keuangan.",
      },
      topLeadSource: {
        ...data.insights.topLeadSource,
        description: topLeadSourceByLeads && topLeadSourceByLeads.count > 0
          ? `${topLeadSourceByLeads.name} memberikan kontribusi ${topLeadSourceByLeads.percentage}% dari total lead yang masuk.`
          : "Belum ada lead yang masuk pada periode ini.",
      },
      bestSellingCategory: {
        ...data.insights.bestSellingCategory,
        title: "Kategori Produk Teratas",
        description: topCategoryByVolume && topCategoryByVolume.pcs > 0
          ? `${topCategoryByVolume.name} menjadi kategori dengan volume produksi terbanyak (${topCategoryByVolume.pcs} pcs).`
          : "Belum ada volume produksi pada periode ini.",
      },
    },
  };
}

export async function getDashboardFullAnalyticsData(params: DashboardQueryParams = {}): Promise<FullDashboardData> {
  const actor = await requireActor(DASHBOARD_ROLES);
  const canViewFinancialData = hasRole(actor.role, FINANCE_ROLES);
  const dashboardScope = resolveDashboardScope(actor.role);
  const prisma = getPrismaClient();

  const period = parsePeriodBounds(params);
  const selectedSourceId = typeof params.sourceId === "string" ? params.sourceId : "";
  const selectedCategoryId = typeof params.categoryId === "string" ? params.categoryId : "";

  // Conditions
  const leadDateCondition = period.start && period.end
    ? Prisma.sql`AND o."createdAt" >= ${period.start} AND o."createdAt" < ${period.end}`
    : Prisma.empty;
  const prevLeadDateCondition = period.prevStart && period.prevEnd
    ? Prisma.sql`AND o."createdAt" >= ${period.prevStart} AND o."createdAt" < ${period.prevEnd}`
    : Prisma.empty;

  const orderDateCondition = period.start && period.end
    ? Prisma.sql`AND so."acceptedAt" >= ${period.start} AND so."acceptedAt" < ${period.end}`
    : Prisma.empty;
  const prevOrderDateCondition = period.prevStart && period.prevEnd
    ? Prisma.sql`AND so."acceptedAt" >= ${period.prevStart} AND so."acceptedAt" < ${period.prevEnd}`
    : Prisma.empty;

  const sourceFilterCondition = selectedSourceId
    ? Prisma.sql`AND o."leadSourceId" = ${selectedSourceId}`
    : Prisma.empty;
  const categoryFilterCondition = selectedCategoryId
    ? Prisma.sql`AND po."productCategoryId" = ${selectedCategoryId}`
    : Prisma.empty;

  // Batch 1: Metadata (LeadSources & ProductCategories) + Summary KPIs + Stages
  const [
    allSources,
    allCategories,
    allCustomerTypes,
    summaryCurrRows,
    summaryPrevRows,
  ] = await Promise.all([
    prisma.leadSource.findMany({ select: { id: true, name: true, position: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    prisma.productCategory.findMany({ select: { id: true, name: true, position: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    prisma.customerType.findMany({ where: { isActive: true }, select: { id: true, name: true, position: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    prisma.$queryRaw<Array<{
      totalLead: number;
      totalDeal: number;
      totalOrder: number;
      totalOmzet: string;
      totalPcs: number;
    }>>(Prisma.sql`
      SELECT
        (SELECT COUNT(*)::int FROM "Opportunity" o WHERE o."customerId" IS NOT NULL ${leadDateCondition} ${sourceFilterCondition}) AS "totalLead",
        (SELECT COUNT(*)::int FROM "Opportunity" o WHERE o.stage = 'DEAL' ${leadDateCondition} ${sourceFilterCondition}) AS "totalDeal",
        (SELECT COUNT(DISTINCT so.id)::int FROM "SalesOrder" so
           INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
           INNER JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
           WHERE so.status = 'ACTIVE' ${orderDateCondition} ${sourceFilterCondition} ${categoryFilterCondition}) AS "totalOrder",
        (SELECT COALESCE(SUM(so.total), 0)::text FROM "SalesOrder" so
           INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
           INNER JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
           WHERE so.status = 'ACTIVE' ${orderDateCondition} ${sourceFilterCondition} ${categoryFilterCondition}) AS "totalOmzet",
        (SELECT COALESCE(SUM(soi.quantity), 0)::int FROM "SalesOrderItem" soi
           INNER JOIN "SalesOrder" so ON so.id = soi."salesOrderId"
           INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
           INNER JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
           WHERE so.status = 'ACTIVE' ${orderDateCondition} ${sourceFilterCondition} ${categoryFilterCondition}) AS "totalPcs"
    `),
    period.prevStart && period.prevEnd
      ? prisma.$queryRaw<Array<{
          totalLead: number;
          totalDeal: number;
          totalOrder: number;
          totalOmzet: string;
          totalPcs: number;
        }>>(Prisma.sql`
          SELECT
            (SELECT COUNT(*)::int FROM "Opportunity" o WHERE o."customerId" IS NOT NULL ${prevLeadDateCondition} ${sourceFilterCondition}) AS "totalLead",
            (SELECT COUNT(*)::int FROM "Opportunity" o WHERE o.stage = 'DEAL' ${prevLeadDateCondition} ${sourceFilterCondition}) AS "totalDeal",
            (SELECT COUNT(DISTINCT so.id)::int FROM "SalesOrder" so
               INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
               INNER JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
               WHERE so.status = 'ACTIVE' ${prevOrderDateCondition} ${sourceFilterCondition} ${categoryFilterCondition}) AS "totalOrder",
            (SELECT COALESCE(SUM(so.total), 0)::text FROM "SalesOrder" so
               INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
               INNER JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
               WHERE so.status = 'ACTIVE' ${prevOrderDateCondition} ${sourceFilterCondition} ${categoryFilterCondition}) AS "totalOmzet",
            (SELECT COALESCE(SUM(soi.quantity), 0)::int FROM "SalesOrderItem" soi
               INNER JOIN "SalesOrder" so ON so.id = soi."salesOrderId"
               INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
               INNER JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
               WHERE so.status = 'ACTIVE' ${prevOrderDateCondition} ${sourceFilterCondition} ${categoryFilterCondition}) AS "totalPcs"
        `)
      : Promise.resolve([{ totalLead: 0, totalDeal: 0, totalOrder: 0, totalOmzet: "0", totalPcs: 0 }]),
  ]);

  const curr = summaryCurrRows[0] ?? { totalLead: 0, totalDeal: 0, totalOrder: 0, totalOmzet: "0", totalPcs: 0 };
  const prev = summaryPrevRows[0] ?? { totalLead: 0, totalDeal: 0, totalOrder: 0, totalOmzet: "0", totalPcs: 0 };

  const currWinRate = curr.totalLead > 0 ? (curr.totalDeal / curr.totalLead) * 100 : 0;
  const prevWinRate = prev.totalLead > 0 ? (prev.totalDeal / prev.totalLead) * 100 : 0;

  const totalOmzetNum = Number(curr.totalOmzet);
  const prevOmzetNum = Number(prev.totalOmzet);

  const summary = {
    totalLead: curr.totalLead,
    prevLead: prev.totalLead,
    leadGrowth: calcGrowth(curr.totalLead, prev.totalLead),

    totalDeal: curr.totalDeal,
    prevDeal: prev.totalDeal,
    dealGrowth: calcGrowth(curr.totalDeal, prev.totalDeal),

    totalOrder: curr.totalOrder,
    prevOrder: prev.totalOrder,
    orderGrowth: calcGrowth(curr.totalOrder, prev.totalOrder),

    totalOmzet: formatCurrency(curr.totalOmzet),
    totalOmzetNum,
    prevOmzet: formatCurrency(prev.totalOmzet),
    omzetGrowth: calcGrowth(totalOmzetNum, prevOmzetNum),

    totalVolumePcs: curr.totalPcs,
    prevVolumePcs: prev.totalPcs,
    volumeGrowth: calcGrowth(curr.totalPcs, prev.totalPcs),

    winRate: Math.round(currWinRate * 10) / 10,
    prevWinRate: Math.round(prevWinRate * 10) / 10,
    winRateGrowth: calcGrowth(currWinRate, prevWinRate),
  };

  // Batch 2: Daily trend, lead sources breakdown, product categories, and recent orders
  // Generate daily points for 7-day trend (or selected period)
  const now = new Date();
  const shiftedNow = toJakartaDate(now);
  const trendDaysCount = 7;
  const dayPoints: Array<{ key: string; date: string; fullDate: string; start: Date; end: Date }> = [];

  for (let i = trendDaysCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(shiftedNow.getUTCFullYear(), shiftedNow.getUTCMonth(), shiftedNow.getUTCDate() - i) - JAKARTA_OFFSET_MS);
    const dayEnd = new Date(d.getTime() + 24 * 3600 * 1000);
    const dLocal = toJakartaDate(d);
    const key = dLocal.toISOString().slice(0, 10);
    const dateLabel = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(d);
    const fullDateLabel = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(d);
    dayPoints.push({ key, date: dateLabel, fullDate: fullDateLabel, start: d, end: dayEnd });
  }

  const trendStart = dayPoints[0].start;
  const trendEnd = dayPoints[dayPoints.length - 1].end;

  const [
    dailyOrdersRaw,
    dailyLeadsRaw,
    leadSourceRows,
    categoryRows,
    recentOrdersRaw,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ dayKey: string; omzet: string; orderCount: number; totalPcs: number }>>(Prisma.sql`
      SELECT
        TO_CHAR(so."acceptedAt" AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS "dayKey",
        COALESCE(SUM(so.total), 0)::text AS omzet,
        COUNT(DISTINCT so.id)::int AS "orderCount",
        COALESCE(SUM(soi.quantity), 0)::int AS "totalPcs"
      FROM "SalesOrder" so
      LEFT JOIN "SalesOrderItem" soi ON soi."salesOrderId" = so.id
      WHERE so.status = 'ACTIVE' AND so."acceptedAt" >= ${trendStart} AND so."acceptedAt" < ${trendEnd}
      GROUP BY "dayKey"
    `),
    prisma.$queryRaw<Array<{ dayKey: string; leadCount: number }>>(Prisma.sql`
      SELECT
        TO_CHAR(o."createdAt" AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS "dayKey",
        COUNT(o.id)::int AS "leadCount"
      FROM "Opportunity" o
      WHERE o."createdAt" >= ${trendStart} AND o."createdAt" < ${trendEnd}
      GROUP BY "dayKey"
    `),
    prisma.$queryRaw<Array<{
      sourceId: string;
      sourceName: string;
      leadCount: number;
      dealCount: number;
      orderCount: number;
      revenue: string;
    }>>(Prisma.sql`
      WITH lead_counts AS (
        SELECT
          o."leadSourceId",
          COUNT(*)::int AS "leadCount",
          COUNT(CASE WHEN o.stage = 'DEAL' THEN 1 END)::int AS "dealCount"
        FROM "Opportunity" o
        WHERE 1=1 ${leadDateCondition}
        GROUP BY o."leadSourceId"
      ),
      order_counts AS (
        SELECT
          o."leadSourceId",
          COUNT(DISTINCT so.id)::int AS "orderCount",
          COALESCE(SUM(so.total), 0)::text AS revenue
        FROM "SalesOrder" so
        INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
        WHERE so.status = 'ACTIVE' ${orderDateCondition}
        GROUP BY o."leadSourceId"
      )
      SELECT
        COALESCE(ls.id, 'none') AS "sourceId",
        COALESCE(ls.name, 'Lainnya') AS "sourceName",
        COALESCE(lc."leadCount", 0)::int AS "leadCount",
        COALESCE(lc."dealCount", 0)::int AS "dealCount",
        COALESCE(oc."orderCount", 0)::int AS "orderCount",
        COALESCE(oc.revenue, '0') AS revenue
      FROM "LeadSource" ls
      FULL OUTER JOIN lead_counts lc ON lc."leadSourceId" = ls.id
      FULL OUTER JOIN order_counts oc ON oc."leadSourceId" = ls.id
      ORDER BY COALESCE(oc.revenue, '0')::numeric DESC, COALESCE(lc."leadCount", 0) DESC
    `),
    prisma.$queryRaw<Array<{
      categoryName: string;
      orderCount: number;
      totalPcs: number;
      revenue: string;
    }>>(Prisma.sql`
      SELECT
        COALESCE(pc.name, po."productName", 'Lainnya') AS "categoryName",
        COUNT(DISTINCT so.id)::int AS "orderCount",
        COALESCE(SUM(soi.quantity), 0)::int AS "totalPcs",
        COALESCE(SUM(so.total), 0)::text AS revenue
      FROM "SalesOrder" so
      INNER JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
      LEFT JOIN "ProductCategory" pc ON pc.id = po."productCategoryId"
      LEFT JOIN "SalesOrderItem" soi ON soi."salesOrderId" = so.id
      WHERE so.status = 'ACTIVE' ${orderDateCondition}
      GROUP BY COALESCE(pc.name, po."productName", 'Lainnya')
      ORDER BY COALESCE(SUM(so.total), 0) DESC, "orderCount" DESC
    `),
    prisma.salesOrder.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        salesOrderNo: true,
        purchaseOrderNo: true,
        snapshotCustomerName: true,
        snapshotCompanyName: true,
        total: true,
        acceptedAt: true,
        purchaseOrder: { select: { productName: true } },
        items: { select: { quantity: true, productName: true } },
      },
      orderBy: { acceptedAt: "desc" },
      take: 8,
    }),
  ]);

  // Merge with ALL registered Master Lead Sources so ALL sources are displayed even if 0
  const rawLeadSourceMap = new Map(leadSourceRows.map((r) => [r.sourceId, r]));
  const combinedLeadSourceRows = allSources.map((s) => {
    const found = rawLeadSourceMap.get(s.id);
    return {
      sourceId: s.id,
      sourceName: s.name,
      leadCount: found ? found.leadCount : 0,
      dealCount: found ? found.dealCount : 0,
      orderCount: found ? found.orderCount : 0,
      revenue: found ? found.revenue : "0",
    };
  });
  // Include any extra source from DB (e.g. 'Lainnya' if unassigned)
  for (const lr of leadSourceRows) {
    if (!combinedLeadSourceRows.some((s) => s.sourceId === lr.sourceId || s.sourceName.toLowerCase() === lr.sourceName.toLowerCase())) {
      combinedLeadSourceRows.push(lr);
    }
  }
  combinedLeadSourceRows.sort((a, b) => {
    const revDiff = Number(b.revenue) - Number(a.revenue);
    if (revDiff !== 0) return revDiff;
    const orderDiff = b.orderCount - a.orderCount;
    if (orderDiff !== 0) return orderDiff;
    const leadDiff = b.leadCount - a.leadCount;
    if (leadDiff !== 0) return leadDiff;
    return a.sourceName.localeCompare(b.sourceName);
  });

  // Merge with ALL registered Master Product Categories so ALL categories are displayed even if 0
  const rawCategoryMap = new Map(categoryRows.map((r) => [r.categoryName.toLowerCase(), r]));
  const combinedCategoryRows = allCategories.map((c) => {
    const found = rawCategoryMap.get(c.name.toLowerCase());
    return {
      categoryName: c.name,
      orderCount: found ? found.orderCount : 0,
      totalPcs: found ? found.totalPcs : 0,
      revenue: found ? found.revenue : "0",
    };
  });
  for (const cr of categoryRows) {
    if (!combinedCategoryRows.some((c) => c.categoryName.toLowerCase() === cr.categoryName.toLowerCase())) {
      combinedCategoryRows.push(cr);
    }
  }
  combinedCategoryRows.sort((a, b) => {
    const revDiff = Number(b.revenue) - Number(a.revenue);
    if (revDiff !== 0) return revDiff;
    const orderDiff = b.orderCount - a.orderCount;
    if (orderDiff !== 0) return orderDiff;
    const pcsDiff = b.totalPcs - a.totalPcs;
    if (pcsDiff !== 0) return pcsDiff;
    return a.categoryName.localeCompare(b.categoryName);
  });

  // Map 7-Day Trend
  const dailyOrdersMap = new Map(dailyOrdersRaw.map((r) => [r.dayKey, r]));
  const dailyLeadsMap = new Map(dailyLeadsRaw.map((r) => [r.dayKey, r.leadCount]));

  const trendData = dayPoints.map((pt) => {
    const o = dailyOrdersMap.get(pt.key);
    const leads = dailyLeadsMap.get(pt.key) ?? 0;
    return {
      date: pt.date,
      fullDate: pt.fullDate,
      omzet: o ? Number(o.omzet) : 0,
      orders: o ? o.orderCount : 0,
      leads,
      pcs: o ? o.totalPcs : 0,
    };
  });

  // Color assignments
  const sourceColors: Record<string, string> = {
    WhatsApp: "#06b6d4",
    Instagram: "#8b5cf6",
    Website: "#2563eb",
    Referral: "#10b981",
    Marketplace: "#f59e0b",
    "Landing Page": "#3b82f6",
    Event: "#ec4899",
    "Walk-in": "#14b8a6",
    Lainnya: "#94a3b8",
  };
  const categoryPalette = [
    "#2563eb", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ec4899",
    "#64748b", "#3b82f6", "#14b8a6", "#6366f1", "#d97706", "#059669",
    "#7c3aed", "#db2777", "#475569", "#0284c7"
  ];

  // Lead sources donut & breakdown (ALL sources present even if 0)
  const totalLeadsForDonut = combinedLeadSourceRows.reduce((acc, row) => acc + row.leadCount, 0);
  const leadSourcesDonut = combinedLeadSourceRows.map((row) => ({
    name: row.sourceName,
    count: row.leadCount,
    percentage: totalLeadsForDonut > 0 ? Math.round((row.leadCount / totalLeadsForDonut) * 100) : 0,
    color: sourceColors[row.sourceName] ?? "#64748b",
  }));

  // Category progress bars (ALL categories present even if 0)
  const totalCategoryOrders = combinedCategoryRows.reduce((acc, row) => acc + row.orderCount, 0);
  const categoryProgress = combinedCategoryRows.map((row) => ({
    name: row.categoryName,
    count: row.orderCount,
    pcs: row.totalPcs,
    percentage: totalCategoryOrders > 0 ? Math.round((row.orderCount / totalCategoryOrders) * 100) : 0,
  }));

  // Lead source table (ALL sources present even if 0)
  const leadSourceTable = combinedLeadSourceRows.map((row, idx) => ({
    no: idx + 1,
    sourceId: row.sourceId,
    name: row.sourceName,
    leadCount: row.leadCount,
    dealCount: row.dealCount,
    orderCount: row.orderCount,
    revenue: formatCurrency(row.revenue),
    revenueNum: Number(row.revenue),
    conversionRate: row.leadCount > 0 ? Math.round((row.dealCount / row.leadCount) * 100) : 0,
  }));

  // Category revenue donut (ALL categories present even if 0)
  const totalCatRevenueNum = combinedCategoryRows.reduce((acc, row) => acc + Number(row.revenue), 0);
  const categoryRevenueDonut = combinedCategoryRows.map((row, idx) => ({
    name: row.categoryName,
    revenue: formatCurrency(row.revenue),
    revenueNum: Number(row.revenue),
    percentage: totalCatRevenueNum > 0 ? Math.round((Number(row.revenue) / totalCatRevenueNum) * 100) : 0,
    color: categoryPalette[idx % categoryPalette.length],
  }));

  // Recent orders
  const recentOrders = recentOrdersRaw.map((item, idx) => {
    const totalQty = item.items.reduce((acc, i) => acc + i.quantity, 0);
    const prodName = item.purchaseOrder?.productName || item.items[0]?.productName || "Kaos Custom";
    // Mock status mapping for UI: Selesai, Diproses, Menunggu
    const statusLabels = ["Selesai", "Diproses", "Menunggu"];
    const status = statusLabels[idx % statusLabels.length];

    return {
      id: item.id,
      orderNo: item.salesOrderNo ? `#SO-${item.salesOrderNo.replace(/\D/g, "").slice(-4) || "0001"}` : `#SO-${item.purchaseOrderNo.slice(-4)}`,
      customerName: item.snapshotCompanyName ?? item.snapshotCustomerName,
      productName: `${prodName} - ${totalQty} pcs`,
      totalQty,
      status,
      total: formatCurrency(item.total),
      totalNum: Number(item.total),
      createdAt: item.acceptedAt.toISOString(),
      formattedDate: formatDate(item.acceptedAt, true),
    };
  });

  // Batch 3: Deep-dive marketing analytics (Funnel, Customer Types, Retention, Top Customers, PICs, Operational, Cashflow)
  const [
    funnelCounts,
    customerTypeRows,
    topCustomerRows,
    picRows,
    workOrdersByStage,
    deadlineAlerts,
    financeCashRaw,
    urgentOpportunities,
  ] = await Promise.all([
    Promise.all([
      prisma.opportunity.count({ where: { ...(period.start && period.end ? { createdAt: { gte: period.start, lt: period.end } } : {}) } }),
      prisma.opportunity.count({ where: { stage: { in: ["FOLLOW_UP", "NEGOSIASI", "DEAL"] }, ...(period.start && period.end ? { createdAt: { gte: period.start, lt: period.end } } : {}) } }),
      prisma.opportunity.count({ where: { stage: { in: ["NEGOSIASI", "DEAL"] }, ...(period.start && period.end ? { createdAt: { gte: period.start, lt: period.end } } : {}) } }),
      prisma.opportunity.count({ where: { stage: "DEAL", ...(period.start && period.end ? { createdAt: { gte: period.start, lt: period.end } } : {}) } }),
      prisma.salesOrder.count({ where: { status: "ACTIVE", ...(period.start && period.end ? { acceptedAt: { gte: period.start, lt: period.end } } : {}) } }),
    ]),
    prisma.$queryRaw<Array<{ typeName: string; orderCount: number; revenue: string }>>(Prisma.sql`
      SELECT
        COALESCE(ct.name, 'Umum / Retail') AS "typeName",
        COUNT(DISTINCT so.id)::int AS "orderCount",
        COALESCE(SUM(so.total), 0)::text AS revenue
      FROM "SalesOrder" so
      INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
      INNER JOIN "Customer" c ON c.id = o."customerId"
      LEFT JOIN "CustomerType" ct ON ct.id = c."customerTypeId"
      WHERE so.status = 'ACTIVE' ${orderDateCondition}
      GROUP BY COALESCE(ct.name, 'Umum / Retail')
      ORDER BY COALESCE(SUM(so.total), 0) DESC
    `),
    prisma.$queryRaw<Array<{
      customerId: string;
      customerName: string;
      companyName: string | null;
      whatsapp: string | null;
      customerType: string;
      orderCount: number;
      revenue: string;
      lastOrderDate: Date | null;
    }>>(Prisma.sql`
      SELECT
        c.id AS "customerId",
        c.name AS "customerName",
        c."companyName",
        c.whatsapp,
        COALESCE(ct.name, 'Umum') AS "customerType",
        COUNT(DISTINCT so.id)::int AS "orderCount",
        COALESCE(SUM(so.total), 0)::text AS revenue,
        MAX(so."acceptedAt") AS "lastOrderDate"
      FROM "Customer" c
      INNER JOIN "Opportunity" o ON o."customerId" = c.id
      INNER JOIN "SalesOrder" so ON so."opportunityId" = o.id AND so.status = 'ACTIVE'
      LEFT JOIN "CustomerType" ct ON ct.id = c."customerTypeId"
      GROUP BY c.id, c.name, c."companyName", c.whatsapp, ct.name
      ORDER BY COALESCE(SUM(so.total), 0) DESC
      LIMIT 5
    `),
    prisma.$queryRaw<Array<{
      picId: string;
      picName: string;
      leadCount: number;
      dealCount: number;
      revenue: string;
    }>>(Prisma.sql`
      SELECT
        u.id AS "picId",
        u.name AS "picName",
        COUNT(DISTINCT o.id)::int AS "leadCount",
        COUNT(DISTINCT CASE WHEN o.stage = 'DEAL' THEN o.id END)::int AS "dealCount",
        COALESCE(SUM(so.total), 0)::text AS revenue
      FROM "AppUser" u
      INNER JOIN "Opportunity" o ON o."salesPicId" = u.id ${leadDateCondition}
      LEFT JOIN "SalesOrder" so ON so."opportunityId" = o.id AND so.status = 'ACTIVE' ${orderDateCondition}
      WHERE u.role IN ('ADMIN_CUSTOMER', 'SALES', 'OWNER') AND u."isActive" = true
      GROUP BY u.id, u.name
      ORDER BY COALESCE(SUM(so.total), 0) DESC, "leadCount" DESC
    `),
    prisma.productionWorkOrder.groupBy({
      by: ["currentStage"],
      where: { status: "ACTIVE" },
      _count: true,
    }),
    prisma.$queryRaw<Array<{ overdueCount: number; approachingCount: number }>>(Prisma.sql`
      SELECT
        COUNT(CASE WHEN deadline < CURRENT_DATE THEN 1 END)::int AS "overdueCount",
        COUNT(CASE WHEN deadline >= CURRENT_DATE AND deadline <= CURRENT_DATE + INTERVAL '3 days' THEN 1 END)::int AS "approachingCount"
      FROM "ProductionWorkOrder"
      WHERE status = 'ACTIVE' AND deadline IS NOT NULL
    `),
    Promise.all([
      prisma.paymentTransaction.aggregate({
        where: { status: "ACTIVE", ...(period.start && period.end ? { paidAt: { gte: period.start, lt: period.end } } : {}) },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.dealPayment.aggregate({
        where: { salesOrder: { status: "ACTIVE" }, outstandingAmount: { gt: 0 } },
        _sum: { outstandingAmount: true },
        _count: true,
      }),
    ]),
    prisma.opportunity.findMany({
      where: {
        stage: { in: ["LEAD_BARU", "FOLLOW_UP", "NEGOSIASI"] },
        nextActionAt: { not: null },
        customer: { archivedAt: null },
      },
      select: {
        id: true,
        title: true,
        nextAction: true,
        nextActionAt: true,
        customer: { select: { name: true } },
      },
      orderBy: { nextActionAt: "asc" },
      take: 5,
    }),
  ]);

  // Conversion Funnel calculation
  const [fLead, fFollowUp, fNego, fDeal, fOrder] = funnelCounts;
  const initialFunnelLead = fLead || 1;
  const conversionFunnel = [
    { stage: "LEAD", label: "Lead Baru Masuk", count: fLead, percentage: 100, dropOffRate: 0 },
    { stage: "FOLLOW_UP", label: "Follow-up & Kualifikasi", count: fFollowUp, percentage: Math.round((fFollowUp / initialFunnelLead) * 100), dropOffRate: Math.max(0, Math.round(((fLead - fFollowUp) / initialFunnelLead) * 100)) },
    { stage: "NEGO", label: "Negosiasi & Penawaran", count: fNego, percentage: Math.round((fNego / initialFunnelLead) * 100), dropOffRate: Math.max(0, Math.round(((fFollowUp - fNego) / initialFunnelLead) * 100)) },
    { stage: "DEAL", label: "Deal & PO Disetujui", count: fDeal, percentage: Math.round((fDeal / initialFunnelLead) * 100), dropOffRate: Math.max(0, Math.round(((fNego - fDeal) / initialFunnelLead) * 100)) },
    { stage: "ORDER", label: "Sales Order Aktif", count: fOrder, percentage: Math.round((fOrder / initialFunnelLead) * 100), dropOffRate: Math.max(0, Math.round(((fDeal - fOrder) / initialFunnelLead) * 100)) },
  ];

  // Customer Segmentation (ALL registered customer types displayed even if 0)
  const rawCustTypeMap = new Map(customerTypeRows.map((r) => [r.typeName.toLowerCase(), r]));
  const combinedCustomerTypeRows = allCustomerTypes.map((ct) => {
    const found = rawCustTypeMap.get(ct.name.toLowerCase());
    return {
      typeName: ct.name,
      orderCount: found ? found.orderCount : 0,
      revenue: found ? found.revenue : "0",
    };
  });
  for (const ctr of customerTypeRows) {
    if (!combinedCustomerTypeRows.some((c) => c.typeName.toLowerCase() === ctr.typeName.toLowerCase())) {
      combinedCustomerTypeRows.push(ctr);
    }
  }
  combinedCustomerTypeRows.sort((a, b) => {
    const revDiff = Number(b.revenue) - Number(a.revenue);
    if (revDiff !== 0) return revDiff;
    return b.orderCount - a.orderCount;
  });

  const totalSegRevenue = combinedCustomerTypeRows.reduce((acc, row) => acc + Number(row.revenue), 0);
  const customerSegmentation = combinedCustomerTypeRows.map((row) => ({
    type: row.typeName,
    orderCount: row.orderCount,
    revenue: formatCurrency(row.revenue),
    revenueNum: Number(row.revenue),
    percentage: totalSegRevenue > 0 ? Math.round((Number(row.revenue) / totalSegRevenue) * 100) : 0,
  }));

  // Customer Retention
  const repeatCount = topCustomerRows.filter((c) => c.orderCount > 1).length;
  const newCount = Math.max(0, topCustomerRows.length - repeatCount);
  const retention = {
    newCustomerCount: newCount,
    repeatCustomerCount: repeatCount,
    repeatRate: topCustomerRows.length > 0 ? Math.round((repeatCount / topCustomerRows.length) * 100) : 0,
    totalActiveCustomers: topCustomerRows.length,
  };

  // Top customers
  const topCustomers = topCustomerRows.map((c) => ({
    id: c.customerId,
    name: c.customerName,
    companyName: c.companyName,
    customerType: c.customerType,
    orderCount: c.orderCount,
    revenue: formatCurrency(c.revenue),
    revenueNum: Number(c.revenue),
    lastOrderDate: c.lastOrderDate ? formatDate(c.lastOrderDate) : null,
    whatsapp: c.whatsapp,
  }));

  // Channel efficiency (ALL channels displayed even if 0)
  const channelEfficiency = combinedLeadSourceRows.map((r) => {
    const winRate = r.leadCount > 0 ? Math.round((r.dealCount / r.leadCount) * 100) : 0;
    let status: "Sangat Efektif" | "Potensial" | "Perlu Ditingkatkan" = "Potensial";
    if (winRate >= 30) status = "Sangat Efektif";
    else if (winRate === 0 && r.leadCount > 2) status = "Perlu Ditingkatkan";
    else if (r.leadCount === 0) status = "Potensial";

    return {
      channel: r.sourceName,
      leadCount: r.leadCount,
      dealCount: r.dealCount,
      orderCount: r.orderCount,
      revenue: formatCurrency(r.revenue),
      winRate,
      status,
    };
  });

  // PIC performance
  const picPerformance = picRows.map((p) => ({
    picId: p.picId,
    picName: p.picName,
    leadCount: p.leadCount,
    dealCount: p.dealCount,
    revenue: formatCurrency(p.revenue),
    revenueNum: Number(p.revenue) || 0,
    winRate: p.leadCount > 0 ? Math.round((p.dealCount / p.leadCount) * 100) : 0,
  }));

  // Operational
  const stageLabels: Record<string, string> = {
    POTONG: "Potong (Cutting)",
    SABLON: "Sablon / DTF",
    PRINTING: "Sublim / Printing",
    BORDIR: "Bordir Komputer",
    JAHIT: "Jahit (Sewing)",
    QC: "QC & Finishing",
    PACKING: "Packing",
    PENGIRIMAN: "Siap Kirim",
    SELESAI: "Selesai",
  };
  const activeStagesList = ["POTONG", "SABLON", "BORDIR", "JAHIT", "QC", "PACKING"];
  const stageCountsMap = new Map<string, number>(workOrdersByStage.map((s) => [s.currentStage, s._count]));

  const stages = activeStagesList.map((st) => ({
    stage: st,
    label: stageLabels[st] ?? st,
    count: stageCountsMap.get(st) ?? 0,
  }));

  const activeWorkOrders = workOrdersByStage.reduce((acc, s) => acc + s._count, 0);
  const dl = deadlineAlerts[0] ?? { overdueCount: 0, approachingCount: 0 };

  const operational = {
    activeWorkOrders,
    stages,
    approachingDeadlineCount: dl.approachingCount,
    overdueCount: dl.overdueCount,
  };

  // Cashflow
  const [cashIn, debt] = financeCashRaw;
  const cashflow = {
    moneyInThisMonth: formatCurrency(cashIn._sum.amount?.toString() ?? "0"),
    moneyInNum: Number(cashIn._sum.amount ?? 0),
    outstandingAmount: formatCurrency(debt._sum.outstandingAmount?.toString() ?? "0"),
    outstandingNum: Number(debt._sum.outstandingAmount ?? 0),
    outstandingOrderCount: debt._count,
  };

  // Urgent CRM actions
  const nowJakarta = new Date();
  const urgentActions = urgentOpportunities.map((o) => ({
    id: o.id,
    title: o.title,
    customerName: o.customer.name,
    nextAction: o.nextAction ?? "Follow-up penawaran",
    nextActionAt: o.nextActionAt ? formatDate(o.nextActionAt, true) : "-",
    isOverdue: o.nextActionAt ? new Date(o.nextActionAt) < nowJakarta : false,
  }));

  // Dynamic intelligent insights
  const topSource = leadSourceRows[0]?.sourceName ?? "WhatsApp";
  const topSourcePct = leadSourcesDonut.find((s) => s.name === topSource)?.percentage ?? 50;
  const bestCategory = categoryRows[0]?.categoryName ?? "Kaos Custom";
  const bestCatPct = categoryProgress.find((c) => c.name === bestCategory)?.percentage ?? 50;

  const insights = {
    omzetStatus: {
      title: summary.omzetGrowth >= 0 ? "Omzet Meningkat" : "Performa Omzet",
      description: summary.omzetGrowth >= 0
        ? `Omzet bulan ini naik ${summary.omzetGrowth}% dibanding bulan lalu.`
        : `Omzet periode ini mencatat penyesuaian ${Math.abs(summary.omzetGrowth)}% dibanding periode sebelumnya.`,
      positive: summary.omzetGrowth >= 0,
    },
    topLeadSource: {
      title: "Sumber Lead Terbanyak",
      description: `${topSource} memberikan kontribusi ${topSourcePct}% dari total lead yang masuk.`,
    },
    bestSellingCategory: {
      title: "Kategori Terlaris",
      description: `${bestCategory} menjadi produk dengan penjualan tertinggi (${bestCatPct}%).`,
    },
    recommendation: {
      title: "Rekomendasi",
      description: `Tingkatkan promosi di ${topSource === "WhatsApp" ? "Instagram" : "WhatsApp"} untuk memperluas jangkauan lead dan meningkatkan konversi deal.`,
    },
  };

  const payload: FullDashboardData = {
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      email: actor.email,
    },
    dashboardScope,
    canViewFinancialData,
    period,
    filters: {
      sourceId: selectedSourceId,
      categoryId: selectedCategoryId,
    },
    filterMeta: {
      leadSources: allSources,
      productCategories: allCategories,
    },
    summary,
    trendData,
    leadSourcesDonut,
    categoryProgress,
    leadSourceTable,
    categoryRevenueDonut,
    recentOrders,
    insights,
    conversionFunnel,
    customerSegmentation,
    retention,
    topCustomers,
    channelEfficiency,
    picPerformance,
    operational,
    cashflow,
    urgentActions,
  };

  return canViewFinancialData ? payload : maskFinancialData(payload);
}
