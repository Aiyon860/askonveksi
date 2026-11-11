import type { Prisma } from "@prisma/client";

import { UserFacingError } from "../actions/errors.ts";

/**
 * Aturan hapus prospek: hanya prospek yang belum menjadi Deal dan belum punya
 * dokumen order (PO, invoice, atau Sales Order) yang boleh dihapus permanen.
 */
export type ProspectOrderCounts = {
  stage: string;
  isRepeatOrder: boolean;
  purchaseOrderCount: number;
  invoiceCount: number;
  salesOrderCount: number;
};

export function prospectDeleteBlockReason({
  stage,
  isRepeatOrder,
  purchaseOrderCount,
  invoiceCount,
  salesOrderCount,
}: ProspectOrderCounts): string | null {
  if (isRepeatOrder || stage === "DEAL") {
    return "Prospek yang sudah menjadi Deal tidak dapat dihapus.";
  }
  if (purchaseOrderCount > 0 || invoiceCount > 0 || salesOrderCount > 0) {
    return "Prospek yang sudah memiliki order tidak dapat dihapus.";
  }
  return null;
}

/**
 * Customer hasil form prospek (lifecycle PROSPEK) ikut dihapus agar tidak
 * menyisakan data yatim, tetapi hanya bila ia tidak punya peluang atau
 * reminder lain di luar prospek yang sedang dihapus.
 */
export function prospectCustomerRemovable({
  lifecycle,
  opportunityCount,
  reminderCount,
}: {
  lifecycle: string;
  opportunityCount: number;
  reminderCount: number;
}) {
  return lifecycle === "PROSPEK" && opportunityCount <= 1 && reminderCount === 0;
}

export type DeletedProspect = {
  opportunityNo: string;
  customerId: string;
  customerRemoved: boolean;
};

/**
 * Hapus satu prospek beserta riwayat komunikasi dan job WhatsApp miliknya.
 * Dokumen order tidak pernah ikut terhapus karena prospek dengan order ditolak
 * sebelum penghapusan dijalankan.
 */
export async function deleteProspectRecord(
  tx: Prisma.TransactionClient,
  { opportunityId, version }: { opportunityId: string; version: number },
): Promise<DeletedProspect> {
  const prospect = await tx.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      id: true,
      opportunityNo: true,
      stage: true,
      isRepeatOrder: true,
      customerId: true,
      _count: { select: { purchaseOrders: true, invoices: true, salesOrders: true } },
      customer: {
        select: {
          id: true,
          lifecycle: true,
          version: true,
          _count: { select: { opportunities: true, reminders: true } },
        },
      },
    },
  });

  if (!prospect) {
    throw new UserFacingError("Prospek tidak ditemukan atau sudah dihapus.");
  }

  const blockReason = prospectDeleteBlockReason({
    stage: prospect.stage,
    isRepeatOrder: prospect.isRepeatOrder,
    purchaseOrderCount: prospect._count.purchaseOrders,
    invoiceCount: prospect._count.invoices,
    salesOrderCount: prospect._count.salesOrders,
  });
  if (blockReason) throw new UserFacingError(blockReason);

  await tx.communicationActivity.deleteMany({ where: { opportunityId: prospect.id } });
  await tx.whatsAppAutomationJob.deleteMany({ where: { opportunityId: prospect.id } });

  const removed = await tx.opportunity.deleteMany({
    where: {
      id: prospect.id,
      customerId: prospect.customerId,
      version,
      stage: { not: "DEAL" },
      isRepeatOrder: false,
    },
  });
  if (removed.count !== 1) {
    throw new UserFacingError("Data prospek sudah berubah. Muat ulang halaman lalu coba lagi.");
  }

  let customerRemoved = false;
  if (
    prospectCustomerRemovable({
      lifecycle: prospect.customer.lifecycle,
      opportunityCount: prospect.customer._count.opportunities,
      reminderCount: prospect.customer._count.reminders,
    })
  ) {
    await tx.communicationActivity.deleteMany({ where: { customerId: prospect.customerId } });
    const deletedCustomer = await tx.customer.deleteMany({
      where: {
        id: prospect.customerId,
        version: prospect.customer.version,
        lifecycle: "PROSPEK",
      },
    });
    customerRemoved = deletedCustomer.count === 1;
  }

  return { opportunityNo: prospect.opportunityNo, customerId: prospect.customerId, customerRemoved };
}
