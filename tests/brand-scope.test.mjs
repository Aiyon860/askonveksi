import assert from "node:assert/strict";
import test from "node:test";

import { brandScopeArgs, brandScopedWhere, withBrandField } from "../lib/brand/scoped-args.ts";

const scope = { brand: "SAGA" };

test("findUnique tetap menyimpan kolom unik di level atas where", () => {
  // Prisma 7 menolak `{ AND: [{ id }, scope] }` untuk WhereUniqueInput.
  // Tanpa `id` di level atas, query gagal dengan PrismaClientValidationError.
  const where = brandScopedWhere("findUnique", { id: "opp-1" }, scope);

  assert.deepEqual(where, { id: "opp-1", AND: [scope] });
  assert.equal(where.id, "opp-1");
});

test("update, delete, findUniqueOrThrow, dan upsert juga memakai bentuk unik", () => {
  for (const operation of ["update", "delete", "findUniqueOrThrow", "upsert"]) {
    const where = brandScopedWhere(operation, { id: "x" }, scope);

    assert.deepEqual(where, { id: "x", AND: [scope] }, `operasi ${operation}`);
  }
});

test("selector unik gabungan tetap utuh di level atas", () => {
  const where = brandScopedWhere(
    "findUnique",
    { opportunityNo: "OPP-AS-0001" },
    scope,
  );

  assert.equal(where.opportunityNo, "OPP-AS-0001");
  assert.deepEqual(where.AND, [scope]);
});

test("AND yang sudah ada digabung, bukan ditimpa", () => {
  const existing = { createdAt: { gte: "2026-01-01" } };
  const where = brandScopedWhere("findUnique", { id: "x", AND: existing }, scope);

  assert.deepEqual(where, { id: "x", AND: [existing, scope] });
});

test("AND berbentuk array dipertahankan urutannya", () => {
  const where = brandScopedWhere(
    "update",
    { id: "x", AND: [{ a: 1 }, { b: 2 }] },
    scope,
  );

  assert.deepEqual(where, { id: "x", AND: [{ a: 1 }, { b: 2 }, scope] });
});

test("operasi list tetap dibungkus AND penuh", () => {
  const where = brandScopedWhere("findMany", { stage: "DEAL" }, scope);

  assert.deepEqual(where, { AND: [{ stage: "DEAL" }, scope] });
});

test("operasi list tanpa where hanya memakai scope", () => {
  for (const operation of ["findMany", "count", "updateMany", "deleteMany", "aggregate"]) {
    assert.deepEqual(brandScopedWhere(operation, undefined, scope), scope, operation);
    assert.deepEqual(brandScopedWhere(operation, {}, scope), scope, operation);
  }
});

test("operasi tanpa where mengembalikan undefined", () => {
  assert.equal(brandScopedWhere("create", { data: {} }, scope), undefined);
  assert.equal(brandScopedWhere("createMany", {}, scope), undefined);
});

test("where unik kosong dibiarkan agar Prisma melaporkan kesalahan pemanggil", () => {
  assert.deepEqual(brandScopedWhere("findUnique", {}, scope), scope);
});

test("withBrandField memaksa brand aktif pada penulisan biasa", () => {
  assert.deepEqual(withBrandField({ name: "A" }, "SAGA", "brand"), {
    name: "A",
    brand: "SAGA",
  });
  assert.deepEqual(
    withBrandField({ name: "A", brand: "ASKONVEKSI" }, "SAGA", "brand"),
    { name: "A", brand: "SAGA" },
  );
});

test("withBrandField mempertahankan customer BOTH, tetapi bukan brand lain", () => {
  assert.deepEqual(
    withBrandField({ brandScope: "BOTH" }, "SAGA", "brandScope"),
    { brandScope: "BOTH" },
  );
  assert.deepEqual(
    withBrandField({ brandScope: "ASKONVEKSI" }, "SAGA", "brandScope"),
    { brandScope: "SAGA" },
  );
});

test("client BOTH tidak bocor ke model ber-brand tunggal", () => {
  // `brand` hanya menerima satu nilai; `BOTH` khusus customer.
  assert.deepEqual(withBrandField({}, "SAGA", "brand"), { brand: "SAGA" });
});

test("argumen query kosong dinormalisasi jadi objek agar penanda brand ikut", () => {
  // `brandScopedClient(SAGA).opportunity.count()` memanggil delegate tanpa
  // argumen. Kalau `undefined` diteruskan, penanda brand hilang dan query
  // membaca ASKONVEKSI (brand default request) — bukan SAGA.
  assert.deepEqual(brandScopeArgs(undefined), {});
  assert.deepEqual(brandScopeArgs(null), {});
  assert.deepEqual(brandScopeArgs([]), {});
  assert.deepEqual(brandScopeArgs({ where: { id: "x" } }), { where: { id: "x" } });
});
