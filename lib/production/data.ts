import "server-only";

import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";

import { PRODUCTION_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import type { ProductionBoardGroup } from "@/lib/production/workflow";

export type ProductionBoardFilter = { group: ProductionBoardGroup; productCategoryId?: string | null };

type BoardWhere = { group: ProductionBoardGroup; productCategoryId: string | null };

function boardWhere({ group, productCategoryId }: BoardWhere): Prisma.ProductionWorkOrderWhereInput {
  const purchaseOrderConditions: Prisma.PurchaseOrderWhereInput[] = [];
  // Work Order aksesoris memakai route NON_JERSEY; grup menentukan pembagian tampilannya.
  if (group === "AKSESORI") purchaseOrderConditions.push({ garmentType: "AKSESORI" });
  else if (group === "NON_JERSEY") purchaseOrderConditions.push({ OR: [{ garmentType: "NON_JERSEY" }, { garmentType: null }] });
  // Kartu yang PO-nya belum punya kategori produk selalu ikut tampil agar tak ada Work Order hilang.
  if (productCategoryId) purchaseOrderConditions.push({ OR: [{ productCategoryId }, { productCategoryId: null }] });

  return {
    route: group === "JERSEY" ? "JERSEY" : "NON_JERSEY",
    status: { not: "CANCELLED" },
    designCompletedAt: { not: null },
    ...(purchaseOrderConditions.length ? { salesOrder: { purchaseOrder: { AND: purchaseOrderConditions } } } : {}),
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
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
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
  const actor = await requireActor(PRODUCTION_ROLES);
  const { rows, total } = await getCachedBoardRows(filter);

  return {
    items: rows,
    total,
    truncated: total > rows.length,
    actor: { id: actor.id, role: actor.role },
  };
}

export async function getProductionDetail(id: string) {
  const actor = await requireActor(PRODUCTION_ROLES);
  const workOrder = await getPrismaClient().productionWorkOrder.findUnique({
    relationLoadStrategy: "join",
    where: { id },
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
                  revisions: {
                    where: { status: "APPROVED" },
                    orderBy: { revision: "desc" },
                    take: 1,
                    select: {
                      attachments: {
                        where: { contentType: "image/png" },
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

  const users = await getPrismaClient().appUser.findMany({
    where: { isActive: true, role: "ADMIN_PRODUCTION" },
    select: { id: true, name: true, role: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return { workOrder, users, actor: { id: actor.id, role: actor.role } };
}
