"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { flashMessagePath, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { MASTER_DATA_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { firstValidationMessage, masterDataFieldsSchema, toggleMasterDataSchema, updateMasterDataSchema } from "@/lib/crm/validation";
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
    const parsed = masterDataFieldsSchema.safeParse(fields(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    await assertUniqueName("customerType", parsed.data.name);
    await getPrismaClient().$transaction(async (tx) => {
      const created = await tx.customerType.create({ data: parsed.data, select: { id: true } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "CustomerType", entityId: created.id, action: "CUSTOMER_TYPE_CREATED", changedFields: ["name", "description", "position", "isActive"] } });
    });
    revalidatePath("/master-data/customer-types");
    return flashMessagePath("/master-data/customer-types", "notice", "Jenis customer berhasil dibuat.");
  });
}

export async function updateCustomerTypeAction(formData: FormData) {
  return runRedirectingAction("/master-data/customer-types", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const parsed = updateMasterDataSchema.safeParse({ ...fields(formData), id: formData.get("id") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const { id, ...data } = parsed.data;
    await assertUniqueName("customerType", data.name, id);
    await getPrismaClient().$transaction(async (tx) => {
      await tx.customerType.update({ where: { id }, data });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "CustomerType", entityId: id, action: "CUSTOMER_TYPE_UPDATED", changedFields: ["name", "description", "position"] } });
    });
    revalidatePath("/master-data/customer-types");
    revalidatePath("/crm/pelanggan");
    return flashMessagePath("/master-data/customer-types", "notice", "Jenis customer diperbarui.");
  });
}

export async function toggleCustomerTypeAction(formData: FormData) {
  return runRedirectingAction("/master-data/customer-types", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const parsed = toggleMasterDataSchema.safeParse({ id: formData.get("id"), isActive: formData.get("isActive") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    await getPrismaClient().$transaction(async (tx) => {
      if (!parsed.data.isActive) {
        const activeCount = await tx.customerType.count({ where: { isActive: true } });
        if (activeCount <= 1) throw new UserFacingError("Minimal satu jenis customer harus tetap aktif.");
      }
      await tx.customerType.update({ where: { id: parsed.data.id }, data: { isActive: parsed.data.isActive } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "CustomerType", entityId: parsed.data.id, action: parsed.data.isActive ? "CUSTOMER_TYPE_ACTIVATED" : "CUSTOMER_TYPE_DEACTIVATED", changedFields: ["isActive"] } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/master-data/customer-types");
    revalidatePath("/crm/pelanggan");
    return flashMessagePath("/master-data/customer-types", "notice", parsed.data.isActive ? "Jenis customer diaktifkan." : "Jenis customer dinonaktifkan.");
  });
}

export async function createLeadSourceAction(formData: FormData) {
  return runRedirectingAction("/master-data/lead-sources", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const parsed = masterDataFieldsSchema.safeParse(fields(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    await assertUniqueName("leadSource", parsed.data.name);
    await getPrismaClient().$transaction(async (tx) => {
      const created = await tx.leadSource.create({ data: parsed.data, select: { id: true } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "LeadSource", entityId: created.id, action: "LEAD_SOURCE_CREATED", changedFields: ["name", "description", "position", "isActive"] } });
    });
    revalidatePath("/master-data/lead-sources");
    return flashMessagePath("/master-data/lead-sources", "notice", "Sumber lead berhasil dibuat.");
  });
}

export async function updateLeadSourceAction(formData: FormData) {
  return runRedirectingAction("/master-data/lead-sources", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const parsed = updateMasterDataSchema.safeParse({ ...fields(formData), id: formData.get("id") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const { id, ...data } = parsed.data;
    await assertUniqueName("leadSource", data.name, id);
    await getPrismaClient().$transaction(async (tx) => {
      await tx.leadSource.update({ where: { id }, data });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "LeadSource", entityId: id, action: "LEAD_SOURCE_UPDATED", changedFields: ["name", "description", "position"] } });
    });
    revalidatePath("/master-data/lead-sources");
    revalidatePath("/crm/pelanggan");
    return flashMessagePath("/master-data/lead-sources", "notice", "Sumber lead diperbarui.");
  });
}

export async function toggleLeadSourceAction(formData: FormData) {
  return runRedirectingAction("/master-data/lead-sources", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const parsed = toggleMasterDataSchema.safeParse({ id: formData.get("id"), isActive: formData.get("isActive") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    await getPrismaClient().$transaction(async (tx) => {
      await tx.leadSource.update({ where: { id: parsed.data.id }, data: { isActive: parsed.data.isActive } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "LeadSource", entityId: parsed.data.id, action: parsed.data.isActive ? "LEAD_SOURCE_ACTIVATED" : "LEAD_SOURCE_DEACTIVATED", changedFields: ["isActive"] } });
    });
    revalidatePath("/master-data/lead-sources");
    revalidatePath("/crm/pelanggan");
    return flashMessagePath("/master-data/lead-sources", "notice", parsed.data.isActive ? "Sumber lead diaktifkan." : "Sumber lead dinonaktifkan.");
  });
}
