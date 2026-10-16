import "server-only";

import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";

import { PRODUCTION_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { isStageRole, type ProductionBoardGroup } from "@/lib/production/workflow";

export type ProductionBoardFilter = { group: ProductionBoardGroup; productCategoryId?: string | null };

const DESIGN_REVISION_ORDER_BY: Prisma.DesignRevisionOrderByWithRelationInput[] = [{ revision: "desc" }, { createdAt: "desc" }];

type BoardWhere = { group: ProductionBoardGroup; productCategoryId: string | null };

function boardWhere({ group, productCategoryId }: BoardWhere): Prisma.ProductionWorkOrderWhereInput {
  const woConditions: Prisma.ProductionWorkOrderWhereInput[] = [];
  // WO dibuat per produk PO, jadi pembagian jalur memakai jenis tiap item (bukan jenis PO).
  // Work Order aksesoris memakai route NON_JERSEY; grup menentukan pembagian tampilannya.
  // WO lawas tanpa item tetap memakai jenis PO sebagai cadangan.
  if (group === "AKSESORI") {
    woConditions.push({
      OR: [
        { purchaseOrderItem: { is: { garmentType: "AKSESORI" } } },
        { purchaseOrderItem: { is: null }, salesOrder: { purchaseOrder: { garmentType: "AKSESORI" } } },
      ],
    });
  } else if (group === "NON_JERSEY") {
    woConditions.push({
      OR: [
        { purchaseOrderItem: { is: { garmentType: "NON_JERSEY" } } },
        { purchaseOrderItem: { is: null }, salesOrder: { purchaseOrder: { OR: [{ garmentType: "NON_JERSEY" }, { garmentType: null }] } } },
      ],
    });
  }
  // Kategori mengikuti produk WO (itemnya); WO lawas tanpa item memakai kategori PO.
  // Item yang belum berkategori ikut tampil agar tak ada Work Order hilang.
  if (productCategoryId) {
    woConditions.push({
      OR: [
        { purchaseOrderItem: { is: { productCategoryId } } },
        { purchaseOrderItem: { is: { productCategoryId: null } } },
        { purchaseOrderItem: { is: null }, salesOrder: { purchaseOrder: { OR: [{ productCategoryId }, { productCategoryId: null }] } } },
      ],
    });
  }

  return {
    route: group === "JERSEY" ? "JERSEY" : "NON_JERSEY",
    status: { not: "CANCELLED" },
    designCompletedAt: { not: null },
    ...(woConditions.length ? { AND: woConditions } : {}),
  };
}

// Cache 30s per grup + kategori agar tiap render/SWR tak RTT Sydney. Actor diambil di luar cache agar tak bocor antar user.
// Tanggal wajib diserialisasi DI DALAM callback: unstable_cache menyimpan hasil sebagai JSON,
// sehingga cache hit mengembalikan string, bukan Date.
const getCachedBoardRows = (filter: BoardWhere) =>
  unstable_cache(
    async () => {
      const prisma = getPrismaClient();
      const where = boardWhere(filter);
      const [rows, total] = await Promise.all([
        prisma.productionWorkOrder.findMany({
          relationLoadStrategy: "join",
          where,
          select: {
            id: true,
            workOrderNo: true,
            route: true,
            productName: true,
            quantity: true,
            deadline: true,
            stageSequence: true,
            currentStage: true,
            status: true,
            sampleRevision: true,
            needsRepair: true,
            repairReason: true,
            obstacle: true,
            obstacleUpdatedAt: true,
            stageEnteredAt: true,
            version: true,
            updatedAt: true,
            salesOrder: { select: { id: true, salesOrderNo: true, snapshotCustomerName: true } },
            steps: {
              where: { status: "ACTIVE" },
              select: { id: true, assignee: { select: { id: true, name: true } } },
              take: 1,
            },
          },
          // Kartu Retur selalu di atas: needsRepair dulu, lalu terbaru.
          orderBy: [{ needsRepair: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
          take: 500,
        }),
        prisma.productionWorkOrder.count({ where }),
      ]);

      return {
        total,
        rows: rows.map(({ steps, ...row }) => ({
          ...row,
          deadline: row.deadline.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          stageEnteredAt: row.stageEnteredAt?.toISOString() ?? null,
          obstacleUpdatedAt: row.obstacleUpdatedAt?.toISOString() ?? null,
          activeStepId: steps[0]?.id ?? null,
          assignee: steps[0]?.assignee ?? null,
        })),
      };
    },
    ["production-board", filter.group, filter.productCategoryId ?? ""],
    { revalidate: 30, tags: ["production-board"] },
  )();

export async function getProductionBoard(input: ProductionBoardFilter) {
  const filter: BoardWhere = { group: input.group, productCategoryId: input.productCategoryId ?? null };
  const actor = await requireActor(PRODUCTION_VIEW_ROLES);
  const { rows, total } = await getCachedBoardRows(filter);

  return {
    items: rows,
    total,
    truncated: total > rows.length,
    actor: { id: actor.id, role: actor.role },
    canManage: isStageRole(actor.role),
  };
}

export async function getProductionDetail(id: string) {
  const actor = await requireActor(PRODUCTION_VIEW_ROLES);
  const workOrder = await getPrismaClient().productionWorkOrder.findUnique({
    relationLoadStrategy: "join",
    where: { id },
    select: {
      id: true,
      workOrderNo: true,
      purchaseOrderItemId: true,
      route: true,
      productName: true,
      quantity: true,
      deadline: true,
      stageSequence: true,
      currentStage: true,
      status: true,
      sampleRevision: true,
      needsRepair: true,
      repairReason: true,
      repairRequestedAt: true,
      obstacle: true,
      version: true,
      completedAt: true,
      cancelledAt: true,
      createdAt: true,
      salesOrder: {
        select: {
          id: true,
          salesOrderNo: true,
          snapshotCustomerName: true,
          acceptedAt: true,
          purchaseOrder: {
            select: {
              garmentType: true,
              productCategoryId: true,
              designTask: {
                select: {
                  id: true,
                  // Desain disimpan per produk PO; work order memakai revisi produknya sendiri.
                  revisions: {
                    orderBy: DESIGN_REVISION_ORDER_BY,
                    select: {
                      itemId: true,
                      attachments: {
                        where: { contentType: { in: ["image/png", "image/jpeg"] } },
                        orderBy: { createdAt: "asc" },
                        select: { id: true, originalName: true, contentType: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      steps: {
        select: {
          id: true,
          stage: true,
          position: true,
          status: true,
          attemptCount: true,
          startedAt: true,
          completedAt: true,
          assignee: { select: { id: true, name: true, role: true } },
        },
        orderBy: { position: "asc" },
      },
      activities: {
        select: { id: true, type: true, fromStage: true, toStage: true, note: true, metadata: true, createdAt: true, actor: { select: { name: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      },
    },
  });
  if (!workOrder) return null;
  // Sisakan hanya revisi desain produk work order ini agar gambar acuan produksi tidak tertukar.
  const designTask = workOrder.salesOrder.purchaseOrder?.designTask;
  const designRevision = designTask
    ? (designTask.revisions.find((revision) => revision.itemId === workOrder.purchaseOrderItemId) ?? designTask.revisions[0])
    : undefined;
  const workOrderWithDesign = {
    ...workOrder,
    salesOrder: {
      ...workOrder.salesOrder,
      purchaseOrder: workOrder.salesOrder.purchaseOrder
        ? {
            ...workOrder.salesOrder.purchaseOrder,
            designTask: designTask ? { ...designTask, revisions: designRevision ? [designRevision] : [] } : null,
          }
        : null,
    },
  };

  const users = await getPrismaClient().appUser.findMany({
    where: { isActive: true, role: "ADMIN_PO" },
    select: { id: true, name: true, role: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return { workOrder: workOrderWithDesign, users, actor: { id: actor.id, role: actor.role }, canManage: isStageRole(actor.role) };
}
