import "server-only";

import type { ProductionRoute } from "@prisma/client";

import { PRODUCTION_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

export async function getProductionBoard(route: ProductionRoute) {
  const actor = await requireActor(PRODUCTION_ROLES);
  const prisma = getPrismaClient();
  const [rows, total] = await Promise.all([
    prisma.productionWorkOrder.findMany({
      relationLoadStrategy: "join",
      where: { route, status: { not: "CANCELLED" } },
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
    prisma.productionWorkOrder.count({ where: { route, status: { not: "CANCELLED" } } }),
  ]);

  return {
    items: rows.map(({ steps, ...row }) => ({
      ...row,
      deadline: row.deadline.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      activeStepId: steps[0]?.id ?? null,
      assignee: steps[0]?.assignee ?? null,
    })),
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
      version: true,
      completedAt: true,
      cancelledAt: true,
      createdAt: true,
      salesOrder: { select: { id: true, salesOrderNo: true, snapshotCustomerName: true, acceptedAt: true } },
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
