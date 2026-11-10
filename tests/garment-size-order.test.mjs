import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  compareGarmentSizeNames,
  sortGarmentSizeNames,
  sortGarmentSizeRows,
} from "../lib/crm/size-aliases.ts";

const [sizeAliases, masterData, masterDataActions, pdfSource] = await Promise.all([
  readFile(new URL("../lib/crm/size-aliases.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/master-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/master-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/crm/purchase-order-pdf.ts", import.meta.url), "utf8"),
]);

test("ukuran pakaian selalu diurutkan XS…N-XL lalu REQ", () => {
  assert.deepEqual(sortGarmentSizeNames(["4XL", "REQ", "2XL", "3XL", "S", "10XL", "XS", "M", "L", "XL"]), [
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "2XL",
    "3XL",
    "4XL",
    "10XL",
    "REQ",
  ]);
  assert.deepEqual(
    sortGarmentSizeRows([{ name: "2XL" }, { name: "4XL" }, { name: "3XL" }, { name: "6XL" }]).map((row) => row.name),
    ["2XL", "3XL", "4XL", "6XL"],
  );
  assert.ok(compareGarmentSizeNames("XXL", "3XL") < 0);
  assert.ok(compareGarmentSizeNames("7XL", "REQ") < 0);
});

test("master ukuran dan PDF memakai urutan baku yang sama", () => {
  assert.match(sizeAliases, /export function compareGarmentSizeNames/);
  assert.match(sizeAliases, /export function sortGarmentSizeRows/);
  assert.match(masterData, /return sortGarmentSizeRows\(/);
  assert.match(masterData, /getActiveGarmentSizes[\s\S]*?return sortGarmentSizeRows\(items\)/);
  assert.match(masterDataActions, /async function reindexGarmentSizePositions/);
  assert.match(masterDataActions, /await reindexGarmentSizePositions\(tx\)/);
  assert.match(masterDataActions, /compareGarmentSizeNames\(left\.name, right\.name\)/);
  assert.match(pdfSource, /const SIZE_LADDER = \["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "REQ"\] as const/);
  assert.match(pdfSource, /sortGarmentSizeNames\(\[\.\.\.SIZE_LADDER, \.\.\.extras\]\)/);
});
