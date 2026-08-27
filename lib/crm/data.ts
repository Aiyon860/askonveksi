import "server-only";

import type { OpportunityStage, Prisma } from "@prisma/client";

import { USER_ADMIN_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { DATA_PAGE_SIZE } from "@/lib/pagination";

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

export async function getCustomers(query: string, archived: boolean, page: number) {
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
          ],
        }
      : {}),
  } satisfies Prisma.CustomerWhereInput;
  const prisma = getPrismaClient();

  const [items, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        customerNo: true,
        name: true,
        companyName: true,
        whatsapp: true,
        email: true,
        instagram: true,
        archivedAt: true,
        updatedAt: true,
        _count: { select: { opportunities: true } },
        opportunities: {
          select: { updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * DATA_PAGE_SIZE,
      take: DATA_PAGE_SIZE,
    }),
    prisma.customer.count({ where }),
  ]);
  return { items, total, pageCount: Math.max(1, Math.ceil(total / DATA_PAGE_SIZE)) };
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
      archivedAt: true,
      version: true,
      createdAt: true,
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
            select: { id: true, salesOrderNo: true, total: true, status: true, createdAt: true },
            orderBy: { createdAt: "desc" },
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

export async function getUsers(page: number) {
  await requireActor(USER_ADMIN_ROLES);
  const prisma = getPrismaClient();
  const [items, total, activeTotal] = await prisma.$transaction([
    prisma.appUser.findMany({
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
      orderBy: [{ isActive: "desc" }, { name: "asc" }, { id: "asc" }],
      skip: (page - 1) * DATA_PAGE_SIZE,
      take: DATA_PAGE_SIZE,
    }),
    prisma.appUser.count(),
    prisma.appUser.count({ where: { isActive: true } }),
  ]);
  return { items, total, activeTotal, pageCount: Math.max(1, Math.ceil(total / DATA_PAGE_SIZE)) };
}
