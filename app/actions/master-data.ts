"use server";

import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { flashMessagePath, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { MASTER_DATA_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import {
  bulkUpdateMasterDataSchema,
  firstValidationMessage,
  sortableMasterDataFieldsSchema,
} from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";

function fields(formData: FormData) {
  return { name: formData.get("name"), description: formData.get("description"), position: formData.get("position") };
}

async function assertUniqueName(kind: "customerType" | "leadSource", name: string, excludedId?: string) {
  const prisma = getPrismaClient();
  const where = { name: { equals: name, mode: "insensitive" as const }, ...(excludedId ? { id: { not: excludedId } } : {}) };
  const existing = kind === "customerType"
    ? await prisma.customerType.findFirst({ where, select: { id: true } })
    : await prisma.leadSource.findFirst({ where, select: { id: true } });
  if (existing) throw new UserFacingError("Nama sudah digunakan. Gunakan nama lain.");
}

export async function createCustomerTypeAction(formData: FormData) {
  return runRedirectingAction("/master-data/customer-types", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const parsed = sortableMasterDataFieldsSchema.safeParse(fields(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    await assertUniqueName("customerType", parsed.data.name);
    await getPrismaClient().$transaction(async (tx) => {
      const lastItem = await tx.customerType.aggregate({ _max: { position: true } });
      const created = await tx.customerType.create({
        data: { ...parsed.data, position: (lastItem._max.position ?? -1) + 1 },
        select: { id: true },
      });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "CustomerType", entityId: created.id, action: "CUSTOMER_TYPE_CREATED", changedFields: ["name", "description", "position"] } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/master-data/customer-types");
    return flashMessagePath("/master-data/customer-types", "notice", "Jenis customer berhasil dibuat.");
  });
}

export async function bulkUpdateCustomerTypesAction(formData: FormData) {
  return runRedirectingAction("/master-data/customer-types", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const rawItems = formData.get("items");
    if (typeof rawItems !== "string" || rawItems.length > 200_000) {
      throw new UserFacingError("Data jenis customer tidak valid. Muat ulang lalu coba lagi.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawItems);
    } catch {
      throw new UserFacingError("Data jenis customer tidak valid. Muat ulang lalu coba lagi.");
    }

    const parsed = bulkUpdateMasterDataSchema.safeParse(payload);
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const submittedIds = new Set(parsed.data.map((item) => item.id));
    if (submittedIds.size !== parsed.data.length) {
      throw new UserFacingError("Daftar jenis customer tidak valid. Muat ulang lalu coba lagi.");
    }

    const normalizedNames = parsed.data.map((item) => item.name.toLocaleLowerCase("id"));
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      throw new UserFacingError("Nama jenis customer tidak boleh sama.");
    }

    await getPrismaClient().$transaction(async (tx) => {
      const currentItems = await tx.customerType.findMany({
        select: { id: true, name: true, description: true, position: true, isActive: true },
      });
      if (currentItems.length !== parsed.data.length || currentItems.some((item) => !submittedIds.has(item.id))) {
        throw new UserFacingError("Daftar jenis customer sudah berubah. Muat ulang lalu coba lagi.");
      }

      const currentById = new Map(currentItems.map((item) => [item.id, item]));
      for (const item of parsed.data) {
        const current = currentById.get(item.id);
        if (current && current.name !== item.name) {
          await tx.customerType.update({
            where: { id: item.id },
            data: { name: `temporary-${randomUUID()}` },
          });
        }
      }

      for (const [position, item] of parsed.data.entries()) {
        const current = currentById.get(item.id);
        if (!current) throw new UserFacingError("Jenis customer tidak ditemukan. Muat ulang lalu coba lagi.");

        const description = item.description ?? null;
        const changedFields = [
          current.name !== item.name ? "name" : null,
          current.description !== description ? "description" : null,
          current.position !== position ? "position" : null,
          !current.isActive ? "isActive" : null,
        ].filter((field): field is string => field !== null);

        if (!changedFields.length) continue;

        await tx.customerType.update({
          where: { id: item.id },
          data: { name: item.name, description, position, isActive: true },
        });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            entityType: "CustomerType",
            entityId: item.id,
            action: "CUSTOMER_TYPE_UPDATED",
            changedFields,
          },
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/master-data/customer-types");
    revalidatePath("/crm/pelanggan");
    return flashMessagePath("/master-data/customer-types", "notice", "Jenis customer berhasil diperbarui.");
  });
}

export async function createLeadSourceAction(formData: FormData) {
  return runRedirectingAction("/master-data/lead-sources", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const parsed = sortableMasterDataFieldsSchema.safeParse(fields(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    await assertUniqueName("leadSource", parsed.data.name);
    await getPrismaClient().$transaction(async (tx) => {
      const lastItem = await tx.leadSource.aggregate({ _max: { position: true } });
      const created = await tx.leadSource.create({
        data: { ...parsed.data, position: (lastItem._max.position ?? -1) + 1 },
        select: { id: true },
      });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "LeadSource", entityId: created.id, action: "LEAD_SOURCE_CREATED", changedFields: ["name", "description", "position"] } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/master-data/lead-sources");
    return flashMessagePath("/master-data/lead-sources", "notice", "Sumber lead berhasil dibuat.");
  });
}

export async function bulkUpdateLeadSourcesAction(formData: FormData) {
  return runRedirectingAction("/master-data/lead-sources", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const rawItems = formData.get("items");
    if (typeof rawItems !== "string" || rawItems.length > 200_000) {
      throw new UserFacingError("Data sumber lead tidak valid. Muat ulang lalu coba lagi.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawItems);
    } catch {
      throw new UserFacingError("Data sumber lead tidak valid. Muat ulang lalu coba lagi.");
    }

    const parsed = bulkUpdateMasterDataSchema.safeParse(payload);
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const submittedIds = new Set(parsed.data.map((item) => item.id));
    if (submittedIds.size !== parsed.data.length) {
      throw new UserFacingError("Daftar sumber lead tidak valid. Muat ulang lalu coba lagi.");
    }

    const normalizedNames = parsed.data.map((item) => item.name.toLocaleLowerCase("id"));
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      throw new UserFacingError("Nama sumber lead tidak boleh sama.");
    }

    await getPrismaClient().$transaction(async (tx) => {
      const currentItems = await tx.leadSource.findMany({
        select: { id: true, name: true, description: true, position: true, isActive: true },
      });
      if (currentItems.length !== parsed.data.length || currentItems.some((item) => !submittedIds.has(item.id))) {
        throw new UserFacingError("Daftar sumber lead sudah berubah. Muat ulang lalu coba lagi.");
      }

      const currentById = new Map(currentItems.map((item) => [item.id, item]));
      for (const item of parsed.data) {
        const current = currentById.get(item.id);
        if (current && current.name !== item.name) {
          await tx.leadSource.update({
            where: { id: item.id },
            data: { name: `temporary-${randomUUID()}` },
          });
        }
      }

      for (const [position, item] of parsed.data.entries()) {
        const current = currentById.get(item.id);
        if (!current) throw new UserFacingError("Sumber lead tidak ditemukan. Muat ulang lalu coba lagi.");

        const description = item.description ?? null;
        const changedFields = [
          current.name !== item.name ? "name" : null,
          current.description !== description ? "description" : null,
          current.position !== position ? "position" : null,
          !current.isActive ? "isActive" : null,
        ].filter((field): field is string => field !== null);

        if (!changedFields.length) continue;

        await tx.leadSource.update({
          where: { id: item.id },
          data: { name: item.name, description, position, isActive: true },
        });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            entityType: "LeadSource",
            entityId: item.id,
            action: "LEAD_SOURCE_UPDATED",
            changedFields,
          },
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/master-data/lead-sources");
    revalidatePath("/crm/pelanggan");
    return flashMessagePath("/master-data/lead-sources", "notice", "Sumber lead berhasil diperbarui.");
  });
}
