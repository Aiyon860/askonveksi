import "server-only";

import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";

import { PRODUCTION_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getActiveProductCategories } from "@/lib/master-data";
import {
  EMPTY_PRODUCTION_BOARD_FILTERS,
  NO_PIC,
  matchingProductionCategoryScopes,
  productionBoardCacheKey,
  productionBoardWhere,
  type ProductionBoardFilters,
  type ProductionCategoryScope,
} from "@/lib/production/board-filters";
import { getPrismaClient } from "@/lib/prisma";
import {
  isStageRole,
  PRODUCTION_BOARD_GROUP_LABEL,
  PRODUCTION_BOARD_GROUPS,
  type ProductionBoardGroup,
} from "@/lib/production/workflow";

export type ProductionBoardFilter = {
  group: ProductionBoardGroup;
  productCategoryId?: string | null;
  filters?: ProductionBoardFilters;
};

const DESIGN_REVISION_ORDER_BY: Prisma.DesignRevisionOrderByWithRelationInput[] = [{ revision: "desc" }, { createdAt: "desc" }];

type BoardWhere = { group: ProductionBoardGroup; productCategoryId: string | null; filters: ProductionBoardFilters };

/**
 * Pilihan filter PIC: hanya user yang benar-benar memegang tahap aktif pada
 * jalur + kategori ini, supaya tidak ada pilihan yang pasti kosong.
 * Sengaja tidak ikut filter lain agar opsi tidak saling menghapus.
 */
export async function getProductionPicOptions(input: {
  group: ProductionBoardGroup;
  productCategoryId?: string | null;
  /** PIC yang sedang dipilih tetap ditampilkan walau sudah tak memegang kartu di sini. */
  selectedPicId?: string | null;
}) {
  const scope = { group: input.group, productCategoryId: input.productCategoryId ?? null };
  const options = await unstable_cache(
    async () => {
      const steps = await getPrismaClient().productionStep.findMany({
        where: { status: "ACTIVE", assigneeId: { not: null }, workOrder: productionBoardWhere(scope) },
        select: { assigneeId: true, assignee: { select: { id: true, name: true } } },
        distinct: ["assigneeId"],
        orderBy: { assigneeId: "asc" },
      });

      return steps
        .flatMap((step) => (step.assignee ? [step.assignee] : []))
        .sort((a, b) => a.name.localeCompare(b.name, "id-ID") || a.id.localeCompare(b.id));
    },
    ["production-board-pic", scope.group, scope.productCategoryId ?? ""],
    { revalidate: 30, tags: ["production-board"] },
  )();

  // Filter terbawa saat pindah Jalur/Kategori. Tanpa ini, dropdown menampilkan
  // "Semua PIC" padahal URL masih menyaring PIC tersebut — kontrol jadi berbohong.
  const selectedId = input.selectedPicId && input.selectedPicId !== NO_PIC ? input.selectedPicId : null;
  if (!selectedId || options.some((option) => option.id === selectedId)) return options;

  const selected = await getPrismaClient().appUser.findUnique({
    where: { id: selectedId },
    select: { id: true, name: true },
  });
  if (!selected) return options;

  return [...options, selected].sort((a, b) => a.name.localeCompare(b.name, "id-ID") || a.id.localeCompare(b.id));
}

// Cache 30s per grup + kategori agar tiap render/SWR tak RTT Sydney. Actor diambil di luar cache agar tak bocor antar user.
// Tanggal wajib diserialisasi DI DALAM callback: unstable_cache menyimpan hasil sebagai JSON,
// sehingga cache hit mengembalikan string, bukan Date.
const getCachedBoardRows = (filter: BoardWhere) =>
  unstable_cache(
    async () => {
      const prisma = getPrismaClient();
      const where = productionBoardWhere(filter);
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
            qcReverted: true,
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
    productionBoardCacheKey(filter),
    { revalidate: 30, tags: ["production-board"] },
  )();

export async function getProductionBoard(input: ProductionBoardFilter) {
  const filter: BoardWhere = {
    group: input.group,
    productCategoryId: input.productCategoryId ?? null,
    filters: input.filters ?? EMPTY_PRODUCTION_BOARD_FILTERS,
  };
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

export type ProductionSearchSuggestion = {
  group: ProductionBoardGroup;
  groupLabel: string;
  productCategoryId: string;
  productCategoryName: string;
  count: number;
};

/**
 * Saran pindah papan saat pencarian kosong. Hanya kategori yang namanya cocok
 * dengan kata kunci yang dihitung, supaya tidak perlu memindai semua kategori.
 */
export async function getProductionSearchSuggestions(input: {
  group: ProductionBoardGroup;
  productCategoryId?: string | null;
  filters?: ProductionBoardFilters;
  categories?: ProductionCategoryScope[];
}): Promise<ProductionSearchSuggestion[]> {
  const filters = input.filters ?? EMPTY_PRODUCTION_BOARD_FILTERS;
  if (!filters.q.trim()) return [];

  const categories =
    input.categories ??
    (await getActiveProductCategories()).map(({ id, name, garmentType }) => ({ id, name, garmentType }));
  const scopes = matchingProductionCategoryScopes(
    categories,
    filters.q,
    input.group,
    input.productCategoryId ?? null,
  );
  if (!scopes.length) return [];

  const prisma = getPrismaClient();
  const suggestions = await Promise.all(
    scopes.map(async (category) => {
      const count = await prisma.productionWorkOrder.count({
        where: productionBoardWhere({
          group: category.garmentType,
          productCategoryId: category.id,
          filters,
        }),
      });
      if (count === 0) return null;
      return {
        group: category.garmentType,
        groupLabel: PRODUCTION_BOARD_GROUP_LABEL[category.garmentType],
        productCategoryId: category.id,
        productCategoryName: category.name,
        count,
      } satisfies ProductionSearchSuggestion;
    }),
  );

  return suggestions
    .filter((suggestion): suggestion is ProductionSearchSuggestion => suggestion !== null)
    .sort(
      (a, b) =>
        PRODUCTION_BOARD_GROUPS.indexOf(a.group) - PRODUCTION_BOARD_GROUPS.indexOf(b.group) ||
        b.count - a.count ||
        a.productCategoryName.localeCompare(b.productCategoryName, "id-ID"),
    )
    .slice(0, 3);
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
      qcReverted: true,
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
