import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { moveProductionSchema } from "../lib/production/validation.ts";

const [schema, migration, skipMigration, workflow, actions, seed, packageJson] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20260902000000_production_workflow/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20260903000000_non_jersey_stage_skip/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../lib/production/workflow.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/production.ts", import.meta.url), "utf8"),
  readFile(new URL("../scripts/seed-production-demo.mjs", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("workflow Produksi memiliki dua jalur yang disepakati", () => {
  const jerseySequence = workflow.match(/if \(route === "JERSEY"\) \{\s+return \[([^\]]+)\]/)?.[1] ?? "";
  assert.match(jerseySequence, /TEST_PRINT.*PERSETUJUAN_SAMPEL.*LAYOUT_PRODUKSI.*PRINT.*CUTTING.*QC.*SELESAI/s);
  assert.doesNotMatch(jerseySequence, /JAHIT|PACKING|PENGIRIMAN/);
  assert.match(workflow, /POTONG.*BORDIR.*SABLON.*PRINTING.*JAHIT.*QC.*PACKING.*PENGIRIMAN.*SELESAI/s);
});

test("Work Order satu-ke-satu dengan Sales Order dan menyimpan urutan tahap", () => {
  assert.match(schema, /salesOrderId\s+String\s+@unique/);
  assert.match(schema, /stageSequence\s+ProductionStage\[\]/);
  assert.match(schema, /model ProductionStep[\s\S]*@@unique\(\[workOrderId, stage\]\)/);
});

test("migrasi Produksi menutup Data API dan mengaktifkan RLS", () => {
  for (const table of ["ProductionWorkOrder", "ProductionStep", "ProductionActivity"]) {
    assert.match(migration, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`));
  }
  assert.match(migration, /REVOKE ALL ON TABLE "ProductionWorkOrder", "ProductionStep", "ProductionActivity" FROM anon, authenticated/);
});

test("perpindahan tahap divalidasi server dan memakai optimistic concurrency", () => {
  assert.match(actions, /nextStage !== parsed\.data\.targetStage/);
  assert.match(actions, /where: \{ id: order\.id, version: order\.version, status: "ACTIVE", currentStage: order\.currentStage \}/);
  assert.match(actions, /order\.currentStage !== "PERSETUJUAN_SAMPEL"/);
  assert.match(actions, /order\.currentStage !== "QC"/);
});

test("Non-Jersey dapat melewati tahap dengan alasan dan jejak status", () => {
  const move = { workOrderId: "DEMO-WO-NON-JERSEY", version: 1, targetStage: "JAHIT", decision: "SKIP" };
  assert.equal(moveProductionSchema.safeParse(move).success, false);
  assert.equal(moveProductionSchema.safeParse({ ...move, note: "Tidak memerlukan sablon atau printing" }).success, true);
  assert.match(schema, /enum ProductionStepStatus[\s\S]*SKIPPED/);
  assert.match(skipMigration, /ProductionStepStatus[\s\S]*SKIPPED/);
  assert.match(skipMigration, /ProductionActivityType[\s\S]*STAGE_SKIPPED/);
  assert.match(actions, /order\.route !== "NON_JERSEY"/);
  assert.match(actions, /status: "SKIPPED"/);
});

test("kartu demo memakai ID Work Order tetap tanpa melonggarkan ID relasi", () => {
  const valid = { workOrderId: "DEMO-WO-JERSEY", version: 1, targetStage: "PERSETUJUAN_SAMPEL", decision: "ADVANCE" };
  assert.equal(moveProductionSchema.safeParse(valid).success, true);
  assert.equal(moveProductionSchema.safeParse({ ...valid, workOrderId: "pendek" }).success, false);
  assert.equal(moveProductionSchema.safeParse({ ...valid, workOrderId: "x".repeat(41) }).success, false);
});

test("seed development membuat satu kartu tiap jalur secara idempotent dan terproteksi", () => {
  assert.match(seed, /ALLOW_DEMO_DATA !== "true"/);
  assert.match(seed, /NODE_ENV === "production"/);
  assert.match(seed, /DEMO-WO-JERSEY/);
  assert.match(seed, /DEMO-WO-NON-JERSEY/);
  assert.match(seed, /TEST_PRINT.*PERSETUJUAN_SAMPEL.*LAYOUT_PRODUKSI.*PRINT.*CUTTING.*QC.*SELESAI/s);
  assert.match(seed, /POTONG.*BORDIR.*SABLON.*PRINTING.*JAHIT.*QC.*PACKING.*PENGIRIMAN.*SELESAI/s);
  assert.match(seed, /productionWorkOrder\.findUnique/);
  assert.match(packageJson, /"db:seed:production-demo": "node scripts\/seed-production-demo\.mjs"/);
  assert.doesNotMatch(packageJson, /"postinstall": [^\n]*seed-production-demo/);
});
