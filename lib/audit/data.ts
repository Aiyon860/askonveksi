import "server-only";

import { Prisma } from "@prisma/client";

import { auditEntityLabel } from "@/lib/audit/labels";
import { AUDIT_VIEW_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

const auditEventSelect = {
  id: true,
  createdAt: true,
  action: true,
  entityType: true,
  entityId: true,
  changedFields: true,
  metadata: true,
  actor: { select: { name: true, email: true, role: true } },
} satisfies Prisma.AuditEventSelect;

export type AuditEventRow = Prisma.AuditEventGetPayload<{ select: typeof auditEventSelect }>;

export type AuditEventListFilter = {
  query: string;
  from: Date | null;
  to: Date | null;
  actorId: string;
  entityType: string;
  page: number;
  pageSize: number;
};

/**
 * Daftar log aktivitas, terbaru dulu. Filter tanggal memakai batas eksklusif
 * (`to` = awal hari setelah tanggal "sampai").
 */
export async function getAuditEventPage(filter: AuditEventListFilter) {
  await requireActor(AUDIT_VIEW_ROLES);
  const prisma = getPrismaClient();
  const query = filter.query.trim().slice(0, 80);
  const where = {
    ...(filter.from || filter.to
      ? {
          createdAt: {
            ...(filter.from ? { gte: filter.from } : {}),
            ...(filter.to ? { lt: filter.to } : {}),
          },
        }
      : {}),
    ...(filter.actorId === "all" ? {} : { actorId: filter.actorId }),
    ...(filter.entityType === "all" ? {} : { entityType: filter.entityType }),
    ...(query
      ? {
          OR: [
            { action: { contains: query, mode: "insensitive" as const } },
            { entityType: { contains: query, mode: "insensitive" as const } },
            { actor: { name: { contains: query, mode: "insensitive" as const } } },
            { actor: { email: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  } satisfies Prisma.AuditEventWhereInput;

  const [total, items] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      select: auditEventSelect,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
  ]);

  return {
    items,
    total,
    pageCount: Math.max(1, Math.ceil(total / filter.pageSize)),
  };
}

/** Pilihan filter: pelaku (semua akun, termasuk nonaktif — log lamanya tetap ada) dan jenis entitas yang benar-benar tercatat. */
export async function getAuditLogFilterOptions() {
  await requireActor(AUDIT_VIEW_ROLES);
  const prisma = getPrismaClient();
  const [actors, entityGroups] = await Promise.all([
    prisma.appUser.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.auditEvent.groupBy({ by: ["entityType"], _count: { _all: true } }),
  ]);

  return {
    actors,
    entityTypes: entityGroups
      .map((group) => group.entityType)
      .sort((a, b) => auditEntityLabel(a).localeCompare(auditEntityLabel(b), "id")),
  };
}
