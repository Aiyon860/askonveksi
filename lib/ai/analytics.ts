import "server-only";

import { Prisma } from "@prisma/client";

import { GARMENT_TYPE_LABEL } from "@/lib/crm/constants";
import { calcGrowth, parsePeriodBounds } from "@/lib/crm/period";
import { getPrismaClient } from "@/lib/prisma";

import type { AiBrandScope } from "@/lib/ai/scope";

/**
 * Agregat baca-saja untuk asisten AI.
 *
 * Semua angka dihitung dengan definisi yang sama seperti halaman Analytics
 * (omzet = SalesOrder ACTIVE, HPP = komponen SalesOrderCost, periode Jakarta),
 * tetapi tanpa sesi/cookie: brand dipilih eksplisit lewat parameter.
 * Tidak ada data pribadi yang keluar dari modul ini — hanya agregat dan
 * nama customer yang disamarkan.
 */

export type AiMeta = {
  brand: AiBrandScope;
  period: {
    preset: string;
    label: string;
    from: string | null;
    to: string | null;
  };
  generatedAt: string;
  currency: "IDR";
  definitions: Record<string, string>;
};

export type AiQuality = {
  customers: { total: number; withCity: number; cityFillRatePercent: number };
  opportunities: { total: number; withLeadSource: number; sourceFillRatePercent: number };
  warnings: string[];
};

export type AiOverviewResult = {
  meta: AiMeta;
  revenue: { total: number; previous: number; growthPercent: number };
  orders: { count: number; previous: number; growthPercent: number; averageOrderValue: number };
  volume: { pcs: number; pcsPerOrder: number };
  cost: { hpp: number; grossProfit: number; marginPercent: number; ordersWithCost: number };
  byBrand: Array<{ brand: string; revenue: number; orders: number }>;
  quality: AiQuality;
};

export type AiProductRow = {
  product: string;
  orders: number;
  pcs: number;
  revenue: number;
  averagePricePerPcs: number;
  revenueSharePercent: number;
};

export type AiProductsResult = {
  meta: AiMeta;
  products: AiProductRow[];
  byGarmentType: Array<{ garmentType: string; label: string; orders: number; pcs: number; pcsSharePercent: number }>;
  notes: string[];
};

export type AiCustomerRow = {
  label: string;
  customers: number;
  orders: number;
  revenue: number;
  customersWithOrders: number;
};

export type AiCustomersResult = {
  meta: AiMeta;
  byCity: AiCustomerRow[];
  byLeadSource: AiCustomerRow[];
  byCustomerType: AiCustomerRow[];
  lifecycle: AiCustomerRow[];
  repeat: { repeatCustomers: number; firstTimeCustomers: number; repeatRatePercent: number };
  topCustomers: Array<{
    customerCode: string;
    nameMasked: string;
    city: string | null;
    orders: number;
    revenue: number;
    lastOrderAt: string | null;
  }>;
  quality: AiQuality;
};

export type AiTimeseriesPoint = {
  bucket: string;
  revenue: number;
  orders: number;
  pcs: number;
};

export type AiTimeseriesResult = {
  meta: AiMeta;
  granularity: "day" | "week" | "month";
  points: AiTimeseriesPoint[];
};

export type AiPipelineResult = {
  meta: AiMeta;
  stages: Array<{ stage: string; label: string; count: number; value: number }>;
  totals: {
    leads: number;
    deals: number;
    lost: number;
    winRatePercent: number;
    openValue: number;
    outstandingReceivableValue: number;
  };
  staleFollowUps: number;
};

const STAGE_LABEL: Record<string, string> = {
  LEAD_BARU: "Lead Baru",
  FOLLOW_UP: "Follow Up",
  NEGOSIASI: "Negosiasi",
  DEAL: "Deal",
  LOST: "Lost",
};

const DEFINITIONS: Record<string, string> = {
  omzet: "Jumlah SalesOrder.total untuk SalesOrder berstatus ACTIVE pada periode (tanggal acceptedAt), semua nilai dalam Rupiah penuh.",
  hpp: "Jumlah komponen biaya SalesOrderCost (kain, zipper, jahit, pres, dtf/plastisol, bordir, lainnya) pada SalesOrder ACTIVE periode.",
  labaKotor: "Omzet dikurangi HPP.",
  margin: "Laba kotor dibagi omzet, dalam persen.",
  pesanan: "Jumlah SalesOrder ACTIVE pada periode.",
  pcs: "Jumlah potong dari seluruh baris SalesOrderItem pada pesanan periode.",
  aov: "Omzet dibagi jumlah pesanan (average order value).",
  kota: "Kolom Customer.city. Kosong dihitung sebagai 'Tidak diisi'.",
  sumberLead: "LeadSource customer/peluang; kosong dihitung sebagai 'Tidak diisi'.",
  jenisPakaian: "PurchaseOrderItem.garmentType: JERSEY, NON_JERSEY, atau AKSESORI.",
  winRate: "Peluang berstatus DEAL dibagi seluruh peluang pada periode.",
};

type ResolvedRange = ReturnType<typeof parsePeriodBounds>;

function brandSql(brand: AiBrandScope, column: Prisma.Sql) {
  return brand === "ALL" ? Prisma.empty : Prisma.sql`AND ${column} = ${brand}::"Brand"`;
}

function acceptedAtSql(range: ResolvedRange, column: Prisma.Sql) {
  if (!range.start || !range.end) return Prisma.empty;
  return Prisma.sql`AND ${column} >= ${range.start} AND ${column} < ${range.end}`;
}

function acceptedAtSqlPrev(range: ResolvedRange, column: Prisma.Sql) {
  if (!range.prevStart || !range.prevEnd) return Prisma.empty;
  return Prisma.sql`AND ${column} >= ${range.prevStart} AND ${column} < ${range.prevEnd}`;
}

function meta(brand: AiBrandScope, range: ResolvedRange): AiMeta {
  return {
    brand,
    period: {
      preset: range.preset,
      label: range.label,
      from: range.start ? range.from : null,
      to: range.end ? range.to : null,
    },
    generatedAt: new Date().toISOString(),
    currency: "IDR",
    definitions: DEFINITIONS,
  };
}

function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

/** Omzet, HPP, laba, dan pertumbuhan dibanding periode sebelumnya. */
export async function getAiOverview(input: {
  brand: AiBrandScope;
  range: ResolvedRange;
}): Promise<AiOverviewResult> {
  const prisma = getPrismaClient();
  const { brand, range } = input;

  const currentSql = Prisma.sql`
    SELECT
      COALESCE(SUM(so.total), 0)::text AS revenue,
      COUNT(DISTINCT so.id)::int AS orders,
      COALESCE(SUM(items.pcs), 0)::int AS pcs,
      COALESCE(SUM(cost.hpp), 0)::text AS hpp,
      COUNT(*) FILTER (WHERE cost."hppComplete")::int AS "ordersWithCost"
    FROM "SalesOrder" so
    LEFT JOIN (
      SELECT "salesOrderId", SUM(quantity)::int AS pcs
      FROM "SalesOrderItem" GROUP BY "salesOrderId"
    ) items ON items."salesOrderId" = so.id
    LEFT JOIN (
      SELECT "salesOrderId",
        (COALESCE(kain, 0) + COALESCE(zipper, 0) + COALESCE(jahit, 0) + COALESCE(pres, 0)
         + COALESCE("dtfPlastisol", 0) + COALESCE(bordir, 0) + COALESCE(lainnya, 0)) AS hpp,
        "hppComplete"
      FROM "SalesOrderCost"
    ) cost ON cost."salesOrderId" = so.id
    WHERE so.status = 'ACTIVE'
    ${acceptedAtSql(range, Prisma.sql`so."acceptedAt"`)}
    ${brandSql(brand, Prisma.sql`so."brand"`)}
  `;

  const previousSql = Prisma.sql`
    SELECT
      COALESCE(SUM(so.total), 0)::text AS revenue,
      COUNT(DISTINCT so.id)::int AS orders
    FROM "SalesOrder" so
    WHERE so.status = 'ACTIVE'
    ${acceptedAtSqlPrev(range, Prisma.sql`so."acceptedAt"`)}
    ${brandSql(brand, Prisma.sql`so."brand"`)}
  `;

  const brandSqlRows = Prisma.sql`
    SELECT so.brand::text AS brand,
      COALESCE(SUM(so.total), 0)::text AS revenue,
      COUNT(DISTINCT so.id)::int AS orders
    FROM "SalesOrder" so
    WHERE so.status = 'ACTIVE'
    ${acceptedAtSql(range, Prisma.sql`so."acceptedAt"`)}
    ${brandSql(brand, Prisma.sql`so."brand"`)}
    GROUP BY so.brand
    ORDER BY 2 DESC
  `;

  const [current, previous, brandRows, quality] = await Promise.all([
    prisma.$queryRaw<Array<{ revenue: string; orders: number; pcs: number; hpp: string; ordersWithCost: number }>>(currentSql),
    prisma.$queryRaw<Array<{ revenue: string; orders: number }>>(previousSql),
    prisma.$queryRaw<Array<{ brand: string; revenue: string; orders: number }>>(brandSqlRows),
    getAiQuality(brand),
  ]);

  const revenue = asNumber(current[0]?.revenue);
  const hpp = asNumber(current[0]?.hpp);
  const orderCount = asNumber(current[0]?.orders);
  const pcs = asNumber(current[0]?.pcs);
  const previousRevenue = asNumber(previous[0]?.revenue);
  const previousOrders = asNumber(previous[0]?.orders);
  const grossProfit = revenue - hpp;

  return {
    meta: meta(brand, range),
    revenue: { total: revenue, previous: previousRevenue, growthPercent: calcGrowth(revenue, previousRevenue) },
    orders: {
      count: orderCount,
      previous: previousOrders,
      growthPercent: calcGrowth(orderCount, previousOrders),
      averageOrderValue: orderCount > 0 ? Math.round(revenue / orderCount) : 0,
    },
    volume: { pcs, pcsPerOrder: orderCount > 0 ? Math.round(pcs / orderCount) : 0 },
    cost: {
      hpp,
      grossProfit,
      marginPercent: percent(grossProfit, revenue),
      ordersWithCost: asNumber(current[0]?.ordersWithCost),
    },
    byBrand: brandRows.map((row) => ({ brand: row.brand, revenue: asNumber(row.revenue), orders: asNumber(row.orders) })),
    quality,
  };
}

/** Produk yang paling sering dipesan, beserta jenis pakaiannya. */
export async function getAiProducts(input: {
  brand: AiBrandScope;
  range: ResolvedRange;
  limit?: number;
}): Promise<AiProductsResult> {
  const prisma = getPrismaClient();
  const { brand, range } = input;
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);

  const revenueSql = Prisma.sql`
    SELECT COALESCE(SUM(so.total), 0)::text AS revenue
    FROM "SalesOrder" so
    WHERE so.status = 'ACTIVE'
    ${acceptedAtSql(range, Prisma.sql`so."acceptedAt"`)}
    ${brandSql(brand, Prisma.sql`so."brand"`)}
  `;

  const productSql = Prisma.sql`
    SELECT
      COALESCE(NULLIF(BTRIM(soi."productName"), ''), 'Tanpa nama produk') AS product,
      COUNT(DISTINCT so.id)::int AS orders,
      COALESCE(SUM(soi.quantity), 0)::int AS pcs,
      COALESCE(SUM(soi.total), 0)::text AS revenue
    FROM "SalesOrderItem" soi
    INNER JOIN "SalesOrder" so ON so.id = soi."salesOrderId"
    WHERE so.status = 'ACTIVE'
    ${acceptedAtSql(range, Prisma.sql`so."acceptedAt"`)}
    ${brandSql(brand, Prisma.sql`so."brand"`)}
    GROUP BY 1
    ORDER BY 3 DESC, 2 DESC
    LIMIT ${limit}
  `;

  const garmentSql = Prisma.sql`
    SELECT
      poi."garmentType"::text AS "garmentType",
      COUNT(DISTINCT so.id)::int AS orders,
      COALESCE(SUM(sizes.pcs), 0)::int AS pcs
    FROM "SalesOrder" so
    INNER JOIN "PurchaseOrderItem" poi ON poi."purchaseOrderId" = so."purchaseOrderId"
    LEFT JOIN (
      SELECT "itemId", SUM(quantity)::int AS pcs
      FROM "PurchaseOrderSize" GROUP BY "itemId"
    ) sizes ON sizes."itemId" = poi.id
    WHERE so.status = 'ACTIVE'
    ${acceptedAtSql(range, Prisma.sql`so."acceptedAt"`)}
    ${brandSql(brand, Prisma.sql`so."brand"`)}
    GROUP BY 1
    ORDER BY 3 DESC
  `;

  const [productRows, garmentRows, revenueRows] = await Promise.all([
    prisma.$queryRaw<Array<{ product: string; orders: number; pcs: number; revenue: string }>>(productSql),
    prisma.$queryRaw<Array<{ garmentType: string | null; orders: number; pcs: number }>>(garmentSql),
    prisma.$queryRaw<Array<{ revenue: string }>>(revenueSql),
  ]);

  // Porsi omzet dihitung terhadap seluruh omzet periode, bukan hanya baris yang ditampilkan.
  const totalRevenue = asNumber(revenueRows[0]?.revenue);
  const totalPcs = garmentRows.reduce((sum, row) => sum + asNumber(row.pcs), 0);

  return {
    meta: meta(brand, range),
    products: productRows.map((row) => {
      const revenue = asNumber(row.revenue);
      const pcs = asNumber(row.pcs);
      return {
        product: row.product,
        orders: asNumber(row.orders),
        pcs,
        revenue,
        averagePricePerPcs: pcs > 0 ? Math.round(revenue / pcs) : 0,
        revenueSharePercent: percent(revenue, totalRevenue),
      };
    }),
    byGarmentType: garmentRows.map((row) => {
      const pcs = asNumber(row.pcs);
      const type = row.garmentType ?? "";
      return {
        garmentType: type || "TIDAK_DIISI",
        label: (GARMENT_TYPE_LABEL as Record<string, string>)[type] ?? "Jenis belum diisi",
        orders: asNumber(row.orders),
        pcs,
        pcsSharePercent: percent(pcs, totalPcs),
      };
    }),
    notes: [
      "Nama produk berasal dari baris SalesOrderItem, jadi variasi ejaan bisa terpisah menjadi beberapa baris.",
      "Omzet per jenis pakaian tidak tersedia karena harga disimpan per baris pesanan, bukan per jenis.",
    ],
  };
}

type GroupDimension = "city" | "source" | "type";

async function customerGroup(
  dimension: GroupDimension,
  brand: AiBrandScope,
  range: ResolvedRange,
): Promise<AiCustomerRow[]> {
  const prisma = getPrismaClient();

  // Setiap dimensi memakai kolom label yang berbeda; sisanya identik.
  const labelSql =
    dimension === "city"
      ? Prisma.sql`COALESCE(NULLIF(BTRIM(c.city), ''), 'Tidak diisi')`
      : dimension === "source"
        ? Prisma.sql`COALESCE(ls.name, 'Tidak diisi')`
        : Prisma.sql`COALESCE(ct.name, 'Tanpa jenis')`;

  const joinSql =
    dimension === "source"
      ? Prisma.sql`LEFT JOIN "LeadSource" ls ON ls.id = c."leadSourceId"`
      : dimension === "type"
        ? Prisma.sql`LEFT JOIN "CustomerType" ct ON ct.id = c."customerTypeId"`
        : Prisma.empty;

  const rows = await prisma.$queryRaw<Array<{ label: string; customers: number; orders: number; revenue: string; customersWithOrders: number }>>(Prisma.sql`
    SELECT
      ${labelSql} AS label,
      COUNT(DISTINCT c.id)::int AS customers,
      COUNT(DISTINCT so.id)::int AS orders,
      COALESCE(SUM(so.total), 0)::text AS revenue,
      COUNT(DISTINCT CASE WHEN so.id IS NOT NULL THEN o."customerId" END)::int AS "customersWithOrders"
    FROM "Customer" c
    ${joinSql}
    LEFT JOIN "Opportunity" o ON o."customerId" = c.id
    LEFT JOIN "SalesOrder" so ON so."opportunityId" = o.id
      AND so.status = 'ACTIVE'
      ${acceptedAtSql(range, Prisma.sql`so."acceptedAt"`)}
      ${brandSql(brand, Prisma.sql`so."brand"`)}
    WHERE c."archivedAt" IS NULL
    GROUP BY 1
    ORDER BY 4 DESC, 2 DESC
    LIMIT 25
  `);

  return rows.map((row) => ({
    label: row.label,
    customers: asNumber(row.customers),
    orders: asNumber(row.orders),
    revenue: asNumber(row.revenue),
    customersWithOrders: asNumber(row.customersWithOrders),
  }));
}

async function lifecycleGroups(brand: AiBrandScope, range: ResolvedRange): Promise<AiCustomerRow[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw<Array<{ label: string; customers: number; orders: number; revenue: string; customersWithOrders: number }>>(Prisma.sql`
    SELECT
      c.lifecycle::text AS label,
      COUNT(DISTINCT c.id)::int AS customers,
      COUNT(DISTINCT so.id)::int AS orders,
      COALESCE(SUM(so.total), 0)::text AS revenue,
      COUNT(DISTINCT CASE WHEN so.id IS NOT NULL THEN o."customerId" END)::int AS "customersWithOrders"
    FROM "Customer" c
    LEFT JOIN "Opportunity" o ON o."customerId" = c.id
    LEFT JOIN "SalesOrder" so ON so."opportunityId" = o.id
      AND so.status = 'ACTIVE'
      ${acceptedAtSql(range, Prisma.sql`so."acceptedAt"`)}
      ${brandSql(brand, Prisma.sql`so."brand"`)}
    WHERE c."archivedAt" IS NULL
    GROUP BY 1
    ORDER BY 2 DESC
  `);

  return rows.map((row) => ({
    label: row.label,
    customers: asNumber(row.customers),
    orders: asNumber(row.orders),
    revenue: asNumber(row.revenue),
    customersWithOrders: asNumber(row.customersWithOrders),
  }));
}

/** Sebaran customer: kota, sumber lead, jenis, siklus hidup, repeat, dan top customer. */
export async function getAiCustomers(input: {
  brand: AiBrandScope;
  range: ResolvedRange;
}): Promise<AiCustomersResult> {
  const prisma = getPrismaClient();
  const { brand, range } = input;

  const repeatSql = Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE order_count > 1)::int AS repeat,
      COUNT(*) FILTER (WHERE order_count = 1)::int AS first_time
    FROM (
      SELECT o."customerId" AS customer_id, COUNT(*)::int AS order_count
      FROM "SalesOrder" so
      INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
      WHERE so.status = 'ACTIVE'
      ${acceptedAtSql(range, Prisma.sql`so."acceptedAt"`)}
      ${brandSql(brand, Prisma.sql`so."brand"`)}
      GROUP BY 1
    ) per_customer
  `;

  const topSql = Prisma.sql`
    SELECT
      MAX(c."customerNo") AS "customerNo",
      MAX(so."snapshotCustomerName") AS name,
      MAX(c.city) AS city,
      COUNT(*)::int AS orders,
      COALESCE(SUM(so.total), 0)::text AS revenue,
      MAX(so."acceptedAt") AS "lastOrderAt"
    FROM "SalesOrder" so
    INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
    LEFT JOIN "Customer" c ON c.id = o."customerId"
    WHERE so.status = 'ACTIVE'
    ${acceptedAtSql(range, Prisma.sql`so."acceptedAt"`)}
    ${brandSql(brand, Prisma.sql`so."brand"`)}
    GROUP BY o."customerId"
    ORDER BY 5 DESC
    LIMIT 10
  `;

  const [byCity, byLeadSource, byCustomerType, lifecycle, repeatRows, topRows, quality] = await Promise.all([
    customerGroup("city", brand, range),
    customerGroup("source", brand, range),
    customerGroup("type", brand, range),
    lifecycleGroups(brand, range),
    prisma.$queryRaw<Array<{ repeat: number; first_time: number }>>(repeatSql),
    prisma.$queryRaw<Array<{ customerNo: string | null; name: string | null; city: string | null; orders: number; revenue: string; lastOrderAt: Date | null }>>(topSql),
    getAiQuality(brand),
  ]);

  const repeat = asNumber(repeatRows[0]?.repeat);
  const firstTime = asNumber(repeatRows[0]?.first_time);

  return {
    meta: meta(brand, range),
    byCity,
    byLeadSource,
    byCustomerType,
    lifecycle,
    repeat: {
      repeatCustomers: repeat,
      firstTimeCustomers: firstTime,
      repeatRatePercent: percent(repeat, repeat + firstTime),
    },
    topCustomers: topRows.map((row) => ({
      customerCode: row.customerNo ?? "",
      nameMasked: maskName(row.name),
      city: row.city,
      orders: asNumber(row.orders),
      revenue: asNumber(row.revenue),
      lastOrderAt: row.lastOrderAt ? new Date(row.lastOrderAt).toISOString().slice(0, 10) : null,
    })),
    quality,
  };
}

/** Nama customer disamarkan: dua kata pertama disingkat inisialnya. */
function maskName(name: string | null) {
  if (!name) return "Tanpa nama";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Tanpa nama";
  const first = words[0]!;
  const head = first.length <= 3 ? first : `${first.slice(0, 3)}***`;
  return words.length > 1 ? `${head} ${words[1]![0]}.` : head;
}

/** Tren omzet/pesanan per hari, minggu, atau bulan. */
export async function getAiTimeseries(input: {
  brand: AiBrandScope;
  range: ResolvedRange;
  granularity: "day" | "week" | "month";
}): Promise<AiTimeseriesResult> {
  const prisma = getPrismaClient();
  const { brand, range, granularity } = input;

  const rows = await prisma.$queryRaw<Array<{ bucket: Date | string; revenue: string; orders: number; pcs: number }>>(Prisma.sql`
    SELECT
      date_trunc(${granularity}, so."acceptedAt" AT TIME ZONE 'Asia/Jakarta') AS bucket,
      COALESCE(SUM(so.total), 0)::text AS revenue,
      COUNT(DISTINCT so.id)::int AS orders,
      COALESCE(SUM(items.pcs), 0)::int AS pcs
    FROM "SalesOrder" so
    LEFT JOIN (
      SELECT "salesOrderId", SUM(quantity)::int AS pcs
      FROM "SalesOrderItem" GROUP BY "salesOrderId"
    ) items ON items."salesOrderId" = so.id
    WHERE so.status = 'ACTIVE'
    ${acceptedAtSql(range, Prisma.sql`so."acceptedAt"`)}
    ${brandSql(brand, Prisma.sql`so."brand"`)}
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  return {
    meta: meta(brand, range),
    granularity,
    points: rows.map((row) => {
      const date = row.bucket instanceof Date ? row.bucket : new Date(String(row.bucket));
      const bucket =
        granularity === "month"
          ? date.toISOString().slice(0, 7)
          : date.toISOString().slice(0, 10);
      return { bucket, revenue: asNumber(row.revenue), orders: asNumber(row.orders), pcs: asNumber(row.pcs) };
    }),
  };
}

/** Kondisi pipeline: jumlah peluang per tahap, win rate, dan nilai yang masih terbuka. */
export async function getAiPipeline(input: {
  brand: AiBrandScope;
  range: ResolvedRange;
}): Promise<AiPipelineResult> {
  const prisma = getPrismaClient();
  const { brand, range } = input;

  const stageRows = await prisma.$queryRaw<Array<{ stage: string; count: number; value: string }>>(Prisma.sql`
    SELECT
      o.stage::text AS stage,
      COUNT(*)::int AS count,
      COALESCE(SUM(open_invoice.value), 0)::text AS value
    FROM "Opportunity" o
    LEFT JOIN LATERAL (
      SELECT SUM(i.total) AS value
      FROM "Invoice" i
      WHERE i."opportunityId" = o.id AND i.status IN ('DRAFT', 'ISSUED')
    ) open_invoice ON TRUE
    WHERE 1 = 1
    ${brandSql(brand, Prisma.sql`o."brand"`)}
    ${range.start && range.end ? Prisma.sql`AND o."createdAt" >= ${range.start} AND o."createdAt" < ${range.end}` : Prisma.empty}
    GROUP BY 1
    ORDER BY 2 DESC
  `);

  const [receivable, staleFollowUps] = await Promise.all([
    // Sisa tagihan yang benar: outstandingAmount pada jadwal pembayaran Sales Order aktif,
    // bukan total invoice terbit (invoice tetap ISSUED walau sudah dibayar).
    prisma.$queryRaw<Array<{ value: string }>>(Prisma.sql`
      SELECT COALESCE(SUM(dp."outstandingAmount"), 0)::text AS value
      FROM "DealPayment" dp
      INNER JOIN "SalesOrder" so ON so.id = dp."salesOrderId"
      WHERE so.status = 'ACTIVE'
      ${brandSql(brand, Prisma.sql`so."brand"`)}
    `),
    prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM "Opportunity" o
      WHERE o.stage IN ('LEAD_BARU', 'FOLLOW_UP', 'NEGOSIASI')
        AND (o."nextActionAt" IS NULL OR o."nextActionAt" < NOW())
      ${brandSql(brand, Prisma.sql`o."brand"`)}
    `),
  ]);

  const stages = stageRows.map((row) => ({
    stage: row.stage,
    label: STAGE_LABEL[row.stage] ?? row.stage,
    count: asNumber(row.count),
    value: asNumber(row.value),
  }));
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);
  const deals = stages.find((stage) => stage.stage === "DEAL")?.count ?? 0;
  const lost = stages.find((stage) => stage.stage === "LOST")?.count ?? 0;

  return {
    meta: meta(brand, range),
    stages,
    totals: {
      leads: total,
      deals,
      lost,
      winRatePercent: percent(deals, total),
      openValue: stages
        .filter((stage) => stage.stage !== "DEAL" && stage.stage !== "LOST")
        .reduce((sum, stage) => sum + stage.value, 0),
      outstandingReceivableValue: asNumber(receivable[0]?.value),
    },
    staleFollowUps: asNumber(staleFollowUps[0]?.count),
  };
}

/** Kelengkapan data yang membatasi kualitas analisis (mis. kota belum diisi). */
export async function getAiQuality(brand: AiBrandScope): Promise<AiQuality> {
  const prisma = getPrismaClient();

  const customerSql = Prisma.sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE NULLIF(BTRIM(c.city), '') IS NOT NULL)::int AS "withCity"
    FROM "Customer" c
    WHERE c."archivedAt" IS NULL
    ${brand === "ALL" ? Prisma.empty : Prisma.sql`AND c."brandScope"::text IN (${brand}, 'BOTH')`}
  `;

  const opportunitySql = Prisma.sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE o."leadSourceId" IS NOT NULL)::int AS "withLeadSource"
    FROM "Opportunity" o
    WHERE 1 = 1
    ${brandSql(brand, Prisma.sql`o."brand"`)}
  `;

  const [customerRows, opportunityRows] = await Promise.all([
    prisma.$queryRaw<Array<{ total: number; withCity: number }>>(customerSql),
    prisma.$queryRaw<Array<{ total: number; withLeadSource: number }>>(opportunitySql),
  ]);

  const customersTotal = asNumber(customerRows[0]?.total);
  const withCity = asNumber(customerRows[0]?.withCity);
  const opportunitiesTotal = asNumber(opportunityRows[0]?.total);
  const withLeadSource = asNumber(opportunityRows[0]?.withLeadSource);
  const cityFillRatePercent = percent(withCity, customersTotal);
  const sourceFillRatePercent = percent(withLeadSource, opportunitiesTotal);

  const warnings: string[] = [];
  if (customersTotal > 0 && cityFillRatePercent < 60) {
    warnings.push(
      `Kota customer hanya terisi ${cityFillRatePercent}% (${withCity} dari ${customersTotal}). Sebaran kota tidak bisa dianggap mewakili seluruh pelanggan; sebutkan keterbatasan ini saat menjawab.`,
    );
  }
  if (opportunitiesTotal > 0 && sourceFillRatePercent < 60) {
    warnings.push(
      `Sumber lead hanya terisi ${sourceFillRatePercent}% (${withLeadSource} dari ${opportunitiesTotal}). Analisis kanal akuisisi belum bisa disimpulkan dari data ini.`,
    );
  }

  return {
    customers: { total: customersTotal, withCity, cityFillRatePercent },
    opportunities: { total: opportunitiesTotal, withLeadSource, sourceFillRatePercent },
    warnings,
  };
}

/** Ringkasan semua metrik inti dalam satu panggilan (dipakai tool MCP pertama). */
export async function getAiSnapshot(input: {
  brand: AiBrandScope;
  range: ResolvedRange;
}) {
  const [overview, products, customers, pipeline] = await Promise.all([
    getAiOverview(input),
    getAiProducts({ ...input, limit: 8 }),
    getAiCustomers(input),
    getAiPipeline(input),
  ]);

  return {
    meta: overview.meta,
    overview,
    products,
    customers,
    pipeline,
  };
}
