import "server-only";

import { Prisma } from "@prisma/client";

import { DESIGN_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { designStatus, type DesignTaskStatus } from "@/lib/design/status";

export type { DesignTaskStatus } from "@/lib/design/status";
export type DesignTaskListSort = "purchaseOrderNo" | "productName" | "customer" | "status" | "deadline" | "uploadedAt";
export type SortDirection = "asc" | "desc";

export async function getDesignTasks({ query, status, start, end, page, pageSize, sort, direction }: { query: string; status: DesignTaskStatus | "all"; start: Date | null; end: Date | null; page: number; pageSize: number; sort: DesignTaskListSort; direction: SortDirection }) {
  const actor = await requireActor(DESIGN_VIEW_ROLES);
  const normalizedQuery = query.trim().slice(0, 80);
  const where = {
    ...((start || end) ? { deadline: { ...(start ? { gte: start } : {}), ...(end ? { lt: end } : {}) } } : {}),
    ...(normalizedQuery ? { purchaseOrder: { OR: [
      { purchaseOrderNo: { contains: normalizedQuery, mode: "insensitive" as const } },
      { productName: { contains: normalizedQuery, mode: "insensitive" as const } },
      { opportunity: { customer: { name: { contains: normalizedQuery, mode: "insensitive" as const } } } },
    ] } } : {}),
  } satisfies Prisma.DesignTaskWhereInput;
  const prisma = getPrismaClient();
  const [rows, total] = await Promise.all([
    prisma.designTask.findMany({
      where,
      select: {
        id: true, deadline: true,
        purchaseOrder: { select: { id: true, purchaseOrderNo: true, productName: true, status: true, opportunity: { select: { id: true, customer: { select: { name: true, companyName: true } } } } } },
        revisions: { select: { id: true, revision: true, status: true, notes: true, reviewNotes: true, createdAt: true, reviewedAt: true, createdBy: { select: { name: true } }, reviewedBy: { select: { name: true } }, attachments: { select: { id: true, originalName: true } } }, orderBy: { revision: "desc" } },
      },
      orderBy: [{ deadline: "asc" }, { id: "asc" }],
    }),
    prisma.designTask.count({ where }),
  ]);
  const items = rows
    .map((row) => ({ ...row, status: designStatus(row.deadline, row.revisions[0]?.status ?? null) }))
    .filter((row) => status === "all" || row.status === status)
    .sort((left, right) => {
      const leftValue = sort === "purchaseOrderNo" ? left.purchaseOrder.purchaseOrderNo
        : sort === "productName" ? left.purchaseOrder.productName
          : sort === "customer" ? left.purchaseOrder.opportunity.customer.companyName ?? left.purchaseOrder.opportunity.customer.name
            : sort === "status" ? left.status
              : sort === "deadline" ? left.deadline.getTime()
                : left.revisions[0]?.createdAt.getTime() ?? 0;
      const rightValue = sort === "purchaseOrderNo" ? right.purchaseOrder.purchaseOrderNo
        : sort === "productName" ? right.purchaseOrder.productName
          : sort === "customer" ? right.purchaseOrder.opportunity.customer.companyName ?? right.purchaseOrder.opportunity.customer.name
            : sort === "status" ? right.status
              : sort === "deadline" ? right.deadline.getTime()
                : right.revisions[0]?.createdAt.getTime() ?? 0;
      const compared = typeof leftValue === "string" && typeof rightValue === "string"
        ? leftValue.localeCompare(rightValue, "id")
        : Number(leftValue) - Number(rightValue);
      return (direction === "asc" ? compared : -compared) || left.id.localeCompare(right.id);
    });
  const paged = items.slice((page - 1) * pageSize, page * pageSize);
  return { items: paged, total: status === "all" ? total : items.length, pageCount: Math.max(1, Math.ceil((status === "all" ? total : items.length) / pageSize)), actorRole: actor.role };
}
