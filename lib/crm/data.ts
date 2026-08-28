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
  followUpAt: string | null;
  cancelReason: string | null;
  updatedAt: string;
  customer: {
    id: string;
    customerNo: string;
    name: string;
    companyName: string | null;
  };
  noteCount: number;
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
  followUpAt: true,
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
    followUpAt: row.followUpAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    updatedAt: row.updatedAt.toISOString(),
    customer: row.customer,
    noteCount: row._count.notes,
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

  const [items, total] = await prisma.$transaction([
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
        city: true,
        customerType: { select: { name: true } },
        leadSource: { select: { name: true } },
        salesPic: { select: { name: true } },
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
      customerType: { select: { id: true, name: true, isActive: true } },
      leadSource: { select: { id: true, name: true, isActive: true } },
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
      estimatedQuantity: true,
      estimatedValue: true,
      deadline: true,
      followUpAt: true,
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
  const [items, total, activeTotal, allTotal] = await prisma.$transaction([
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
