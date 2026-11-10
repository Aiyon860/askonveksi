import assert from "node:assert/strict";
import test from "node:test";

import {
  PO_SIZE_COLUMN_COUNT,
  defaultPoCustomSize,
  poSizeColumns,
  remapPoSizeColumn,
  savedPoCustomSize,
} from "../lib/crm/po-size-columns.ts";

const names = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL", "REQ"];
const sizes = names.map((name) => ({ id: `id-${name}`, name }));

const namesOf = (columns) => columns.map((size) => size.name);

test("kolom matriks PO: 7 ukuran master + kolom ke-8 ubahan + REQ paling kanan", () => {
  const custom = defaultPoCustomSize(sizes);
  assert.equal(custom?.name, "4XL");

  const columns = poSizeColumns(sizes, custom, {});
  assert.deepEqual(namesOf(columns), ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "REQ"]);
  assert.equal(columns.length, PO_SIZE_COLUMN_COUNT + 1);
  assert.equal(columns.at(-1)?.name, "REQ");
});

test("REQ tidak ikut jatah 8 kolom dan tidak pernah jadi kolom ubahan", () => {
  const withoutRequest = sizes.filter((size) => size.name !== "REQ");
  const custom = defaultPoCustomSize(withoutRequest);
  assert.equal(custom?.name, "4XL");
  assert.deepEqual(namesOf(poSizeColumns(withoutRequest, custom, {})), ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"]);

  // Master yang hanya berisi sedikit ukuran + REQ: REQ tetap tampil paling kanan.
  const minimal = ["M", "L", "XL", "REQ"].map((name) => ({ id: `id-${name}`, name }));
  assert.deepEqual(namesOf(poSizeColumns(minimal, { id: "id-2XL", name: "2XL" }, {})), ["M", "L", "XL", "2XL", "REQ"]);
});

test("kolom ke-8 mengikuti ukuran yang sudah dipakai PO lama", () => {
  assert.equal(savedPoCustomSize(sizes, { "PENDEK:id-6XL": 2 })?.name, "6XL");
  // REQ bukan kandidat kolom ubahan.
  assert.equal(savedPoCustomSize(sizes, { "PENDEK:id-REQ": 2 })?.name, "4XL");
  assert.equal(savedPoCustomSize(sizes, { "PENDEK:id-M": 2 })?.name, "4XL");
});

test("ukuran di luar 8 kolom tetap tampil sebelum REQ saat PO lama memakainya", () => {
  const custom = { id: "id-8XL", name: "8XL" };
  const columns = poSizeColumns(sizes, custom, { "PENDEK:id-5XL": 3, "PENDEK:id-8XL": 1 });
  assert.deepEqual(namesOf(columns), ["XS", "S", "M", "L", "XL", "2XL", "3XL", "5XL", "8XL", "REQ"]);
});

test("ganti nama kolom ke-8 memindahkan jumlah kedua lengan", () => {
  const next = remapPoSizeColumn({ "PENDEK:id-4XL": 5, "PANJANG:id-4XL": 2, "PENDEK:id-M": 1 }, "id-4XL", "id-8XL");
  assert.equal(next["PENDEK:id-8XL"], 5);
  assert.equal(next["PANJANG:id-8XL"], 2);
  assert.equal(next["PENDEK:id-4XL"], undefined);
  assert.equal(next["PANJANG:id-4XL"], undefined);
  assert.equal(next["PENDEK:id-M"], 1);

  const fresh = remapPoSizeColumn({}, "", "id-8XL");
  assert.equal(fresh["PENDEK:id-8XL"], 0);
  assert.equal(fresh["PANJANG:id-8XL"], 0);
});
