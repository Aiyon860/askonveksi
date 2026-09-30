import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { GARMENT_TYPE_LABEL, groupProductCategories, sortProductCategoryRows } from "../lib/crm/constants.ts";

const [
  constants,
  campaigns,
  crmData,
  excel,
  masterDataPage,
  masterData,
  masterDataActions,
  editor,
  groupOrderMigration,
  broadcastWorkspace,
  broadcastActions,
  campaignDialog,
  campaignActions,
] = await Promise.all([
  readFile(new URL("../lib/crm/constants.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/whatsapp/campaigns.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/crm/data.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/master-data-excel.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(app)/master-data/product-categories/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/master-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/master-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/master-data-editor.tsx", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20260930000000_product_category_group_order/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../components/crm/broadcast-workspace.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/broadcast.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/campaigns/campaign-recipient-dialog.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/campaigns.ts", import.meta.url), "utf8"),
]);

test("label jenis kategori memakai Aksesoris tanpa ejaan lama", () => {
  assert.equal(GARMENT_TYPE_LABEL.JERSEY, "Jersey");
  assert.equal(GARMENT_TYPE_LABEL.NON_JERSEY, "Non-jersey");
  assert.equal(GARMENT_TYPE_LABEL.AKSESORI, "Aksesoris");

  const sources = [
    ["constants", constants],
    ["campaigns", campaigns],
    ["crmData", crmData],
    ["excel", excel],
    ["masterDataPage", masterDataPage],
  ];
  for (const [name, source] of sources) {
    assert.doesNotMatch(source, /\bAksesori\b/, `${name} masih memakai ejaan Aksesori`);
  }
  assert.match(excel, /allowedLabels: \["Jersey", "Non-jersey", "Aksesoris"\]/);
  assert.match(excel, /aksesoris: "AKSESORI"/);
});

test("urutan kanonik kategori selalu Jersey, Non-jersey, Aksesoris", () => {
  const rows = [
    { name: "Topi", position: 14, garmentType: "AKSESORI" },
    { name: "Jersey", position: 17, garmentType: "JERSEY" },
    { name: "Jaket", position: 10, garmentType: "NON_JERSEY" },
    { name: "Kemeja", position: 1, garmentType: "NON_JERSEY" },
    { name: "Ganci", position: 15, garmentType: "AKSESORI" },
  ];

  assert.deepEqual(
    sortProductCategoryRows(rows, (row) => row.garmentType).map((row) => row.name),
    ["Jersey", "Kemeja", "Jaket", "Topi", "Ganci"],
  );
  // Data asli tidak boleh berubah urutannya (helper mengembalikan salinan).
  assert.deepEqual(rows.map((row) => row.name), ["Topi", "Jersey", "Jaket", "Kemeja", "Ganci"]);
  // Kelompokkan hanya mengurutkan grup: urutan relatif di dalam grup tetap.
  assert.deepEqual(
    groupProductCategories(rows, (row) => row.garmentType).map((row) => row.name),
    ["Jersey", "Jaket", "Kemeja", "Topi", "Ganci"],
  );
  const last = sortProductCategoryRows(rows, (row) => row.garmentType).at(-1);
  assert.equal(GARMENT_TYPE_LABEL[last.garmentType], "Aksesoris");
});

test("pembacaan dan penyimpanan kategori produk memakai urutan paksa", () => {
  const active = masterData.slice(masterData.indexOf("export async function getActiveProductCategories"));
  assert.match(active, /position: true/);
  assert.match(active, /sortProductCategoryRows\(items, \(item\) => item\.garmentType\)/);
  assert.match(masterData, /export async function getProductCategories[\s\S]*?sortProductCategoryRows\(/);
  assert.match(masterDataActions, /groupProductCategories\(/);
  assert.match(masterDataActions, /orderedRows/);
  assert.match(masterDataActions, /orderedItems/);
  assert.match(masterDataActions, /productCategory\.aggregate\(\{ where: \{ garmentType: parsed\.data\.kind \}, _max: \{ position: true \} \}/);
  assert.match(editor, /kindOptions \? groupProductCategories\(moved, \(item\) => item\.kind\) : moved/);
  assert.match(editor, /Jenis kategori selalu berurutan Jersey, Non-jersey, lalu Aksesoris\./);
  assert.match(groupOrderMigration, /CASE "garmentType" WHEN 'JERSEY' THEN 0 WHEN 'NON_JERSEY' THEN 1 ELSE 2 END/);
  assert.match(groupOrderMigration, /UPDATE "ProductCategory" AS p/);
});

test("Broadcast kehilangan filter Kategori Order tanpa menyentuh Campaign", () => {
  assert.doesNotMatch(broadcastWorkspace, /Kategori Order/);
  assert.doesNotMatch(broadcastWorkspace, /productCategoryId/);
  assert.doesNotMatch(broadcastActions, /orderCategory|productCategoryId/);
  assert.match(campaignDialog, /productCategoryId/);
  assert.match(campaignActions, /productCategoryId/);
});
