import "server-only";

import { Prisma } from "@prisma/client";

import { requireActor, requireDeveloperActor } from "@/lib/auth/session";
import { CRM_VIEW_ROLES, PRODUCTION_VIEW_ROLES } from "@/lib/auth/permissions";
import {
  GARMENT_TYPE_LABEL,
  PURCHASE_ORDER_STATUS_LABEL,
  SALES_ORDER_STATUS_LABEL,
  decorationMethodsLabel,
} from "@/lib/crm/constants";
import { getPrismaClient } from "@/lib/prisma";
import {
  PRODUCTION_BOARD_GROUP_LABEL,
  PRODUCTION_ROUTE_LABEL,
  PRODUCTION_STAGE_LABEL,
  parseProductionBoardGroup,
  stageRouteForGroup,
} from "@/lib/production/workflow";
import { exportDate, exportDateKey, exportDateTime, exportFilterSummary, exportRange, exportText } from "@/lib/export/params";
import type { ExportColumn, ExportDatasetResult, ExportRow } from "@/lib/export/types";

type LoadInput = { searchParams: URLSearchParams; page: { offset: number; limit: number } };

function row(cells: ExportRow["cells"], bold = false): ExportRow {
  return bold ? { cells, bold: true } : { cells };
}

const DESIGN_REVISION_STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: "Menunggu review",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

const PO_STATUSES = ["DRAFT", "AGREED", "SUPERSEDED", "CANCELLED"] as const;

/* ----------------------------- Purchase order ----------------------------- */

export const PURCHASE_ORDER_COLUMNS: ExportColumn[] = [
  { header: "No. PO", width: 20 },
  { header: "Dibuat", format: "date", width: 14 },
  { header: "Tanggal order", format: "date", width: 14 },
  { header: "Customer", width: 26 },
  { header: "Perusahaan", width: 26 },
  { header: "Produk", width: 26 },
  { header: "Kategori", width: 20 },
  { header: "Jenis busana", width: 16 },
  { header: "Total QTY", format: "number", width: 10 },
  { header: "Roster", format: "number", width: 10 },
  { header: "Status", width: 14 },
  { header: "Deadline", format: "date", width: 14 },
  { header: "Bahan", width: 20 },
  { header: "Warna", width: 20 },
  { header: "Pola", width: 20 },
  { header: "Dekorasi", width: 24 },
  { header: "Deposit", format: "currency", width: 16 },
  { header: "Tanggal deposit", format: "date", width: 14 },
  { header: "Desain", width: 14 },
  { header: "Revisi desain", format: "number", width: 11 },
  { header: "Status revisi", width: 16 },
  { header: "Deadline desain", format: "date", width: 14 },
  { header: "Referensi customer", width: 22 },
  { header: "Catatan", width: 40 },
];

export async function loadPurchaseOrder({ searchParams, page }: LoadInput): Promise<ExportDatasetResult> {
  await requireActor(CRM_VIEW_ROLES);
  const query = exportText(searchParams.get("q"));
  const status = PO_STATUSES.find((item) => item === searchParams.get("status"));
  const from = exportDate(searchParams.get("from"));
  const to = exportDate(searchParams.get("to"));
  const range = exportRange(from, to);
  const where = {
    ...(status ? { status } : {}),
    ...(range ? { createdAt: { gte: range.start, lt: range.end } } : {}),
    ...(query
      ? {
          OR: [
            { purchaseOrderNo: { contains: query, mode: "insensitive" as const } },
            { productName: { contains: query, mode: "insensitive" as const } },
            { customerReference: { contains: query, mode: "insensitive" as const } },
            { opportunity: { customer: { name: { contains: query, mode: "insensitive" as const } } } },
            { opportunity: { customer: { companyName: { contains: query, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  } satisfies Prisma.PurchaseOrderWhereInput;
  const prisma = getPrismaClient();
  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      select: {
        purchaseOrderNo: true,
        createdAt: true,
        orderDate: true,
        status: true,
        productName: true,
        garmentType: true,
        material: true,
        color: true,
        baseColor: true,
        variationColor: true,
        decorationMethods: true,
        deadline: true,
        customerReference: true,
        notes: true,
        opportunity: { select: { customer: { select: { name: true, companyName: true } } } },
        productCategory: { select: { name: true } },
        items: { select: { name: true, pola: true, baseColor: true, variationColor: true } },
        sizes: { select: { quantity: true } },
        _count: { select: { rosterEntries: true } },
        deposit: { select: { amount: true, paidAt: true } },
        designTask: {
          select: {
            deadline: true,
            revisions: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: page.offset,
      take: page.limit,
    }),
    page.offset === 0 ? prisma.purchaseOrder.count({ where }) : Promise.resolve(null),
  ]);
  return {
    rows: items.map((item) => {
      const customer = item.opportunity.customer;
      const quantity = item.sizes.reduce((sum, size) => sum + size.quantity, 0);
      const pola = [...new Set(item.items.map((line) => line.pola).filter(Boolean))].join(", ");
      // Warna mengikuti produk: gabungkan warna tiap produk, fallback ke kolom header PO lama.
      const color = (() => {
        const perItem = item.items
          .map((line) => {
            if (!line.baseColor && !line.variationColor) return null;
            const value = line.variationColor ? `${line.baseColor ?? ""} / ${line.variationColor}` : line.baseColor;
            return item.items.length > 1 ? `${line.name}: ${value}` : value;
          })
          .filter(Boolean);
        if (perItem.length) return perItem.join(", ");
        return item.variationColor ? `${item.baseColor ?? item.color ?? ""} / ${item.variationColor}` : item.color ?? "";
      })();
      const latestRevision = item.designTask?.revisions[0];
      return row([
        item.purchaseOrderNo,
        exportDateKey(item.createdAt),
        exportDateKey(item.orderDate),
        customer.name,
        customer.companyName ?? "",
        item.productName,
        item.productCategory?.name ?? "",
        item.garmentType ? GARMENT_TYPE_LABEL[item.garmentType] : "",
        quantity,
        item._count.rosterEntries,
        PURCHASE_ORDER_STATUS_LABEL[item.status],
        exportDateKey(item.deadline),
        item.material,
        color,
        pola,
        decorationMethodsLabel(item.decorationMethods),
        item.deposit ? Number(item.deposit.amount) : null,
        exportDateKey(item.deposit?.paidAt ?? null),
        item.designTask ? "Ada desain" : "Belum ada",
        item.designTask?.revisions.length ?? 0,
        latestRevision ? DESIGN_REVISION_STATUS_LABEL[latestRevision.status] ?? latestRevision.status : "",
        exportDateKey(item.designTask?.deadline ?? null),
        item.customerReference ?? "",
        item.notes ?? "",
      ]);
    }),
    total,
    filterSummary: exportFilterSummary([
      status ? PURCHASE_ORDER_STATUS_LABEL[status] : "Semua status",
      from && to ? `${exportDateKey(from)} s.d. ${exportDateKey(to)}` : null,
      query ? `Pencarian: ${query}` : null,
    ]),
  };
}

/* -------------------------------- Sales order ----------------------------- */

export const SALES_ORDER_COLUMNS: ExportColumn[] = [
  { header: "No. SO", width: 20 },
  { header: "Tanggal diterima", format: "date", width: 16 },
  { header: "Customer", width: 26 },
  { header: "Perusahaan", width: 26 },
  { header: "No. PO", width: 20 },
  { header: "No. Invoice", width: 20 },
  { header: "Status SO", width: 14 },
  { header: "Status invoice", width: 16 },
  { header: "Status WO", width: 16 },
  { header: "Total QTY", format: "number", width: 10 },
  { header: "Total", format: "currency", width: 16 },
  { header: "Sisa bayar", format: "currency", width: 16 },
  { header: "Dibatalkan pada", format: "datetime", width: 18 },
  { header: "Alasan batal", width: 30 },
];

export async function loadSalesOrder({ searchParams, page }: LoadInput): Promise<ExportDatasetResult> {
  await requireActor(CRM_VIEW_ROLES);
  const query = exportText(searchParams.get("q"));
  const rawStatus = searchParams.get("status");
  const status = rawStatus === "ACTIVE" || rawStatus === "CANCELLED" ? rawStatus : undefined;
  const rawInvoicePayment = searchParams.get("inv");
  const invoicePayment = rawInvoicePayment === "PAID" || rawInvoicePayment === "UNPAID" ? rawInvoicePayment : undefined;
  const rawWo = searchParams.get("wo");
  const woStatus = rawWo === "DONE" || rawWo === "ONGOING" || rawWo === "NONE" ? rawWo : undefined;
  const invoicePaymentWhere = invoicePayment === "PAID"
    ? { payment: { is: { outstandingAmount: 0 } } }
    : invoicePayment === "UNPAID"
      ? { OR: [{ payment: { is: { outstandingAmount: { gt: 0 } } } }, { payment: null }] }
      : {};
  const woWhere = woStatus === "DONE"
    ? { AND: [{ productionWorkOrders: { some: {} } }, { productionWorkOrders: { every: { OR: [{ status: "COMPLETED" as const }, { currentStage: "SELESAI" as const }] } } }] }
    : woStatus === "ONGOING"
      ? { productionWorkOrders: { some: { status: { not: "COMPLETED" as const }, currentStage: { not: "SELESAI" as const } } } }
      : woStatus === "NONE"
        ? { productionWorkOrders: { none: {} } }
        : {};
  const from = exportDate(searchParams.get("from"));
  const to = exportDate(searchParams.get("to"));
  const range = exportRange(from, to);
  const where = {
    ...invoicePaymentWhere,
    ...woWhere,
    ...(status ? { status } : {}),
    ...(range ? { acceptedAt: { gte: range.start, lt: range.end } } : {}),
    ...(query
      ? {
          OR: [
            { salesOrderNo: { contains: query, mode: "insensitive" as const } },
            { purchaseOrderNo: { contains: query, mode: "insensitive" as const } },
            { invoiceNo: { contains: query, mode: "insensitive" as const } },
            { snapshotCustomerName: { contains: query, mode: "insensitive" as const } },
            { snapshotCompanyName: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  } satisfies Prisma.SalesOrderWhereInput;
  const prisma = getPrismaClient();
  const [items, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      select: {
        salesOrderNo: true,
        acceptedAt: true,
        status: true,
        snapshotCustomerName: true,
        snapshotCompanyName: true,
        purchaseOrderNo: true,
        invoiceNo: true,
        total: true,
        cancelledAt: true,
        cancelReason: true,
        payment: { select: { outstandingAmount: true } },
        productionWorkOrders: { select: { status: true, currentStage: true } },
        items: { select: { quantity: true } },
      },
      orderBy: [{ acceptedAt: "desc" }, { id: "asc" }],
      skip: page.offset,
      take: page.limit,
    }),
    page.offset === 0 ? prisma.salesOrder.count({ where }) : Promise.resolve(null),
  ]);
  return {
    rows: items.map((item) => {
      const workOrders = item.productionWorkOrders;
      const done = workOrders.length > 0 && workOrders.every((wo) => wo.status === "COMPLETED" || wo.currentStage === "SELESAI");
      return row([
        item.salesOrderNo,
        exportDateKey(item.acceptedAt),
        item.snapshotCustomerName,
        item.snapshotCompanyName ?? "",
        item.purchaseOrderNo,
        item.invoiceNo,
        SALES_ORDER_STATUS_LABEL[item.status],
        !item.payment ? "Belum diatur" : item.payment.outstandingAmount.equals(0) ? "Lunas" : "Belum lunas",
        !workOrders.length ? "Belum ada WO" : done ? "Selesai" : "Berjalan",
        item.items.reduce((sum, line) => sum + line.quantity, 0),
        Number(item.total),
        item.payment ? Number(item.payment.outstandingAmount) : null,
        exportDateTime(item.cancelledAt),
        item.cancelReason ?? "",
      ]);
    }),
    total,
    filterSummary: exportFilterSummary([
      status ? SALES_ORDER_STATUS_LABEL[status] : "Semua status",
      invoicePayment === "PAID" ? "Invoice lunas" : invoicePayment === "UNPAID" ? "Invoice belum lunas" : null,
      woStatus === "DONE" ? "WO selesai" : woStatus === "ONGOING" ? "WO berjalan" : woStatus === "NONE" ? "Belum ada WO" : null,
      from && to ? `${exportDateKey(from)} s.d. ${exportDateKey(to)}` : null,
      query ? `Pencarian: ${query}` : null,
    ]),
  };
}

/* --------------------------------- Produksi ------------------------------- */

export const PRODUKSI_COLUMNS: ExportColumn[] = [
  { header: "No. WO", width: 20 },
  { header: "No. SO", width: 20 },
  { header: "No. PO", width: 20 },
  { header: "Customer", width: 26 },
  { header: "Produk", width: 26 },
  { header: "Item", width: 20 },
  { header: "Qty", format: "number", width: 10 },
  { header: "Jalur", width: 14 },
  { header: "Tahap sekarang", width: 18 },
  { header: "Status", width: 12 },
  { header: "Deadline", format: "date", width: 14 },
  { header: "Masuk tahap", format: "datetime", width: 18 },
  { header: "Selesai", format: "datetime", width: 18 },
  { header: "Retur", width: 10 },
  { header: "Alasan retur", width: 30 },
  { header: "Kendala", width: 36 },
  { header: "Update kendala", format: "datetime", width: 18 },
  { header: "Penanggung jawab", width: 20 },
];

export async function loadProduksi({ searchParams, page }: LoadInput): Promise<ExportDatasetResult> {
  await requireActor(PRODUCTION_VIEW_ROLES);
  const query = exportText(searchParams.get("q"));
  const group = parseProductionBoardGroup(searchParams.get("jalur") ?? undefined);
  const route = stageRouteForGroup(group);
  const kategori = exportText(searchParams.get("kategori"), 40);
  const rawStatus = searchParams.get("status");
  const status = rawStatus === "ACTIVE" || rawStatus === "COMPLETED" || rawStatus === "CANCELLED" ? rawStatus : undefined;
  const where = {
    route,
    ...(status ? { status } : {}),
    ...(kategori ? { purchaseOrderItem: { productCategoryId: kategori } } : {}),
    ...(query
      ? {
          OR: [
            { workOrderNo: { contains: query, mode: "insensitive" as const } },
            { productName: { contains: query, mode: "insensitive" as const } },
            { salesOrder: { salesOrderNo: { contains: query, mode: "insensitive" as const } } },
            { salesOrder: { snapshotCustomerName: { contains: query, mode: "insensitive" as const } } },
            { salesOrder: { snapshotCompanyName: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  } satisfies Prisma.ProductionWorkOrderWhereInput;
  const prisma = getPrismaClient();
  const [items, total] = await Promise.all([
    prisma.productionWorkOrder.findMany({
      where,
      select: {
        workOrderNo: true,
        productName: true,
        itemName: true,
        quantity: true,
        route: true,
        currentStage: true,
        status: true,
        deadline: true,
        stageEnteredAt: true,
        completedAt: true,
        needsRepair: true,
        repairReason: true,
        obstacle: true,
        obstacleUpdatedAt: true,
        salesOrder: { select: { salesOrderNo: true, purchaseOrderNo: true, snapshotCustomerName: true, snapshotCompanyName: true } },
        steps: { where: { status: "ACTIVE" }, select: { assignee: { select: { name: true } } }, take: 1 },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: page.offset,
      take: page.limit,
    }),
    page.offset === 0 ? prisma.productionWorkOrder.count({ where }) : Promise.resolve(null),
  ]);
  return {
    rows: items.map((item) => row([
      item.workOrderNo,
      item.salesOrder.salesOrderNo,
      item.salesOrder.purchaseOrderNo,
      item.salesOrder.snapshotCompanyName ?? item.salesOrder.snapshotCustomerName,
      item.productName,
      item.itemName ?? "",
      item.quantity,
      PRODUCTION_ROUTE_LABEL[item.route],
      PRODUCTION_STAGE_LABEL[item.currentStage],
      item.status === "ACTIVE" ? "Aktif" : item.status === "COMPLETED" ? "Selesai" : "Dibatalkan",
      exportDateKey(item.deadline),
      exportDateTime(item.stageEnteredAt),
      exportDateTime(item.completedAt),
      item.needsRepair ? "Retur" : "-",
      item.repairReason ?? "",
      item.obstacle ?? "",
      exportDateTime(item.obstacleUpdatedAt),
      item.steps[0]?.assignee?.name ?? "",
    ])),
    total,
    filterSummary: exportFilterSummary([
      PRODUCTION_BOARD_GROUP_LABEL[group],
      status ? (status === "ACTIVE" ? "Aktif" : status === "COMPLETED" ? "Selesai" : "Dibatalkan") : "Semua status",
      query ? `Pencarian: ${query}` : null,
    ]),
  };
}

/* ------------------------------- Detail desain ---------------------------- */

export const DETAIL_DESAIN_COLUMNS: ExportColumn[] = [
  { header: "No. PO", width: 20 },
  { header: "No. WO", width: 20 },
  { header: "Customer", width: 26 },
  { header: "Perusahaan", width: 26 },
  { header: "Produk", width: 26 },
  { header: "Item", width: 20 },
  { header: "Revisi", format: "number", width: 10 },
  { header: "Status", width: 16 },
  { header: "Deadline desain", format: "date", width: 16 },
  { header: "Catatan desain", width: 34 },
  { header: "Catatan review", width: 34 },
  { header: "Diunggah oleh", width: 20 },
  { header: "Diunggah pada", format: "datetime", width: 18 },
  { header: "Direview oleh", width: 20 },
  { header: "Direview pada", format: "datetime", width: 18 },
  { header: "Lampiran", format: "number", width: 11 },
];

export async function loadDetailDesain({ searchParams, page }: LoadInput): Promise<ExportDatasetResult> {
  // Halaman Detail Desain hanya untuk DEVELOPER (sesuai halaman asalnya).
  await requireDeveloperActor();
  const query = exportText(searchParams.get("q"));
  const rawStatus = searchParams.get("status");
  const status = rawStatus === "PENDING_REVIEW" || rawStatus === "APPROVED" || rawStatus === "REJECTED" ? rawStatus : undefined;
  const where = {
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { designTask: { purchaseOrder: { purchaseOrderNo: { contains: query, mode: "insensitive" as const } } } },
            { designTask: { purchaseOrder: { productName: { contains: query, mode: "insensitive" as const } } } },
            { designTask: { purchaseOrder: { opportunity: { customer: { name: { contains: query, mode: "insensitive" as const } } } } } },
            { designTask: { purchaseOrder: { opportunity: { customer: { companyName: { contains: query, mode: "insensitive" as const } } } } } },
          ],
        }
      : {}),
  } satisfies Prisma.DesignRevisionWhereInput;
  const prisma = getPrismaClient();
  const [items, total] = await Promise.all([
    prisma.designRevision.findMany({
      where,
      select: {
        itemId: true,
        revision: true,
        status: true,
        notes: true,
        reviewNotes: true,
        createdAt: true,
        reviewedAt: true,
        createdBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
        _count: { select: { attachments: true } },
        designTask: {
          select: {
            deadline: true,
            purchaseOrder: {
              select: {
                purchaseOrderNo: true,
                productName: true,
                opportunity: { select: { customer: { select: { name: true, companyName: true } } } },
                items: { select: { id: true, name: true } },
                salesOrder: { select: { productionWorkOrders: { select: { workOrderNo: true }, take: 1 } } },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: page.offset,
      take: page.limit,
    }),
    page.offset === 0 ? prisma.designRevision.count({ where }) : Promise.resolve(null),
  ]);
  return {
    rows: items.map((item) => {
      const purchaseOrder = item.designTask.purchaseOrder;
      const customer = purchaseOrder.opportunity.customer;
      const purchaseOrderItem = purchaseOrder.items.find((line) => line.id === item.itemId);
      return row([
        purchaseOrder.purchaseOrderNo,
        purchaseOrder.salesOrder?.productionWorkOrders[0]?.workOrderNo ?? "",
        customer.name,
        customer.companyName ?? "",
        purchaseOrder.productName,
        purchaseOrderItem?.name ?? "",
        item.revision,
        DESIGN_REVISION_STATUS_LABEL[item.status] ?? item.status,
        exportDateKey(item.designTask.deadline),
        item.notes ?? "",
        item.reviewNotes ?? "",
        item.createdBy.name,
        exportDateTime(item.createdAt),
        item.reviewedBy?.name ?? "",
        exportDateTime(item.reviewedAt),
        item._count.attachments,
      ]);
    }),
    total,
    filterSummary: exportFilterSummary([
      status ? DESIGN_REVISION_STATUS_LABEL[status] : "Semua status",
      query ? `Pencarian: ${query}` : null,
    ]),
  };
}
