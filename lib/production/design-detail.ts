import "server-only";

import { Prisma } from "@prisma/client";

import { requireDeveloperActor } from "@/lib/auth/session";
import { pageCountFor, sliceArgs } from "@/lib/pagination";
import { getPrismaClient } from "@/lib/prisma";
import { isStageRole } from "@/lib/production/workflow";

// Gambar desain yang dapat dirender pratinjau: PNG dan JPEG (revisi D2).
const DESIGN_IMAGE_CONTENT_TYPES = ["image/png", "image/jpeg"];

const DESIGN_REVISION_ORDER_BY: Prisma.DesignRevisionOrderByWithRelationInput[] = [{ revision: "desc" }, { createdAt: "desc" }];

const designSelect = {
  id: true,
  workOrderNo: true,
  purchaseOrderItemId: true,
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
              // Desain per produk PO: ambil semua revisi lalu pilih milik item work order ini.
              revisions: {
                orderBy: DESIGN_REVISION_ORDER_BY,
                // D2: hanya gambar PNG/JPEG yang ditampilkan (PDF/PSD sudah ditolak saat unggah).
                select: { itemId: true, attachments: { where: { contentType: { in: DESIGN_IMAGE_CONTENT_TYPES } }, orderBy: { createdAt: "asc" }, select: { id: true, path: true, originalName: true, annotations: true } } },
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

type DesignWorkOrder = Prisma.ProductionWorkOrderGetPayload<{ select: typeof designSelect }>;

/**
 * Work order hanya terhubung ke satu produk PO, jadi halaman desain memakai revisi produk itu
 * (versi terbaru) alih-alih revisi produk lain pada PO yang sama.
 */
function withOwnProductDesign(workOrder: DesignWorkOrder): DesignWorkOrder {
  const purchaseOrder = workOrder.salesOrder.purchaseOrder;
  const designTask = purchaseOrder?.designTask;
  if (!purchaseOrder || !designTask) return workOrder;
  const designRevision = designTask.revisions.find((revision) => revision.itemId === workOrder.purchaseOrderItemId) ?? designTask.revisions[0];
  return {
    ...workOrder,
    salesOrder: {
      ...workOrder.salesOrder,
      purchaseOrder: { ...purchaseOrder, designTask: { ...designTask, revisions: designRevision ? [designRevision] : [] } },
    },
  };
}

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
  // Halaman Detail Desain disembunyikan: hanya DEVELOPER yang boleh membukanya.
  const actor = await requireDeveloperActor();
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
      ...sliceArgs(page, pageSize),
      select: designSelect,
    }),
    getPrismaClient().productionWorkOrder.count({ where }),
  ]);
  return {
    items: items.map(withOwnProductDesign),
    total,
    pageCount: pageCountFor(total, pageSize),
    canManage: isStageRole(actor.role),
  };
}

export async function getProductionDesignDetail(workOrderId: string) {
  // Halaman Detail Desain disembunyikan: hanya DEVELOPER yang boleh membukanya.
  const actor = await requireDeveloperActor();
  const workOrder = await getPrismaClient().productionWorkOrder.findFirst({
    where: { id: workOrderId, status: { not: "CANCELLED" } },
    select: designSelect,
  });
  return workOrder ? { workOrder: withOwnProductDesign(workOrder), canManage: isStageRole(actor.role) } : null;
}
