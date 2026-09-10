import "server-only";

import { Prisma } from "@prisma/client";

import { DESIGN_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";
import { designStatus, type DesignTaskStatus } from "@/lib/design/status";

export type { DesignTaskStatus } from "@/lib/design/status";

export async function getDesignTasks({ query, status, page, pageSize }: { query: string; status: DesignTaskStatus | "all"; page: number; pageSize: number }) {
  await requireActor(DESIGN_ROLES);
  const normalizedQuery = query.trim().slice(0, 80);
  const where = {
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
        revisions: { select: { id: true, revision: true, notes: true, createdAt: true, createdBy: { select: { name: true } }, attachments: { select: { id: true, originalName: true } } }, orderBy: { revision: "desc" } },
      },
      orderBy: [{ deadline: "asc" }, { id: "asc" }],
    }),
    prisma.designTask.count({ where }),
  ]);
  const items = rows.map((row) => ({ ...row, status: designStatus(row.deadline, row.revisions.length) })).filter((row) => status === "all" || row.status === status);
  const paged = items.slice((page - 1) * pageSize, page * pageSize);
  return { items: paged, total: status === "all" ? total : items.length, pageCount: Math.max(1, Math.ceil((status === "all" ? total : items.length) / pageSize)) };
}
