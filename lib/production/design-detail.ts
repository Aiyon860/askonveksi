import "server-only";

import { Prisma } from "@prisma/client";

import { DETAIL_DESIGN_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { isStageRole } from "@/lib/production/workflow";

// Gambar desain yang dapat dirender pratinjau: PNG dan JPEG (revisi D2).
const DESIGN_IMAGE_CONTENT_TYPES = ["image/png", "image/jpeg"];

const designSelect = {
  id: true,
  workOrderNo: true,
  productName: true,
  route: true,
  quantity: true,
  deadline: true,
  designCompletedAt: true,
  salesOrder: {
    select: {
      salesOrderNo: true,
      snapshotCustomerName: true,
      purchaseOrder: {
        select: {
          purchaseOrderNo: true,
          designTask: {
            select: {
              id: true,
              revisions: {
                where: { status: "APPROVED" }, orderBy: { revision: "desc" }, take: 1,
                select: { attachments: { where: { contentType: { in: DESIGN_IMAGE_CONTENT_TYPES } }, orderBy: { createdAt: "asc" }, select: { id: true, path: true, originalName: true, annotations: true } } },
              },
            },
          },
        },
      },
    },
  },
} as const;

export type DesignDetailStatus = "all" | "pending" | "sent";
export type DesignDetailSort = "workOrderNo" | "purchaseOrderNo" | "salesOrderNo" | "customer" | "productName" | "route" | "deadline" | "designStatus";
export type DesignDetailDirection = "asc" | "desc";

function designDetailOrderBy(sort: DesignDetailSort, direction: DesignDetailDirection) {
  const order = (
    sort === "purchaseOrderNo" ? { salesOrder: { purchaseOrderNo: direction } }
      : sort === "salesOrderNo" ? { salesOrder: { salesOrderNo: direction } }
        : sort === "customer" ? { salesOrder: { snapshotCustomerName: direction } }
          : sort === "designStatus" ? { designCompletedAt: { sort: direction, nulls: direction === "asc" ? "first" : "last" } }
            : { [sort]: direction }
  ) satisfies Prisma.ProductionWorkOrderOrderByWithRelationInput;
  return [order, { id: "asc" }] satisfies Prisma.ProductionWorkOrderOrderByWithRelationInput[];
}

export async function getProductionDesignDetails({
  query,
  status,
  page,
  pageSize,
  sort,
  direction,
}: {
  query: string;
  status: DesignDetailStatus;
  page: number;
  pageSize: number;
  sort: DesignDetailSort;
  direction: DesignDetailDirection;
}) {
  const actor = await requireActor(DETAIL_DESIGN_VIEW_ROLES);
  const where = {
    status: { not: "CANCELLED" },
    ...(status === "pending" ? { designCompletedAt: null } : status === "sent" ? { designCompletedAt: { not: null } } : {}),
    ...(query ? {
      OR: [
        { workOrderNo: { contains: query, mode: "insensitive" } },
        { productName: { contains: query, mode: "insensitive" } },
        { salesOrder: { salesOrderNo: { contains: query, mode: "insensitive" } } },
        { salesOrder: { purchaseOrderNo: { contains: query, mode: "insensitive" } } },
        { salesOrder: { snapshotCustomerName: { contains: query, mode: "insensitive" } } },
      ],
    } : {}),
  } satisfies Prisma.ProductionWorkOrderWhereInput;
  const [items, total] = await Promise.all([
    getPrismaClient().productionWorkOrder.findMany({
      where,
      orderBy: designDetailOrderBy(sort, direction),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: designSelect,
    }),
    getPrismaClient().productionWorkOrder.count({ where }),
  ]);
  return {
    items,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    canManage: isStageRole(actor.role),
  };
}

export async function getProductionDesignDetail(workOrderId: string) {
  const actor = await requireActor(DETAIL_DESIGN_VIEW_ROLES);
  const workOrder = await getPrismaClient().productionWorkOrder.findFirst({
    where: { id: workOrderId, status: { not: "CANCELLED" } },
    select: designSelect,
  });
  return workOrder ? { workOrder, canManage: isStageRole(actor.role) } : null;
}
