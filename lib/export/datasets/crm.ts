import "server-only";

import { Prisma } from "@prisma/client";

import { requireActor } from "@/lib/auth/session";
import { CRM_VIEW_ROLES } from "@/lib/auth/permissions";
import {
  COMMUNICATION_CHANNEL_LABEL,
  COMMUNICATION_DIRECTION_LABEL,
  COMMUNICATION_SYSTEM_EVENT_LABEL,
  GARMENT_TYPE_LABEL,
  STAGE_LABEL,
} from "@/lib/crm/constants";
import { getCustomersForExport, type CustomerSegment, type CustomerSort, type SortDirection } from "@/lib/crm/data";
import { getPrismaClient } from "@/lib/prisma";
import { exportDate, exportDateKey, exportDateTime, exportFilterSummary, exportRange, exportText } from "@/lib/export/params";
import type { ExportColumn, ExportDatasetResult, ExportRow } from "@/lib/export/types";

type LoadInput = { searchParams: URLSearchParams; page: { offset: number; limit: number } };

function row(cells: ExportRow["cells"], bold = false): ExportRow {
  return bold ? { cells, bold: true } : { cells };
}

const CUSTOMER_SORTS = ["customerNo", "name", "opportunities", "updatedAt"] as const satisfies readonly CustomerSort[];

/* -------------------------------- Customer -------------------------------- */

export const CUSTOMER_COLUMNS: ExportColumn[] = [
  { header: "No. customer", width: 18 },
  { header: "Nama", width: 32 },
  { header: "Perusahaan/komunitas", width: 32 },
  { header: "Jenis customer", width: 22 },
  { header: "Sumber lead", width: 22 },
  { header: "Sales/PIC", width: 24 },
  { header: "WhatsApp", width: 20 },
  { header: "Email", width: 34 },
  { header: "Instagram", width: 22 },
  { header: "Kota", width: 20 },
  { header: "Alamat", width: 44 },
  { header: "Catatan", width: 44 },
  { header: "Status aktivitas", width: 16 },
  { header: "Order terakhir", format: "date", width: 18 },
  { header: "Peluang", format: "number", width: 10 },
  { header: "Diperbarui", format: "datetime", width: 18 },
  { header: "Status arsip", width: 16 },
];

function defaultCustomerDirection(sort: CustomerSort): SortDirection {
  return sort === "updatedAt" ? "desc" : "asc";
}

export async function loadCustomer({ searchParams, page }: LoadInput): Promise<ExportDatasetResult> {
  const query = exportText(searchParams.get("q"));
  const segment: CustomerSegment = searchParams.get("segment") === "archived" ? "archived" : "all";
  const sort = CUSTOMER_SORTS.find((item) => item === searchParams.get("sort")) ?? "updatedAt";
  const direction: SortDirection = searchParams.get("order") === "asc" || searchParams.get("order") === "desc"
    ? (searchParams.get("order") as SortDirection)
    : defaultCustomerDirection(sort);
  const { rows, total } = await getCustomersForExport({
    query,
    segment,
    sort,
    direction,
    offset: page.offset,
    limit: page.limit,
  });
  return {
    rows: rows.map((item) => row([
      item.customerNo,
      item.name,
      item.companyName,
      item.customerTypeName,
      item.leadSourceName,
      item.salesPicName,
      item.whatsapp,
      item.email,
      item.instagram,
      item.city,
      item.address,
      item.notes,
      item.activityStatus,
      exportDateKey(item.lastOrderAt),
      item.opportunityCount,
      exportDateTime(item.updatedAt),
      item.archivedAt ? "Diarsipkan" : "Aktif",
    ])),
    total,
    filterSummary: exportFilterSummary([
      segment === "archived" ? "Hanya diarsipkan" : "Semua customer",
      query ? `Pencarian: ${query}` : null,
    ]),
  };
}

/* --------------------------------- Peluang -------------------------------- */

export const PELUANG_COLUMNS: ExportColumn[] = [
  { header: "No. Peluang", width: 18 },
  { header: "Dibuat", format: "date", width: 14 },
  { header: "Customer", width: 26 },
  { header: "Perusahaan", width: 26 },
  { header: "WhatsApp", width: 18 },
  { header: "Email", width: 28 },
  { header: "Instagram", width: 18 },
  { header: "Kota", width: 18 },
  { header: "Judul", width: 32 },
  { header: "Produk", width: 24 },
  { header: "Kategori", width: 20 },
  { header: "Jenis busana", width: 16 },
  { header: "Tahap", width: 16 },
  { header: "Asal", width: 16 },
  { header: "Sumber lead", width: 18 },
  { header: "Sales/PIC", width: 20 },
  { header: "Repeat order", width: 12 },
  { header: "Aksi berikutnya", width: 30 },
  { header: "Jadwal aksi", format: "datetime", width: 18 },
  { header: "Terakhir dihubungi", format: "datetime", width: 18 },
  { header: "Alasan batal", width: 26 },
  { header: "Diperbarui", format: "datetime", width: 18 },
];

const ORIGIN_LABEL: Record<string, string> = {
  PROSPEK_FORM: "Form prospek",
  REPEAT_ORDER: "Repeat order",
  LANDING_PAGE: "Landing page",
  MANUAL: "Manual",
};

export async function loadPeluang({ searchParams, page }: LoadInput): Promise<ExportDatasetResult> {
  await requireActor(CRM_VIEW_ROLES);
  const query = exportText(searchParams.get("q"));
  const from = exportDate(searchParams.get("from"));
  const to = exportDate(searchParams.get("to"));
  const range = exportRange(from, to);
  const rawStage = searchParams.get("stage");
  const stage = rawStage && rawStage in STAGE_LABEL ? (rawStage as keyof typeof STAGE_LABEL) : undefined;
  const where = {
    ...(stage ? { stage } : {}),
    ...(range ? { createdAt: { gte: range.start, lt: range.end } } : {}),
    ...(query
      ? {
          OR: [
            { opportunityNo: { contains: query, mode: "insensitive" as const } },
            { title: { contains: query, mode: "insensitive" as const } },
            { productName: { contains: query, mode: "insensitive" as const } },
            { customer: { name: { contains: query, mode: "insensitive" as const } } },
            { customer: { companyName: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  } satisfies Prisma.OpportunityWhereInput;
  const prisma = getPrismaClient();
  const [items, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      select: {
        opportunityNo: true,
        createdAt: true,
        updatedAt: true,
        title: true,
        stage: true,
        origin: true,
        isRepeatOrder: true,
        productName: true,
        garmentType: true,
        nextAction: true,
        nextActionAt: true,
        lastContactedAt: true,
        cancelReason: true,
        customer: { select: { name: true, companyName: true, whatsapp: true, email: true, instagram: true, city: true } },
        productCategory: { select: { name: true } },
        leadSource: { select: { name: true } },
        salesPic: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: page.offset,
      take: page.limit,
    }),
    page.offset === 0 ? prisma.opportunity.count({ where }) : Promise.resolve(null),
  ]);
  return {
    rows: items.map((item) => row([
      item.opportunityNo,
      exportDateKey(item.createdAt),
      item.customer.name,
      item.customer.companyName ?? "",
      item.customer.whatsapp ?? "",
      item.customer.email ?? "",
      item.customer.instagram ?? "",
      item.customer.city ?? "",
      item.title,
      item.productName ?? "",
      item.productCategory?.name ?? "",
      item.garmentType ? GARMENT_TYPE_LABEL[item.garmentType] : "",
      STAGE_LABEL[item.stage],
      ORIGIN_LABEL[item.origin] ?? item.origin,
      item.leadSource?.name ?? "",
      item.salesPic?.name ?? "",
      item.isRepeatOrder ? "Ya" : "Tidak",
      item.nextAction ?? "",
      exportDateTime(item.nextActionAt),
      exportDateTime(item.lastContactedAt),
      item.cancelReason ?? "",
      exportDateTime(item.updatedAt),
    ])),
    total,
    filterSummary: exportFilterSummary([
      from && to ? `${exportDateKey(from)} s.d. ${exportDateKey(to)}` : "semua tanggal",
      stage ? STAGE_LABEL[stage] : null,
      query ? `Pencarian: ${query}` : null,
    ]),
  };
}

/* --------------------------------- Follow-up ------------------------------- */

const REMINDER_TYPE_LABEL: Record<string, string> = {
  REPEAT_ORDER: "Repeat order",
  REACTIVATION: "Reaktivasi",
};

export const FOLLOW_UP_COLUMNS: ExportColumn[] = [
  { header: "Customer", width: 26 },
  { header: "Perusahaan", width: 26 },
  { header: "WhatsApp", width: 18 },
  { header: "Tipe", width: 14 },
  { header: "Jatuh tempo", format: "datetime", width: 18 },
  { header: "Status", width: 14 },
  { header: "No. SO", width: 18 },
  { header: "No. Invoice", width: 18 },
  { header: "Tanggal order", format: "date", width: 14 },
  { header: "Generasi", format: "number", width: 10 },
  { header: "Dibuat", format: "datetime", width: 18 },
  { header: "Diperbarui", format: "datetime", width: 18 },
];

export async function loadFollowUp({ searchParams, page }: LoadInput): Promise<ExportDatasetResult> {
  await requireActor(CRM_VIEW_ROLES);
  const rawStatus = searchParams.get("status");
  const status = rawStatus === "open" || rawStatus === "resolved" ? rawStatus : "all";
  const from = exportDate(searchParams.get("from"));
  const to = exportDate(searchParams.get("to"));
  const range = exportRange(from, to);
  const query = exportText(searchParams.get("q"));
  const where = {
    ...(status === "open" ? { resolvedAt: null } : status === "resolved" ? { resolvedAt: { not: null } } : {}),
    ...(range ? { dueAt: { gte: range.start, lt: range.end } } : {}),
    ...(query
      ? {
          OR: [
            { customer: { name: { contains: query, mode: "insensitive" as const } } },
            { customer: { companyName: { contains: query, mode: "insensitive" as const } } },
            { sourceSalesOrder: { salesOrderNo: { contains: query, mode: "insensitive" as const } } },
            { sourceSalesOrder: { invoiceNo: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  } satisfies Prisma.CustomerReminderWhereInput;
  const prisma = getPrismaClient();
  const [items, total] = await Promise.all([
    prisma.customerReminder.findMany({
      where,
      select: {
        type: true,
        dueAt: true,
        resolvedAt: true,
        generation: true,
        createdAt: true,
        updatedAt: true,
        customer: { select: { name: true, companyName: true, whatsapp: true } },
        sourceSalesOrder: { select: { salesOrderNo: true, invoiceNo: true, acceptedAt: true } },
      },
      orderBy: [{ dueAt: "desc" }, { id: "asc" }],
      skip: page.offset,
      take: page.limit,
    }),
    page.offset === 0 ? prisma.customerReminder.count({ where }) : Promise.resolve(null),
  ]);
  return {
    rows: items.map((item) => row([
      item.customer.name,
      item.customer.companyName ?? "",
      item.customer.whatsapp ?? "",
      REMINDER_TYPE_LABEL[item.type] ?? item.type,
      exportDateTime(item.dueAt),
      item.resolvedAt ? "Selesai" : "Menunggu",
      item.sourceSalesOrder.salesOrderNo,
      item.sourceSalesOrder.invoiceNo,
      exportDateKey(item.sourceSalesOrder.acceptedAt),
      item.generation,
      exportDateTime(item.createdAt),
      exportDateTime(item.updatedAt),
    ])),
    total,
    filterSummary: exportFilterSummary([
      status === "open" ? "Belum selesai" : status === "resolved" ? "Sudah selesai" : "Semua status",
      from && to ? `${exportDateKey(from)} s.d. ${exportDateKey(to)}` : null,
      query ? `Pencarian: ${query}` : null,
    ]),
  };
}

/* ---------------------------- Riwayat komunikasi -------------------------- */

const ACTIVITY_KIND_LABEL: Record<string, string> = {
  COMMUNICATION: "Komunikasi",
  INTERNAL_NOTE: "Catatan internal",
  SYSTEM: "Sistem",
};

export const KOMUNIKASI_COLUMNS: ExportColumn[] = [
  { header: "Tanggal", format: "datetime", width: 18 },
  { header: "Customer", width: 26 },
  { header: "Perusahaan", width: 26 },
  { header: "No. Peluang", width: 18 },
  { header: "Jenis", width: 18 },
  { header: "Kanal", width: 14 },
  { header: "Arah", width: 12 },
  { header: "Event sistem", width: 20 },
  { header: "Isi", width: 50 },
  { header: "Oleh", width: 20 },
];

export async function loadKomunikasi({ searchParams, page }: LoadInput): Promise<ExportDatasetResult> {
  await requireActor(CRM_VIEW_ROLES);
  const query = exportText(searchParams.get("q"));
  const from = exportDate(searchParams.get("from"));
  const to = exportDate(searchParams.get("to"));
  const range = exportRange(from, to);
  const rawChannel = searchParams.get("channel");
  const channel = rawChannel && rawChannel in COMMUNICATION_CHANNEL_LABEL
    ? (rawChannel as keyof typeof COMMUNICATION_CHANNEL_LABEL)
    : undefined;
  const where = {
    ...(channel ? { channel } : {}),
    ...(range ? { occurredAt: { gte: range.start, lt: range.end } } : {}),
    ...(query
      ? {
          OR: [
            { content: { contains: query, mode: "insensitive" as const } },
            { customer: { name: { contains: query, mode: "insensitive" as const } } },
            { customer: { companyName: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  } satisfies Prisma.CommunicationActivityWhereInput;
  const prisma = getPrismaClient();
  const [items, total] = await Promise.all([
    prisma.communicationActivity.findMany({
      where,
      select: {
        occurredAt: true,
        kind: true,
        channel: true,
        direction: true,
        systemEvent: true,
        content: true,
        customer: { select: { name: true, companyName: true } },
        opportunity: { select: { opportunityNo: true } },
        author: { select: { name: true } },
      },
      orderBy: [{ occurredAt: "desc" }, { id: "asc" }],
      skip: page.offset,
      take: page.limit,
    }),
    page.offset === 0 ? prisma.communicationActivity.count({ where }) : Promise.resolve(null),
  ]);
  return {
    rows: items.map((item) => row([
      exportDateTime(item.occurredAt),
      item.customer.name,
      item.customer.companyName ?? "",
      item.opportunity?.opportunityNo ?? "",
      ACTIVITY_KIND_LABEL[item.kind] ?? item.kind,
      item.channel ? COMMUNICATION_CHANNEL_LABEL[item.channel] : "",
      item.direction ? COMMUNICATION_DIRECTION_LABEL[item.direction] : "",
      item.systemEvent ? COMMUNICATION_SYSTEM_EVENT_LABEL[item.systemEvent] ?? item.systemEvent : "",
      item.content,
      item.author.name,
    ])),
    total,
    filterSummary: exportFilterSummary([
      from && to ? `${exportDateKey(from)} s.d. ${exportDateKey(to)}` : "semua tanggal",
      channel ? COMMUNICATION_CHANNEL_LABEL[channel] : null,
      query ? `Pencarian: ${query}` : null,
    ]),
  };
}
