import "server-only";

import { unstable_cache } from "next/cache";
import { Prisma, type AppRole, type OpportunityStage } from "@prisma/client";
import { cache } from "react";

import {
  parseAnalyticsDateRange,
  parseAnalyticsReportMode,
  type AnalyticsReportMode,
} from "@/lib/analytics/report-period";
import { calculateConversionRate } from "@/lib/analytics/conversion-rate";
import {
  finalizeSalesPerformanceRows,
  type SalesPerformanceRow,
} from "@/lib/analytics/sales-performance";
import { ANALYTICS_ROLES, CRM_ROLES, DEAL_ROLES, FINANCE_ROLES, MASTER_DATA_ROLES, USER_ADMIN_ROLES, hasRole } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { OPEN_STAGES } from "@/lib/crm/constants";
import type { CustomerExcelExportRow } from "@/lib/crm/customer-excel";
import { getPrismaClient } from "@/lib/prisma";

export type PipelineOpportunity = {
  id: string;
  opportunityNo: string;
  title: string;
  stage: OpportunityStage;
  version: number;
  productName: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  cancelReason: string | null;
  updatedAt: string;
  customer: {
    id: string;
    customerNo: string;
    name: string;
    companyName: string | null;
  };
  activityCount: number;
  salesPic: { id: string; name: string } | null;
  purchaseOrder: {
    id: string;
    purchaseOrderNo: string;
    status: "DRAFT" | "AGREED" | "SUPERSEDED";
    productName: string;
    garmentType: "JERSEY" | "NON_JERSEY" | null;
    totalQuantity: number;
  } | null;
  invoice: {
    id: string;
    invoiceNo: string;
    purchaseOrderId: string;
    status: "DRAFT" | "ISSUED" | "SUPERSEDED";
    version: number;
    total: string;
    pendingPayment: { kind: "LUNAS" | "DP"; initialDueAt: string } | null;
  } | null;
  salesOrder: {
    id: string;
    salesOrderNo: string;
    paymentKind: "LUNAS" | "DP" | null;
  } | null;
};

const opportunitySummarySelect = {
  id: true,
  opportunityNo: true,
  title: true,
  stage: true,
  version: true,
  productName: true,
  nextAction: true,
  nextActionAt: true,
  cancelReason: true,
  updatedAt: true,
  customer: {
    select: {
      id: true,
      customerNo: true,
      name: true,
      companyName: true,
    },
  },
  salesPic: { select: { id: true, name: true } },
  purchaseOrders: {
    select: {
      id: true,
      purchaseOrderNo: true,
      status: true,
      productName: true,
      garmentType: true,
      sizes: { select: { quantity: true } },
    },
    orderBy: { revision: "desc" },
    take: 1,
  },
  invoices: {
    select: { id: true, invoiceNo: true, purchaseOrderId: true, status: true, version: true, total: true, pendingPayment: { select: { kind: true, initialDueAt: true } } },
    orderBy: { revision: "desc" },
    take: 1,
  },
  salesOrders: {
    where: { status: "ACTIVE" },
    select: { id: true, salesOrderNo: true, payment: { select: { kind: true } } },
    take: 1,
  },
  _count: { select: { communicationActivities: true } },
} satisfies Prisma.OpportunitySelect;

const getCachedPipelineData = unstable_cache(
  async (actorRole: AppRole) => {
    const prisma = getPrismaClient();
    const [rows, total] = await Promise.all([
      prisma.opportunity.findMany({
        relationLoadStrategy: "join",
        where: { customer: { archivedAt: null } },
        select: opportunitySummarySelect,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 500,
      }),
      prisma.opportunity.count({ where: { customer: { archivedAt: null } } }),
    ]);

    const opportunities: PipelineOpportunity[] = rows.map((row) => ({
    id: row.id,
    opportunityNo: row.opportunityNo,
    title: row.title,
    stage: row.stage,
    version: row.version,
    productName: row.productName,
    nextAction: row.nextAction,
    nextActionAt: row.nextActionAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    updatedAt: row.updatedAt.toISOString(),
    customer: row.customer,
    activityCount: row._count.communicationActivities,
    salesPic: row.salesPic,
    purchaseOrder: row.purchaseOrders[0] ? {
      id: row.purchaseOrders[0].id,
      purchaseOrderNo: row.purchaseOrders[0].purchaseOrderNo,
      status: row.purchaseOrders[0].status,
      productName: row.purchaseOrders[0].productName,
      garmentType: row.purchaseOrders[0].garmentType,
      totalQuantity: row.purchaseOrders[0].sizes.reduce((sum, item) => sum + item.quantity, 0),
    } : null,
    invoice: row.invoices[0] ? { ...row.invoices[0], total: row.invoices[0].total.toString(), pendingPayment: row.invoices[0].pendingPayment ? { ...row.invoices[0].pendingPayment, initialDueAt: row.invoices[0].pendingPayment.initialDueAt.toISOString() } : null } : null,
    salesOrder: row.salesOrders[0] ? {
      id: row.salesOrders[0].id,
      salesOrderNo: row.salesOrders[0].salesOrderNo,
      paymentKind: row.salesOrders[0].payment?.kind ?? null,
    } : null,
  }));

  return { opportunities, total, truncated: total > rows.length, actorRole };
  },
  ["pipeline-data"],
  { tags: ["pipeline-data"], revalidate: 30 },
);

export async function getPipelineData() {
  const actor = await requireActor();
  return getCachedPipelineData(actor.role);
}

const getCachedCustomerOptions = unstable_cache(
  async () => {
    return getPrismaClient().customer.findMany({
      where: { archivedAt: null },
      select: { id: true, customerNo: true, name: true, companyName: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 500,
    });
  },
  ["customer-options"],
  { tags: ["customer-options"], revalidate: 60 },
);

export async function getCustomerOptions() {
  await requireActor();
  return getCachedCustomerOptions();
}

export type CustomerSort = "customerNo" | "name" | "opportunities" | "updatedAt";
export type SortDirection = "asc" | "desc";
export type CustomerSegment = "all" | "repeat" | "inactive" | "archived";

type CustomerListQuery = {
  query: string;
  segment: CustomerSegment;
  sort: CustomerSort;
  direction: SortDirection;
};

function customerWhere(actor: { id: string; role: AppRole }, query: string, segment: CustomerSegment) {
  const normalizedQuery = query.trim().slice(0, 80);
  const reference = new Date();
  const segmentWhere = segment === "archived"
    ? { archivedAt: { not: null } }
    : segment === "repeat"
      ? {
          archivedAt: null,
          opportunities: { none: { stage: { in: OPEN_STAGES } } },
          reminders: {
            some: { type: "REPEAT_ORDER" as const, resolvedAt: null, dueAt: { lte: reference } },
          },
          AND: [{
            reminders: {
              some: { type: "REACTIVATION" as const, resolvedAt: null, dueAt: { gt: reference } },
            },
          }],
          ...(actor.role === "SALES" ? { salesPicId: actor.id } : {}),
        }
      : segment === "inactive"
        ? {
            archivedAt: null,
            opportunities: { none: { stage: { in: OPEN_STAGES } } },
            reminders: {
              some: { type: "REACTIVATION" as const, resolvedAt: null, dueAt: { lte: reference } },
            },
            ...(actor.role === "SALES" ? { salesPicId: actor.id } : {}),
          }
        : { archivedAt: null };

  return {
    ...segmentWhere,
    ...(normalizedQuery
      ? {
          OR: [
            { name: { contains: normalizedQuery, mode: "insensitive" as const } },
            { companyName: { contains: normalizedQuery, mode: "insensitive" as const } },
            { customerNo: { contains: normalizedQuery, mode: "insensitive" as const } },
            { whatsapp: { contains: normalizedQuery, mode: "insensitive" as const } },
            { email: { contains: normalizedQuery, mode: "insensitive" as const } },
            { instagram: { contains: normalizedQuery, mode: "insensitive" as const } },
            { city: { contains: normalizedQuery, mode: "insensitive" as const } },
            { customerType: { name: { contains: normalizedQuery, mode: "insensitive" as const } } },
            { leadSource: { name: { contains: normalizedQuery, mode: "insensitive" as const } } },
            { salesPic: { name: { contains: normalizedQuery, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  } satisfies Prisma.CustomerWhereInput;
}

function customerOrderBy(sort: CustomerSort, direction: SortDirection) {
  return (
    sort === "opportunities"
      ? [{ opportunities: { _count: direction } }, { id: "asc" as const }]
      : [{ [sort]: direction }, { id: "asc" as const }]
  ) satisfies Prisma.CustomerOrderByWithRelationInput[];
}

export async function getCustomers({
  query,
  segment,
  page,
  pageSize,
  sort,
  direction,
}: {
  query: string;
  segment: CustomerSegment;
  page: number;
  pageSize: number;
  sort: CustomerSort;
  direction: SortDirection;
}) {
  const actor = await requireActor();
  const where = customerWhere(actor, query, segment);
  const prisma = getPrismaClient();
  const orderBy = customerOrderBy(sort, direction);

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        customerNo: true,
        version: true,
        name: true,
        companyName: true,
        whatsapp: true,
        email: true,
        instagram: true,
        address: true,
        city: true,
        notes: true,
        customerTypeId: true,
        leadSourceId: true,
        salesPicId: true,
        customerType: { select: { name: true } },
        leadSource: { select: { name: true } },
        salesPic: { select: { id: true, name: true, isActive: true } },
        archivedAt: true,
        updatedAt: true,
        _count: { select: { opportunities: true } },
        opportunities: {
          select: { updatedAt: true, stage: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
        reminders: {
          where: { resolvedAt: null },
          select: {
            type: true,
            dueAt: true,
            sourceSalesOrder: {
              select: { id: true, salesOrderNo: true, acceptedAt: true },
            },
          },
          orderBy: { dueAt: "asc" },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);
  const customerIds = items.map((item) => item.id);
  const openOpportunities = customerIds.length
    ? await prisma.opportunity.findMany({
        where: { customerId: { in: customerIds }, stage: { in: OPEN_STAGES } },
        select: { customerId: true },
        distinct: ["customerId"],
      })
    : [];
  const openCustomerIds = new Set(openOpportunities.map((item) => item.customerId));
  return {
    items: items.map((item) => ({ ...item, hasOpenOpportunity: openCustomerIds.has(item.id) })),
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getCustomersForExport({
  query,
  segment,
  sort,
  direction,
}: CustomerListQuery): Promise<CustomerExcelExportRow[]> {
  const actor = await requireActor(MASTER_DATA_ROLES);
  const items = await getPrismaClient().customer.findMany({
    where: customerWhere(actor, query, segment),
    select: {
      customerNo: true,
      name: true,
      companyName: true,
      whatsapp: true,
      email: true,
      instagram: true,
      address: true,
      city: true,
      notes: true,
      customerType: { select: { name: true } },
      leadSource: { select: { name: true } },
      salesPic: { select: { name: true } },
      archivedAt: true,
    },
    orderBy: customerOrderBy(sort, direction),
  });

  return items.map((item) => ({
    customerNo: item.customerNo,
    name: item.name,
    companyName: item.companyName ?? "",
    customerTypeName: item.customerType.name,
    leadSourceName: item.leadSource?.name ?? "",
    salesPicName: item.salesPic?.name ?? "",
    whatsapp: item.whatsapp ?? "",
    email: item.email ?? "",
    instagram: item.instagram ?? "",
    city: item.city ?? "",
    address: item.address ?? "",
    notes: item.notes ?? "",
    archivedAt: item.archivedAt,
  }));
}

export async function getCustomerPopupDetail(customerId: string) {
  await requireActor(CRM_ROLES);
  return getPrismaClient().customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      customerNo: true,
      name: true,
      companyName: true,
      whatsapp: true,
      email: true,
      instagram: true,
      address: true,
      city: true,
      notes: true,
      customerType: { select: { name: true } },
      leadSource: { select: { name: true } },
      salesPic: { select: { name: true } },
      archivedAt: true,
      updatedAt: true,
      _count: { select: { opportunities: true } },
      opportunities: {
        select: {
          id: true,
          opportunityNo: true,
          title: true,
          stage: true,
          updatedAt: true,
          salesOrders: {
            select: {
              id: true,
              salesOrderNo: true,
              total: true,
              status: true,
              acceptedAt: true,
            },
            orderBy: { acceptedAt: "desc" },
            take: 3,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
      },
      reminders: {
        where: { resolvedAt: null },
        select: {
          id: true,
          type: true,
          dueAt: true,
          sourceSalesOrder: {
            select: { id: true, salesOrderNo: true, acceptedAt: true, total: true },
          },
        },
        orderBy: { dueAt: "asc" },
      },
    },
  });
}

export async function getCustomerDetail(customerId: string) {
  await requireActor();
  return getPrismaClient().customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      customerNo: true,
      name: true,
      companyName: true,
      whatsapp: true,
      email: true,
      instagram: true,
      address: true,
      city: true,
      notes: true,
      customerTypeId: true,
      leadSourceId: true,
      salesPicId: true,
      customerType: { select: { id: true, name: true } },
      leadSource: { select: { id: true, name: true } },
      salesPic: { select: { id: true, name: true, isActive: true } },
      archivedAt: true,
      version: true,
      updatedAt: true,
      opportunities: {
        select: {
          id: true,
          opportunityNo: true,
          title: true,
          stage: true,
          updatedAt: true,
          salesOrders: {
            select: {
              id: true,
              salesOrderNo: true,
              total: true,
              status: true,
              acceptedAt: true,
              items: {
                select: { id: true, size: true, description: true, quantity: true, position: true },
                orderBy: { position: "asc" },
              },
            },
            orderBy: { acceptedAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
      reminders: {
        where: { resolvedAt: null },
        select: {
          id: true,
          type: true,
          dueAt: true,
          sourceSalesOrder: {
            select: { id: true, salesOrderNo: true, acceptedAt: true, total: true },
          },
        },
        orderBy: { dueAt: "asc" },
      },
    },
  });
}

export const getOpportunityDetail = cache(async function getOpportunityDetail(opportunityId: string) {
  await requireActor();
  return getPrismaClient().opportunity.findUnique({
    relationLoadStrategy: "join",
    where: { id: opportunityId },
    select: {
      id: true,
      opportunityNo: true,
      title: true,
      stage: true,
      leadSourceId: true,
      salesPicId: true,
      productName: true,
      garmentType: true,
      needPurpose: true,
      specification: true,
      lastContactedAt: true,
      nextAction: true,
      nextActionAt: true,
      cancelReason: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          customerNo: true,
          name: true,
          companyName: true,
          whatsapp: true,
          email: true,
          instagram: true,
          address: true,
          archivedAt: true,
        },
      },
      leadSource: { select: { id: true, name: true } },
      salesPic: { select: { id: true, name: true, isActive: true } },
      purchaseOrders: {
        select: {
          id: true,
          purchaseOrderNo: true,
          customerReference: true,
          revision: true,
          status: true,
          garmentType: true,
          productName: true,
          material: true,
          color: true,
          baseColor: true,
          variationColor: true,
          decorationMethod: true,
          orderDate: true,
          sampleSize: true,
          designNotes: true,
          notes: true,
          deadline: true,
          agreedAt: true,
          version: true,
          createdAt: true,
          createdBy: { select: { name: true } },
          sizes: { select: { id: true, position: true, sizeId: true, size: true, sleeveLength: true, quantity: true }, orderBy: { position: "asc" } },
          rosterEntries: { select: { id: true, position: true, memberId: true, name: true, sizeId: true, size: true }, orderBy: { position: "asc" } },
          attachments: { select: { id: true, originalName: true, contentType: true, sizeBytes: true, kind: true, caption: true }, orderBy: { createdAt: "asc" } },
          designTask: { select: { deadline: true } },
        },
        orderBy: { revision: "desc" },
      },
      invoices: {
        select: {
          id: true,
          invoiceNo: true,
          revision: true,
          status: true,
          discountType: true,
          discountValue: true,
          subtotal: true,
          totalDiscount: true,
          totalTax: true,
          total: true,
          issuedAt: true,
          dueAt: true,
          notes: true,
          purchaseOrderId: true,
          version: true,
          createdAt: true,
          items: {
            select: {
              id: true, position: true, productName: true, size: true, sleeveLength: true, description: true, quantity: true,
              unitPrice: true, grossAmount: true, discountPercent: true, discountCapAmount: true,
              discountAmount: true, taxRate: true, taxAmount: true, total: true, subtotal: true,
            },
            orderBy: { position: "asc" },
          },
          salesOrder: { select: { id: true, salesOrderNo: true, status: true } },
        },
        orderBy: { revision: "desc" },
      },
      salesOrders: {
        select: {
          id: true,
          salesOrderNo: true,
          status: true,
          total: true,
          createdAt: true,
          cancelReason: true,
          payment: { select: { kind: true, initialAmount: true, outstandingAmount: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
});

export const COMMUNICATION_PAGE_SIZE = 25;

const communicationActivitySelect = {
  id: true,
  kind: true,
  channel: true,
  direction: true,
  systemEvent: true,
  content: true,
  metadata: true,
  occurredAt: true,
  createdAt: true,
  author: { select: { name: true, role: true } },
  opportunity: { select: { id: true, opportunityNo: true, title: true } },
} satisfies Prisma.CommunicationActivitySelect;

export type CommunicationTimelineItem = Prisma.CommunicationActivityGetPayload<{
  select: typeof communicationActivitySelect;
}>;

export async function getCommunicationTimeline({
  customerId,
  opportunityId,
  page,
}: {
  customerId?: string;
  opportunityId?: string;
  page: number;
}) {
  await requireActor();
  if (!customerId && !opportunityId) throw new Error("Timeline membutuhkan customer atau peluang.");
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const where = {
    ...(customerId ? { customerId } : {}),
    ...(opportunityId ? { opportunityId } : {}),
  } satisfies Prisma.CommunicationActivityWhereInput;
  const prisma = getPrismaClient();
  const [items, total] = await Promise.all([
    prisma.communicationActivity.findMany({
      where,
      select: communicationActivitySelect,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      skip: (safePage - 1) * COMMUNICATION_PAGE_SIZE,
      take: COMMUNICATION_PAGE_SIZE,
    }),
    prisma.communicationActivity.count({ where }),
  ]);

  return {
    items,
    total,
    page: safePage,
    pageCount: Math.max(1, Math.ceil(total / COMMUNICATION_PAGE_SIZE)),
  };
}

type FollowUpBucket = "overdue" | "today" | "tomorrow" | "upcoming";

function jakartaDayBounds(reference = new Date()) {
  const shifted = new Date(reference.getTime() + 7 * 60 * 60 * 1000);
  const start = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 7 * 60 * 60 * 1000);
  const tomorrow = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterTomorrow = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
  return { start, tomorrow, dayAfterTomorrow };
}

export async function getFollowUpData({ bucket, picId }: { bucket: FollowUpBucket; picId?: string }) {
  const actor = await requireActor();
  const { start, tomorrow, dayAfterTomorrow } = jakartaDayBounds();
  const timeWhere = bucket === "overdue"
    ? { lt: start }
    : bucket === "today"
      ? { gte: start, lt: tomorrow }
      : bucket === "tomorrow"
        ? { gte: tomorrow, lt: dayAfterTomorrow }
        : { gte: dayAfterTomorrow };
  const selectedPicId = picId === "all" ? undefined : picId || (actor.role === "SALES" ? actor.id : undefined);
  const baseWhere = {
    stage: { in: ["LEAD_BARU", "FOLLOW_UP", "NEGOSIASI"] as OpportunityStage[] },
    nextActionAt: { not: null },
    customer: { archivedAt: null },
    ...(selectedPicId ? { salesPicId: selectedPicId } : {}),
  } satisfies Prisma.OpportunityWhereInput;
  const prisma = getPrismaClient();
  const [items, overdue, today, tomorrowCount, upcoming, salesUsers] = await Promise.all([
    prisma.opportunity.findMany({
      where: { ...baseWhere, nextActionAt: timeWhere },
      select: {
        id: true,
        opportunityNo: true,
        title: true,
        stage: true,
        version: true,
        nextAction: true,
        nextActionAt: true,
        lastContactedAt: true,
        cancelReason: true,
        customer: { select: { name: true, companyName: true, whatsapp: true } },
        salesPic: { select: { id: true, name: true } },
      },
      orderBy: [{ nextActionAt: "asc" }, { id: "asc" }],
      take: 200,
    }),
    prisma.opportunity.count({ where: { ...baseWhere, nextActionAt: { lt: start } } }),
    prisma.opportunity.count({ where: { ...baseWhere, nextActionAt: { gte: start, lt: tomorrow } } }),
    prisma.opportunity.count({ where: { ...baseWhere, nextActionAt: { gte: tomorrow, lt: dayAfterTomorrow } } }),
    prisma.opportunity.count({ where: { ...baseWhere, nextActionAt: { gte: dayAfterTomorrow } } }),
    prisma.appUser.findMany({ where: { role: "SALES", isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { items, counts: { overdue, today, tomorrow: tomorrowCount, upcoming }, salesUsers, selectedPicId };
}

async function countFollowUpBadge(actorId: string, actorRole: string) {
  const { tomorrow } = jakartaDayBounds();
  return getPrismaClient().opportunity.count({
    where: {
      stage: { in: ["LEAD_BARU", "FOLLOW_UP", "NEGOSIASI"] },
      nextActionAt: { lt: tomorrow },
      customer: { archivedAt: null },
      ...(actorRole === "SALES" ? { salesPicId: actorId } : {}),
    },
  });
}

export async function getFollowUpBadgeCount() {
  const actor = await requireActor();
  const cached = unstable_cache(
    () => countFollowUpBadge(actor.id, actor.role),
    ["follow-up-badge", actor.id, actor.role],
    { tags: ["badge-counts"], revalidate: 30 },
  );
  return cached();
}

export async function getSalesDashboardData() {
  const actor = await requireActor();
  const prisma = getPrismaClient();
  const documentPreviewLimit = 5;
  const { start, tomorrow } = jakartaDayBounds();
  const shifted = new Date(start.getTime() + 7 * 60 * 60 * 1000);
  const monthStart = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - 7 * 60 * 60 * 1000);
  const nextMonth = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1) - 7 * 60 * 60 * 1000);
  const openStages: OpportunityStage[] = ["LEAD_BARU", "FOLLOW_UP", "NEGOSIASI"];
  const [
    stageGroups,
    dealRevenue,
    overdue,
    dueToday,
    urgentActions,
    latestPurchaseOrders,
    latestInvoices,
    monthMoneyIn,
    activeOutstanding,
  ] = await Promise.all([
    prisma.opportunity.groupBy({ by: ["stage"], where: { customer: { archivedAt: null } }, orderBy: { stage: "asc" }, _count: true }),
    prisma.salesOrder.aggregate({ where: { status: "ACTIVE", acceptedAt: { gte: monthStart, lt: nextMonth } }, _sum: { total: true } }),
    prisma.opportunity.count({ where: { stage: { in: openStages }, nextActionAt: { lt: start }, customer: { archivedAt: null } } }),
    prisma.opportunity.count({ where: { stage: { in: openStages }, nextActionAt: { gte: start, lt: tomorrow }, customer: { archivedAt: null } } }),
    prisma.opportunity.findMany({
      where: { stage: { in: openStages }, nextActionAt: { not: null }, customer: { archivedAt: null } },
      select: { id: true, title: true, nextAction: true, nextActionAt: true, customer: { select: { name: true } } },
      orderBy: { nextActionAt: "asc" },
      take: 5,
    }),
    prisma.purchaseOrder.findMany({
      select: {
        id: true,
        opportunityId: true,
        purchaseOrderNo: true,
        productName: true,
        status: true,
        deadline: true,
        createdAt: true,
        opportunity: {
          select: {
            customer: { select: { name: true, companyName: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: documentPreviewLimit,
    }),
    prisma.invoice.findMany({
      select: {
        id: true,
        opportunityId: true,
        invoiceNo: true,
        snapshotCustomerName: true,
        snapshotCompanyName: true,
        status: true,
        total: true,
        dueAt: true,
        createdAt: true,
        purchaseOrder: { select: { purchaseOrderNo: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: documentPreviewLimit,
    }),
    hasRole(actor.role, FINANCE_ROLES)
      ? prisma.paymentTransaction.aggregate({
          where: {
            status: "ACTIVE",
            paidAt: { gte: monthStart, lt: nextMonth },
            payment: { salesOrder: { status: "ACTIVE" } },
          },
          _sum: { amount: true },
          _count: true,
        })
      : null,
    hasRole(actor.role, FINANCE_ROLES)
      ? prisma.dealPayment.aggregate({
          where: { salesOrder: { status: "ACTIVE" }, outstandingAmount: { gt: 0 } },
          _sum: { outstandingAmount: true },
          _count: true,
        })
      : null,
  ]);
  const stageCounts = Object.fromEntries(
    stageGroups.map((group) => [group.stage, group._count]),
  ) as Partial<Record<OpportunityStage, number>>;
  const totalLeadCount = Object.values(stageCounts).reduce(
    (total, count) => total + count,
    0,
  );
  const dealCount = stageCounts.DEAL ?? 0;

  return {
    stageCounts,
    totalLeadCount,
    dealCount,
    conversionRate: calculateConversionRate(dealCount, totalLeadCount),
    dealRevenue: dealRevenue._sum.total?.toString() ?? "0",
    overdue,
    dueToday,
    urgentActions,
    latestPurchaseOrders: latestPurchaseOrders.map((item) => ({
      id: item.id,
      opportunityId: item.opportunityId,
      purchaseOrderNo: item.purchaseOrderNo,
      customerName: item.opportunity.customer.companyName ?? item.opportunity.customer.name,
      productName: item.productName,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      deadline: item.deadline?.toISOString() ?? null,
    })),
    latestInvoices: latestInvoices.map((item) => ({
      id: item.id,
      opportunityId: item.opportunityId,
      invoiceNo: item.invoiceNo,
      purchaseOrderNo: item.purchaseOrder.purchaseOrderNo,
      customerName: item.snapshotCompanyName ?? item.snapshotCustomerName,
      status: item.status,
      total: item.total.toString(),
      createdAt: item.createdAt.toISOString(),
      dueAt: item.dueAt?.toISOString() ?? null,
    })),
    financeSummary: monthMoneyIn && activeOutstanding
      ? {
          moneyInThisMonth: monthMoneyIn._sum.amount?.toString() ?? "0",
          transactionCountThisMonth: monthMoneyIn._count,
          outstandingAmount: activeOutstanding._sum.outstandingAmount?.toString() ?? "0",
          outstandingOrderCount: activeOutstanding._count,
        }
      : null,
  };
}

type LeadSourceRevenueQueryRow = {
  sourceId: string | null;
  sourceName: string;
  leadCount: number;
  dealCount: number;
  revenue: string;
};

type AnalyticsReportParams = {
  mode?: string | string[];
  from?: string | string[];
  to?: string | string[];
};

function parseAnalyticsReportParams(params: AnalyticsReportParams) {
  const mode = parseAnalyticsReportMode(params.mode);
  const range = parseAnalyticsDateRange(params.from, params.to);

  return {
    mode,
    range,
    start: mode === "range" ? range.start : null,
    end: mode === "range" ? range.end : null,
  };
}

function analyticsReportLabel(mode: AnalyticsReportMode, label: string) {
  return mode === "all" ? "Seluruh waktu" : label;
}

export async function getLeadSourceRevenueData(params: AnalyticsReportParams) {
  await requireActor(ANALYTICS_ROLES);
  const report = parseAnalyticsReportParams(params);
  const leadDateCondition = report.start && report.end
    ? Prisma.sql`WHERE o."createdAt" >= ${report.start} AND o."createdAt" < ${report.end}`
    : Prisma.empty;
  const orderDateCondition = report.start && report.end
    ? Prisma.sql`AND so."acceptedAt" >= ${report.start} AND so."acceptedAt" < ${report.end}`
    : Prisma.empty;

  const rows = await getPrismaClient().$queryRaw<LeadSourceRevenueQueryRow[]>(Prisma.sql`
    WITH lead_totals AS (
      SELECT
        o."leadSourceId",
        COUNT(*)::int AS "leadCount"
      FROM "Opportunity" o
      ${leadDateCondition}
      GROUP BY o."leadSourceId"
    ),
    deal_totals AS (
      SELECT
        o."leadSourceId",
        COUNT(DISTINCT so."opportunityId")::int AS "dealCount",
        COALESCE(SUM(so."total"), 0) AS revenue
      FROM "SalesOrder" so
      INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
      WHERE so."status" = 'ACTIVE'
      ${orderDateCondition}
      GROUP BY o."leadSourceId"
    ),
    source_rows AS (
      SELECT ls.id AS "sourceId", ls.name AS "sourceName"
      FROM "LeadSource" ls
      UNION ALL
      SELECT NULL::text AS "sourceId", 'Belum ditentukan' AS "sourceName"
      WHERE EXISTS (SELECT 1 FROM lead_totals WHERE "leadSourceId" IS NULL)
         OR EXISTS (SELECT 1 FROM deal_totals WHERE "leadSourceId" IS NULL)
    )
    SELECT
      sr."sourceId",
      sr."sourceName",
      COALESCE(lt."leadCount", 0)::int AS "leadCount",
      COALESCE(dt."dealCount", 0)::int AS "dealCount",
      COALESCE(dt.revenue, 0)::text AS revenue
    FROM source_rows sr
    LEFT JOIN lead_totals lt ON lt."leadSourceId" IS NOT DISTINCT FROM sr."sourceId"
    LEFT JOIN deal_totals dt ON dt."leadSourceId" IS NOT DISTINCT FROM sr."sourceId"
    ORDER BY COALESCE(dt.revenue, 0) DESC, COALESCE(lt."leadCount", 0) DESC, sr."sourceName" ASC
  `);

  const totals = rows.reduce(
    (result, row) => ({
      leadCount: result.leadCount + row.leadCount,
      dealCount: result.dealCount + row.dealCount,
      revenue: result.revenue.plus(row.revenue),
    }),
    { leadCount: 0, dealCount: 0, revenue: new Prisma.Decimal(0) },
  );

  return {
    mode: report.mode,
    range: {
      from: report.range.from,
      to: report.range.to,
      label: report.range.label,
    },
    periodLabel: analyticsReportLabel(report.mode, report.range.label),
    rows,
    totals: {
      leadCount: totals.leadCount,
      dealCount: totals.dealCount,
      revenue: totals.revenue.toString(),
    },
  };
}

export async function getSalesPerformanceData(params: AnalyticsReportParams) {
  await requireActor(ANALYTICS_ROLES);
  const report = parseAnalyticsReportParams(params);
  const leadDateCondition = report.start && report.end
    ? Prisma.sql`WHERE o."createdAt" >= ${report.start} AND o."createdAt" < ${report.end}`
    : Prisma.empty;
  const followUpDateCondition = report.start && report.end
    ? Prisma.sql`AND ae."createdAt" >= ${report.start} AND ae."createdAt" < ${report.end}`
    : Prisma.empty;
  const invoiceDateCondition = report.start && report.end
    ? Prisma.sql`AND q."issuedAt" >= ${report.start} AND q."issuedAt" < ${report.end}`
    : Prisma.empty;
  const orderDateCondition = report.start && report.end
    ? Prisma.sql`AND so."acceptedAt" >= ${report.start} AND so."acceptedAt" < ${report.end}`
    : Prisma.empty;

  const rawRows = await getPrismaClient().$queryRaw<SalesPerformanceRow[]>(Prisma.sql`
    WITH lead_totals AS (
      SELECT
        o."salesPicId",
        COUNT(*)::int AS "leadCount"
      FROM "Opportunity" o
      ${leadDateCondition}
      GROUP BY o."salesPicId"
    ),
    follow_up_totals AS (
      SELECT
        o."salesPicId",
        COUNT(*)::int AS "followUpCount"
      FROM "AuditEvent" ae
      INNER JOIN "Opportunity" o
        ON ae."entityType" = 'Opportunity'
       AND ae."entityId" = o.id
      WHERE ae.action = 'FOLLOW_UP_RECORDED'
      ${followUpDateCondition}
      GROUP BY o."salesPicId"
    ),
    invoice_totals AS (
      SELECT
        o."salesPicId",
        COUNT(DISTINCT q."opportunityId")::int AS "invoiceCount"
      FROM "Invoice" q
      INNER JOIN "Opportunity" o ON o.id = q."opportunityId"
      WHERE q."issuedAt" IS NOT NULL
      ${invoiceDateCondition}
      GROUP BY o."salesPicId"
    ),
    deal_totals AS (
      SELECT
        o."salesPicId",
        COUNT(DISTINCT so."opportunityId")::int AS "dealCount",
        COALESCE(SUM(so.total), 0) AS revenue
      FROM "SalesOrder" so
      INNER JOIN "Opportunity" o ON o.id = so."opportunityId"
      WHERE so.status = 'ACTIVE'
      ${orderDateCondition}
      GROUP BY o."salesPicId"
    ),
    sales_rows AS (
      SELECT
        u.id AS "salesId",
        u.name AS "salesName",
        u."isActive"
      FROM "AppUser" u
      WHERE u.role = 'SALES'

      UNION ALL

      SELECT
        NULL::text AS "salesId",
        'Belum ada PIC' AS "salesName",
        NULL::boolean AS "isActive"
      WHERE EXISTS (SELECT 1 FROM lead_totals WHERE "salesPicId" IS NULL)
         OR EXISTS (SELECT 1 FROM follow_up_totals WHERE "salesPicId" IS NULL)
         OR EXISTS (SELECT 1 FROM invoice_totals WHERE "salesPicId" IS NULL)
         OR EXISTS (SELECT 1 FROM deal_totals WHERE "salesPicId" IS NULL)
    )
    SELECT
      sr."salesId",
      sr."salesName",
      sr."isActive",
      COALESCE(lt."leadCount", 0)::int AS "leadCount",
      COALESCE(ft."followUpCount", 0)::int AS "followUpCount",
      COALESCE(qt."invoiceCount", 0)::int AS "invoiceCount",
      COALESCE(dt."dealCount", 0)::int AS "dealCount",
      COALESCE(dt.revenue, 0)::text AS revenue
    FROM sales_rows sr
    LEFT JOIN lead_totals lt
      ON lt."salesPicId" IS NOT DISTINCT FROM sr."salesId"
    LEFT JOIN follow_up_totals ft
      ON ft."salesPicId" IS NOT DISTINCT FROM sr."salesId"
    LEFT JOIN invoice_totals qt
      ON qt."salesPicId" IS NOT DISTINCT FROM sr."salesId"
    LEFT JOIN deal_totals dt
      ON dt."salesPicId" IS NOT DISTINCT FROM sr."salesId"
  `);

  return {
    mode: report.mode,
    range: {
      from: report.range.from,
      to: report.range.to,
      label: report.range.label,
    },
    periodLabel: analyticsReportLabel(report.mode, report.range.label),
    ...finalizeSalesPerformanceRows(rawRows),
  };
}

export async function getSalesOrderDetail(salesOrderId: string) {
  await requireActor();
  return getPrismaClient().salesOrder.findUnique({
    relationLoadStrategy: "join",
    where: { id: salesOrderId },
    select: {
      id: true,
      salesOrderNo: true,
      purchaseOrderNo: true,
      invoiceNo: true,
      status: true,
      snapshotCustomerName: true,
      snapshotCompanyName: true,
      snapshotWhatsapp: true,
      snapshotEmail: true,
      snapshotInstagram: true,
      snapshotAddress: true,
      discountType: true,
      discountValue: true,
      subtotal: true,
      total: true,
      acceptedAt: true,
      createdAt: true,
      cancelledAt: true,
      cancelReason: true,
      opportunity: { select: { id: true, opportunityNo: true, title: true, stage: true } },
      invoice: {
        select: {
          id: true,
          revision: true,
          status: true,
        },
      },
      purchaseOrder: {
        select: {
          id: true,
          revision: true,
          productName: true,
          material: true,
          color: true,
          designNotes: true,
          sizes: { select: { size: true, quantity: true, position: true }, orderBy: { position: "asc" } },
        },
      },
      payment: {
        select: {
          id: true,
          kind: true,
          paidAt: true,
          initialAmount: true,
          outstandingAmount: true,
          terms: {
            select: { id: true, position: true, valueType: true, value: true, amount: true, dueAt: true, transactions: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 } },
            orderBy: { position: "asc" },
          },
          transactions: {
            select: {
              id: true, paymentTermId: true, paymentMethodId: true, amount: true, paidAt: true, reference: true, note: true, status: true, version: true,
              paymentMethod: { select: { name: true } },
              voidedAt: true, voidReason: true, createdBy: { select: { name: true } }, voidedBy: { select: { name: true } },
            },
            orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
          },
        },
      },
      createdBy: { select: { name: true } },
      cancelledBy: { select: { name: true } },
      items: {
        select: {
          id: true, position: true, productName: true, size: true, sleeveLength: true, description: true, quantity: true,
          unitPrice: true, grossAmount: true, discountAmount: true, taxAmount: true, total: true, subtotal: true,
        },
        orderBy: { position: "asc" },
      },
      productionWorkOrder: { select: { id: true, workOrderNo: true, status: true, currentStage: true } },
    },
  });
}

export type PurchaseOrderListStatus = "all" | "DRAFT" | "AGREED" | "SUPERSEDED";
export type InvoiceListStatus = "all" | "DRAFT" | "ISSUED" | "SUPERSEDED";
export type InvoicePaymentStatus = "all" | "PAID" | "UNPAID" | "NO_SALES_ORDER" | "PENDING_DP" | "PENDING_LUNAS" | "UNSCHEDULED";
export type SalesOrderListStatus = "all" | "ACTIVE" | "CANCELLED";
export type PurchaseOrderListSort = "purchaseOrderNo" | "productName" | "customer" | "status" | "createdAt" | "deadline";
export type InvoiceListSort = "invoiceNo" | "customer" | "purchaseOrderNo" | "status" | "total" | "createdAt";
export type SalesOrderListSort = "salesOrderNo" | "customer" | "purchaseOrderNo" | "invoiceNo" | "status" | "total" | "acceptedAt";

function purchaseOrderOrderBy(sort: PurchaseOrderListSort, direction: SortDirection) {
  const primary: Prisma.PurchaseOrderOrderByWithRelationInput = sort === "customer"
    ? { opportunity: { customer: { name: direction } } }
    : sort === "deadline"
      ? { deadline: { sort: direction, nulls: "last" } }
      : { [sort]: direction };
  return [primary, { id: "asc" as const }];
}

function invoiceOrderBy(sort: InvoiceListSort, direction: SortDirection) {
  if (sort === "customer") {
    return [
      { snapshotCompanyName: { sort: direction, nulls: direction === "asc" ? "first" as const : "last" as const } },
      { snapshotCustomerName: direction },
      { id: "asc" as const },
    ] satisfies Prisma.InvoiceOrderByWithRelationInput[];
  }
  const primary: Prisma.InvoiceOrderByWithRelationInput = sort === "purchaseOrderNo"
    ? { purchaseOrder: { purchaseOrderNo: direction } }
    : { [sort]: direction };
  return [primary, { id: "asc" as const }];
}

function invoicePaymentWhere(paymentStatus: InvoicePaymentStatus) {
  if (paymentStatus === "PAID") {
    return {
      salesOrder: {
        is: {
          status: "ACTIVE",
          payment: { is: { outstandingAmount: 0 } },
        },
      },
    } satisfies Prisma.InvoiceWhereInput;
  }

  if (paymentStatus === "UNPAID") {
    return {
      salesOrder: {
        is: {
          status: "ACTIVE",
          payment: { is: { outstandingAmount: { gt: 0 } } },
        },
      },
    } satisfies Prisma.InvoiceWhereInput;
  }

  if (paymentStatus === "NO_SALES_ORDER") {
    return {
      OR: [
        { salesOrder: null },
        { salesOrder: { is: { status: "CANCELLED" } } },
      ],
    } satisfies Prisma.InvoiceWhereInput;
  }

  return {};
}

function salesOrderOrderBy(sort: SalesOrderListSort, direction: SortDirection) {
  const primary: Prisma.SalesOrderOrderByWithRelationInput = sort === "customer"
    ? { snapshotCustomerName: direction }
    : { [sort]: direction };
  return [primary, { id: "asc" as const }];
}

const getCachedPurchaseOrders = unstable_cache(
  async ({
    query,
    status,
    start,
    end,
    page,
    pageSize,
    sort,
    direction,
  }: {
    query: string;
    status: PurchaseOrderListStatus;
    start: Date | null;
    end: Date | null;
    page: number;
    pageSize: number;
    sort: PurchaseOrderListSort;
    direction: SortDirection;
  }) => {
    const normalizedQuery = query.trim().slice(0, 80);
    const where = {
      ...(status === "all" ? {} : { status }),
      ...(start && end ? { createdAt: { gte: start, lt: end } } : {}),
      ...(normalizedQuery ? {
        OR: [
          { productName: { contains: normalizedQuery, mode: "insensitive" as const } },
          { purchaseOrderNo: { contains: normalizedQuery, mode: "insensitive" as const } },
          { customerReference: { contains: normalizedQuery, mode: "insensitive" as const } },
          { opportunity: { customer: { name: { contains: normalizedQuery, mode: "insensitive" as const } } } },
        ],
      } : {}),
    } satisfies Prisma.PurchaseOrderWhereInput;
    const prisma = getPrismaClient();
    const [items, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        select: {
          id: true,
          purchaseOrderNo: true,
          productName: true,
          status: true,
          deadline: true,
          createdAt: true,
          opportunity: { select: { id: true, customer: { select: { name: true } } } },
        },
        orderBy: purchaseOrderOrderBy(sort, direction),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);
    return {
      items,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  },
  ["purchase-orders"],
  { tags: ["purchase-orders"], revalidate: 30 },
);

export async function getPurchaseOrders({
  query,
  status,
  start,
  end,
  page,
  pageSize,
  sort,
  direction,
}: {
  query: string;
  status: PurchaseOrderListStatus;
  start: Date | null;
  end: Date | null;
  page: number;
  pageSize: number;
  sort: PurchaseOrderListSort;
  direction: SortDirection;
}) {
  await requireActor();
  return getCachedPurchaseOrders({ query, status, start, end, page, pageSize, sort, direction });
}

const getCachedInvoices = unstable_cache(
  async ({
    query,
    status,
    paymentStatus,
    start,
    end,
    page,
    pageSize,
    sort,
    direction,
  }: {
    query: string;
    status: InvoiceListStatus;
    paymentStatus: InvoicePaymentStatus;
    start: Date | null;
    end: Date | null;
    page: number;
    pageSize: number;
    sort: InvoiceListSort;
    direction: SortDirection;
  }) => {
    const normalizedQuery = query.trim().slice(0, 80);
    const where = {
      ...(status === "all" ? {} : { status }),
      ...invoicePaymentWhere(paymentStatus),
      ...(start && end ? { createdAt: { gte: start, lt: end } } : {}),
      ...(normalizedQuery ? {
        OR: [
          { invoiceNo: { contains: normalizedQuery, mode: "insensitive" as const } },
          { snapshotCustomerName: { contains: normalizedQuery, mode: "insensitive" as const } },
          { snapshotCompanyName: { contains: normalizedQuery, mode: "insensitive" as const } },
          { purchaseOrder: { purchaseOrderNo: { contains: normalizedQuery, mode: "insensitive" as const } } },
        ],
      } : {}),
    } satisfies Prisma.InvoiceWhereInput;
    const prisma = getPrismaClient();
    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNo: true,
          snapshotCustomerName: true,
          snapshotCompanyName: true,
          status: true,
          total: true,
          createdAt: true,
          opportunityId: true,
          purchaseOrder: { select: { purchaseOrderNo: true } },
          salesOrder: { select: { status: true, payment: { select: { outstandingAmount: true } } } },
          pendingPayment: { select: { kind: true } },
        },
        orderBy: invoiceOrderBy(sort, direction),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        total: item.total.toString(),
        paymentStatus: item.salesOrder?.status === "ACTIVE"
          ? item.salesOrder.payment && item.salesOrder.payment.outstandingAmount.equals(0)
            ? "PAID" as const
            : "UNPAID" as const
          : item.pendingPayment?.kind === "DP"
            ? "PENDING_DP" as const
            : item.pendingPayment?.kind === "LUNAS"
              ? "PENDING_LUNAS" as const
              : "UNSCHEDULED" as const,
      })),
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  },
  ["invoices"],
  { tags: ["invoices"], revalidate: 30 },
);

export async function getInvoices({
  query,
  status,
  paymentStatus,
  start,
  end,
  page,
  pageSize,
  sort,
  direction,
}: {
  query: string;
  status: InvoiceListStatus;
  paymentStatus: InvoicePaymentStatus;
  start: Date | null;
  end: Date | null;
  page: number;
  pageSize: number;
  sort: InvoiceListSort;
  direction: SortDirection;
}) {
  await requireActor();
  return getCachedInvoices({ query, status, paymentStatus, start, end, page, pageSize, sort, direction });
}

const getCachedSalesOrders = unstable_cache(
  async ({ query, status, start, end, page, pageSize, sort, direction }: {
    query: string; status: SalesOrderListStatus; start: Date | null; end: Date | null; page: number; pageSize: number; sort: SalesOrderListSort; direction: SortDirection;
  }) => {
    const normalizedQuery = query.trim().slice(0, 80);
    const where = {
      ...(status === "all" ? {} : { status }),
      ...(start && end ? { acceptedAt: { gte: start, lt: end } } : {}),
      ...(normalizedQuery ? { OR: [
        { salesOrderNo: { contains: normalizedQuery, mode: "insensitive" as const } },
        { purchaseOrderNo: { contains: normalizedQuery, mode: "insensitive" as const } },
        { invoiceNo: { contains: normalizedQuery, mode: "insensitive" as const } },
        { snapshotCustomerName: { contains: normalizedQuery, mode: "insensitive" as const } },
        { snapshotCompanyName: { contains: normalizedQuery, mode: "insensitive" as const } },
      ] } : {}),
    } satisfies Prisma.SalesOrderWhereInput;
    const prisma = getPrismaClient();
    const [items, total] = await Promise.all([
      prisma.salesOrder.findMany({ where, select: { id: true, salesOrderNo: true, purchaseOrderNo: true, invoiceNo: true, snapshotCustomerName: true, snapshotCompanyName: true, status: true, total: true, acceptedAt: true }, orderBy: salesOrderOrderBy(sort, direction), skip: (page - 1) * pageSize, take: pageSize }),
      prisma.salesOrder.count({ where }),
    ]);
    return { items: items.map((item) => ({ ...item, total: item.total.toString() })), total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  },
  ["sales-orders"],
  { tags: ["sales-orders"], revalidate: 30 },
);

export async function getSalesOrders({ query, status, start, end, page, pageSize, sort, direction }: {
  query: string; status: SalesOrderListStatus; start: Date | null; end: Date | null; page: number; pageSize: number; sort: SalesOrderListSort; direction: SortDirection;
}) {
  await requireActor();
  return getCachedSalesOrders({ query, status, start, end, page, pageSize, sort, direction });
}

export async function getSalesOrderDocumentDetail(salesOrderId: string) {
  await requireActor();
  const order = await getPrismaClient().salesOrder.findUnique({
    where: { id: salesOrderId },
    select: { id: true, salesOrderNo: true, purchaseOrderNo: true, invoiceNo: true, status: true, snapshotCustomerName: true, snapshotCompanyName: true, total: true, acceptedAt: true, createdAt: true, cancelledAt: true, cancelReason: true, opportunity: { select: { id: true } }, items: { select: { id: true, productName: true, description: true, size: true, quantity: true, unitPrice: true, total: true }, orderBy: { position: "asc" } } },
  });
  return order ? { ...order, total: order.total.toString(), items: order.items.map((item) => ({ ...item, unitPrice: item.unitPrice.toString(), total: item.total.toString() })) } : null;
}

export async function getPurchaseOrderDetail(purchaseOrderId: string) {
  await requireActor();
  return getPrismaClient().purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: {
      id: true,
      purchaseOrderNo: true,
      customerReference: true,
      productName: true,
      material: true,
      color: true,
      deadline: true,
      status: true,
      designNotes: true,
      notes: true,
      createdAt: true,
      sizes: { select: { id: true, size: true, quantity: true }, orderBy: { position: "asc" } },
      attachments: { select: { id: true, originalName: true, contentType: true, sizeBytes: true }, orderBy: { createdAt: "asc" } },
      opportunity: { select: { id: true, opportunityNo: true, customer: { select: { name: true, companyName: true } } } },
    },
  });
}

export async function getInvoiceDetail(invoiceId: string) {
  const actor = await requireActor();
  const prisma = getPrismaClient();
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNo: true,
      snapshotCustomerName: true,
      snapshotCompanyName: true,
      status: true,
      discountType: true,
      discountValue: true,
      subtotal: true,
      total: true,
      issuedAt: true,
      dueAt: true,
      notes: true,
      createdAt: true,
      opportunity: { select: { id: true, opportunityNo: true } },
      purchaseOrder: { select: { purchaseOrderNo: true, deadline: true } },
      pendingPayment: { select: { kind: true, initialAmount: true, initialDueAt: true, terms: { select: { id: true, position: true, amount: true, dueAt: true }, orderBy: { position: "asc" } } } },
      items: { select: { id: true, size: true, description: true, quantity: true, unitPrice: true, subtotal: true }, orderBy: { position: "asc" } },
      salesOrder: {
        select: {
          id: true,
          status: true,
          payment: {
            select: {
              kind: true,
              initialAmount: true,
              outstandingAmount: true,
              transactions: {
                where: { paymentTermId: null, status: "ACTIVE" },
                select: { id: true, version: true, amount: true, paidAt: true, reference: true, note: true, paymentMethodId: true, paymentMethod: { select: { name: true } } },
                take: 1,
              },
              terms: {
                select: {
                  id: true,
                  position: true,
                  amount: true,
                  dueAt: true,
                  transactions: {
                    where: { status: "ACTIVE" },
                    select: { id: true, version: true, amount: true, paidAt: true, reference: true, note: true, paymentMethodId: true, paymentMethod: { select: { name: true } } },
                    take: 1,
                  },
                },
                orderBy: { position: "asc" },
              },
            },
          },
        },
      },
    },
  });
  const paymentMethods = hasRole(actor.role, DEAL_ROLES)
    ? await prisma.paymentMethod.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: [{ position: "asc" }, { name: "asc" }] })
    : [];
  return invoice ? {
    ...invoice,
    discountValue: invoice.discountValue.toString(),
    subtotal: invoice.subtotal.toString(),
    total: invoice.total.toString(),
    items: invoice.items.map((item) => ({ ...item, unitPrice: item.unitPrice.toString(), subtotal: item.subtotal.toString() })),
    canRecordPayment: hasRole(actor.role, DEAL_ROLES),
    paymentMethods,
    salesOrder: invoice.salesOrder?.payment ? {
      id: invoice.salesOrder.id,
      status: invoice.salesOrder.status,
      kind: invoice.salesOrder.payment.kind,
      initialAmount: invoice.salesOrder.payment.initialAmount.toString(),
      outstandingAmount: invoice.salesOrder.payment.outstandingAmount.toString(),
      initialTransaction: invoice.salesOrder.payment.transactions[0] ? { ...invoice.salesOrder.payment.transactions[0], amount: invoice.salesOrder.payment.transactions[0].amount.toString() } : null,
      terms: invoice.salesOrder.payment.terms.map((term) => ({ ...term, amount: term.amount.toString(), transaction: term.transactions[0] ? { ...term.transactions[0], amount: term.transactions[0].amount.toString() } : null })),
    } : null,
    pendingPayment: invoice.pendingPayment ? { ...invoice.pendingPayment, initialAmount: invoice.pendingPayment.initialAmount.toString(), terms: invoice.pendingPayment.terms.map((term) => ({ ...term, amount: term.amount.toString() })) } : null,
  } : null;
}

export type UserStatusFilter = "active" | "all" | "inactive";
export type UserSort = "createdAt" | "email" | "isActive" | "name" | "role";

export async function getUsers({
  query,
  role,
  status,
  page,
  pageSize,
  sort,
  direction,
}: {
  query: string;
  role: AppRole | "all";
  status: UserStatusFilter;
  page: number;
  pageSize: number;
  sort: UserSort;
  direction: SortDirection;
}) {
  await requireActor(USER_ADMIN_ROLES);
  const normalizedQuery = query.trim().slice(0, 120);
  const where = {
    ...(normalizedQuery
      ? {
          OR: [
            { name: { contains: normalizedQuery, mode: "insensitive" as const } },
            { email: { contains: normalizedQuery, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(role === "all" ? {} : { role }),
    ...(status === "all" ? {} : { isActive: status === "active" }),
  } satisfies Prisma.AppUserWhereInput;
  const orderBy = [{ [sort]: direction }, { id: "asc" as const }] satisfies Prisma.AppUserOrderByWithRelationInput[];
  const prisma = getPrismaClient();
  const [items, total, activeTotal, allTotal] = await Promise.all([
    prisma.appUser.findMany({
      where,
      select: {
        id: true,
        authUserId: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.appUser.count({ where }),
    prisma.appUser.count({ where: { isActive: true } }),
    prisma.appUser.count(),
  ]);
  return { items, total, activeTotal, allTotal, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
