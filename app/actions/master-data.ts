"use server";

import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { flashMessagePath, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { MASTER_DATA_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import {
  bulkUpdateMasterDataSchema,
  businessProfileSchema,
  firstValidationMessage,
  sortableMasterDataFieldsSchema,
} from "@/lib/crm/validation";
import { parseMasterDataWorkbook, type MasterDataExcelRow } from "@/lib/master-data-excel";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

function fields(formData: FormData) {
  return { name: formData.get("name"), description: formData.get("description"), position: formData.get("position") };
}

async function assertUniqueName(kind: "customerType" | "leadSource" | "paymentMethod", name: string, excludedId?: string) {
  const prisma = getPrismaClient();
  const where = { name: { equals: name, mode: "insensitive" as const }, ...(excludedId ? { id: { not: excludedId } } : {}) };
  const existing = kind === "customerType"
    ? await prisma.customerType.findFirst({ where, select: { id: true } })
    : kind === "leadSource"
      ? await prisma.leadSource.findFirst({ where, select: { id: true } })
      : await prisma.paymentMethod.findFirst({ where, select: { id: true } });
  if (existing) throw new UserFacingError("Nama sudah digunakan. Gunakan nama lain.");
}

function excelFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new UserFacingError("Pilih file Excel terlebih dahulu.");
  return file;
}

async function importCustomerTypeRows(actorId: string, rows: MasterDataExcelRow[]) {
  await getPrismaClient().$transaction(async (tx) => {
    const currentItems = await tx.customerType.findMany({
      select: { id: true, name: true, description: true, position: true, isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
    const currentByName = new Map(currentItems.map((item) => [item.name.toLocaleLowerCase("id-ID"), item]));
    if (currentByName.size !== currentItems.length) throw new UserFacingError("Data jenis customer memiliki nama duplikat. Rapikan data sebelum import.");

    const importedIds = new Set<string>();
    for (const [position, row] of rows.entries()) {
      const current = currentByName.get(row.name.toLocaleLowerCase("id-ID"));
      if (!current) {
        const created = await tx.customerType.create({ data: { ...row, position }, select: { id: true } });
        importedIds.add(created.id);
        await tx.auditEvent.create({ data: { actorId, entityType: "CustomerType", entityId: created.id, action: "CUSTOMER_TYPE_CREATED", changedFields: ["name", "description", "position"] } });
        continue;
      }
      importedIds.add(current.id);
      const changedFields = [
        current.name !== row.name ? "name" : null,
        current.description !== row.description ? "description" : null,
        current.position !== position ? "position" : null,
        !current.isActive ? "isActive" : null,
      ].filter((field): field is string => field !== null);
      if (!changedFields.length) continue;
      await tx.customerType.update({ where: { id: current.id }, data: { name: row.name, description: row.description, position, isActive: true } });
      await tx.auditEvent.create({ data: { actorId, entityType: "CustomerType", entityId: current.id, action: "CUSTOMER_TYPE_UPDATED", changedFields } });
    }

    let position = rows.length;
    for (const item of currentItems) {
      if (importedIds.has(item.id)) continue;
      if (item.position === position) {
        position += 1;
        continue;
      }
      await tx.customerType.update({ where: { id: item.id }, data: { position } });
      await tx.auditEvent.create({ data: { actorId, entityType: "CustomerType", entityId: item.id, action: "CUSTOMER_TYPE_UPDATED", changedFields: ["position"] } });
      position += 1;
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function importLeadSourceRows(actorId: string, rows: MasterDataExcelRow[]) {
  await getPrismaClient().$transaction(async (tx) => {
    const currentItems = await tx.leadSource.findMany({
      select: { id: true, name: true, description: true, position: true, isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
    const currentByName = new Map(currentItems.map((item) => [item.name.toLocaleLowerCase("id-ID"), item]));
    if (currentByName.size !== currentItems.length) throw new UserFacingError("Data sumber lead memiliki nama duplikat. Rapikan data sebelum import.");

    const importedIds = new Set<string>();
    for (const [position, row] of rows.entries()) {
      const current = currentByName.get(row.name.toLocaleLowerCase("id-ID"));
      if (!current) {
        const created = await tx.leadSource.create({ data: { ...row, position }, select: { id: true } });
        importedIds.add(created.id);
        await tx.auditEvent.create({ data: { actorId, entityType: "LeadSource", entityId: created.id, action: "LEAD_SOURCE_CREATED", changedFields: ["name", "description", "position"] } });
        continue;
      }
      importedIds.add(current.id);
      const changedFields = [
        current.name !== row.name ? "name" : null,
        current.description !== row.description ? "description" : null,
        current.position !== position ? "position" : null,
        !current.isActive ? "isActive" : null,
      ].filter((field): field is string => field !== null);
      if (!changedFields.length) continue;
      await tx.leadSource.update({ where: { id: current.id }, data: { name: row.name, description: row.description, position, isActive: true } });
      await tx.auditEvent.create({ data: { actorId, entityType: "LeadSource", entityId: current.id, action: "LEAD_SOURCE_UPDATED", changedFields } });
    }

    let position = rows.length;
    for (const item of currentItems) {
      if (importedIds.has(item.id)) continue;
      if (item.position === position) {
        position += 1;
        continue;
      }
      await tx.leadSource.update({ where: { id: item.id }, data: { position } });
      await tx.auditEvent.create({ data: { actorId, entityType: "LeadSource", entityId: item.id, action: "LEAD_SOURCE_UPDATED", changedFields: ["position"] } });
      position += 1;
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function importGarmentSizeRows(actorId: string, rows: MasterDataExcelRow[]) {
  await getPrismaClient().$transaction(async (tx) => {
    const currentItems = await tx.garmentSize.findMany({
      select: { id: true, name: true, description: true, position: true, isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
    const currentByName = new Map(currentItems.map((item) => [item.name.toLocaleLowerCase("id-ID"), item]));
    if (currentByName.size !== currentItems.length) throw new UserFacingError("Data ukuran memiliki nama duplikat. Rapikan data sebelum import.");

    const importedIds = new Set<string>();
    for (const [position, row] of rows.entries()) {
      const current = currentByName.get(row.name.toLocaleLowerCase("id-ID"));
      if (!current) {
        const created = await tx.garmentSize.create({ data: { ...row, position }, select: { id: true } });
        importedIds.add(created.id);
        await tx.auditEvent.create({ data: { actorId, entityType: "GarmentSize", entityId: created.id, action: "GARMENT_SIZE_CREATED", changedFields: ["name", "description", "position"] } });
        continue;
      }
      importedIds.add(current.id);
      const changedFields = [
        current.name !== row.name ? "name" : null,
        current.description !== row.description ? "description" : null,
        current.position !== position ? "position" : null,
        !current.isActive ? "isActive" : null,
      ].filter((field): field is string => field !== null);
      if (!changedFields.length) continue;
      await tx.garmentSize.update({ where: { id: current.id }, data: { name: row.name, description: row.description, position, isActive: true } });
      await tx.auditEvent.create({ data: { actorId, entityType: "GarmentSize", entityId: current.id, action: "GARMENT_SIZE_UPDATED", changedFields } });
    }

    let position = rows.length;
    for (const item of currentItems) {
      if (importedIds.has(item.id)) continue;
      if (item.position === position) {
        position += 1;
        continue;
      }
      await tx.garmentSize.update({ where: { id: item.id }, data: { position } });
      await tx.auditEvent.create({ data: { actorId, entityType: "GarmentSize", entityId: item.id, action: "GARMENT_SIZE_UPDATED", changedFields: ["position"] } });
      position += 1;
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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

export async function importCustomerTypesAction(formData: FormData) {
  return runRedirectingAction("/master-data/customer-types", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const rows = await parseMasterDataWorkbook(excelFile(formData), 80);
    await importCustomerTypeRows(actor.id, rows);
    revalidatePath("/master-data/customer-types");
    revalidatePath("/customers");
    return flashMessagePath("/master-data/customer-types", "notice", "Import jenis customer berhasil.");
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
    revalidatePath("/customers");
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

export async function importLeadSourcesAction(formData: FormData) {
  return runRedirectingAction("/master-data/lead-sources", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const rows = await parseMasterDataWorkbook(excelFile(formData), 80);
    await importLeadSourceRows(actor.id, rows);
    revalidatePath("/master-data/lead-sources");
    revalidatePath("/customers");
    return flashMessagePath("/master-data/lead-sources", "notice", "Import sumber lead berhasil.");
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
    revalidatePath("/customers");
    return flashMessagePath("/master-data/lead-sources", "notice", "Sumber lead berhasil diperbarui.");
  });
}

async function importPaymentMethodRows(actorId: string, rows: MasterDataExcelRow[]) {
  await getPrismaClient().$transaction(async (tx) => {
    const currentItems = await tx.paymentMethod.findMany({
      select: { id: true, name: true, description: true, position: true, isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
    const currentByName = new Map(currentItems.map((item) => [item.name.toLocaleLowerCase("id-ID"), item]));
    if (currentByName.size !== currentItems.length) throw new UserFacingError("Data metode pembayaran memiliki nama duplikat. Rapikan data sebelum import.");

    const importedIds = new Set<string>();
    for (const [position, row] of rows.entries()) {
      const current = currentByName.get(row.name.toLocaleLowerCase("id-ID"));
      if (!current) {
        const created = await tx.paymentMethod.create({ data: { ...row, position }, select: { id: true } });
        importedIds.add(created.id);
        await tx.auditEvent.create({ data: { actorId, entityType: "PaymentMethod", entityId: created.id, action: "PAYMENT_METHOD_CREATED", changedFields: ["name", "description", "position"] } });
        continue;
      }
      importedIds.add(current.id);
      const changedFields = [
        current.name !== row.name ? "name" : null,
        current.description !== row.description ? "description" : null,
        current.position !== position ? "position" : null,
        !current.isActive ? "isActive" : null,
      ].filter((field): field is string => field !== null);
      if (!changedFields.length) continue;
      await tx.paymentMethod.update({ where: { id: current.id }, data: { name: row.name, description: row.description, position, isActive: true } });
      await tx.auditEvent.create({ data: { actorId, entityType: "PaymentMethod", entityId: current.id, action: "PAYMENT_METHOD_UPDATED", changedFields } });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createPaymentMethodAction(formData: FormData) {
  return runRedirectingAction("/master-data/payment-methods", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const parsed = sortableMasterDataFieldsSchema.safeParse(fields(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    await assertUniqueName("paymentMethod", parsed.data.name);
    await getPrismaClient().$transaction(async (tx) => {
      const lastItem = await tx.paymentMethod.aggregate({ _max: { position: true } });
      const created = await tx.paymentMethod.create({ data: { ...parsed.data, position: (lastItem._max.position ?? -1) + 1 }, select: { id: true } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "PaymentMethod", entityId: created.id, action: "PAYMENT_METHOD_CREATED", changedFields: ["name", "description", "position"] } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/master-data/payment-methods");
    revalidatePath("/crm");
    return flashMessagePath("/master-data/payment-methods", "notice", "Metode pembayaran berhasil dibuat.");
  });
}

export async function importPaymentMethodsAction(formData: FormData) {
  return runRedirectingAction("/master-data/payment-methods", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const rows = await parseMasterDataWorkbook(excelFile(formData), 80);
    await importPaymentMethodRows(actor.id, rows);
    revalidatePath("/master-data/payment-methods");
    revalidatePath("/crm");
    return flashMessagePath("/master-data/payment-methods", "notice", "Import metode pembayaran berhasil.");
  });
}

export async function bulkUpdatePaymentMethodsAction(formData: FormData) {
  return runRedirectingAction("/master-data/payment-methods", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const rawItems = formData.get("items");
    if (typeof rawItems !== "string" || rawItems.length > 200_000) throw new UserFacingError("Data metode pembayaran tidak valid. Muat ulang lalu coba lagi.");
    let payload: unknown;
    try { payload = JSON.parse(rawItems); } catch { throw new UserFacingError("Data metode pembayaran tidak valid. Muat ulang lalu coba lagi."); }
    const parsed = bulkUpdateMasterDataSchema.safeParse(payload);
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const submittedIds = new Set(parsed.data.map((item) => item.id));
    const normalizedNames = parsed.data.map((item) => item.name.toLocaleLowerCase("id-ID"));
    if (submittedIds.size !== parsed.data.length || new Set(normalizedNames).size !== normalizedNames.length) throw new UserFacingError("ID dan nama metode pembayaran tidak boleh duplikat.");

    await getPrismaClient().$transaction(async (tx) => {
      const currentItems = await tx.paymentMethod.findMany({ select: { id: true, name: true, description: true, position: true, isActive: true } });
      if (currentItems.length !== parsed.data.length || currentItems.some((item) => !submittedIds.has(item.id))) throw new UserFacingError("Daftar metode pembayaran sudah berubah. Muat ulang lalu coba lagi.");
      const currentById = new Map(currentItems.map((item) => [item.id, item]));
      for (const item of parsed.data) {
        const current = currentById.get(item.id);
        if (current && current.name !== item.name) await tx.paymentMethod.update({ where: { id: item.id }, data: { name: `temporary-${randomUUID()}` } });
      }
      for (const [position, item] of parsed.data.entries()) {
        const current = currentById.get(item.id);
        if (!current) throw new UserFacingError("Metode pembayaran tidak ditemukan. Muat ulang lalu coba lagi.");
        const description = item.description ?? null;
        const changedFields = [current.name !== item.name ? "name" : null, current.description !== description ? "description" : null, current.position !== position ? "position" : null, !current.isActive ? "isActive" : null].filter((field): field is string => field !== null);
        if (!changedFields.length) continue;
        await tx.paymentMethod.update({ where: { id: item.id }, data: { name: item.name, description, position, isActive: true } });
        await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "PaymentMethod", entityId: item.id, action: "PAYMENT_METHOD_UPDATED", changedFields } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/master-data/payment-methods");
    revalidatePath("/crm");
    return flashMessagePath("/master-data/payment-methods", "notice", "Metode pembayaran berhasil diperbarui.");
  });
}

export async function createGarmentSizeAction(formData: FormData) {
  return runRedirectingAction("/master-data/garment-sizes", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const parsed = sortableMasterDataFieldsSchema.safeParse(fields(formData));
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const prisma = getPrismaClient();
    const existing = await prisma.garmentSize.findFirst({
      where: { name: { equals: parsed.data.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) throw new UserFacingError("Nama ukuran sudah digunakan.");
    await prisma.$transaction(async (tx) => {
      const lastItem = await tx.garmentSize.aggregate({ _max: { position: true } });
      const created = await tx.garmentSize.create({
        data: { ...parsed.data, position: (lastItem._max.position ?? -1) + 1 },
        select: { id: true },
      });
      await tx.auditEvent.create({
        data: { actorId: actor.id, entityType: "GarmentSize", entityId: created.id, action: "GARMENT_SIZE_CREATED", changedFields: ["name", "description", "position"] },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/master-data/garment-sizes");
    return flashMessagePath("/master-data/garment-sizes", "notice", "Ukuran pakaian berhasil dibuat.");
  });
}

export async function importGarmentSizesAction(formData: FormData) {
  return runRedirectingAction("/master-data/garment-sizes", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const rows = await parseMasterDataWorkbook(excelFile(formData), 40);
    await importGarmentSizeRows(actor.id, rows);
    revalidatePath("/master-data/garment-sizes");
    revalidatePath("/crm");
    return flashMessagePath("/master-data/garment-sizes", "notice", "Import ukuran pakaian berhasil.");
  });
}

export async function bulkUpdateGarmentSizesAction(formData: FormData) {
  return runRedirectingAction("/master-data/garment-sizes", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const rawItems = formData.get("items");
    if (typeof rawItems !== "string" || rawItems.length > 200_000) throw new UserFacingError("Data ukuran tidak valid. Muat ulang lalu coba lagi.");
    let payload: unknown;
    try {
      payload = JSON.parse(rawItems);
    } catch {
      throw new UserFacingError("Data ukuran tidak valid. Muat ulang lalu coba lagi.");
    }
    const parsed = bulkUpdateMasterDataSchema.safeParse(payload);
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const submittedIds = new Set(parsed.data.map((item) => item.id));
    const normalizedNames = parsed.data.map((item) => item.name.toLocaleLowerCase("id-ID"));
    if (submittedIds.size !== parsed.data.length || new Set(normalizedNames).size !== normalizedNames.length) {
      throw new UserFacingError("ID dan nama ukuran tidak boleh duplikat.");
    }

    await getPrismaClient().$transaction(async (tx) => {
      const currentItems = await tx.garmentSize.findMany({ select: { id: true, name: true, description: true, position: true, isActive: true } });
      if (currentItems.length !== parsed.data.length || currentItems.some((item) => !submittedIds.has(item.id))) {
        throw new UserFacingError("Daftar ukuran sudah berubah. Muat ulang lalu coba lagi.");
      }
      const currentById = new Map(currentItems.map((item) => [item.id, item]));
      for (const item of parsed.data) {
        const current = currentById.get(item.id);
        if (current && current.name !== item.name) await tx.garmentSize.update({ where: { id: item.id }, data: { name: `temporary-${randomUUID()}` } });
      }
      for (const [position, item] of parsed.data.entries()) {
        const current = currentById.get(item.id);
        if (!current) throw new UserFacingError("Ukuran tidak ditemukan. Muat ulang lalu coba lagi.");
        const description = item.description ?? null;
        const changedFields = [
          current.name !== item.name ? "name" : null,
          current.description !== description ? "description" : null,
          current.position !== position ? "position" : null,
          !current.isActive ? "isActive" : null,
        ].filter((field): field is string => field !== null);
        if (!changedFields.length) continue;
        await tx.garmentSize.update({ where: { id: item.id }, data: { name: item.name, description, position, isActive: true } });
        await tx.auditEvent.create({
          data: { actorId: actor.id, entityType: "GarmentSize", entityId: item.id, action: "GARMENT_SIZE_UPDATED", changedFields },
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/master-data/garment-sizes");
    revalidatePath("/crm");
    return flashMessagePath("/master-data/garment-sizes", "notice", "Ukuran pakaian berhasil diperbarui.");
  });
}

export async function updateBusinessProfileAction(formData: FormData) {
  return runRedirectingAction("/master-data/business-profile", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const parsed = businessProfileSchema.safeParse({
      version: formData.get("version"),
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      address: formData.get("address"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const logo = formData.get("logo");
    let uploadedPath: string | null = null;
    if (logo instanceof File && logo.size) {
      if (logo.size > 2 * 1024 * 1024) throw new UserFacingError("Logo maksimal 2 MB.");
      const bytes = new Uint8Array(await logo.arrayBuffer());
      const isPng = logo.type === "image/png" && bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
      const isJpeg = logo.type === "image/jpeg" && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const isWebp = logo.type === "image/webp" && bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
      if (!isPng && !isJpeg && !isWebp) throw new UserFacingError("Logo harus berupa PNG, JPG, atau WebP yang valid.");
      const extension = isPng ? "png" : isWebp ? "webp" : "jpg";
      uploadedPath = `business/logo-${randomUUID()}.${extension}`;
      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedPath, bytes, { contentType: logo.type, upsert: false });
      if (error) throw new UserFacingError("Logo belum dapat disimpan. Pastikan bucket business-assets sudah disiapkan.");
    }

    try {
      await getPrismaClient().$transaction(async (tx) => {
        const current = await tx.businessProfile.findUnique({ where: { id: "default" }, select: { id: true } });
        if (!current) throw new UserFacingError("Profil perusahaan belum tersedia. Jalankan migrasi terbaru.");
        const updated = await tx.businessProfile.updateMany({
          where: { id: "default", version: parsed.data.version },
          data: {
            name: parsed.data.name,
            phone: parsed.data.phone,
            email: parsed.data.email?.toLowerCase(),
            address: parsed.data.address,
            ...(uploadedPath ? { logoPath: uploadedPath } : {}),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new UserFacingError("Profil perusahaan sudah berubah. Muat ulang halaman.");
        await tx.auditEvent.create({
          data: { actorId: actor.id, entityType: "BusinessProfile", entityId: "default", action: "BUSINESS_PROFILE_UPDATED", changedFields: ["name", "phone", "email", "address", ...(uploadedPath ? ["logoPath"] : [])] },
        });
      });
    } catch (error) {
      if (uploadedPath) await createAdminClient().storage.from("business-assets").remove([uploadedPath]);
      throw error;
    }
    revalidatePath("/master-data/business-profile");
    return flashMessagePath("/master-data/business-profile", "notice", "Profil perusahaan berhasil diperbarui.");
  });
}
