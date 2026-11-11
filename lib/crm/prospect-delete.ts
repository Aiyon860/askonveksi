import type { Prisma } from "@prisma/client";

import { UserFacingError } from "../actions/errors.ts";

/**
 * Hapus prospek bisa sekaligus membersihkan PO, invoice, dan Sales Order yang
 * dibuat karena salah input. Karena itu penghapusan hanya diizinkan selama
 * belum ada jejak uang, produksi, atau pengeluaran — semuanya dicek sebelum
 * satu baris pun dihapus.
 */

/** Prospek yang sudah Deal (Sales Order) tidak dihapus dari sini; pakai alur pembatalan order. */
export function prospectDeleteBlockReason({
  stage,
  isRepeatOrder,
}: {
  stage: string;
  isRepeatOrder: boolean;
}): string | null {
  if (isRepeatOrder || stage === "DEAL") {
    return "Prospek ini sudah menjadi Deal (Sales Order). Batalkan order lewat alur pembatalan, bukan dihapus.";
  }
  return null;
}

export type ProspectPurgeCounts = {
  paymentTransactionCount: number;
  depositCount: number;
  productionWorkOrderCount: number;
  expenseCount: number;
};

/**
 * Pengaman hapus berantai: uang yang sudah masuk dan pekerjaan yang sudah
 * berjalan tidak boleh hilang bersama prospek.
 */
export function prospectPurgeBlockReason({
  paymentTransactionCount,
  depositCount,
  productionWorkOrderCount,
  expenseCount,
}: ProspectPurgeCounts): string | null {
  if (paymentTransactionCount > 0) {
    return "Prospek ini sudah punya pembayaran tercatat. Void pembayaran terlebih dahulu, lalu hapus ulang.";
  }
  if (depositCount > 0) {
    return "Prospek ini sudah punya deposit PO. Hapus prospek tidak dapat menghapus uang yang sudah masuk.";
  }
  if (productionWorkOrderCount > 0) {
    return "Prospek ini sudah masuk produksi. Selesaikan atau batalkan order lewat modul Produksi.";
  }
  if (expenseCount > 0) {
    return "Prospek ini punya pengeluaran tercatat di Keuangan. Hapus prospek tidak dapat menghapus data pengeluaran.";
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
  deletedPurchaseOrders: string[];
  deletedInvoices: string[];
  deletedSalesOrders: string[];
  /** Lampiran di storage yang harus dibersihkan setelah transaksi commit. */
  filePaths: string[];
};

/**
 * Hapus satu prospek beserta seluruh dokumen yang lahir darinya: PO, invoice,
 * Sales Order, pembayaran, reminder, riwayat komunikasi, dan job WhatsApp.
 *
 * Urutan hapus mengikuti foreign key `Restrict` di skema; semua berjalan dalam
 * satu transaksi yang sama dengan action pemanggil.
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
      customer: {
        select: {
          id: true,
          lifecycle: true,
          version: true,
          _count: { select: { opportunities: true, reminders: true } },
        },
      },
      purchaseOrders: {
        select: {
          id: true,
          purchaseOrderNo: true,
          attachments: { select: { path: true } },
          items: { select: { designs: { select: { path: true } } } },
          designTask: {
            select: {
              revisions: {
                select: { attachments: { select: { path: true } } },
              },
            },
          },
        },
        orderBy: { revision: "asc" },
      },
      invoices: { select: { id: true, invoiceNo: true }, orderBy: { revision: "asc" } },
      salesOrders: { select: { id: true, salesOrderNo: true } },
    },
  });

  if (!prospect) {
    throw new UserFacingError("Prospek tidak ditemukan atau sudah dihapus.");
  }
  const dealBlockReason = prospectDeleteBlockReason(prospect);
  if (dealBlockReason) throw new UserFacingError(dealBlockReason);

  const purchaseOrderIds = prospect.purchaseOrders.map((item) => item.id);
  const invoiceIds = prospect.invoices.map((item) => item.id);
  const salesOrderIds = prospect.salesOrders.map((item) => item.id);
  const hasDocuments = purchaseOrderIds.length > 0 || invoiceIds.length > 0 || salesOrderIds.length > 0;

  if (hasDocuments) {
    const [paymentTransactionCount, depositCount, productionWorkOrderCount, expenseCount] = await Promise.all([
      tx.paymentTransaction.count({ where: { payment: { salesOrderId: { in: salesOrderIds } } } }),
      tx.purchaseOrderDeposit.count({ where: { purchaseOrderId: { in: purchaseOrderIds } } }),
      tx.productionWorkOrder.count({ where: { salesOrderId: { in: salesOrderIds } } }),
      tx.expense.count({
        where: {
          OR: [
            { salesOrderId: { in: salesOrderIds } },
            { salesOrderProductCost: { salesOrderId: { in: salesOrderIds } } },
          ],
        },
      }),
    ]);
    const purgeBlockReason = prospectPurgeBlockReason({
      paymentTransactionCount,
      depositCount,
      productionWorkOrderCount,
      expenseCount,
    });
    if (purgeBlockReason) throw new UserFacingError(purgeBlockReason);
  }

  const reminders = salesOrderIds.length
    ? await tx.customerReminder.findMany({ where: { sourceSalesOrderId: { in: salesOrderIds } }, select: { id: true } })
    : [];
  const reminderIds = reminders.map((item) => item.id);

  // 1. Job WhatsApp menggantung ke peluang, invoice, dan reminder (semua Restrict).
  await tx.whatsAppAutomationJob.deleteMany({
    where: {
      OR: [
        { opportunityId: prospect.id },
        ...(invoiceIds.length ? [{ invoiceId: { in: invoiceIds } }] : []),
        ...(reminderIds.length ? [{ reminderId: { in: reminderIds } }] : []),
      ],
    },
  });

  // 2. Reminder beserta tanda terimanya.
  if (reminderIds.length) {
    await tx.customerReminderReceipt.deleteMany({ where: { reminderId: { in: reminderIds } } });
    await tx.customerReminder.deleteMany({ where: { id: { in: reminderIds } } });
  }

  // 3. Sales Order beserta pembayaran dan biayanya.
  if (salesOrderIds.length) {
    await tx.paymentTerm.deleteMany({ where: { payment: { salesOrderId: { in: salesOrderIds } } } });
    await tx.dealPayment.deleteMany({ where: { salesOrderId: { in: salesOrderIds } } });
    await tx.salesOrderItem.deleteMany({ where: { salesOrderId: { in: salesOrderIds } } });
    await tx.salesOrderCost.deleteMany({ where: { salesOrderId: { in: salesOrderIds } } });
    await tx.salesOrderProductCost.deleteMany({ where: { salesOrderId: { in: salesOrderIds } } });
    await tx.salesOrder.deleteMany({ where: { id: { in: salesOrderIds } } });
  }

  // 4. Invoice beserta baris, add on, dan jadwal pembayaran yang belum jadi.
  if (invoiceIds.length) {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await tx.invoiceAddon.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await tx.pendingPaymentTerm.deleteMany({ where: { pendingPayment: { invoiceId: { in: invoiceIds } } } });
    await tx.pendingDealPayment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  }

  // 5. Purchase Order beserta produk, ukuran, roster, lampiran, dan desain.
  const filePaths = [
    ...prospect.purchaseOrders.flatMap((item) => [
      ...item.attachments.map((attachment) => attachment.path),
      ...item.items.flatMap((line) => line.designs.map((design) => design.path)),
      ...(item.designTask?.revisions.flatMap((revision) => revision.attachments.map((attachment) => attachment.path)) ?? []),
    ]),
  ].filter((path): path is string => Boolean(path));

  if (purchaseOrderIds.length) {
    await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: { in: purchaseOrderIds } } });
    await tx.purchaseOrderSize.deleteMany({ where: { purchaseOrderId: { in: purchaseOrderIds } } });
    await tx.purchaseOrderRosterEntry.deleteMany({ where: { purchaseOrderId: { in: purchaseOrderIds } } });
    await tx.purchaseOrderAttachment.deleteMany({ where: { purchaseOrderId: { in: purchaseOrderIds } } });
    await tx.designAttachment.deleteMany({ where: { designRevision: { designTask: { purchaseOrderId: { in: purchaseOrderIds } } } } });
    await tx.designRevision.deleteMany({ where: { designTask: { purchaseOrderId: { in: purchaseOrderIds } } } });
    await tx.designTask.deleteMany({ where: { purchaseOrderId: { in: purchaseOrderIds } } });
    await tx.purchaseOrderDeposit.deleteMany({ where: { purchaseOrderId: { in: purchaseOrderIds } } });
    await tx.purchaseOrder.deleteMany({ where: { id: { in: purchaseOrderIds } } });
  }

  // 6. Riwayat komunikasi peluang, lalu peluangnya sendiri dengan kunci versi.
  await tx.communicationActivity.deleteMany({ where: { opportunityId: prospect.id } });
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

  // 7. Customer prospek yang tidak punya peluang/reminder lain ikut dibersihkan.
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

  return {
    opportunityNo: prospect.opportunityNo,
    customerId: prospect.customerId,
    customerRemoved,
    deletedPurchaseOrders: prospect.purchaseOrders.map((item) => item.purchaseOrderNo),
    deletedInvoices: prospect.invoices.map((item) => item.invoiceNo),
    deletedSalesOrders: prospect.salesOrders.map((item) => item.salesOrderNo),
    filePaths,
  };
}
