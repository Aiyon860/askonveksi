import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_PIPELINE_FILTERS,
  NO_PRODUCT_CATEGORY,
  filterPipelineOpportunities,
  formatPipelineMonth,
  hasActivePipelineFilters,
  isPipelineMonth,
  jakartaMonthKey,
} from "../lib/crm/pipeline-filters.ts";

const rows = [
  {
    id: "a",
    stage: "FOLLOW_UP",
    createdAt: "2026-01-31T17:30:00.000Z",
    customer: { id: "cust-1" },
    productCategory: { id: "cat-jersey" },
  },
  {
    id: "b",
    stage: "NEGOSIASI",
    createdAt: "2026-02-10T03:00:00.000Z",
    customer: { id: "cust-2" },
    productCategory: null,
  },
  {
    id: "c",
    stage: "DEAL",
    createdAt: "2026-02-28T16:59:59.000Z",
    customer: { id: "cust-1" },
    productCategory: { id: "cat-aksesori" },
  },
];

test("bulan pipeline memakai kalender Jakarta, bukan UTC", () => {
  assert.equal(jakartaMonthKey("2026-01-31T17:30:00.000Z"), "2026-02");
  assert.equal(jakartaMonthKey("2026-01-31T16:59:59.000Z"), "2026-01");
  assert.equal(jakartaMonthKey("2026-02-28T16:59:59.000Z"), "2026-02");
  assert.equal(jakartaMonthKey("2026-03-01T00:00:00.000Z"), "2026-03");
  assert.equal(jakartaMonthKey(null), "");
  assert.equal(jakartaMonthKey("bukan tanggal"), "");
});

test("format bulan hanya menerima YYYY-MM yang valid", () => {
  assert.equal(isPipelineMonth("2026-02"), true);
  assert.equal(isPipelineMonth("2026-13"), false);
  assert.equal(isPipelineMonth("2026-00"), false);
  assert.equal(isPipelineMonth("2026-2"), false);
  assert.equal(isPipelineMonth(""), false);
});

test("label bulan memakai nama bulan Indonesia", () => {
  assert.equal(formatPipelineMonth("2026-08"), "Agustus 2026");
  assert.equal(formatPipelineMonth("2026-01"), "Januari 2026");
  assert.equal(formatPipelineMonth("2026-13"), "");
});

test("filter bulan menyaring peluang menurut tanggal dibuat", () => {
  const result = filterPipelineOpportunities(rows, { ...EMPTY_PIPELINE_FILTERS, month: "2026-02" });
  assert.deepEqual(result.map((row) => row.id), ["a", "b", "c"]);

  const january = filterPipelineOpportunities(rows, { ...EMPTY_PIPELINE_FILTERS, month: "2026-01" });
  assert.deepEqual(january, []);
});

test("filter customer hanya mencocokkan id customer", () => {
  const result = filterPipelineOpportunities(rows, { ...EMPTY_PIPELINE_FILTERS, customerId: "cust-1" });
  assert.deepEqual(result.map((row) => row.id), ["a", "c"]);
});

test("filter kategori produk mendukung opsi tanpa kategori", () => {
  const jersey = filterPipelineOpportunities(rows, { ...EMPTY_PIPELINE_FILTERS, categoryId: "cat-jersey" });
  assert.deepEqual(jersey.map((row) => row.id), ["a"]);

  const withoutCategory = filterPipelineOpportunities(rows, { ...EMPTY_PIPELINE_FILTERS, categoryId: NO_PRODUCT_CATEGORY });
  assert.deepEqual(withoutCategory.map((row) => row.id), ["b"]);
});

test("kategori PO terakhir dipakai saat kategori peluang kosong", () => {
  const poRows = [
    {
      id: "po-jersey",
      stage: "DEAL",
      createdAt: "2026-02-10T03:00:00.000Z",
      customer: { id: "cust-1" },
      productCategory: null,
      purchaseOrder: { productCategory: { id: "cat-jersey" } },
    },
    {
      id: "po-kemeja",
      stage: "NEGOSIASI",
      createdAt: "2026-02-10T03:00:00.000Z",
      customer: { id: "cust-2" },
      productCategory: null,
      purchaseOrder: { productCategory: { id: "cat-kemeja" } },
    },
    {
      id: "po-kosong",
      stage: "FOLLOW_UP",
      createdAt: "2026-02-10T03:00:00.000Z",
      customer: { id: "cust-3" },
      productCategory: null,
      purchaseOrder: { productCategory: null },
    },
    {
      id: "tanpa-po",
      stage: "PROSPEK",
      createdAt: "2026-02-10T03:00:00.000Z",
      customer: { id: "cust-4" },
      productCategory: null,
    },
  ];

  const jersey = filterPipelineOpportunities(poRows, { ...EMPTY_PIPELINE_FILTERS, categoryId: "cat-jersey" });
  assert.deepEqual(jersey.map((row) => row.id), ["po-jersey"]);

  const kemeja = filterPipelineOpportunities(poRows, { ...EMPTY_PIPELINE_FILTERS, categoryId: "cat-kemeja" });
  assert.deepEqual(kemeja.map((row) => row.id), ["po-kemeja"]);

  const withoutCategory = filterPipelineOpportunities(poRows, { ...EMPTY_PIPELINE_FILTERS, categoryId: NO_PRODUCT_CATEGORY });
  assert.deepEqual(withoutCategory.map((row) => row.id), ["po-kosong", "tanpa-po"]);
});

test("kategori peluang tetap menang saat kategori PO berbeda", () => {
  const mixed = [
    {
      id: "peluang-jersey-po-kemeja",
      stage: "DEAL",
      createdAt: "2026-02-10T03:00:00.000Z",
      customer: { id: "cust-1" },
      productCategory: { id: "cat-jersey" },
      purchaseOrder: { productCategory: { id: "cat-kemeja" } },
    },
    {
      id: "peluang-jersey-tanpa-kategori-po",
      stage: "NEGOSIASI",
      createdAt: "2026-02-10T03:00:00.000Z",
      customer: { id: "cust-2" },
      productCategory: { id: "cat-jersey" },
      purchaseOrder: { productCategory: null },
    },
  ];

  const jersey = filterPipelineOpportunities(mixed, { ...EMPTY_PIPELINE_FILTERS, categoryId: "cat-jersey" });
  assert.deepEqual(jersey.map((row) => row.id), ["peluang-jersey-po-kemeja", "peluang-jersey-tanpa-kategori-po"]);

  const kemeja = filterPipelineOpportunities(mixed, { ...EMPTY_PIPELINE_FILTERS, categoryId: "cat-kemeja" });
  assert.deepEqual(kemeja, []);
});

test("tiga filter digabung dengan AND", () => {
  const result = filterPipelineOpportunities(rows, {
    customerId: "cust-1",
    month: "2026-02",
    categoryId: "cat-aksesori",
  });
  assert.deepEqual(result.map((row) => row.id), ["c"]);

  const empty = filterPipelineOpportunities(rows, {
    customerId: "cust-1",
    month: "2026-01",
    categoryId: "cat-aksesori",
  });
  assert.deepEqual(empty, []);
});

test("filter tidak membatasi tahap: semua kolom pipeline ikut disaring", () => {
  const allStages = ["FOLLOW_UP", "NEGOSIASI", "DEAL", "LOST"].map((stage, index) => ({
    id: `stage-${index}`,
    stage,
    createdAt: "2026-08-15T03:00:00.000Z",
    customer: { id: "cust-sama" },
    productCategory: { id: "cat-jersey" },
  }));

  const byCustomer = filterPipelineOpportunities(allStages, { ...EMPTY_PIPELINE_FILTERS, customerId: "cust-sama" });
  assert.equal(byCustomer.length, 4);
  assert.deepEqual([...new Set(byCustomer.map((row) => row.stage))], ["FOLLOW_UP", "NEGOSIASI", "DEAL", "LOST"]);

  const byMonth = filterPipelineOpportunities(allStages, { ...EMPTY_PIPELINE_FILTERS, month: "2026-08" });
  assert.equal(byMonth.length, 4);
});

test("filter kosong atau bulan tidak valid mengembalikan semua peluang", () => {
  assert.equal(filterPipelineOpportunities(rows, EMPTY_PIPELINE_FILTERS), rows);
  assert.equal(
    filterPipelineOpportunities(rows, { ...EMPTY_PIPELINE_FILTERS, month: "2026-13" }),
    rows,
  );
});

test("penanda filter aktif mengikuti isi ketiga kontrol", () => {
  assert.equal(hasActivePipelineFilters(EMPTY_PIPELINE_FILTERS), false);
  assert.equal(hasActivePipelineFilters({ ...EMPTY_PIPELINE_FILTERS, month: "2026-02" }), true);
  assert.equal(hasActivePipelineFilters({ ...EMPTY_PIPELINE_FILTERS, customerId: "cust-1" }), true);
  assert.equal(hasActivePipelineFilters({ ...EMPTY_PIPELINE_FILTERS, categoryId: NO_PRODUCT_CATEGORY }), true);
});
