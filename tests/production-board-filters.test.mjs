import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";

import {
  ALL_PRODUCTION_CATEGORIES,
  EMPTY_PRODUCTION_BOARD_FILTERS,
  NO_PIC,
  activeProductionBoardFilterLabels,
  deadlineRange,
  hasActiveProductionBoardFilters,
  jakartaToday,
  matchingProductionCategoryScopes,
  parseProductionBoardFilters,
  productionBoardCacheKey,
  productionBoardFilterConditions,
  productionBoardFilterParams,
  productionBoardWhere,
  resolveProductionCategorySelection,
} from "../lib/production/board-filters.ts";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

// 30 Okt 2026 03:00 UTC = 10:00 WIB. Deadline tersimpan sebagai UTC tengah malam
// tanggal yang dimaksud, jadi "hari ini" = 2026-10-30T00:00:00.000Z.
const NOW = new Date("2026-10-30T03:00:00.000Z");

test("parse filter memakai whitelist dan mengabaikan nilai rusak", () => {
  const filters = parseProductionBoardFilters({
    q: "  wo-2026  ",
    pic: "ckx1234567890",
    deadline: "besok",
    status: "CANCELLED",
    penanda: "qc, retur, entah",
  });

  assert.equal(filters.q, "wo-2026");
  assert.equal(filters.pic, "ckx1234567890");
  // Nilai di luar daftar jatuh ke "semua", bukan error.
  assert.equal(filters.deadline, "");
  assert.equal(filters.status, "");
  // Urutan penanda mengikuti opsi, bukan urutan URL.
  assert.deepEqual(filters.penanda, ["retur", "qc"]);
});

test("parse filter menerima array parameter dan membatasi panjang pencarian", () => {
  const filters = parseProductionBoardFilters({
    q: ["pertama", "kedua"],
    pic: "bukan id!",
    deadline: ["d7"],
    status: ["ACTIVE"],
    penanda: ["sampel"],
  });

  assert.equal(filters.q, "pertama");
  assert.equal(filters.pic, "", "id tidak valid diabaikan");
  assert.equal(filters.deadline, "d7");
  assert.equal(filters.status, "ACTIVE");
  assert.deepEqual(filters.penanda, ["sampel"]);

  assert.equal(parseProductionBoardFilters({ q: "x".repeat(200) }).q.length, 80);
});

test("filter tanpa nilai menghasilkan parameter URL kosong dan tidak dianggap aktif", () => {
  assert.equal(ALL_PRODUCTION_CATEGORIES, "all");
  const filters = parseProductionBoardFilters({});
  assert.deepEqual(filters, EMPTY_PRODUCTION_BOARD_FILTERS);
  assert.equal(hasActiveProductionBoardFilters(filters), false);
  assert.deepEqual(productionBoardFilterParams(filters), {});
});

test("parameter URL bolak-balik tetap sama (dipakai tautan tab dan export)", () => {
  const filters = { q: "seragam", pic: NO_PIC, deadline: "overdue", status: "ACTIVE", penanda: ["retur", "sampel"] };
  const params = productionBoardFilterParams(filters);
  assert.deepEqual(params, {
    q: "seragam",
    pic: NO_PIC,
    deadline: "overdue",
    status: "ACTIVE",
    penanda: "retur,sampel",
  });
  assert.deepEqual(parseProductionBoardFilters(params), filters);
});

test("batas tanggal deadline memakai kalender Jakarta, bukan jam browser", () => {
  // 29 Okt 17:30 UTC sudah 30 Okt di Jakarta: "hari ini" harus ikut WIB.
  assert.equal(jakartaToday(new Date("2026-10-29T17:30:00.000Z")).toISOString(), "2026-10-30T00:00:00.000Z");
  assert.equal(jakartaToday(new Date("2026-10-29T16:59:59.000Z")).toISOString(), "2026-10-29T00:00:00.000Z");

  assert.deepEqual(deadlineRange("overdue", NOW), { lt: new Date("2026-10-30T00:00:00.000Z") });
  // Deadline hari ini belum terlambat.
  assert.deepEqual(deadlineRange("today", NOW), {
    gte: new Date("2026-10-30T00:00:00.000Z"),
    lt: new Date("2026-10-31T00:00:00.000Z"),
  });
  assert.deepEqual(deadlineRange("d3", NOW), {
    gte: new Date("2026-10-30T00:00:00.000Z"),
    lt: new Date("2026-11-03T00:00:00.000Z"),
  });
  assert.deepEqual(deadlineRange("d7", NOW), {
    gte: new Date("2026-10-30T00:00:00.000Z"),
    lt: new Date("2026-11-07T00:00:00.000Z"),
  });
  assert.deepEqual(deadlineRange("d30", NOW), {
    gte: new Date("2026-10-30T00:00:00.000Z"),
    lt: new Date("2026-11-30T00:00:00.000Z"),
  });
});

test("pencarian mencakup nomor WO, produk, Sales Order, customer, dan kategori", () => {
  const [condition] = productionBoardFilterConditions({ ...EMPTY_PRODUCTION_BOARD_FILTERS, q: "budi" }, NOW);
  const fields = JSON.stringify(condition);
  assert.match(fields, /"workOrderNo"/);
  assert.match(fields, /"productName"/);
  assert.match(fields, /"salesOrderNo"/);
  assert.match(fields, /"snapshotCustomerName"/);
  assert.match(fields, /"snapshotCompanyName"/);
  assert.match(fields, /"productCategory"/);
  assert.match(fields, /"name"/);
  assert.match(fields, /insensitive/);
});

test("pilihan Semua hanya dipakai saat jalur punya lebih dari satu kategori", () => {
  const jersey = [{ id: "cat-jersey" }];
  const nonJersey = [{ id: "cat-kemeja" }, { id: "cat-pdh" }];

  assert.deepEqual(resolveProductionCategorySelection("all", jersey), {
    allCategoriesSelected: false,
    kategoriId: "cat-jersey",
    categoryParam: "cat-jersey",
  });
  assert.deepEqual(resolveProductionCategorySelection(undefined, jersey), {
    allCategoriesSelected: false,
    kategoriId: "cat-jersey",
    categoryParam: "cat-jersey",
  });
  assert.deepEqual(resolveProductionCategorySelection("all", nonJersey), {
    allCategoriesSelected: true,
    kategoriId: null,
    categoryParam: "all",
  });
  assert.deepEqual(resolveProductionCategorySelection("cat-pdh", nonJersey), {
    allCategoriesSelected: false,
    kategoriId: "cat-pdh",
    categoryParam: "cat-pdh",
  });
  assert.deepEqual(resolveProductionCategorySelection("kategori-hilang", nonJersey), {
    allCategoriesSelected: false,
    kategoriId: "cat-kemeja",
    categoryParam: "cat-kemeja",
  });
  assert.deepEqual(resolveProductionCategorySelection("all", []), {
    allCategoriesSelected: false,
    kategoriId: null,
    categoryParam: null,
  });
});

test("saran pindah papan hanya menampilkan kategori lain yang cocok", () => {
  const categories = [
    { id: "cat-jersey", name: "Jersey", garmentType: "JERSEY" },
    { id: "cat-kemeja", name: "Kemeja", garmentType: "NON_JERSEY" },
    { id: "cat-pdh", name: "PDH / PDL", garmentType: "NON_JERSEY" },
    { id: "cat-topi", name: "Topi", garmentType: "AKSESORI" },
  ];

  assert.deepEqual(
    matchingProductionCategoryScopes(categories, "kemeja", "JERSEY", "cat-jersey").map((category) => category.id),
    ["cat-kemeja"],
  );
  assert.deepEqual(
    matchingProductionCategoryScopes(categories, "kemeja", "NON_JERSEY", "cat-kemeja"),
    [],
    "kategori yang sedang aktif tidak disarankan lagi",
  );
  assert.deepEqual(
    matchingProductionCategoryScopes(categories, "kemeja", "NON_JERSEY", null),
    [],
    "saat semua kategori dipilih, kategori satu jalur sudah tercakup",
  );
  assert.deepEqual(
    matchingProductionCategoryScopes(categories, "topi", "NON_JERSEY", "cat-kemeja").map((category) => category.id),
    ["cat-topi"],
  );
  assert.deepEqual(matchingProductionCategoryScopes(categories, "", "JERSEY", "cat-jersey"), []);
});

test("PIC dibaca dari tahap aktif, termasuk kartu yang belum punya PIC", () => {
  const withPic = productionBoardFilterConditions({ ...EMPTY_PRODUCTION_BOARD_FILTERS, pic: "user-1" }, NOW);
  assert.deepEqual(withPic, [{ steps: { some: { status: "ACTIVE", assigneeId: "user-1" } } }]);

  const withoutPic = productionBoardFilterConditions({ ...EMPTY_PRODUCTION_BOARD_FILTERS, pic: NO_PIC }, NOW);
  assert.deepEqual(withoutPic, [{ steps: { some: { status: "ACTIVE", assigneeId: null } } }]);
});

test("Terlambat membatasi ke pekerjaan aktif, kecuali status dipilih eksplisit", () => {
  const overdue = productionBoardFilterConditions({ ...EMPTY_PRODUCTION_BOARD_FILTERS, deadline: "overdue" }, NOW);
  assert.deepEqual(overdue, [{ deadline: { lt: new Date("2026-10-30T00:00:00.000Z") } }, { status: "ACTIVE" }]);

  const overdueCompleted = productionBoardFilterConditions(
    { ...EMPTY_PRODUCTION_BOARD_FILTERS, deadline: "overdue", status: "COMPLETED" },
    NOW,
  );
  assert.deepEqual(overdueCompleted, [
    { deadline: { lt: new Date("2026-10-30T00:00:00.000Z") } },
    { status: "COMPLETED" },
  ]);
});

test("penanda digabung sebagai 'salah satu' di dalam AND, bukan menimpa OR jalur", () => {
  const conditions = productionBoardFilterConditions(
    { ...EMPTY_PRODUCTION_BOARD_FILTERS, penanda: ["retur", "qc"] },
    NOW,
  );
  assert.deepEqual(conditions, [{ OR: [{ repairReason: { not: null } }, { qcReverted: true }] }]);

  const where = productionBoardWhere({
    group: "NON_JERSEY",
    productCategoryId: "cat-1",
    filters: { ...EMPTY_PRODUCTION_BOARD_FILTERS, penanda: ["sampel"] },
    reference: NOW,
  });
  // Jalur, kategori, dan penanda semuanya berada di array AND (tidak saling timpa).
  assert.ok(Array.isArray(where.AND));
  assert.equal(where.AND.length, 3);
  assert.deepEqual(where.AND[2], { OR: [{ sampleRevision: { gt: 1 } }] });
  assert.equal(where.route, "NON_JERSEY");
  assert.deepEqual(where.status, { not: "CANCELLED" });
  assert.deepEqual(where.designCompletedAt, { not: null });
});

test("kategori item kosong memakai kategori PO, bukan cocok ke semua kategori", () => {
  const where = productionBoardWhere({ group: "NON_JERSEY", productCategoryId: "cat-kemeja" });
  assert.ok(Array.isArray(where.AND));
  assert.deepEqual(where.AND[1], {
    OR: [
      { purchaseOrderItem: { is: { productCategoryId: "cat-kemeja" } } },
      {
        purchaseOrderItem: { is: { productCategoryId: null } },
        salesOrder: { purchaseOrder: { productCategoryId: "cat-kemeja" } },
      },
      { purchaseOrderItem: { is: null }, salesOrder: { purchaseOrder: { productCategoryId: "cat-kemeja" } } },
    ],
  });
});

test("tanpa filter, where papan sama seperti sebelumnya untuk setiap jalur", () => {
  const jersey = productionBoardWhere({ group: "JERSEY" });
  assert.equal(jersey.route, "JERSEY");
  assert.equal(jersey.AND, undefined, "tanpa syarat tambahan tidak ada AND kosong");

  const aksesori = productionBoardWhere({ group: "AKSESORI" });
  assert.equal(aksesori.route, "NON_JERSEY");
  assert.deepEqual(aksesori.AND, [
    {
      OR: [
        { purchaseOrderItem: { is: { garmentType: "AKSESORI" } } },
        { purchaseOrderItem: { is: null }, salesOrder: { purchaseOrder: { garmentType: "AKSESORI" } } },
      ],
    },
  ]);
});

test("label filter aktif menyebut PIC dan penanda untuk empty state", () => {
  const filters = { ...EMPTY_PRODUCTION_BOARD_FILTERS, q: "seragam", pic: "user-9", deadline: "d3", status: "ACTIVE", penanda: ["retur"] };
  assert.deepEqual(activeProductionBoardFilterLabels(filters, "Budi"), ['"seragam"', "Budi", "Deadline ≤ 3 hari", "Aktif", "Retur"]);
  assert.deepEqual(
    activeProductionBoardFilterLabels({ ...EMPTY_PRODUCTION_BOARD_FILTERS, pic: NO_PIC }, null),
    ["Belum ada PIC"],
  );
});

test("cache papan memuat setiap filter agar hasil filter lain tidak bocor", () => {
  const base = productionBoardCacheKey({ group: "JERSEY", productCategoryId: "cat-1" });
  const key = productionBoardCacheKey({
    group: "JERSEY",
    productCategoryId: "cat-1",
    filters: { q: "Seragam", pic: "user-1", deadline: "d7", status: "ACTIVE", penanda: ["retur", "qc"] },
  });

  assert.deepEqual(base, ["production-board", "JERSEY", "cat-1", "", "", "", "", ""]);
  assert.equal(key.length, base.length, "panjang key tetap, hanya nilai yang berubah");
  // Pencarian tidak peka huruf besar/kecil supaya cache tidak dobel.
  assert.equal(key[3], "seragam");
  assert.deepEqual(key.slice(4), ["user-1", "d7", "ACTIVE", "retur,qc"]);
  assert.notDeepEqual(key, base);
});

test("halaman, API polling, dan export memakai builder filter yang sama", async () => {
  const [page, section, sectionClient, filtersBar, route, exportData, data] = await Promise.all([
    read("app/(app)/produksi/page.tsx"),
    read("components/production/production-board-section.tsx"),
    read("components/production/production-board-section-client.tsx"),
    read("components/production/production-filters.tsx"),
    read("app/api/produksi/board/route.ts"),
    read("lib/export/datasets/orders.ts"),
    read("lib/production/data.ts"),
  ]);

  // Halaman membaca filter dari URL dan meneruskannya ke board + tombol export.
  assert.match(page, /parseProductionBoardFilters\(params\)/);
  assert.match(page, /productionBoardFilterParams\(filters\)/);
  assert.match(page, /categoryParam=\{kategoriParam\}/);
  assert.match(page, /categoryName=\{selectedCategoryName\}/);
  assert.match(page, /categories=\{categoryOptions\}/);
  assert.match(page, /ALL_PRODUCTION_CATEGORIES/);
  assert.match(page, /resolveProductionCategorySelection\(rawKategori, categories\)/);
  assert.match(page, /categories.length > 1/);
  assert.match(page, />\s*Semua\s*<\/Button>/);
  // Filter ikut terbawa saat pindah jalur/kategori.
  assert.match(page, /const withFilters = \(query: string\) => \(filterQuery \? `\$\{query\}&\$\{filterQuery\}` : query\)/);

  assert.match(section, /getProductionBoard\(\{ group, productCategoryId, filters \}\)/);
  assert.match(section, /getProductionSearchSuggestions/);
  // Polling memakai filter yang sama, kalau tidak kartu terfilter muncul lagi.
  assert.match(sectionClient, /\/api\/produksi\/board\?jalur=\$\{group\}&kategori=\$\{productCategoryId \?\? ""\}\$\{filterQuery \? `&\$\{filterQuery\}` : ""\}/);
  assert.match(sectionClient, /isFiltering && board\.items\.length === 0/);
  assert.match(sectionClient, /activeProductionBoardFilterLabels\(filters, selectedPic\)/);
  assert.match(sectionClient, /searchSuggestions/);
  assert.match(sectionClient, /Ditemukan juga di papan lain/);
  assert.match(filtersBar, /Cari di \{scopeLabel\}/);
  assert.match(filtersBar, /categoryParam/);

  assert.match(route, /parseProductionBoardFilters\(Object\.fromEntries\(params\.entries\(\)\)\)/);
  assert.match(route, /getProductionBoard\(\{ group, productCategoryId, filters \}\)/);

  // Export memakai where yang identik dengan board (termasuk WO lawas tanpa item).
  assert.match(exportData, /kategori === ALL_PRODUCTION_CATEGORIES/);
  assert.match(exportData, /productionBoardWhere\(\{ group, productCategoryId, filters \}\)/);
  assert.match(data, /productionBoardWhere\(filter\)/);
  assert.match(data, /productionBoardCacheKey\(filter\)/);
  assert.match(data, /matchingProductionCategoryScopes/);
  // Pilihan PIC dibatasi jalur + kategori, bukan filter aktif lainnya.
  assert.match(data, /workOrder: productionBoardWhere\(scope\)/);
});
