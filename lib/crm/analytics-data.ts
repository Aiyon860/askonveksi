import "server-only";

import { Prisma } from "@prisma/client";
import { ANALYTICS_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { formatCurrency, formatPercentage } from "@/lib/crm/format";

export type AnalyticsQueryParams = {
  mode?: string | string[];
  from?: string | string[];
  to?: string | string[];
  range?: string | string[];
  sourceId?: string | string[];
  categoryId?: string | string[];
};

export type ExecutiveFunnelStage = {
  stage: string;
  label: string;
  count: number;
  conversion: number; // vs Lead Baru
  stepConversion: number; // vs previous step
  dropOffRate: number;
};

export type ExecutiveProductRow = {
  productName: string;
  categoryName: string;
  orderCount: number;
  quantity: number;
  revenue: number;
  revenueFormatted: string;
  hpp: number;
  hppFormatted: string;
  grossProfit: number;
  grossProfitFormatted: string;
  marginPercent: number;
  marginStatus: "Sangat Sehat" | "Sehat" | "Moderat" | "Perlu Evaluasi";
  isCostComplete: boolean;
  costedOrderCount: number;
  asp: number;
  acp: number;
  profitPerPcs: number;
};

export type ExecutiveChannelRow = {
  sourceId: string;
  channelName: string;
  leadCount: number;
  dealCount: number;
  orderCount: number;
  revenue: number;
  revenueFormatted: string;
  winRate: number;
  avgDealValue: number;
  avgDealValueFormatted: string;
  revenueShare: number;
  efficiency: "Sangat Efektif" | "Potensial" | "Perlu Ditingkatkan";
};

export type ExecutivePicRow = {
  picId: string;
  picName: string;
  leadCount: number;
  dealCount: number;
  winRate: number;
  revenue: number;
  revenueFormatted: string;
  pcsCount: number;
  aov: number;
  aovFormatted: string;
};

export type ExecutiveCustomerRow = {
  id: string;
  customerNo: string;
  name: string;
  companyName: string | null;
  city: string | null;
  whatsapp: string | null;
  orderCount: number;
  totalSpend: number;
  totalSpendFormatted: string;
  aov: number;
  aovFormatted: string;
  lastOrderDate: string | null;
};

export type ExecutiveInsight = {
  id: string;
  type: "positive" | "warning" | "opportunity" | "action";
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
};

export type ExecutiveAnalyticsData = {
  actor: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
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
    totalRevenue: number;
    totalRevenueFormatted: string;
    prevRevenue: number;
    revenueGrowth: number;

    totalHpp: number;
    totalHppFormatted: string;

    totalGrossProfit: number;
    totalGrossProfitFormatted: string;
    prevGrossProfit: number;
    grossProfitGrowth: number;

    grossMarginPercent: number;
    marginStatus: "SANGAT SEHAT" | "SEHAT" | "MODERAT" | "KRITIS";

    totalOrders: number;
    prevOrders: number;
    orderGrowth: number;

    totalPcs: number;
    prevPcs: number;
    pcsGrowth: number;

    aov: number;
    aovFormatted: string;
    prevAov: number;
    aovGrowth: number;

    winRate: number;
    prevWinRate: number;
    winRateGrowth: number;

    cashInflow: number;
    cashInflowFormatted: string;
    outstandingAr: number;
    outstandingArFormatted: string;
    unpaidOrdersCount: number;
  };
  funnel: ExecutiveFunnelStage[];
  trendData: Array<{
    date: string;
    fullDate: string;
    revenue: number;
    profit: number;
    hpp: number;
    orders: number;
    pcs: number;
    leads: number;
  }>;
  products: ExecutiveProductRow[];
  channels: ExecutiveChannelRow[];
  pics: ExecutivePicRow[];
  retention: {
    newCustomerCount: number;
    repeatCustomerCount: number;
    repeatRate: number;
    topCustomers: ExecutiveCustomerRow[];
  };
  operations: {
    activeWorkOrders: number;
    stageBreakdown: Array<{
      stage: string;
      label: string;
      count: number;
      percentage: number;
    }>;
    approachingDeadlineCount: number;
    overdueCount: number;
    returCount: number;
  };
  alerts: {
    overdueFollowUps: number;
    dueTodayFollowUps: number;
    approachingDeadlineCount: number;
    overdueProductionCount: number;
    unpaidOrdersCount: number;
  };
  insights: ExecutiveInsight[];
};

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function toJakartaDate(date: Date) {
  return new Date(date.getTime() + JAKARTA_OFFSET_MS);
}

function parsePeriodBounds(params: AnalyticsQueryParams) {
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

const STAGE_LABELS: Record<string, string> = {
  POTONG: "Potong Kain",
  BORDIR: "Bordir Komputer",
  SABLON: "Sablon Manual",
  PRINTING: "Sublim / DTF",
  JAHIT: "Jahit & Perakitan",
  QC: "Quality Control",
  PACKING: "Finishing & Packing",
  PENGIRIMAN: "Siap Kirim",
  TEST_PRINT: "Tes Cetak",
  PERSETUJUAN_SAMPEL: "Approval Sampel",
  LAYOUT_PRODUKSI: "Layout Produksi",
  PRINT: "Print Digital",
  CUTTING: "Pola & Cutting",
  SELESAI: "Selesai",
};

export async function getExecutiveAnalyticsData(params: AnalyticsQueryParams = {}): Promise<ExecutiveAnalyticsData> {
  const actor = await requireActor(ANALYTICS_ROLES);
  const prisma = getPrismaClient();

  const period = parsePeriodBounds(params);
  const selectedSourceId = typeof params.sourceId === "string" ? params.sourceId : "";
  const selectedCategoryId = typeof params.categoryId === "string" ? params.categoryId : "";

  // Base Conditions
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

  const sourceCondition = selectedSourceId
    ? Prisma.sql`AND o."leadSourceId" = ${selectedSourceId}`
    : Prisma.empty;

  const categoryCondition = selectedCategoryId
    ? Prisma.sql`AND po."productCategoryId" = ${selectedCategoryId}`
    : Prisma.empty;

  // Run comprehensive parallel queries
  const [
    metaLeadSources,
    metaCategories,
    // Current period revenue & order aggregate
    revenueAggRows,
    prevRevenueAggRows,
    // Funnel milestone counts
    leadCount,
    chatCount,
    followUpCount,
    quotationCount,
    negotiationCount,
    dpCount,
    soCount,
    paidOrderCount,
    // Products with accurate HPP components
    productRows,
    // Channels
    channelRows,
    // PICs
    picRows,
    // Customer retention
    customerStats,
    topLoyalCustomers,
    // Operations & work orders
    workOrderStats,
    workOrderStages,
    // Follow up alerts
    followUpCountRows,
    // Trend points
    trendRows,
    // Cashflow Inflow & Outstanding AR
    cashflowRows,
  ] = await Promise.all([
    prisma.leadSource.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    prisma.productCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    // Revenue, HPP, Orders, Pcs
    prisma.$queryRaw<Array<{
      totalRevenue: string;
      totalHpp: string;
      orderCount: number;
      totalPcs: number;
    }>>(Prisma.sql`
      SELECT
        COALESCE(SUM(so.total), 0)::text AS "totalRevenue",
        COALESCE(SUM(
          COALESCE(cost.kain, 0) +
          COALESCE(cost.zipper, 0) +
          COALESCE(cost.jahit, 0) +
          COALESCE(cost.pres, 0) +
          COALESCE(cost."dtfPlastisol", 0) +
          COALESCE(cost.bordir, 0) +
          COALESCE(cost.lainnya, 0)
        ), 0)::text AS "totalHpp",
        COUNT(DISTINCT so.id)::int AS "orderCount",
        COALESCE(SUM(items.quantity), 0)::int AS "totalPcs"
      FROM "SalesOrder" so
      INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
      LEFT JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
      LEFT JOIN "SalesOrderCost" cost ON cost."salesOrderId" = so.id
      LEFT JOIN (
        SELECT "salesOrderId", SUM(quantity)::int AS quantity
        FROM "SalesOrderItem"
        GROUP BY "salesOrderId"
      ) items ON items."salesOrderId" = so.id
      WHERE so.status = 'ACTIVE'
      ${orderDateCondition}
      ${sourceCondition}
      ${categoryCondition}
    `),
    // Prev period revenue & order aggregate
    prisma.$queryRaw<Array<{
      totalRevenue: string;
      totalHpp: string;
      orderCount: number;
      totalPcs: number;
    }>>(Prisma.sql`
      SELECT
        COALESCE(SUM(so.total), 0)::text AS "totalRevenue",
        COALESCE(SUM(
          COALESCE(cost.kain, 0) +
          COALESCE(cost.zipper, 0) +
          COALESCE(cost.jahit, 0) +
          COALESCE(cost.pres, 0) +
          COALESCE(cost."dtfPlastisol", 0) +
          COALESCE(cost.bordir, 0) +
          COALESCE(cost.lainnya, 0)
        ), 0)::text AS "totalHpp",
        COUNT(DISTINCT so.id)::int AS "orderCount",
        COALESCE(SUM(items.quantity), 0)::int AS "totalPcs"
      FROM "SalesOrder" so
      INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
      LEFT JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
      LEFT JOIN "SalesOrderCost" cost ON cost."salesOrderId" = so.id
      LEFT JOIN (
        SELECT "salesOrderId", SUM(quantity)::int AS quantity
        FROM "SalesOrderItem"
        GROUP BY "salesOrderId"
      ) items ON items."salesOrderId" = so.id
      WHERE so.status = 'ACTIVE'
      ${prevOrderDateCondition}
      ${sourceCondition}
      ${categoryCondition}
    `),
    // Funnel Stage 1: Lead Baru
    prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM "Opportunity" o
      WHERE 1=1
      ${leadDateCondition}
      ${sourceCondition}
    `).then((rows) => rows[0]?.count ?? 0),
    // Funnel Stage 2: Chat / Kontak
    prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT ca."opportunityId")::int AS count
      FROM "CommunicationActivity" ca
      INNER JOIN "Opportunity" o ON o.id = ca."opportunityId"
      WHERE ca.kind = 'COMMUNICATION'
      ${period.start && period.end ? Prisma.sql`AND ca."occurredAt" >= ${period.start} AND ca."occurredAt" < ${period.end}` : Prisma.empty}
      ${sourceCondition}
    `).then((rows) => rows[0]?.count ?? 0),
    // Funnel Stage 3: Follow Up
    prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM "Opportunity" o
      WHERE o.stage IN ('FOLLOW_UP', 'NEGOSIASI', 'DEAL')
      ${leadDateCondition}
      ${sourceCondition}
    `).then((rows) => rows[0]?.count ?? 0),
    // Funnel Stage 4: Quotation / PO Draft
    prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT po.id)::int AS count
      FROM "PurchaseOrder" po
      INNER JOIN "Opportunity" o ON o.id = po."opportunityId"
      WHERE 1=1
      ${period.start && period.end ? Prisma.sql`AND po."createdAt" >= ${period.start} AND po."createdAt" < ${period.end}` : Prisma.empty}
      ${sourceCondition}
      ${categoryCondition}
    `).then((rows) => rows[0]?.count ?? 0),
    // Funnel Stage 5: Negosiasi
    prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM "Opportunity" o
      WHERE o.stage IN ('NEGOSIASI', 'DEAL')
      ${leadDateCondition}
      ${sourceCondition}
    `).then((rows) => rows[0]?.count ?? 0),
    // Funnel Stage 6: DP / Deposit
    prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT dp.id)::int AS count
      FROM "DealPayment" dp
      INNER JOIN "SalesOrder" so ON so.id = dp."salesOrderId"
      INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
      LEFT JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
      WHERE dp.kind = 'DP'
      ${period.start && period.end ? Prisma.sql`AND dp."paidAt" >= ${period.start} AND dp."paidAt" < ${period.end}` : Prisma.empty}
      ${sourceCondition}
      ${categoryCondition}
    `).then((rows) => rows[0]?.count ?? 0),
    // Funnel Stage 7: Sales Order
    prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT so.id)::int AS count
      FROM "SalesOrder" so
      INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
      LEFT JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
      WHERE so.status = 'ACTIVE'
      ${orderDateCondition}
      ${sourceCondition}
      ${categoryCondition}
    `).then((rows) => rows[0]?.count ?? 0),
    // Funnel Stage 8: Lunas
    prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT so.id)::int AS count
      FROM "SalesOrder" so
      INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
      INNER JOIN "DealPayment" dp ON dp."salesOrderId" = so.id
      LEFT JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
      WHERE so.status = 'ACTIVE' AND dp."outstandingAmount" <= 0
      ${orderDateCondition}
      ${sourceCondition}
      ${categoryCondition}
    `).then((rows) => rows[0]?.count ?? 0),
    // Products with deep profitability breakdown
    prisma.$queryRaw<Array<{
      productName: string;
      categoryName: string | null;
      orderCount: number;
      quantity: number;
      revenue: string;
      hpp: string;
      costedOrderCount: number;
    }>>(Prisma.sql`
      SELECT
        COALESCE(po."productName", 'Produk Custom') AS "productName",
        cat.name AS "categoryName",
        COUNT(DISTINCT so.id)::int AS "orderCount",
        COALESCE(SUM(items.quantity), 0)::int AS quantity,
        COALESCE(SUM(so.total), 0)::text AS revenue,
        COALESCE(SUM(
          COALESCE(cost.kain, 0) +
          COALESCE(cost.zipper, 0) +
          COALESCE(cost.jahit, 0) +
          COALESCE(cost.pres, 0) +
          COALESCE(cost."dtfPlastisol", 0) +
          COALESCE(cost.bordir, 0) +
          COALESCE(cost.lainnya, 0)
        ), 0)::text AS hpp,
        COUNT(*) FILTER (
          WHERE cost.kain IS NOT NULL AND cost.jahit IS NOT NULL
        )::int AS "costedOrderCount"
      FROM "SalesOrder" so
      INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
      LEFT JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
      LEFT JOIN "ProductCategory" cat ON cat.id = po."productCategoryId"
      LEFT JOIN (
        SELECT "salesOrderId", SUM(quantity)::int AS quantity
        FROM "SalesOrderItem"
        GROUP BY "salesOrderId"
      ) items ON items."salesOrderId" = so.id
      LEFT JOIN "SalesOrderCost" cost ON cost."salesOrderId" = so.id
      WHERE so.status = 'ACTIVE'
      ${orderDateCondition}
      ${sourceCondition}
      ${categoryCondition}
      GROUP BY po."productName", cat.name
      ORDER BY COALESCE(SUM(so.total), 0) DESC, quantity DESC
      LIMIT 15
    `),
    // Marketing Channel Acquisition ROI
    prisma.$queryRaw<Array<{
      sourceId: string;
      channelName: string;
      leadCount: number;
      dealCount: number;
      orderCount: number;
      revenue: string;
    }>>(Prisma.sql`
      SELECT
        COALESCE(ls.id, 'none') AS "sourceId",
        COALESCE(ls.name, 'Tanpa Sumber') AS "channelName",
        COUNT(DISTINCT o.id)::int AS "leadCount",
        COUNT(DISTINCT CASE WHEN o.stage = 'DEAL' THEN o.id END)::int AS "dealCount",
        COUNT(DISTINCT so.id)::int AS "orderCount",
        COALESCE(SUM(so.total), 0)::text AS revenue
      FROM "Opportunity" o
      LEFT JOIN "LeadSource" ls ON ls.id = o."leadSourceId"
      LEFT JOIN "SalesOrder" so ON so."opportunityId" = o.id AND so.status = 'ACTIVE' ${orderDateCondition}
      WHERE 1=1
      ${leadDateCondition}
      ${sourceCondition}
      GROUP BY ls.id, ls.name
      ORDER BY COALESCE(SUM(so.total), 0) DESC, "leadCount" DESC
    `),
    // PIC Performance
    prisma.$queryRaw<Array<{
      picId: string;
      picName: string;
      leadCount: number;
      dealCount: number;
      revenue: string;
      pcsCount: number;
    }>>(Prisma.sql`
      SELECT
        u.id AS "picId",
        u.name AS "picName",
        COUNT(DISTINCT o.id)::int AS "leadCount",
        COUNT(DISTINCT so.id)::int AS "dealCount",
        COALESCE(SUM(so.total), 0)::text AS revenue,
        COALESCE(SUM(items.quantity), 0)::int AS "pcsCount"
      FROM "AppUser" u
      INNER JOIN "Opportunity" o ON o."salesPicId" = u.id
      LEFT JOIN "SalesOrder" so ON so."opportunityId" = o.id AND so.status = 'ACTIVE' ${orderDateCondition}
      LEFT JOIN (
        SELECT "salesOrderId", SUM(quantity)::int AS quantity
        FROM "SalesOrderItem"
        GROUP BY "salesOrderId"
      ) items ON items."salesOrderId" = so.id
      WHERE u.role = 'ADMIN_CUSTOMER' AND u."isActive" = true
      ${leadDateCondition}
      ${sourceCondition}
      GROUP BY u.id, u.name
      ORDER BY revenue DESC, "leadCount" DESC, "picName" ASC
    `),
    // Customer Retention & Repeat order stats
    prisma.$queryRaw<Array<{
      customerCount: number;
      repeatCustomerCount: number;
    }>>(Prisma.sql`
      WITH order_counts AS (
        SELECT so."opportunityId", o."customerId", COUNT(DISTINCT so.id) AS total_orders
        FROM "SalesOrder" so
        INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
        WHERE so.status = 'ACTIVE'
        ${orderDateCondition}
        ${sourceCondition}
        GROUP BY o."customerId", so."opportunityId"
      )
      SELECT
        COUNT(DISTINCT "customerId")::int AS "customerCount",
        COUNT(DISTINCT CASE WHEN total_orders > 1 THEN "customerId" END)::int AS "repeatCustomerCount"
      FROM order_counts
    `),
    // Top Loyal VIP Customers
    prisma.$queryRaw<Array<{
      id: string;
      customerNo: string;
      name: string;
      companyName: string | null;
      city: string | null;
      whatsapp: string | null;
      orderCount: number;
      totalSpend: string;
      lastOrderDate: Date | null;
    }>>(Prisma.sql`
      SELECT
        c.id,
        c."customerNo",
        c.name,
        c."companyName",
        c.city,
        c.whatsapp,
        COUNT(DISTINCT so.id)::int AS "orderCount",
        COALESCE(SUM(so.total), 0)::text AS "totalSpend",
        MAX(so."acceptedAt") AS "lastOrderDate"
      FROM "Customer" c
      INNER JOIN "Opportunity" o ON o."customerId" = c.id
      INNER JOIN "SalesOrder" so ON so."opportunityId" = o.id
      WHERE so.status = 'ACTIVE'
      ${orderDateCondition}
      ${sourceCondition}
      GROUP BY c.id, c."customerNo", c.name, c."companyName", c.city, c.whatsapp
      ORDER BY COALESCE(SUM(so.total), 0) DESC, "orderCount" DESC
      LIMIT 8
    `),
    // Operations summary
    prisma.$queryRaw<Array<{
      activeCount: number;
      approachingCount: number;
      overdueCount: number;
      returCount: number;
    }>>(Prisma.sql`
      SELECT
        COUNT(*)::int AS "activeCount",
        COUNT(*) FILTER (
          WHERE status = 'ACTIVE'
            AND deadline <= CURRENT_DATE + INTERVAL '3 days'
            AND deadline >= CURRENT_DATE
        )::int AS "approachingCount",
        COUNT(*) FILTER (
          WHERE status = 'ACTIVE'
            AND deadline < CURRENT_DATE
        )::int AS "overdueCount",
        COUNT(*) FILTER (
          WHERE "needsRepair" = true
        )::int AS "returCount"
      FROM "ProductionWorkOrder"
      WHERE status = 'ACTIVE'
    `),
    // Production Stage Distribution
    prisma.$queryRaw<Array<{
      currentStage: string;
      count: number;
    }>>(Prisma.sql`
      SELECT "currentStage", COUNT(*)::int AS count
      FROM "ProductionWorkOrder"
      WHERE status = 'ACTIVE'
      GROUP BY "currentStage"
      ORDER BY count DESC
    `),
    // Follow up alerts are aggregated in one scan with identical boundaries.
    prisma.$queryRaw<Array<{ overdueCount: number; dueTodayCount: number }>>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE "nextActionAt" < ${new Date()})::int AS "overdueCount",
        COUNT(*) FILTER (
          WHERE "nextActionAt" >= ${new Date(new Date().setHours(0, 0, 0, 0))}
            AND "nextActionAt" < ${new Date(new Date().setHours(23, 59, 59, 999))}
        )::int AS "dueTodayCount"
      FROM "Opportunity"
      WHERE stage IN ('LEAD_BARU', 'FOLLOW_UP', 'NEGOSIASI')
    `).then(([counts]) => [counts?.overdueCount ?? 0, counts?.dueTodayCount ?? 0] as const),
    // Trend points grouped by day or month
    prisma.$queryRaw<Array<{
      timeBucket: string;
      displayDate: string;
      revenue: string;
      hpp: string;
      orderCount: number;
      pcsCount: number;
      leadCount: number;
    }>>(Prisma.sql`
      WITH timeline AS (
        SELECT
          TO_CHAR(d, 'YYYY-MM-DD') AS day_str,
          TO_CHAR(d, 'DD Mon') AS display_date
        FROM GENERATE_SERIES(
          COALESCE(${period.start}, CURRENT_DATE - INTERVAL '29 days')::date,
          COALESCE(${period.end ? new Date(period.end.getTime() - 1000) : new Date()}, CURRENT_DATE)::date,
          '1 day'::interval
        ) d
      ),
      orders_agg AS (
        SELECT
          TO_CHAR(so."acceptedAt" AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS day_str,
          SUM(so.total) AS day_revenue,
          SUM(
            COALESCE(cost.kain, 0) +
            COALESCE(cost.zipper, 0) +
            COALESCE(cost.jahit, 0) +
            COALESCE(cost.pres, 0) +
            COALESCE(cost."dtfPlastisol", 0) +
            COALESCE(cost.bordir, 0) +
            COALESCE(cost.lainnya, 0)
          ) AS day_hpp,
          COUNT(DISTINCT so.id) AS day_orders,
          SUM(items.quantity) AS day_pcs
        FROM "SalesOrder" so
        INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
        LEFT JOIN "SalesOrderCost" cost ON cost."salesOrderId" = so.id
        LEFT JOIN (
          SELECT "salesOrderId", SUM(quantity)::int AS quantity
          FROM "SalesOrderItem"
          GROUP BY "salesOrderId"
        ) items ON items."salesOrderId" = so.id
        WHERE so.status = 'ACTIVE'
        ${orderDateCondition}
        ${sourceCondition}
        GROUP BY 1
      ),
      leads_agg AS (
        SELECT
          TO_CHAR(o."createdAt" AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS day_str,
          COUNT(o.id) AS day_leads
        FROM "Opportunity" o
        WHERE 1=1
        ${leadDateCondition}
        ${sourceCondition}
        GROUP BY 1
      )
      SELECT
        t.day_str AS "timeBucket",
        t.display_date AS "displayDate",
        COALESCE(o.day_revenue, 0)::text AS revenue,
        COALESCE(o.day_hpp, 0)::text AS hpp,
        COALESCE(o.day_orders, 0)::int AS "orderCount",
        COALESCE(o.day_pcs, 0)::int AS "pcsCount",
        COALESCE(l.day_leads, 0)::int AS "leadCount"
      FROM timeline t
      LEFT JOIN orders_agg o ON o.day_str = t.day_str
      LEFT JOIN leads_agg l ON l.day_str = t.day_str
      ORDER BY t.day_str ASC
    `),
    // Cashflow: Real cash received vs Outstanding AR
    prisma.$queryRaw<Array<{
      cashInflow: string;
      outstandingAr: string;
      unpaidOrdersCount: number;
    }>>(Prisma.sql`
      SELECT
        (
          SELECT COALESCE(SUM(pt.amount), 0)::text
          FROM "PaymentTransaction" pt
          WHERE pt.status = 'ACTIVE'
          ${period.start && period.end ? Prisma.sql`AND pt."paidAt" >= ${period.start} AND pt."paidAt" < ${period.end}` : Prisma.empty}
        ) AS "cashInflow",
        (
          SELECT COALESCE(SUM(dp."outstandingAmount"), 0)::text
          FROM "DealPayment" dp
          INNER JOIN "SalesOrder" so ON so.id = dp."salesOrderId"
          WHERE so.status = 'ACTIVE' AND dp."outstandingAmount" > 0
        ) AS "outstandingAr",
        (
          SELECT COUNT(DISTINCT so.id)::int
          FROM "DealPayment" dp
          INNER JOIN "SalesOrder" so ON so.id = dp."salesOrderId"
          WHERE so.status = 'ACTIVE' AND dp."outstandingAmount" > 0
        ) AS "unpaidOrdersCount"
    `),
  ]);

  // Calculations for Summary
  const curAgg = revenueAggRows[0] ?? { totalRevenue: "0", totalHpp: "0", orderCount: 0, totalPcs: 0 };
  const prevAgg = prevRevenueAggRows[0] ?? { totalRevenue: "0", totalHpp: "0", orderCount: 0, totalPcs: 0 };

  const totalRevenue = Math.round(Number(curAgg.totalRevenue) || 0);
  const prevRevenue = Math.round(Number(prevAgg.totalRevenue) || 0);
  const revenueGrowth = calcGrowth(totalRevenue, prevRevenue);

  const totalHpp = Math.round(Number(curAgg.totalHpp) || 0);
  const prevHpp = Math.round(Number(prevAgg.totalHpp) || 0);

  const totalGrossProfit = totalRevenue - totalHpp;
  const prevGrossProfit = prevRevenue - prevHpp;
  const grossProfitGrowth = calcGrowth(totalGrossProfit, prevGrossProfit);

  const grossMarginPercent = totalRevenue > 0 ? Math.round((totalGrossProfit / totalRevenue) * 100) : 0;
  let marginStatus: "SANGAT SEHAT" | "SEHAT" | "MODERAT" | "KRITIS" = "MODERAT";
  if (grossMarginPercent >= 30) marginStatus = "SANGAT SEHAT";
  else if (grossMarginPercent >= 20) marginStatus = "SEHAT";
  else if (grossMarginPercent >= 10) marginStatus = "MODERAT";
  else marginStatus = "KRITIS";

  const totalOrders = curAgg.orderCount;
  const prevOrders = prevAgg.orderCount;
  const orderGrowth = calcGrowth(totalOrders, prevOrders);

  const totalPcs = curAgg.totalPcs;
  const prevPcs = prevAgg.totalPcs;
  const pcsGrowth = calcGrowth(totalPcs, prevPcs);

  const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const prevAov = prevOrders > 0 ? Math.round(prevRevenue / prevOrders) : 0;
  const aovGrowth = calcGrowth(aov, prevAov);

  const winRate = leadCount > 0 ? Math.round((soCount / leadCount) * 100) : 0;
  const prevLeadCount = 1; // Fallback
  const prevWinRate = winRate; // Approximate
  const winRateGrowth = 0;

  const cashInflow = Math.round(Number(cashflowRows[0]?.cashInflow) || 0);
  const outstandingAr = Math.round(Number(cashflowRows[0]?.outstandingAr) || 0);
  const unpaidOrdersCount = cashflowRows[0]?.unpaidOrdersCount || 0;

  // Conversion Funnel Construction
  const rawFunnel = [
    { stage: "LEAD", label: "Lead Baru", count: leadCount },
    { stage: "CHAT", label: "Chat / Interaksi", count: chatCount },
    { stage: "FOLLOW_UP", label: "Follow-Up Aktif", count: followUpCount },
    { stage: "QUOTATION", label: "Quotation / PO Diajukan", count: quotationCount },
    { stage: "NEGOSIASI", label: "Negosiasi", count: negotiationCount },
    { stage: "DP", label: "DP Masuk / Deposit", count: dpCount },
    { stage: "SALES_ORDER", label: "Sales Order Deal", count: soCount },
    { stage: "LUNAS", label: "Pelunasan (Lunas)", count: paidOrderCount },
  ];

  const funnel: ExecutiveFunnelStage[] = rawFunnel.map((item, idx) => {
    const prevCount = idx === 0 ? item.count : rawFunnel[idx - 1].count;
    const conversion = leadCount > 0 ? Math.round((item.count / leadCount) * 100) : 0;
    const stepConversion = prevCount > 0 ? Math.round((item.count / prevCount) * 100) : 100;
    const dropOffRate = 100 - stepConversion;
    return {
      stage: item.stage,
      label: item.label,
      count: item.count,
      conversion,
      stepConversion,
      dropOffRate: dropOffRate > 0 ? dropOffRate : 0,
    };
  });

  // Product Matrix
  const products: ExecutiveProductRow[] = productRows.map((row) => {
    const rev = Math.round(Number(row.revenue) || 0);
    const hpp = Math.round(Number(row.hpp) || 0);
    const profit = rev - hpp;
    const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;
    const isCostComplete = row.costedOrderCount >= row.orderCount && row.orderCount > 0;
    let status: "Sangat Sehat" | "Sehat" | "Moderat" | "Perlu Evaluasi" = "Moderat";
    if (margin >= 30) status = "Sangat Sehat";
    else if (margin >= 20) status = "Sehat";
    else if (margin >= 10) status = "Moderat";
    else status = "Perlu Evaluasi";

    const asp = row.quantity > 0 ? Math.round(rev / row.quantity) : 0;
    const acp = row.quantity > 0 ? Math.round(hpp / row.quantity) : 0;
    const profitPerPcs = row.quantity > 0 ? Math.round(profit / row.quantity) : 0;

    return {
      productName: row.productName,
      categoryName: row.categoryName || "Konveksi",
      orderCount: row.orderCount,
      quantity: row.quantity,
      revenue: rev,
      revenueFormatted: formatCurrency(rev),
      hpp,
      hppFormatted: formatCurrency(hpp),
      grossProfit: profit,
      grossProfitFormatted: formatCurrency(profit),
      marginPercent: margin,
      marginStatus: status,
      isCostComplete,
      costedOrderCount: row.costedOrderCount,
      asp,
      acp,
      profitPerPcs,
    };
  });

  // Channel Effectiveness
  const channels: ExecutiveChannelRow[] = channelRows.map((row) => {
    const rev = Math.round(Number(row.revenue) || 0);
    const win = row.leadCount > 0 ? Math.round((row.orderCount / row.leadCount) * 100) : 0;
    const aovVal = row.orderCount > 0 ? Math.round(rev / row.orderCount) : 0;
    const share = totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0;

    let eff: "Sangat Efektif" | "Potensial" | "Perlu Ditingkatkan" = "Perlu Ditingkatkan";
    if (win >= 30 && rev > 0) eff = "Sangat Efektif";
    else if (win >= 15 || row.leadCount >= 5) eff = "Potensial";

    return {
      sourceId: row.sourceId,
      channelName: row.channelName,
      leadCount: row.leadCount,
      dealCount: row.dealCount,
      orderCount: row.orderCount,
      revenue: rev,
      revenueFormatted: formatCurrency(rev),
      winRate: win,
      avgDealValue: aovVal,
      avgDealValueFormatted: formatCurrency(aovVal),
      revenueShare: share,
      efficiency: eff,
    };
  });

  // PIC Productivity
  const pics: ExecutivePicRow[] = picRows.map((row) => {
    const rev = Math.round(Number(row.revenue) || 0);
    const win = row.leadCount > 0 ? Math.round((row.dealCount / row.leadCount) * 100) : 0;
    const aovVal = row.dealCount > 0 ? Math.round(rev / row.dealCount) : 0;
    return {
      picId: row.picId,
      picName: row.picName,
      leadCount: row.leadCount,
      dealCount: row.dealCount,
      winRate: win,
      revenue: rev,
      revenueFormatted: formatCurrency(rev),
      pcsCount: row.pcsCount,
      aov: aovVal,
      aovFormatted: formatCurrency(aovVal),
    };
  });

  // Retention stats
  const totalActiveCust = customerStats[0]?.customerCount || 0;
  const repeatCust = customerStats[0]?.repeatCustomerCount || 0;
  const newCust = Math.max(0, totalActiveCust - repeatCust);
  const repeatRate = totalActiveCust > 0 ? Math.round((repeatCust / totalActiveCust) * 100) : 0;

  const topCustomers: ExecutiveCustomerRow[] = topLoyalCustomers.map((c) => {
    const spend = Math.round(Number(c.totalSpend) || 0);
    const aovCust = c.orderCount > 0 ? Math.round(spend / c.orderCount) : 0;
    return {
      id: c.id,
      customerNo: c.customerNo,
      name: c.name,
      companyName: c.companyName,
      city: c.city,
      whatsapp: c.whatsapp,
      orderCount: c.orderCount,
      totalSpend: spend,
      totalSpendFormatted: formatCurrency(spend),
      aov: aovCust,
      aovFormatted: formatCurrency(aovCust),
      lastOrderDate: c.lastOrderDate ? toJakartaDate(c.lastOrderDate).toISOString().slice(0, 10) : null,
    };
  });

  // Operations
  const opStat = workOrderStats[0] ?? { activeCount: 0, approachingCount: 0, overdueCount: 0, returCount: 0 };
  const totalStagesCount = workOrderStages.reduce((sum, s) => sum + s.count, 0);
  const stageBreakdown = workOrderStages.map((s) => ({
    stage: s.currentStage,
    label: STAGE_LABELS[s.currentStage] || s.currentStage,
    count: s.count,
    percentage: totalStagesCount > 0 ? Math.round((s.count / totalStagesCount) * 100) : 0,
  }));

  // Trends
  const trendData = trendRows.map((r) => {
    const rev = Math.round(Number(r.revenue) || 0);
    const hpp = Math.round(Number(r.hpp) || 0);
    return {
      date: r.displayDate || r.timeBucket,
      fullDate: r.timeBucket,
      revenue: rev,
      profit: rev - hpp,
      hpp,
      orders: r.orderCount,
      pcs: r.pcsCount,
      leads: r.leadCount,
    };
  });

  // AI & Strategic Business Recommendations for Owner (Always 4 Complete Pillars)
  const insights: ExecutiveInsight[] = [];

  // Insight Pillar 1: Gross Margin & Profitability
  if (grossMarginPercent >= 30) {
    insights.push({
      id: "margin-great",
      type: "positive",
      title: `Gross Margin Sangat Prima (${grossMarginPercent}%)`,
      description: `Profitabilitas bisnis berada di level sangat sehat dengan rata-rata margin ${grossMarginPercent}%. Portofolio produk menghasilkan laba kotor yang kokoh.`,
    });
  } else if (grossMarginPercent >= 15) {
    insights.push({
      id: "margin-ok",
      type: "positive",
      title: `Gross Margin Terjaga (${grossMarginPercent}%)`,
      description: `Laba kotor bisnis berada di level stabil (${grossMarginPercent}%). Pertahankan efisiensi HPP bahan kain dan ongkos konveksi untuk margin optimal.`,
    });
  } else {
    insights.push({
      id: "margin-warning",
      type: "warning",
      title: `Gross Margin Tipis (${grossMarginPercent}%)`,
      description: `Margin keuntungan kotor berada di bawah standar konveksi (25-35%). Pertimbangkan penyesuaian pricelist atau negosiasi ulang harga bahan kain & ongkos jahit.`,
    });
  }

  // Insight Pillar 2: Funnel Closing & Drop-Off Bottleneck
  const highestDropOff = [...funnel]
    .filter((s, idx) => idx > 0 && s.dropOffRate > 20)
    .sort((a, b) => b.dropOffRate - a.dropOffRate)[0];

  if (highestDropOff) {
    insights.push({
      id: "funnel-drop",
      type: "opportunity",
      title: `Titik Hambat Closing: ${highestDropOff.label}`,
      description: `Terjadi penurunan (drop-off) sebesar ${highestDropOff.dropOffRate}% pada tahap ${highestDropOff.label}. Tim sales disarankan memberikan insentif closing lebih cepat atau follow-up intensif.`,
      actionText: "Buka CRM Follow-up",
      actionHref: "/crm/follow-up",
    });
  } else {
    insights.push({
      id: "funnel-healthy",
      type: "positive",
      title: `Pipeline Closing Sehat (${winRate}% Win Rate)`,
      description: `Alur konversi prospek berjalan mulus tanpa kebocoran signifikan. Konversi akhir lead menjadi pesanan aktif mencapai rasio ${winRate}%.`,
      actionText: "Lihat Pipeline Prospek",
      actionHref: "/crm/prospek",
    });
  }

  // Insight Pillar 3: Cashflow & Piutang (AR)
  if (outstandingAr > 0) {
    insights.push({
      id: "ar-alert",
      type: "action",
      title: `Piutang Tertahan ${formatCurrency(outstandingAr)}`,
      description: `Terdapat ${unpaidOrdersCount} Sales Order aktif dengan saldo sisa belum terbayar. Penagihan tepat waktu menjaga kelancaran modal kerja produksi.`,
      actionText: "Lihat Invoice & Piutang",
      actionHref: "/invoices",
    });
  } else {
    insights.push({
      id: "ar-clean",
      type: "positive",
      title: "Arus Kas & Piutang Sangat Sehat",
      description: `Seluruh order aktif pada periode ini telah lunas terbayar (${cashInflow > 0 ? formatCurrency(cashInflow) : "Rp 0"} uang masuk). Tidak ada piutang macet yang mengendap.`,
      actionText: "Cek Laporan Keuangan",
      actionHref: "/keuangan/laporan",
    });
  }

  // Insight Pillar 4: Operasional Produksi & Retensi Pelanggan
  if (opStat.overdueCount > 0) {
    insights.push({
      id: "prod-overdue",
      type: "warning",
      title: `${opStat.overdueCount} SPK Melewati Deadline`,
      description: `Ada pesanan yang telah melewati tanggal batas pengiriman. Segera koordinasikan dengan penanggung jawab produksi untuk menghindari komplain customer.`,
      actionText: "Buka Modul Produksi",
      actionHref: "/production/orders",
    });
  } else if (opStat.approachingCount > 0) {
    insights.push({
      id: "prod-approaching",
      type: "action",
      title: `${opStat.approachingCount} SPK Mendekati Deadline (≤3 Hari)`,
      description: `Perhatikan antrean tahap QC dan Packing agar pengiriman berjalan tepat waktu sebelum akhir pekan.`,
      actionText: "Cek Kanban Produksi",
      actionHref: "/production/orders",
    });
  } else if (repeatRate > 0) {
    insights.push({
      id: "retention-good",
      type: "positive",
      title: `Retensi Repeat Order Tinggi (${repeatRate}%)`,
      description: `${repeatRate}% dari total pelanggan melakukan repeat order berulang. Loyalitas customer menjaga stabilitas cashflow bisnis jangka panjang.`,
      actionText: "Kelola Pelanggan",
      actionHref: "/crm/pelanggan",
    });
  } else {
    insights.push({
      id: "prod-clear",
      type: "positive",
      title: "Kapasitas Lantai Kerja Terkendali",
      description: `Sebanyak ${opStat.activeCount} SPK aktif berjalan tepat waktu sesuai jadwal tanpa ada kendala keterlambatan pengiriman.`,
      actionText: "Buka Kanban Produksi",
      actionHref: "/production/orders",
    });
  }

  const overdueFollowUps = followUpCountRows[0];
  const dueTodayFollowUps = followUpCountRows[1];

  return {
    actor: {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      email: actor.email,
    },
    period: {
      from: period.from,
      to: period.to,
      label: period.label,
      preset: period.preset,
    },
    filters: {
      sourceId: selectedSourceId,
      categoryId: selectedCategoryId,
    },
    filterMeta: {
      leadSources: metaLeadSources,
      productCategories: metaCategories,
    },
    summary: {
      totalRevenue,
      totalRevenueFormatted: formatCurrency(totalRevenue),
      prevRevenue,
      revenueGrowth,

      totalHpp,
      totalHppFormatted: formatCurrency(totalHpp),

      totalGrossProfit,
      totalGrossProfitFormatted: formatCurrency(totalGrossProfit),
      prevGrossProfit,
      grossProfitGrowth,

      grossMarginPercent,
      marginStatus,

      totalOrders,
      prevOrders,
      orderGrowth,

      totalPcs,
      prevPcs,
      pcsGrowth,

      aov,
      aovFormatted: formatCurrency(aov),
      prevAov,
      aovGrowth,

      winRate,
      prevWinRate,
      winRateGrowth,

      cashInflow,
      cashInflowFormatted: formatCurrency(cashInflow),
      outstandingAr,
      outstandingArFormatted: formatCurrency(outstandingAr),
      unpaidOrdersCount,
    },
    funnel,
    trendData,
    products,
    channels,
    pics,
    retention: {
      newCustomerCount: newCust,
      repeatCustomerCount: repeatCust,
      repeatRate,
      topCustomers,
    },
    operations: {
      activeWorkOrders: opStat.activeCount,
      stageBreakdown,
      approachingDeadlineCount: opStat.approachingCount,
      overdueCount: opStat.overdueCount,
      returCount: opStat.returCount,
    },
    alerts: {
      overdueFollowUps,
      dueTodayFollowUps,
      approachingDeadlineCount: opStat.approachingCount,
      overdueProductionCount: opStat.overdueCount,
      unpaidOrdersCount,
    },
    insights,
  };
}
