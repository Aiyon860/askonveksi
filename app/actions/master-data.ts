"use server";

import { Prisma, type GarmentType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";

import { flashMessagePath, runRedirectingAction, UserFacingError } from "@/lib/actions/response";
import { MASTER_DATA_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { groupProductCategories } from "@/lib/crm/constants";
import {
  bulkUpdateMasterDataSchema,
  bulkUpdateProductCategoriesSchema,
  businessProfileSchema,
  firstValidationMessage,
  invoiceSettingsSchema,
  productCategoryFieldsSchema,
  sortableMasterDataFieldsSchema,
} from "@/lib/crm/validation";
import {
  parseMasterDataWorkbook,
  PRODUCT_CATEGORY_EXCEL_KIND,
  type MasterDataExcelRow,
} from "@/lib/master-data-excel";
import { getPrismaClient } from "@/lib/prisma";
import { SITE_LOGO_CACHE_TAG } from "@/lib/site-logo";
import { createAdminClient } from "@/lib/supabase/admin";

function fields(formData: FormData) {
  return { name: formData.get("name"), description: formData.get("description"), position: formData.get("position") };
}

async function assertUniqueName(kind: "customerType" | "leadSource" | "paymentMethod" | "productCategory", name: string, excludedId?: string) {
  const prisma = getPrismaClient();
  const where = { name: { equals: name, mode: "insensitive" as const }, ...(excludedId ? { id: { not: excludedId } } : {}) };
  const existing = kind === "customerType"
    ? await prisma.customerType.findFirst({ where, select: { id: true } })
    : kind === "leadSource"
      ? await prisma.leadSource.findFirst({ where, select: { id: true } })
      : kind === "productCategory"
        ? await prisma.productCategory.findFirst({ where, select: { id: true } })
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

async function countUsed(kind: "customerType" | "leadSource" | "garmentSize" | "paymentMethod" | "productCategory", id: string) {
  const prisma = getPrismaClient();
  if (kind === "customerType") {
    return prisma.customer.count({ where: { customerTypeId: id } });
  }
  if (kind === "productCategory") {
    return prisma.purchaseOrder.count({ where: { productCategoryId: id } });
  }
  if (kind === "leadSource") {
    const [customers, opportunities] = await Promise.all([
      prisma.customer.count({ where: { leadSourceId: id } }),
      prisma.opportunity.count({ where: { leadSourceId: id } }),
    ]);
    return customers + opportunities;
  }
  if (kind === "garmentSize") {
    const [purchaseRows, rosterEntries, invoiceItems] = await Promise.all([
      prisma.purchaseOrderSize.count({ where: { sizeId: id } }),
      prisma.purchaseOrderRosterEntry.count({ where: { sizeId: id } }),
      prisma.invoiceItem.count({ where: { sizeId: id } }),
    ]);
    return purchaseRows + rosterEntries + invoiceItems;
  }
  const [transactions, expenses] = await Promise.all([
    prisma.paymentTransaction.count({ where: { paymentMethodId: id } }),
    prisma.expense.count({ where: { paymentMethodId: id } }),
  ]);
  return transactions + expenses;
}

export async function deleteCustomerTypeAction(formData: FormData) {
  return runRedirectingAction("/master-data/customer-types", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const id = formData.get("id");
    if (typeof id !== "string" || !id) throw new UserFacingError("Jenis customer tidak ditemukan. Muat ulang halaman.");
    const current = await getPrismaClient().customerType.findUnique({ where: { id }, select: { name: true } });
    if (!current) throw new UserFacingError("Jenis customer tidak ditemukan atau sudah dihapus.");
    const used = await countUsed("customerType", id);
    if (used > 0) throw new UserFacingError(`Jenis customer "${current.name}" masih digunakan oleh ${used} customer dan tidak bisa dihapus.`);
    await getPrismaClient().$transaction(async (tx) => {
      await tx.customerType.delete({ where: { id } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "CustomerType", entityId: id, action: "CUSTOMER_TYPE_DELETED", changedFields: ["name", "description", "position"] } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/master-data/customer-types");
    revalidatePath("/customers");
    return flashMessagePath("/master-data/customer-types", "notice", `Jenis customer "${current.name}" berhasil dihapus.`);
  });
}

export async function deleteLeadSourceAction(formData: FormData) {
  return runRedirectingAction("/master-data/lead-sources", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const id = formData.get("id");
    if (typeof id !== "string" || !id) throw new UserFacingError("Sumber lead tidak ditemukan. Muat ulang halaman.");
    const current = await getPrismaClient().leadSource.findUnique({ where: { id }, select: { name: true } });
    if (!current) throw new UserFacingError("Sumber lead tidak ditemukan atau sudah dihapus.");
    const used = await countUsed("leadSource", id);
    if (used > 0) throw new UserFacingError(`Sumber lead "${current.name}" masih digunakan oleh ${used} data dan tidak bisa dihapus.`);
    await getPrismaClient().$transaction(async (tx) => {
      await tx.leadSource.delete({ where: { id } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "LeadSource", entityId: id, action: "LEAD_SOURCE_DELETED", changedFields: ["name", "description", "position"] } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/master-data/lead-sources");
    revalidatePath("/customers");
    return flashMessagePath("/master-data/lead-sources", "notice", `Sumber lead "${current.name}" berhasil dihapus.`);
  });
}

export async function deleteGarmentSizeAction(formData: FormData) {
  return runRedirectingAction("/master-data/garment-sizes", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const id = formData.get("id");
    if (typeof id !== "string" || !id) throw new UserFacingError("Ukuran pakaian tidak ditemukan. Muat ulang halaman.");
    const current = await getPrismaClient().garmentSize.findUnique({ where: { id }, select: { name: true } });
    if (!current) throw new UserFacingError("Ukuran pakaian tidak ditemukan atau sudah dihapus.");
    const used = await countUsed("garmentSize", id);
    if (used > 0) throw new UserFacingError(`Ukuran "${current.name}" masih digunakan oleh ${used} data dan tidak bisa dihapus.`);
    await getPrismaClient().$transaction(async (tx) => {
      await tx.garmentSize.delete({ where: { id } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "GarmentSize", entityId: id, action: "GARMENT_SIZE_DELETED", changedFields: ["name", "description", "position"] } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/master-data/garment-sizes");
    revalidatePath("/crm");
    return flashMessagePath("/master-data/garment-sizes", "notice", `Ukuran "${current.name}" berhasil dihapus.`);
  });
}

export async function deletePaymentMethodAction(formData: FormData) {
  return runRedirectingAction("/master-data/payment-methods", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const id = formData.get("id");
    if (typeof id !== "string" || !id) throw new UserFacingError("Metode pembayaran tidak ditemukan. Muat ulang halaman.");
    const current = await getPrismaClient().paymentMethod.findUnique({ where: { id }, select: { name: true } });
    if (!current) throw new UserFacingError("Metode pembayaran tidak ditemukan atau sudah dihapus.");
    const used = await countUsed("paymentMethod", id);
    if (used > 0) throw new UserFacingError(`Metode pembayaran "${current.name}" masih digunakan oleh ${used} transaksi dan tidak bisa dihapus.`);
    await getPrismaClient().$transaction(async (tx) => {
      await tx.paymentMethod.delete({ where: { id } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "PaymentMethod", entityId: id, action: "PAYMENT_METHOD_DELETED", changedFields: ["name", "description", "position"] } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/master-data/payment-methods");
    revalidatePath("/crm");
    return flashMessagePath("/master-data/payment-methods", "notice", `Metode pembayaran "${current.name}" berhasil dihapus.`);
  });
}

async function importProductCategoryRows(actorId: string, rows: MasterDataExcelRow[]) {
  await getPrismaClient().$transaction(async (tx) => {
    const currentItems = await tx.productCategory.findMany({
      select: { id: true, name: true, garmentType: true, position: true, isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
    const currentByName = new Map(currentItems.map((item) => [item.name.toLocaleLowerCase("id-ID"), item]));
    if (currentByName.size !== currentItems.length) throw new UserFacingError("Data kategori produk memiliki nama duplikat. Rapikan data sebelum import.");

    // Baris hasil import dikelompokkan Jersey > Non-jersey > Aksesoris; baris yang tidak
    // disentuh file tetap mengikuti urutannya sendiri di belakang baris import dalam grupnya.
    type OrderedRow = { name: string; garmentType: GarmentType; matchedId: string | null; isActive: boolean };
    const logicalRows: OrderedRow[] = rows.map((row) => {
      const garmentType = row.kind === "JERSEY" || row.kind === "NON_JERSEY" || row.kind === "AKSESORI" ? row.kind : null;
      if (!garmentType) throw new UserFacingError(`${PRODUCT_CATEGORY_EXCEL_KIND.header} pada data "${row.name}" tidak dikenali.`);
      return { name: row.name, garmentType, matchedId: currentByName.get(row.name.toLocaleLowerCase("id-ID"))?.id ?? null, isActive: true };
    });
    const normalizedNames = logicalRows.map((row) => row.name.toLocaleLowerCase("id-ID"));
    if (new Set(normalizedNames).size !== normalizedNames.length) throw new UserFacingError("Nama kategori produk pada file tidak boleh duplikat.");

    const matchedIds = new Set(logicalRows.flatMap((row) => (row.matchedId ? [row.matchedId] : [])));
    const untouchedRows: OrderedRow[] = currentItems
      .filter((item) => !matchedIds.has(item.id))
      .map((item) => ({ name: item.name, garmentType: item.garmentType, matchedId: item.id, isActive: item.isActive }));
    const orderedRows = groupProductCategories([...logicalRows, ...untouchedRows], (row) => row.garmentType);

    const currentById = new Map(currentItems.map((item) => [item.id, item]));
    for (const [position, row] of orderedRows.entries()) {
      const current = row.matchedId ? currentById.get(row.matchedId) : undefined;
      if (!current) {
        const created = await tx.productCategory.create({ data: { name: row.name, garmentType: row.garmentType, position }, select: { id: true } });
        await tx.auditEvent.create({ data: { actorId, entityType: "ProductCategory", entityId: created.id, action: "PRODUCT_CATEGORY_CREATED", changedFields: ["name", "garmentType", "position"] } });
        continue;
      }
      const changedFields = [
        current.name !== row.name ? "name" : null,
        current.garmentType !== row.garmentType ? "garmentType" : null,
        current.position !== position ? "position" : null,
        current.isActive !== row.isActive ? "isActive" : null,
      ].filter((field): field is string => field !== null);
      if (!changedFields.length) continue;
      await tx.productCategory.update({ where: { id: current.id }, data: { name: row.name, garmentType: row.garmentType, position, isActive: row.isActive } });
      await tx.auditEvent.create({ data: { actorId, entityType: "ProductCategory", entityId: current.id, action: "PRODUCT_CATEGORY_UPDATED", changedFields } });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

type InvoiceSettingGroups = Array<{ section: "KETERANGAN" | "SYARAT_KETENTUAN"; rows: Array<{ id?: string | undefined; text: string; bold: boolean }> }>;

/**
 * Simpan dua kolom master "Pengaturan invoice" sekaligus.
 * Baris yang tidak lagi dikirim form dianggap dihapus user, sisanya diperbarui di
 * tempat (id tetap) supaya jejak audit per poin tidak hilang.
 */
export async function saveInvoiceSettingsAction(formData: FormData) {
  return runRedirectingAction("/master-data/invoice-settings", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const rawPoints = formData.get("points");
    if (typeof rawPoints !== "string" || rawPoints.length > 60_000) {
      throw new UserFacingError("Data pengaturan invoice tidak valid. Muat ulang lalu coba lagi.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawPoints);
    } catch {
      throw new UserFacingError("Data pengaturan invoice tidak valid. Muat ulang lalu coba lagi.");
    }

    const parsed = invoiceSettingsSchema.safeParse(payload);
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const groups: InvoiceSettingGroups = [
      { section: "KETERANGAN", rows: parsed.data.keterangan },
      { section: "SYARAT_KETENTUAN", rows: parsed.data.syarat },
    ];
    const submittedIds = groups.flatMap((group) => group.rows.flatMap((row) => (row.id ? [row.id] : [])));
    if (new Set(submittedIds).size !== submittedIds.length) {
      throw new UserFacingError("Poin pengaturan invoice tidak boleh duplikat. Muat ulang lalu coba lagi.");
    }

    await getPrismaClient().$transaction(async (tx) => {
      const currentRows = await tx.invoiceSettingPoint.findMany({
        select: { id: true, section: true, text: true, isBold: true, position: true },
      });
      const currentById = new Map(currentRows.map((row) => [row.id, row]));
      const keptIds = new Set<string>();

      for (const { section, rows } of groups) {
        for (const [position, row] of rows.entries()) {
          const current = row.id ? currentById.get(row.id) : undefined;
          if (row.id && !current) throw new UserFacingError("Poin pengaturan invoice sudah berubah. Muat ulang lalu coba lagi.");
          if (!current) {
            const created = await tx.invoiceSettingPoint.create({
              data: { section, text: row.text, isBold: row.bold, position },
              select: { id: true },
            });
            keptIds.add(created.id);
            await tx.auditEvent.create({
              data: { actorId: actor.id, entityType: "InvoiceSettingPoint", entityId: created.id, action: "INVOICE_SETTING_POINT_CREATED", changedFields: ["section", "text", "isBold", "position"] },
            });
            continue;
          }
          keptIds.add(current.id);
          const changedFields = [
            current.section !== section ? "section" : null,
            current.text !== row.text ? "text" : null,
            current.isBold !== row.bold ? "isBold" : null,
            current.position !== position ? "position" : null,
          ].filter((field): field is string => field !== null);
          if (!changedFields.length) continue;
          await tx.invoiceSettingPoint.update({
            where: { id: current.id },
            data: { section, text: row.text, isBold: row.bold, position },
          });
          await tx.auditEvent.create({
            data: { actorId: actor.id, entityType: "InvoiceSettingPoint", entityId: current.id, action: "INVOICE_SETTING_POINT_UPDATED", changedFields },
          });
        }
      }

      for (const row of currentRows) {
        if (keptIds.has(row.id)) continue;
        await tx.invoiceSettingPoint.delete({ where: { id: row.id } });
        await tx.auditEvent.create({
          data: { actorId: actor.id, entityType: "InvoiceSettingPoint", entityId: row.id, action: "INVOICE_SETTING_POINT_DELETED", changedFields: ["section", "text", "isBold", "position"] },
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/master-data/invoice-settings");
    revalidatePath("/crm/invoices");
    return flashMessagePath("/master-data/invoice-settings", "notice", "Pengaturan invoice berhasil disimpan.");
  });
}

export async function createProductCategoryAction(formData: FormData) {
  return runRedirectingAction("/master-data/product-categories", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const parsed = productCategoryFieldsSchema.safeParse({ name: formData.get("name"), kind: formData.get("kind") });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    await assertUniqueName("productCategory", parsed.data.name);
    await getPrismaClient().$transaction(async (tx) => {
      // Posisi dihitung di dalam grupnya sendiri supaya data baru selalu jatuh
      // pada urutan paksa Jersey > Non-jersey > Aksesoris.
      const lastItem = await tx.productCategory.aggregate({ where: { garmentType: parsed.data.kind }, _max: { position: true } });
      const created = await tx.productCategory.create({
        data: { name: parsed.data.name, garmentType: parsed.data.kind, position: (lastItem._max.position ?? -1) + 1 },
        select: { id: true },
      });
      await tx.auditEvent.create({
        data: { actorId: actor.id, entityType: "ProductCategory", entityId: created.id, action: "PRODUCT_CATEGORY_CREATED", changedFields: ["name", "garmentType", "position"] },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/master-data/product-categories");
    revalidatePath("/crm");
    return flashMessagePath("/master-data/product-categories", "notice", "Kategori produk berhasil dibuat.");
  });
}

export async function importProductCategoriesAction(formData: FormData) {
  return runRedirectingAction("/master-data/product-categories", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const rows = await parseMasterDataWorkbook(excelFile(formData), 80, PRODUCT_CATEGORY_EXCEL_KIND);
    await importProductCategoryRows(actor.id, rows);
    revalidatePath("/master-data/product-categories");
    revalidatePath("/crm");
    return flashMessagePath("/master-data/product-categories", "notice", "Import kategori produk berhasil.");
  });
}

export async function bulkUpdateProductCategoriesAction(formData: FormData) {
  return runRedirectingAction("/master-data/product-categories", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const rawItems = formData.get("items");
    if (typeof rawItems !== "string" || rawItems.length > 200_000) throw new UserFacingError("Data kategori produk tidak valid. Muat ulang lalu coba lagi.");
    let payload: unknown;
    try {
      payload = JSON.parse(rawItems);
    } catch {
      throw new UserFacingError("Data kategori produk tidak valid. Muat ulang lalu coba lagi.");
    }
    const parsed = bulkUpdateProductCategoriesSchema.safeParse(payload);
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    const submittedIds = new Set(parsed.data.map((item) => item.id));
    const normalizedNames = parsed.data.map((item) => item.name.toLocaleLowerCase("id-ID"));
    if (submittedIds.size !== parsed.data.length || new Set(normalizedNames).size !== normalizedNames.length) {
      throw new UserFacingError("ID dan nama kategori produk tidak boleh duplikat.");
    }
    // Urutan paksa Jersey > Non-jersey > Aksesoris, di dalam grup mengikuti urutan drag user.
    const orderedItems = groupProductCategories(parsed.data, (item) => item.kind);

    await getPrismaClient().$transaction(async (tx) => {
      const currentItems = await tx.productCategory.findMany({ select: { id: true, name: true, garmentType: true, position: true, isActive: true } });
      if (currentItems.length !== parsed.data.length || currentItems.some((item) => !submittedIds.has(item.id))) {
        throw new UserFacingError("Daftar kategori produk sudah berubah. Muat ulang lalu coba lagi.");
      }
      const currentById = new Map(currentItems.map((item) => [item.id, item]));
      for (const item of orderedItems) {
        const current = currentById.get(item.id);
        if (current && current.name !== item.name) await tx.productCategory.update({ where: { id: item.id }, data: { name: `temporary-${randomUUID()}` } });
      }
      for (const [position, item] of orderedItems.entries()) {
        const current = currentById.get(item.id);
        if (!current) throw new UserFacingError("Kategori produk tidak ditemukan. Muat ulang lalu coba lagi.");
        const changedFields = [
          current.name !== item.name ? "name" : null,
          current.garmentType !== item.kind ? "garmentType" : null,
          current.position !== position ? "position" : null,
          !current.isActive ? "isActive" : null,
        ].filter((field): field is string => field !== null);
        if (!changedFields.length) continue;
        await tx.productCategory.update({ where: { id: item.id }, data: { name: item.name, garmentType: item.kind, position, isActive: true } });
        await tx.auditEvent.create({
          data: { actorId: actor.id, entityType: "ProductCategory", entityId: item.id, action: "PRODUCT_CATEGORY_UPDATED", changedFields },
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/master-data/product-categories");
    revalidatePath("/crm");
    return flashMessagePath("/master-data/product-categories", "notice", "Kategori produk berhasil diperbarui.");
  });
}

export async function deleteProductCategoryAction(formData: FormData) {
  return runRedirectingAction("/master-data/product-categories", async () => {
    const actor = await requireActor(MASTER_DATA_ROLES);
    const id = formData.get("id");
    if (typeof id !== "string" || !id) throw new UserFacingError("Kategori produk tidak ditemukan. Muat ulang halaman.");
    const current = await getPrismaClient().productCategory.findUnique({ where: { id }, select: { name: true } });
    if (!current) throw new UserFacingError("Kategori produk tidak ditemukan atau sudah dihapus.");
    const used = await countUsed("productCategory", id);
    if (used > 0) throw new UserFacingError(`Kategori "${current.name}" masih digunakan oleh ${used} PO dan tidak bisa dihapus.`);
    await getPrismaClient().$transaction(async (tx) => {
      await tx.productCategory.delete({ where: { id } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "ProductCategory", entityId: id, action: "PRODUCT_CATEGORY_DELETED", changedFields: ["name", "garmentType", "position"] } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/master-data/product-categories");
    revalidatePath("/crm");
    return flashMessagePath("/master-data/product-categories", "notice", `Kategori "${current.name}" berhasil dihapus.`);
  });
}

async function readBusinessImage(file: File, label: string) {
  if (file.size > 2 * 1024 * 1024) throw new UserFacingError(`${label} maksimal 2 MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPng = file.type === "image/png" && bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  const isJpeg = file.type === "image/jpeg" && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = file.type === "image/webp" && bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!isPng && !isJpeg && !isWebp) throw new UserFacingError(`${label} harus berupa PNG, JPG, atau WebP yang valid.`);
  const extension = isPng ? "png" : isWebp ? "webp" : "jpg";
  return { bytes, type: file.type, extension };
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
      signatureName: formData.get("signatureName"),
      signatureTitle: formData.get("signatureTitle"),
      invoiceNotes: formData.get("invoiceNotes"),
    });
    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const logo = formData.get("logo");
    let uploadedLogoPath: string | null = null;
    if (logo instanceof File && logo.size) {
      const image = await readBusinessImage(logo, "Logo");
      uploadedLogoPath = `business/logo-${randomUUID()}.${image.extension}`;
      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedLogoPath, image.bytes, { contentType: image.type, upsert: false });
      if (error) throw new UserFacingError("Logo belum dapat disimpan. Pastikan bucket business-assets sudah disiapkan.");
    }

    // Gambar tanda tangan boleh diganti atau dihapus. File lama sengaja tidak
    // ikut dihapus: path-nya sudah tersimpan di snapshot invoice yang terkunci.
    const signature = formData.get("signature");
    let uploadedSignaturePath: string | null = null;
    if (signature instanceof File && signature.size) {
      const image = await readBusinessImage(signature, "Gambar tanda tangan");
      uploadedSignaturePath = `business/signature-${randomUUID()}.${image.extension}`;
      const { error } = await createAdminClient().storage.from("business-assets").upload(uploadedSignaturePath, image.bytes, { contentType: image.type, upsert: false });
      if (error) throw new UserFacingError("Gambar tanda tangan belum dapat disimpan. Pastikan bucket business-assets sudah disiapkan.");
    }
    const removeSignature = formData.get("removeSignature") === "1" && !uploadedSignaturePath;

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
            signatureName: parsed.data.signatureName,
            signatureTitle: parsed.data.signatureTitle,
            invoiceNotes: parsed.data.invoiceNotes,
            ...(uploadedLogoPath ? { logoPath: uploadedLogoPath } : {}),
            ...(uploadedSignaturePath ? { signaturePath: uploadedSignaturePath } : {}),
            ...(removeSignature ? { signaturePath: null } : {}),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new UserFacingError("Profil perusahaan sudah berubah. Muat ulang halaman.");
        await tx.auditEvent.create({
          data: { actorId: actor.id, entityType: "BusinessProfile", entityId: "default", action: "BUSINESS_PROFILE_UPDATED", changedFields: ["name", "phone", "email", "address", "signatureName", "signatureTitle", "invoiceNotes", ...(uploadedLogoPath ? ["logoPath"] : []), ...(uploadedSignaturePath || removeSignature ? ["signaturePath"] : [])] },
        });
      });
    } catch (error) {
      if (uploadedLogoPath) await createAdminClient().storage.from("business-assets").remove([uploadedLogoPath]);
      if (uploadedSignaturePath) await createAdminClient().storage.from("business-assets").remove([uploadedSignaturePath]);
      throw error;
    }
    revalidatePath("/master-data/business-profile");
    revalidateTag(SITE_LOGO_CACHE_TAG, { expire: 0 });
    return flashMessagePath("/master-data/business-profile", "notice", "Profil perusahaan berhasil diperbarui.");
  });
}
