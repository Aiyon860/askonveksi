import "server-only";

import { MASTER_DATA_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

export async function getCustomerFormOptions() {
  await requireActor();
  const prisma = getPrismaClient();
  const [customerTypes, leadSources, salesUsers] = await Promise.all([
    prisma.customerType.findMany({
      select: { id: true, name: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    prisma.leadSource.findMany({
      select: { id: true, name: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    prisma.appUser.findMany({
      where: { role: "SALES", isActive: true },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);
  return { customerTypes, leadSources, salesUsers };
}

export async function getCustomerTypes() {
  await requireActor(MASTER_DATA_ROLES);
  return getPrismaClient().customerType.findMany({
    select: { id: true, name: true, description: true, position: true, _count: { select: { customers: true } } },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

export async function getLeadSources() {
  await requireActor(MASTER_DATA_ROLES);
  return getPrismaClient().leadSource.findMany({
    select: { id: true, name: true, description: true, position: true, _count: { select: { customers: true } } },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

export async function getGarmentSizes() {
  await requireActor(MASTER_DATA_ROLES);
  const items = await getPrismaClient().garmentSize.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      position: true,
      _count: { select: { purchaseRows: true, rosterEntries: true } },
    },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  return items.map((item) => ({
    ...item,
    _count: { customers: item._count.purchaseRows + item._count.rosterEntries },
  }));
}

export async function getActiveGarmentSizes() {
  await requireActor();
  return getPrismaClient().garmentSize.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

export async function getBusinessProfile() {
  await requireActor(MASTER_DATA_ROLES);
  return getPrismaClient().businessProfile.findUnique({ where: { id: "default" } });
}
