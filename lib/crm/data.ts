import "server-only";

import type { AppRole, OpportunityStage, Prisma } from "@prisma/client";

import { USER_ADMIN_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

export type PipelineOpportunity = {
  id: string;
  opportunityNo: string;
  title: string;
  stage: OpportunityStage;
  version: number;
  estimatedQuantity: number | null;
  estimatedValue: string | null;
  deadline: string | null;
  leadScore: number;
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
  noteCount: number;
  salesPic: { id: string; name: string } | null;
};

const opportunitySummarySelect = {
  id: true,
  opportunityNo: true,
  title: true,
  stage: true,
  version: true,
  estimatedQuantity: true,
  estimatedValue: true,
  deadline: true,
  leadScore: true,
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
  _count: { select: { notes: true } },
} satisfies Prisma.OpportunitySelect;

export async function getPipelineData() {
  await requireActor();
  const prisma = getPrismaClient();
  const [rows, total] = await Promise.all([
    prisma.opportunity.findMany({
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
    estimatedQuantity: row.estimatedQuantity,
    estimatedValue: row.estimatedValue?.toString() ?? null,
    deadline: row.deadline?.toISOString() ?? null,
    leadScore: row.leadScore,
    productName: row.productName,
    nextAction: row.nextAction,
    nextActionAt: row.nextActionAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    updatedAt: row.updatedAt.toISOString(),
    customer: row.customer,
    noteCount: row._count.notes,
    salesPic: row.salesPic,
  }));

  return { opportunities, total, truncated: total > rows.length };
}

export async function getCustomerOptions() {
  await requireActor();
  return getPrismaClient().customer.findMany({
    where: { archivedAt: null },
    select: { id: true, customerNo: true, name: true, companyName: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 500,
  });
}

export type CustomerSort = "customerNo" | "name" | "opportunities" | "updatedAt";
export type SortDirection = "asc" | "desc";

export async function getCustomers({
  query,
  archived,
  page,
  pageSize,
  sort,
  direction,
}: {
  query: string;
  archived: boolean;
  page: number;
  pageSize: number;
  sort: CustomerSort;
  direction: SortDirection;
}) {
  await requireActor();
  const normalizedQuery = query.trim().slice(0, 80);
  const where = {
    archivedAt: archived ? { not: null } : null,
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
  const prisma = getPrismaClient();
  const orderBy = (
    sort === "opportunities"
      ? [{ opportunities: { _count: direction } }, { id: "asc" as const }]
      : [{ [sort]: direction }, { id: "asc" as const }]
  ) satisfies Prisma.CustomerOrderByWithRelationInput[];

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
          select: { updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);
  return { items, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
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
          estimatedValue: true,
          deadline: true,
          updatedAt: true,
          salesOrders: {
            select: {
              id: true,
              salesOrderNo: true,
              total: true,
              status: true,
              acceptedAt: true,
              items: {
                select: { id: true, description: true, quantity: true, position: true },
                orderBy: { position: "asc" },
              },
            },
            orderBy: { acceptedAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
}

export async function getOpportunityDetail(opportunityId: string) {
  await requireActor();
  return getPrismaClient().opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      id: true,
      opportunityNo: true,
      title: true,
      stage: true,
      leadSourceId: true,
      salesPicId: true,
      productName: true,
      needPurpose: true,
      designStatus: true,
      specification: true,
      customerBudget: true,
      leadScore: true,
      estimatedQuantity: true,
      estimatedValue: true,
      deadline: true,
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
      notes: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: { select: { name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      },
      quotations: {
        select: {
          id: true,
          quotationNo: true,
          revision: true,
          status: true,
          discountType: true,
          discountValue: true,
          subtotal: true,
          total: true,
          issuedAt: true,
          acceptedAt: true,
          acceptanceReference: true,
          acceptanceProofPath: true,
          acceptanceProofName: true,
          acceptanceProofType: true,
          version: true,
          createdAt: true,
          items: {
            select: { id: true, position: true, description: true, quantity: true, unitPrice: true, subtotal: true },
            orderBy: { position: "asc" },
          },
          salesOrder: { select: { id: true, salesOrderNo: true, status: true } },
        },
        orderBy: { revision: "desc" },
      },
      salesOrders: {
        select: { id: true, salesOrderNo: true, status: true, total: true, createdAt: true, cancelReason: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
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
    stage: { in: ["LEAD_BARU", "DIHUBUNGI", "KEBUTUHAN_TERGALI", "PENAWARAN", "FOLLOW_UP", "NEGOSIASI"] as OpportunityStage[] },
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
        leadScore: true,
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

export async function getFollowUpBadgeCount() {
  const actor = await requireActor();
  const { tomorrow } = jakartaDayBounds();
  return getPrismaClient().opportunity.count({
    where: {
      stage: { in: ["LEAD_BARU", "DIHUBUNGI", "KEBUTUHAN_TERGALI", "PENAWARAN", "FOLLOW_UP", "NEGOSIASI"] },
      nextActionAt: { lt: tomorrow },
      customer: { archivedAt: null },
      ...(actor.role === "SALES" ? { salesPicId: actor.id } : {}),
    },
  });
}

export async function getSalesDashboardData() {
  await requireActor();
  const prisma = getPrismaClient();
  const { start, tomorrow } = jakartaDayBounds();
  const shifted = new Date(start.getTime() + 7 * 60 * 60 * 1000);
  const monthStart = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - 7 * 60 * 60 * 1000);
  const nextMonth = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1) - 7 * 60 * 60 * 1000);
  const openStages: OpportunityStage[] = ["LEAD_BARU", "DIHUBUNGI", "KEBUTUHAN_TERGALI", "PENAWARAN", "FOLLOW_UP", "NEGOSIASI"];
  const [stageGroups, potential, dealRevenue, overdue, dueToday, hotLeads, urgentActions] = await Promise.all([
    prisma.opportunity.groupBy({ by: ["stage"], where: { customer: { archivedAt: null } }, orderBy: { stage: "asc" }, _count: true }),
    prisma.opportunity.aggregate({ where: { stage: { in: openStages }, customer: { archivedAt: null } }, _sum: { estimatedValue: true } }),
    prisma.salesOrder.aggregate({ where: { status: "ACTIVE", acceptedAt: { gte: monthStart, lt: nextMonth } }, _sum: { total: true } }),
    prisma.opportunity.count({ where: { stage: { in: openStages }, nextActionAt: { lt: start }, customer: { archivedAt: null } } }),
    prisma.opportunity.count({ where: { stage: { in: openStages }, nextActionAt: { gte: start, lt: tomorrow }, customer: { archivedAt: null } } }),
    prisma.opportunity.findMany({
      where: { stage: { in: openStages }, leadScore: { gte: 80 }, customer: { archivedAt: null } },
      select: { id: true, opportunityNo: true, title: true, leadScore: true, estimatedValue: true, customer: { select: { name: true } } },
      orderBy: [{ leadScore: "desc" }, { updatedAt: "desc" }],
      take: 5,
    }),
    prisma.opportunity.findMany({
      where: { stage: { in: openStages }, nextActionAt: { not: null }, customer: { archivedAt: null } },
      select: { id: true, title: true, nextAction: true, nextActionAt: true, customer: { select: { name: true } } },
      orderBy: { nextActionAt: "asc" },
      take: 5,
    }),
  ]);
  return {
    stageCounts: Object.fromEntries(stageGroups.map((group) => [group.stage, group._count])) as Partial<Record<OpportunityStage, number>>,
    potentialValue: potential._sum.estimatedValue?.toString() ?? "0",
    dealRevenue: dealRevenue._sum.total?.toString() ?? "0",
    overdue,
    dueToday,
    hotLeads: hotLeads.map((item) => ({ ...item, estimatedValue: item.estimatedValue?.toString() ?? null })),
    urgentActions,
  };
}

export async function getSalesOrderDetail(salesOrderId: string) {
  await requireActor();
  return getPrismaClient().salesOrder.findUnique({
    where: { id: salesOrderId },
    select: {
      id: true,
      salesOrderNo: true,
      quotationNo: true,
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
      quotation: {
        select: {
          id: true,
          revision: true,
          status: true,
          acceptanceReference: true,
          acceptanceProofPath: true,
          acceptanceProofName: true,
        },
      },
      createdBy: { select: { name: true } },
      cancelledBy: { select: { name: true } },
      items: {
        select: { id: true, position: true, description: true, quantity: true, unitPrice: true, subtotal: true },
        orderBy: { position: "asc" },
      },
    },
  });
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
        mustChangePassword: true,
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
