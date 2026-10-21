import "server-only";

import { Prisma } from "@prisma/client";
import { ANALYTICS_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { formatCurrency, formatPercentage } from "@/lib/crm/format";

export type LeadSourceAnalyticsQueryParams = {
  mode?: string | string[];
  from?: string | string[];
  to?: string | string[];
  range?: string | string[];
  sourceId?: string | string[];
};

export type LeadSourceChannelDetail = {
  id: string | null;
  name: string;
  leadCount: number;
  dealCount: number;
  winRate: number; // percentage (deal / lead * 100)
  revenue: number;
  revenueFormatted: string;
  aov: number; // average order value
  aovFormatted: string;
  totalPcs: number;
  leadShare: number; // % of total leads
  revenueShare: number; // % of total revenue
  dealShare: number; // % of total deals
  repeatDealCount: number;
  repeatDealRate: number; // % of deals that are repeat orders
  newDealCount: number;
  avgCycleDays: number; // average days from lead creation to sales order acceptance
  topCustomerCategory: string;
  topGarmentType: string;
  topCity: string;
  tier: "Bintang Utama" | "High Ticket" | "Volume Builder" | "Perlu Optimalisasi";
  tierColor: "emerald" | "blue" | "purple" | "amber";
  badgeClass: string;
};

export type LeadSourceTimelinePoint = {
  date: string;
  formattedDate: string;
  totalLeads: number;
  totalDeals: number;
  totalRevenue: number;
  channelData: Record<string, { leads: number; deals: number; revenue: number }>;
};

export type CustomerCategoryChannelDistribution = {
  categoryName: string;
  totalOrders: number;
  totalRevenue: number;
  totalRevenueFormatted: string;
  dominantSource: string;
  channels: Array<{
    sourceName: string;
    orderCount: number;
    revenue: number;
    sharePercent: number;
  }>;
};

export type GarmentTypeChannelDistribution = {
  garmentType: string;
  totalOrders: number;
  totalPcs: number;
  dominantSource: string;
  channels: Array<{
    sourceName: string;
    orderCount: number;
    pcs: number;
    sharePercent: number;
  }>;
};

export type LeadSourceInsight = {
  id: string;
  type: "positive" | "warning" | "opportunity" | "action";
  title: string;
  description: string;
  channelName?: string;
  actionText?: string;
  actionHref?: string;
};

export type LeadSourceAnalyticsData = {
  actor: {
    name: string;
    role: string;
  };
  period: {
    label: string;
    preset: string;
    from: string;
    to: string;
    mode: "range" | "all";
  };
  summary: {
    totalLeads: number;
    prevLeads: number;
    leadsGrowth: number;

    totalDeals: number;
    prevDeals: number;
    dealsGrowth: number;

    totalRevenue: number;
    totalRevenueFormatted: string;
    prevRevenue: number;
    revenueGrowth: number;

    overallWinRate: number;
    prevWinRate: number;
    winRateGrowth: number;

    aov: number;
    aovFormatted: string;
    prevAov: number;
    aovGrowth: number;

    totalPcs: number;
    prevPcs: number;
    pcsGrowth: number;

    topRevenueChannel: string;
    topWinRateChannel: string;
    topVolumeChannel: string;
    repeatOrderChampion: string;
  };
  channels: LeadSourceChannelDetail[];
  timeline: LeadSourceTimelinePoint[];
  customerCategories: CustomerCategoryChannelDistribution[];
  garmentCategories: GarmentTypeChannelDistribution[];
  insights: LeadSourceInsight[];
};

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function toJakartaDate(date: Date) {
  return new Date(date.getTime() + JAKARTA_OFFSET_MS);
}

function parsePeriodBounds(params: LeadSourceAnalyticsQueryParams) {
  const modeParam = typeof params.mode === "string" ? params.mode : (Array.isArray(params.mode) ? params.mode[0] : undefined);
  const rangePreset = typeof params.range === "string" ? params.range : (Array.isArray(params.range) ? params.range[0] : "this-month");
  const rawFrom = typeof params.from === "string" ? params.from : (Array.isArray(params.from) ? params.from[0] : undefined);
  const rawTo = typeof params.to === "string" ? params.to : (Array.isArray(params.to) ? params.to[0] : undefined);

  if (modeParam === "all" || rangePreset === "all") {
    return {
      start: null,
      end: null,
      prevStart: null,
      prevEnd: null,
      label: "Semua Waktu (All Time)",
      preset: "all",
      from: "",
      to: "",
      mode: "all" as const,
    };
  }

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
  } else if (rangePreset === "this-year") {
    start = new Date(Date.UTC(y, 0, 1) - JAKARTA_OFFSET_MS);
    end = new Date(Date.UTC(y + 1, 0, 1) - JAKARTA_OFFSET_MS);
    prevStart = new Date(Date.UTC(y - 1, 0, 1) - JAKARTA_OFFSET_MS);
    prevEnd = start;
    label = `Tahun ${y}`;
  } else {
    // "this-month" default
    preset = "this-month";
    start = new Date(Date.UTC(y, m, 1) - JAKARTA_OFFSET_MS);
    end = new Date(Date.UTC(y, m + 1, 1) - JAKARTA_OFFSET_MS);
    prevStart = new Date(Date.UTC(y, m - 1, 1) - JAKARTA_OFFSET_MS);
    prevEnd = start;
    const monthFormatter = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
    label = monthFormatter.format(new Date(Date.UTC(y, m, 1)));
  }

  const toYMD = (dt: Date | null) => (dt ? toJakartaDate(dt).toISOString().slice(0, 10) : "");

  return {
    start,
    end,
    prevStart,
    prevEnd,
    label,
    preset,
    from: toYMD(start),
    to: toYMD(end ? new Date(end.getTime() - 1000) : null),
    mode: "range" as const,
  };
}

function calcGrowth(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export async function getLeadSourceAnalyticsData(
  params: LeadSourceAnalyticsQueryParams = {},
): Promise<LeadSourceAnalyticsData> {
  const actor = await requireActor(ANALYTICS_ROLES);
  const prisma = getPrismaClient();
  const period = parsePeriodBounds(params);

  // Date filters
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

  // Run comprehensive parallel queries
  const [
    allLeadSources,
    channelAggRows,
    prevChannelAggRows,
    cycleDaysRows,
    breakdownCustomerRows,
    breakdownGarmentRows,
    timelineRows,
    topCityRows,
  ] = await Promise.all([
    // 1. All active lead sources
    prisma.leadSource.findMany({
      where: { isActive: true },
      select: { id: true, name: true, position: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),

    // 2. Comprehensive Channel Aggregate (Current Period)
    prisma.$queryRaw<Array<{
      sourceId: string | null;
      sourceName: string;
      leadCount: number;
      dealCount: number;
      revenue: string;
      totalPcs: number;
      repeatDeals: number;
    }>>(Prisma.sql`
      WITH lead_counts AS (
        SELECT
          o."leadSourceId",
          COUNT(*)::int AS "leadCount"
        FROM "Opportunity" o
        WHERE 1=1
        ${leadDateCondition}
        GROUP BY o."leadSourceId"
      ),
      deal_metrics AS (
        SELECT
          o."leadSourceId",
          COUNT(DISTINCT so.id)::int AS "dealCount",
          COALESCE(SUM(so.total), 0)::text AS revenue,
          COALESCE(SUM(items.quantity), 0)::int AS "totalPcs",
          COUNT(DISTINCT CASE WHEN o."isRepeatOrder" = true THEN so.id END)::int AS "repeatDeals"
        FROM "SalesOrder" so
        INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
        LEFT JOIN (
          SELECT "salesOrderId", SUM(quantity)::int AS quantity
          FROM "SalesOrderItem"
          GROUP BY "salesOrderId"
        ) items ON items."salesOrderId" = so.id
        WHERE so.status = 'ACTIVE'
        ${orderDateCondition}
        GROUP BY o."leadSourceId"
      ),
      source_list AS (
        SELECT ls.id AS "sourceId", ls.name AS "sourceName", ls.position
        FROM "LeadSource" ls
        UNION ALL
        SELECT NULL::text AS "sourceId", 'Belum Ditentukan' AS "sourceName", 9999 AS position
        WHERE EXISTS (SELECT 1 FROM lead_counts WHERE "leadSourceId" IS NULL)
           OR EXISTS (SELECT 1 FROM deal_metrics WHERE "leadSourceId" IS NULL)
      )
      SELECT
        sl."sourceId",
        sl."sourceName",
        COALESCE(lc."leadCount", 0)::int AS "leadCount",
        COALESCE(dm."dealCount", 0)::int AS "dealCount",
        COALESCE(dm.revenue, '0') AS revenue,
        COALESCE(dm."totalPcs", 0)::int AS "totalPcs",
        COALESCE(dm."repeatDeals", 0)::int AS "repeatDeals"
      FROM source_list sl
      LEFT JOIN lead_counts lc ON lc."leadSourceId" IS NOT DISTINCT FROM sl."sourceId"
      LEFT JOIN deal_metrics dm ON dm."leadSourceId" IS NOT DISTINCT FROM sl."sourceId"
      ORDER BY COALESCE(dm.revenue::numeric, 0) DESC, COALESCE(lc."leadCount", 0) DESC, sl.position ASC
    `),

    // 3. Prev Period Totals for Growth
    prisma.$queryRaw<Array<{
      totalLeads: number;
      totalDeals: number;
      totalRevenue: string;
      totalPcs: number;
    }>>(Prisma.sql`
      WITH prev_leads AS (
        SELECT COUNT(*)::int AS "cnt"
        FROM "Opportunity" o
        WHERE 1=1
        ${prevLeadDateCondition}
      ),
      prev_deals AS (
        SELECT
          COUNT(DISTINCT so.id)::int AS "cnt",
          COALESCE(SUM(so.total), 0)::text AS "rev",
          COALESCE(SUM(items.quantity), 0)::int AS "pcs"
        FROM "SalesOrder" so
        LEFT JOIN (
          SELECT "salesOrderId", SUM(quantity)::int AS quantity
          FROM "SalesOrderItem"
          GROUP BY "salesOrderId"
        ) items ON items."salesOrderId" = so.id
        WHERE so.status = 'ACTIVE'
        ${prevOrderDateCondition}
      )
      SELECT
        (SELECT "cnt" FROM prev_leads)::int AS "totalLeads",
        (SELECT "cnt" FROM prev_deals)::int AS "totalDeals",
        (SELECT "rev" FROM prev_deals) AS "totalRevenue",
        (SELECT "pcs" FROM prev_deals)::int AS "totalPcs"
    `),

    // 4. Lead-to-Deal Cycle Days per Lead Source
    prisma.$queryRaw<Array<{
      sourceId: string | null;
      avgCycleDays: number;
    }>>(Prisma.sql`
      SELECT
        o."leadSourceId" AS "sourceId",
        ROUND(AVG(EXTRACT(EPOCH FROM (so."acceptedAt" - o."createdAt")) / 86400))::int AS "avgCycleDays"
      FROM "SalesOrder" so
      INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
      WHERE so.status = 'ACTIVE'
        AND so."acceptedAt" >= o."createdAt"
        ${orderDateCondition}
      GROUP BY o."leadSourceId"
    `),

    // 5. Customer Type Breakdown by Lead Source
    prisma.$queryRaw<Array<{
      categoryName: string;
      sourceName: string;
      orderCount: number;
      revenue: string;
    }>>(Prisma.sql`
      SELECT
        COALESCE(ct.name, 'Umum / Lainnya') AS "categoryName",
        COALESCE(ls.name, 'Belum Ditentukan') AS "sourceName",
        COUNT(DISTINCT so.id)::int AS "orderCount",
        COALESCE(SUM(so.total), 0)::text AS revenue
      FROM "SalesOrder" so
      INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
      LEFT JOIN "Customer" c ON c.id = o."customerId"
      LEFT JOIN "CustomerType" ct ON ct.id = c."customerTypeId"
      LEFT JOIN "LeadSource" ls ON ls.id = o."leadSourceId"
      WHERE so.status = 'ACTIVE'
      ${orderDateCondition}
      GROUP BY ct.name, ls.name
      ORDER BY COALESCE(SUM(so.total), 0) DESC, COUNT(DISTINCT so.id) DESC
    `),

    // 6. Garment Type Breakdown by Lead Source
    prisma.$queryRaw<Array<{
      garmentType: string;
      sourceName: string;
      orderCount: number;
      pcs: number;
    }>>(Prisma.sql`
      SELECT
        CASE
          WHEN po."garmentType" = 'JERSEY' THEN 'Jersey Printing'
          WHEN po."garmentType" = 'NON_JERSEY' THEN 'Kemeja / PDH / Jaket'
          WHEN po."garmentType" = 'AKSESORI' THEN 'Aksesoris / Topi'
          WHEN o."productName" IS NOT NULL THEN o."productName"
          ELSE 'Pakaian Konveksi'
        END AS "garmentType",
        COALESCE(ls.name, 'Belum Ditentukan') AS "sourceName",
        COUNT(DISTINCT so.id)::int AS "orderCount",
        COALESCE(SUM(items.quantity), 0)::int AS pcs
      FROM "SalesOrder" so
      INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
      LEFT JOIN "PurchaseOrder" po ON po.id = so."purchaseOrderId"
      LEFT JOIN "LeadSource" ls ON ls.id = o."leadSourceId"
      LEFT JOIN (
        SELECT "salesOrderId", SUM(quantity)::int AS quantity
        FROM "SalesOrderItem"
        GROUP BY "salesOrderId"
      ) items ON items."salesOrderId" = so.id
      WHERE so.status = 'ACTIVE'
      ${orderDateCondition}
      GROUP BY po."garmentType", o."productName", ls.name
      ORDER BY COALESCE(SUM(items.quantity), 0) DESC, COUNT(DISTINCT so.id) DESC
    `),

    // 7. Timeline Series (Lead creation and deal revenue over monthly buckets)
    prisma.$queryRaw<Array<{
      bucketDate: string;
      sourceName: string;
      leads: number;
      deals: number;
      revenue: string;
    }>>(Prisma.sql`
      WITH dates AS (
        SELECT
          TO_CHAR(DATE_TRUNC('month', o."createdAt" AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM') AS "bucketDate",
          COALESCE(ls.name, 'Belum Ditentukan') AS "sourceName",
          COUNT(*)::int AS leads,
          0::int AS deals,
          0::numeric AS revenue
        FROM "Opportunity" o
        LEFT JOIN "LeadSource" ls ON ls.id = o."leadSourceId"
        WHERE 1=1
        ${leadDateCondition}
        GROUP BY 1, 2
        UNION ALL
        SELECT
          TO_CHAR(DATE_TRUNC('month', so."acceptedAt" AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM') AS "bucketDate",
          COALESCE(ls.name, 'Belum Ditentukan') AS "sourceName",
          0::int AS leads,
          COUNT(DISTINCT so.id)::int AS deals,
          COALESCE(SUM(so.total), 0)::numeric AS revenue
        FROM "SalesOrder" so
        INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
        LEFT JOIN "LeadSource" ls ON ls.id = o."leadSourceId"
        WHERE so.status = 'ACTIVE'
        ${orderDateCondition}
        GROUP BY 1, 2
      )
      SELECT
        "bucketDate",
        "sourceName",
        SUM(leads)::int AS leads,
        SUM(deals)::int AS deals,
        SUM(revenue)::text AS revenue
      FROM dates
      WHERE "bucketDate" IS NOT NULL
      GROUP BY "bucketDate", "sourceName"
      ORDER BY "bucketDate" ASC, "sourceName" ASC
    `),

    // 8. Top Customer Cities per Lead Source
    prisma.$queryRaw<Array<{
      sourceId: string | null;
      city: string;
      cnt: number;
    }>>(Prisma.sql`
      SELECT
        o."leadSourceId" AS "sourceId",
        COALESCE(NULLIF(TRIM(c.city), ''), 'Kota Belum Diisi') AS city,
        COUNT(*)::int AS cnt
      FROM "Opportunity" o
      LEFT JOIN "Customer" c ON c.id = o."customerId"
      WHERE 1=1
      ${leadDateCondition}
      GROUP BY o."leadSourceId", c.city
      ORDER BY COUNT(*) DESC
    `),
  ]);

  // Aggregate current period totals
  let totalLeads = 0;
  let totalDeals = 0;
  let totalRevenue = 0;
  let totalPcs = 0;

  for (const row of channelAggRows) {
    totalLeads += row.leadCount;
    totalDeals += row.dealCount;
    totalRevenue += Number(row.revenue);
    totalPcs += row.totalPcs;
  }

  const overallWinRate = totalLeads > 0 ? Math.round((totalDeals / totalLeads) * 100) : 0;
  const aov = totalDeals > 0 ? Math.round(totalRevenue / totalDeals) : 0;

  // Previous period metrics
  const prevMetrics = prevChannelAggRows[0] ?? {
    totalLeads: 0,
    totalDeals: 0,
    totalRevenue: "0",
    totalPcs: 0,
  };
  const prevLeads = prevMetrics.totalLeads ?? 0;
  const prevDeals = prevMetrics.totalDeals ?? 0;
  const prevRev = Number(prevMetrics.totalRevenue ?? 0);
  const prevPcs = prevMetrics.totalPcs ?? 0;
  const prevWinRate = prevLeads > 0 ? Math.round((prevDeals / prevLeads) * 100) : 0;
  const prevAov = prevDeals > 0 ? Math.round(prevRev / prevDeals) : 0;

  // Map cycle days
  const cycleDaysMap = new Map<string | null, number>();
  for (const row of cycleDaysRows) {
    cycleDaysMap.set(row.sourceId, row.avgCycleDays);
  }

  // Map top city per channel
  const topCityMap = new Map<string | null, string>();
  for (const row of topCityRows) {
    if (!topCityMap.has(row.sourceId) && row.city !== "Kota Belum Diisi") {
      topCityMap.set(row.sourceId, row.city);
    }
  }

  // Map top customer type per channel
  const topCustTypeMap = new Map<string, string>();
  for (const row of breakdownCustomerRows) {
    if (!topCustTypeMap.has(row.sourceName) && row.categoryName) {
      topCustTypeMap.set(row.sourceName, row.categoryName);
    }
  }

  // Map top garment type per channel
  const topGarmentMap = new Map<string, string>();
  for (const row of breakdownGarmentRows) {
    if (!topGarmentMap.has(row.sourceName) && row.garmentType) {
      topGarmentMap.set(row.sourceName, row.garmentType);
    }
  }

  // Format channel list
  const channels: LeadSourceChannelDetail[] = channelAggRows.map((row) => {
    const rev = Number(row.revenue);
    const winRate = row.leadCount > 0 ? Math.round((row.dealCount / row.leadCount) * 100) : 0;
    const channelAov = row.dealCount > 0 ? Math.round(rev / row.dealCount) : 0;
    const leadShare = totalLeads > 0 ? Math.round((row.leadCount / totalLeads) * 100) : 0;
    const revenueShare = totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0;
    const dealShare = totalDeals > 0 ? Math.round((row.dealCount / totalDeals) * 100) : 0;
    const repeatDealRate = row.dealCount > 0 ? Math.round((row.repeatDeals / row.dealCount) * 100) : 0;
    const avgCycleDays = cycleDaysMap.get(row.sourceId) ?? 0;
    const topCity = topCityMap.get(row.sourceId) ?? "Beragam Kota";
    const topCustomerCategory = topCustTypeMap.get(row.sourceName) ?? "Umum / Organisasi";
    const topGarmentType = topGarmentMap.get(row.sourceName) ?? "Pakaian Seragam";

    // Strategic Tier
    let tier: LeadSourceChannelDetail["tier"] = "Volume Builder";
    let tierColor: LeadSourceChannelDetail["tierColor"] = "blue";
    let badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300";

    if (revenueShare >= 30 || (winRate >= 35 && row.dealCount >= 3)) {
      tier = "Bintang Utama";
      tierColor = "emerald";
      badgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
    } else if (channelAov >= aov * 1.3 && row.dealCount >= 1) {
      tier = "High Ticket";
      tierColor = "purple";
      badgeClass = "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300";
    } else if (winRate < 15 && row.leadCount >= 5) {
      tier = "Perlu Optimalisasi";
      tierColor = "amber";
      badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
    }

    return {
      id: row.sourceId,
      name: row.sourceName,
      leadCount: row.leadCount,
      dealCount: row.dealCount,
      winRate,
      revenue: rev,
      revenueFormatted: formatCurrency(rev),
      aov: channelAov,
      aovFormatted: formatCurrency(channelAov),
      totalPcs: row.totalPcs,
      leadShare,
      revenueShare,
      dealShare,
      repeatDealCount: row.repeatDeals,
      repeatDealRate,
      newDealCount: Math.max(0, row.dealCount - row.repeatDeals),
      avgCycleDays,
      topCustomerCategory,
      topGarmentType,
      topCity,
      tier,
      tierColor,
      badgeClass,
    };
  });

  // Calculate champions
  const sortedByRev = [...channels].sort((a, b) => b.revenue - a.revenue);
  const sortedByWin = [...channels].filter((c) => c.leadCount >= 3).sort((a, b) => b.winRate - a.winRate);
  const sortedByVol = [...channels].sort((a, b) => b.totalPcs - a.totalPcs);
  const sortedByRepeat = [...channels].filter((c) => c.dealCount >= 2).sort((a, b) => b.repeatDealRate - a.repeatDealRate);

  const topRevenueChannel = sortedByRev[0]?.name ?? "-";
  const topWinRateChannel = sortedByWin[0]?.name ?? sortedByRev[0]?.name ?? "-";
  const topVolumeChannel = sortedByVol[0]?.name ?? "-";
  const repeatOrderChampion = sortedByRepeat[0]?.name ?? sortedByRev[0]?.name ?? "-";

  // Build timeline series
  const timelineMap = new Map<string, LeadSourceTimelinePoint>();
  for (const row of timelineRows) {
    if (!timelineMap.has(row.bucketDate)) {
      const [by, bm] = row.bucketDate.split("-").map(Number);
      const bDate = new Date(Date.UTC(by, bm - 1, 1));
      const formattedDate = new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit", timeZone: "Asia/Jakarta" }).format(bDate);
      timelineMap.set(row.bucketDate, {
        date: row.bucketDate,
        formattedDate,
        totalLeads: 0,
        totalDeals: 0,
        totalRevenue: 0,
        channelData: {},
      });
    }
    const point = timelineMap.get(row.bucketDate)!;
    const rev = Number(row.revenue);
    point.totalLeads += row.leads;
    point.totalDeals += row.deals;
    point.totalRevenue += rev;
    point.channelData[row.sourceName] = {
      leads: row.leads,
      deals: row.deals,
      revenue: rev,
    };
  }
  const timeline = Array.from(timelineMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Build Customer Categories distribution
  const custCatMap = new Map<string, {
    totalOrders: number;
    totalRevenue: number;
    channels: Map<string, { orderCount: number; revenue: number }>;
  }>();

  for (const row of breakdownCustomerRows) {
    if (!custCatMap.has(row.categoryName)) {
      custCatMap.set(row.categoryName, { totalOrders: 0, totalRevenue: 0, channels: new Map() });
    }
    const entry = custCatMap.get(row.categoryName)!;
    const rev = Number(row.revenue);
    entry.totalOrders += row.orderCount;
    entry.totalRevenue += rev;
    entry.channels.set(row.sourceName, {
      orderCount: row.orderCount,
      revenue: rev,
    });
  }

  const customerCategories: CustomerCategoryChannelDistribution[] = Array.from(custCatMap.entries())
    .map(([categoryName, data]) => {
      const channelArray = Array.from(data.channels.entries()).map(([sourceName, ch]) => ({
        sourceName,
        orderCount: ch.orderCount,
        revenue: ch.revenue,
        sharePercent: data.totalRevenue > 0 ? Math.round((ch.revenue / data.totalRevenue) * 100) : 0,
      })).sort((a, b) => b.revenue - a.revenue);

      return {
        categoryName,
        totalOrders: data.totalOrders,
        totalRevenue: data.totalRevenue,
        totalRevenueFormatted: formatCurrency(data.totalRevenue),
        dominantSource: channelArray[0]?.sourceName ?? "Beragam",
        channels: channelArray,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 6);

  // Build Garment Categories distribution
  const garmentMap = new Map<string, {
    totalOrders: number;
    totalPcs: number;
    channels: Map<string, { orderCount: number; pcs: number }>;
  }>();

  for (const row of breakdownGarmentRows) {
    if (!garmentMap.has(row.garmentType)) {
      garmentMap.set(row.garmentType, { totalOrders: 0, totalPcs: 0, channels: new Map() });
    }
    const entry = garmentMap.get(row.garmentType)!;
    entry.totalOrders += row.orderCount;
    entry.totalPcs += row.pcs;
    entry.channels.set(row.sourceName, {
      orderCount: row.orderCount,
      pcs: row.pcs,
    });
  }

  const garmentCategories: GarmentTypeChannelDistribution[] = Array.from(garmentMap.entries())
    .map(([garmentType, data]) => {
      const channelArray = Array.from(data.channels.entries()).map(([sourceName, ch]) => ({
        sourceName,
        orderCount: ch.orderCount,
        pcs: ch.pcs,
        sharePercent: data.totalPcs > 0 ? Math.round((ch.pcs / data.totalPcs) * 100) : 0,
      })).sort((a, b) => b.pcs - a.pcs);

      return {
        garmentType,
        totalOrders: data.totalOrders,
        totalPcs: data.totalPcs,
        dominantSource: channelArray[0]?.sourceName ?? "Beragam",
        channels: channelArray,
      };
    })
    .sort((a, b) => b.totalPcs - a.totalPcs)
    .slice(0, 6);

  // Dynamic Strategic Insights
  const insights: LeadSourceInsight[] = [];

  if (sortedByRev.length > 0 && sortedByRev[0].revenueShare >= 30) {
    insights.push({
      id: "dominant-revenue-engine",
      type: "positive",
      title: `${sortedByRev[0].name} adalah Penggerak Omzet Utama`,
      description: `Kanal ini berkontribusi ${sortedByRev[0].revenueShare}% (${sortedByRev[0].revenueFormatted}) dari seluruh omzet bisnis. Pertahankan standar layanan dan respon cepat di kanal ini.`,
      channelName: sortedByRev[0].name,
      actionText: "Lihat Detail Kanal",
    });
  }

  const optChannel = channels.find((c) => c.tier === "Perlu Optimalisasi");
  if (optChannel) {
    insights.push({
      id: "low-conversion-leak",
      type: "warning",
      title: `Peluang Konversi di ${optChannel.name}`,
      description: `Mendatangkan ${optChannel.leadCount} lead namun rasio closing baru ${optChannel.winRate}%. Evaluasi kualifikasi prospek atau perbaiki penawaran awal untuk meningkatkan closing.`,
      channelName: optChannel.name,
      actionText: "Filter Prospek Kanal",
      actionHref: `/crm/prospek?sourceId=${optChannel.id ?? ""}`,
    });
  }

  const highTicket = channels.find((c) => c.tier === "High Ticket");
  if (highTicket) {
    insights.push({
      id: "high-ticket-source",
      type: "opportunity",
      title: `${highTicket.name} Menghasilkan Nilai Transaksi Tertinggi`,
      description: `Rata-rata order (AOV) mencapai ${highTicket.aovFormatted}, jauh di atas rata-rata keseluruhan (${formatCurrency(aov)}). Sangat ideal untuk ditargetkan klien instansi / korporat.`,
      channelName: highTicket.name,
      actionText: "Eksplorasi Prospek",
    });
  }

  if (sortedByRepeat.length > 0 && sortedByRepeat[0].repeatDealRate >= 20) {
    insights.push({
      id: "repeat-order-loyalist",
      type: "positive",
      title: `${sortedByRepeat[0].name} Paling Banyak Melahirkan Repeat Order`,
      description: `${sortedByRepeat[0].repeatDealRate}% dari order di kanal ini adalah pembelian berulang. Terbukti memiliki kepuasan dan loyalitas pelanggan yang tinggi.`,
      channelName: sortedByRepeat[0].name,
    });
  }

  if (insights.length < 3) {
    insights.push({
      id: "general-growth-advice",
      type: "action",
      title: "Diversifikasi Kanal Prospek",
      description: "Pastikan setiap penawaran harga mencatat sumber lead secara akurat agar data efektivitas promosi selalu presisi untuk evaluasi biaya iklan.",
    });
  }

  return {
    actor: {
      name: actor.name,
      role: actor.role,
    },
    period: {
      label: period.label,
      preset: period.preset,
      from: period.from,
      to: period.to,
      mode: period.mode,
    },
    summary: {
      totalLeads,
      prevLeads,
      leadsGrowth: calcGrowth(totalLeads, prevLeads),

      totalDeals,
      prevDeals,
      dealsGrowth: calcGrowth(totalDeals, prevDeals),

      totalRevenue,
      totalRevenueFormatted: formatCurrency(totalRevenue),
      prevRevenue: prevRev,
      revenueGrowth: calcGrowth(totalRevenue, prevRev),

      overallWinRate,
      prevWinRate,
      winRateGrowth: overallWinRate - prevWinRate,

      aov,
      aovFormatted: formatCurrency(aov),
      prevAov,
      aovGrowth: calcGrowth(aov, prevAov),

      totalPcs,
      prevPcs,
      pcsGrowth: calcGrowth(totalPcs, prevPcs),

      topRevenueChannel,
      topWinRateChannel,
      topVolumeChannel,
      repeatOrderChampion,
    },
    channels,
    timeline,
    customerCategories,
    garmentCategories,
    insights,
  };
}
