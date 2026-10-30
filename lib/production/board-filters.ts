/**
 * Filter papan Produksi. Semua aturan tinggal di sini supaya halaman, API
 * polling, dan export memakai SATU sumber kebenaran: parameter URL yang sama
 * menghasilkan where yang sama, sehingga isi Excel tidak pernah berbeda dari
 * yang terlihat di board.
 *
 * Penyaringan berjalan di server (bukan di browser seperti papan CRM) karena
 * board dibatasi 500 kartu: filter harus mengenai seluruh Work Order, bukan
 * hanya yang kebetulan termuat.
 */

import type { Prisma } from "@prisma/client";

import type { ProductionBoardGroup } from "@/lib/production/workflow";

export const PRODUCTION_BOARD_PATH = "/produksi";

export type ProductionDeadlinePreset = "overdue" | "today" | "d3" | "d7" | "d30";
export type ProductionPenanda = "retur" | "qc" | "sampel";
export type ProductionBoardStatus = "ACTIVE" | "COMPLETED";

export type ProductionBoardFilters = {
  /** Pencarian bebas: nomor WO, produk, nomor Sales Order, nama customer. */
  q: string;
  /** ID user PIC, `none` untuk kartu tanpa PIC, atau kosong untuk semua. */
  pic: string;
  deadline: ProductionDeadlinePreset | "";
  status: ProductionBoardStatus | "";
  /** Penanda kartu; beberapa nilai berarti "salah satu" (union). */
  penanda: ProductionPenanda[];
};

/** Nilai filter khusus untuk kartu yang tahap aktifnya belum punya PIC. */
export const NO_PIC = "none";

export const EMPTY_PRODUCTION_BOARD_FILTERS: ProductionBoardFilters = {
  q: "",
  pic: "",
  deadline: "",
  status: "",
  penanda: [],
};

export const DEADLINE_PRESETS: ReadonlyArray<{ value: ProductionDeadlinePreset; label: string }> = [
  { value: "overdue", label: "Terlambat" },
  { value: "today", label: "Deadline hari ini" },
  { value: "d3", label: "Deadline ≤ 3 hari" },
  { value: "d7", label: "Deadline ≤ 7 hari" },
  { value: "d30", label: "Deadline ≤ 30 hari" },
];

export const PENANDA_OPTIONS: ReadonlyArray<{ value: ProductionPenanda; label: string }> = [
  { value: "retur", label: "Retur" },
  { value: "qc", label: "Wajib QC" },
  { value: "sampel", label: "Revisi sampel" },
];

export const STATUS_OPTIONS: ReadonlyArray<{ value: ProductionBoardStatus; label: string }> = [
  { value: "ACTIVE", label: "Aktif" },
  { value: "COMPLETED", label: "Selesai" },
];

const QUERY_MAX = 80;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const DAY_MS = 86_400_000;
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Tanggal kalender Jakarta (YYYY-MM-DD) dari sebuah timestamp. */
export function jakartaDateKey(date: Date) {
  return new Date(date.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** `ProductionWorkOrder.deadline` disimpan sebagai UTC tengah malam tanggal itu. */
function utcMidnightOfDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Awal hari ini menurut kalender Jakarta, sebagai UTC tengah malam. */
export function jakartaToday(reference: Date = new Date()) {
  return utcMidnightOfDateKey(jakartaDateKey(reference));
}

/**
 * Rentang deadline untuk satu preset. Preset "Terlambat" berhenti sebelum hari
 * ini; preset lain mulai hari ini, sehingga satu kartu tidak muncul di dua
 * kategori sekaligus.
 */
export function deadlineRange(
  preset: ProductionDeadlinePreset,
  reference: Date = new Date(),
): Prisma.DateTimeFilter | null {
  const today = jakartaToday(reference);
  const daysFromToday = (days: number) => new Date(today.getTime() + days * DAY_MS);

  switch (preset) {
    case "overdue":
      return { lt: today };
    case "today":
      return { gte: today, lt: daysFromToday(1) };
    case "d3":
      return { gte: today, lt: daysFromToday(4) };
    case "d7":
      return { gte: today, lt: daysFromToday(8) };
    case "d30":
      return { gte: today, lt: daysFromToday(31) };
    default:
      return null;
  }
}

type ProductionBoardFilterInput = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Whitelist nilai URL: parameter rusak/tak dikenal diabaikan, bukan error. */
export function parseProductionBoardFilters(input: ProductionBoardFilterInput): ProductionBoardFilters {
  const q = firstValue(input.q).trim().slice(0, QUERY_MAX);
  const rawPic = firstValue(input.pic).trim();
  const pic = rawPic === NO_PIC || ID_PATTERN.test(rawPic) ? rawPic : "";
  const rawDeadline = firstValue(input.deadline).trim();
  const deadline = DEADLINE_PRESETS.some((option) => option.value === rawDeadline)
    ? (rawDeadline as ProductionDeadlinePreset)
    : "";
  const rawStatus = firstValue(input.status).trim();
  const status: ProductionBoardStatus | "" = rawStatus === "ACTIVE" || rawStatus === "COMPLETED" ? rawStatus : "";
  const requestedPenanda = firstValue(input.penanda).toLowerCase().split(",").map((value) => value.trim());
  const penanda = PENANDA_OPTIONS.map((option) => option.value).filter((value) => requestedPenanda.includes(value));

  return { q, pic, deadline, status, penanda };
}

/** Parameter URL siap pakai (hanya nilai aktif) untuk tautan dan export. */
export function productionBoardFilterParams(filters: ProductionBoardFilters) {
  const params: Record<string, string> = {};
  if (filters.q) params.q = filters.q;
  if (filters.pic) params.pic = filters.pic;
  if (filters.deadline) params.deadline = filters.deadline;
  if (filters.status) params.status = filters.status;
  if (filters.penanda.length) params.penanda = filters.penanda.join(",");
  return params;
}

export function hasActiveProductionBoardFilters(filters: ProductionBoardFilters) {
  return Boolean(filters.q || filters.pic || filters.deadline || filters.status || filters.penanda.length);
}

/** Label filter aktif untuk empty state, mis. ["Terlambat", "Retur", "Budi"]. */
export function activeProductionBoardFilterLabels(
  filters: ProductionBoardFilters,
  picName?: string | null,
): string[] {
  const labels: string[] = [];
  if (filters.q) labels.push(`"${filters.q}"`);
  if (filters.pic === NO_PIC) labels.push("Belum ada PIC");
  else if (filters.pic) labels.push(picName?.trim() || "PIC terpilih");
  if (filters.deadline) {
    const preset = DEADLINE_PRESETS.find((option) => option.value === filters.deadline);
    if (preset) labels.push(preset.label);
  }
  if (filters.status) labels.push(filters.status === "ACTIVE" ? "Aktif" : "Selesai");
  for (const option of PENANDA_OPTIONS) {
    if (filters.penanda.includes(option.value)) labels.push(option.label);
  }
  return labels;
}

/**
 * Kondisi filter sebagai daftar terpisah: pemanggil menggabungkannya ke array
 * `AND` bersama kondisi jalur/kategori. Menggabung langsung ke root where akan
 * saling menimpa dengan `OR` milik grup.
 */
export function productionBoardFilterConditions(
  filters: ProductionBoardFilters,
  reference: Date = new Date(),
): Prisma.ProductionWorkOrderWhereInput[] {
  const conditions: Prisma.ProductionWorkOrderWhereInput[] = [];

  if (filters.q) {
    conditions.push({
      OR: [
        { workOrderNo: { contains: filters.q, mode: "insensitive" } },
        { productName: { contains: filters.q, mode: "insensitive" } },
        { salesOrder: { salesOrderNo: { contains: filters.q, mode: "insensitive" } } },
        { salesOrder: { snapshotCustomerName: { contains: filters.q, mode: "insensitive" } } },
        { salesOrder: { snapshotCompanyName: { contains: filters.q, mode: "insensitive" } } },
      ],
    });
  }

  // PIC dibaca dari tahap yang sedang aktif, sama seperti kolom PIC di kartu.
  if (filters.pic === NO_PIC) {
    conditions.push({ steps: { some: { status: "ACTIVE", assigneeId: null } } });
  } else if (filters.pic) {
    conditions.push({ steps: { some: { status: "ACTIVE", assigneeId: filters.pic } } });
  }

  if (filters.deadline) {
    const range = deadlineRange(filters.deadline, reference);
    if (range) {
      conditions.push({ deadline: range });
      // Kartu Selesai tidak pernah "terlambat": batasi ke pekerjaan aktif,
      // kecuali user memang memilih status tertentu.
      if (filters.deadline === "overdue" && !filters.status) conditions.push({ status: "ACTIVE" });
    }
  }

  if (filters.status) conditions.push({ status: filters.status });

  if (filters.penanda.length) {
    const penandaConditions: Prisma.ProductionWorkOrderWhereInput[] = [];
    for (const penanda of filters.penanda) {
      if (penanda === "retur") penandaConditions.push({ repairReason: { not: null } });
      if (penanda === "qc") penandaConditions.push({ qcReverted: true });
      if (penanda === "sampel") penandaConditions.push({ sampleRevision: { gt: 1 } });
    }
    if (penandaConditions.length) conditions.push({ OR: penandaConditions });
  }

  return conditions;
}

/** Where lengkap papan Produksi: jalur + kategori + filter aktif. */
export function productionBoardWhere({
  group,
  productCategoryId,
  filters = EMPTY_PRODUCTION_BOARD_FILTERS,
  reference,
}: {
  group: ProductionBoardGroup;
  productCategoryId?: string | null;
  filters?: ProductionBoardFilters;
  reference?: Date;
}): Prisma.ProductionWorkOrderWhereInput {
  const conditions: Prisma.ProductionWorkOrderWhereInput[] = [];

  // WO dibuat per produk PO, jadi pembagian jalur memakai jenis tiap item (bukan jenis PO).
  // Work Order aksesoris memakai route NON_JERSEY; grup menentukan pembagian tampilannya.
  // WO lawas tanpa item tetap memakai jenis PO sebagai cadangan.
  if (group === "AKSESORI") {
    conditions.push({
      OR: [
        { purchaseOrderItem: { is: { garmentType: "AKSESORI" } } },
        { purchaseOrderItem: { is: null }, salesOrder: { purchaseOrder: { garmentType: "AKSESORI" } } },
      ],
    });
  } else if (group === "NON_JERSEY") {
    conditions.push({
      OR: [
        { purchaseOrderItem: { is: { garmentType: "NON_JERSEY" } } },
        { purchaseOrderItem: { is: null }, salesOrder: { purchaseOrder: { OR: [{ garmentType: "NON_JERSEY" }, { garmentType: null }] } } },
      ],
    });
  }

  // Kategori mengikuti produk WO (itemnya); WO lawas tanpa item memakai kategori PO.
  // Item yang belum berkategori ikut tampil agar tak ada Work Order hilang.
  if (productCategoryId) {
    conditions.push({
      OR: [
        { purchaseOrderItem: { is: { productCategoryId } } },
        { purchaseOrderItem: { is: { productCategoryId: null } } },
        { purchaseOrderItem: { is: null }, salesOrder: { purchaseOrder: { OR: [{ productCategoryId }, { productCategoryId: null }] } } },
      ],
    });
  }

  conditions.push(...productionBoardFilterConditions(filters, reference));

  return {
    route: group === "JERSEY" ? "JERSEY" : "NON_JERSEY",
    status: { not: "CANCELLED" },
    designCompletedAt: { not: null },
    ...(conditions.length ? { AND: conditions } : {}),
  };
}

/**
 * Cache `unstable_cache` per kombinasi filter. WAJIB memuat setiap parameter:
 * key yang tertinggal akan menyajikan hasil filter lain (mis. daftar kartu
 * "Terlambat" muncul saat filter sudah direset).
 */
export function productionBoardCacheKey({
  group,
  productCategoryId,
  filters = EMPTY_PRODUCTION_BOARD_FILTERS,
}: {
  group: ProductionBoardGroup;
  productCategoryId?: string | null;
  filters?: ProductionBoardFilters;
}) {
  return [
    "production-board",
    group,
    productCategoryId ?? "",
    filters.q.toLocaleLowerCase("id"),
    filters.pic,
    filters.deadline,
    filters.status,
    filters.penanda.join(","),
  ];
}
