import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { moveProductionSchema, updateProductionObstacleSchema } from "../lib/production/validation.ts";

const [schema, migration, skipMigration, automationMigration, workflow, actions, crmActions, service, seed, packageJson, board, revertMigration, sectionClient, data, obstacleTimestampMigration] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20260902000000_production_workflow/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20260903000000_non_jersey_stage_skip/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20260907000000_automatic_production_work_orders/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../lib/production/workflow.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/production.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/crm.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/production/service.ts", import.meta.url), "utf8"),
  readFile(new URL("../scripts/seed-production-demo.mjs", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../components/production/production-board.tsx", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20260928000000_production_stage_reverted/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../components/production/production-board-section-client.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/production/data.ts", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20260928020000_production_obstacle_and_stage_timestamps/migration.sql", import.meta.url), "utf8"),
]);

test("workflow Produksi memiliki dua jalur yang disepakati", () => {
  const jerseySequence = workflow.match(/if \(route === "JERSEY"\) \{\s+return \[([^\]]+)\]/)?.[1] ?? "";
  assert.match(jerseySequence, /TEST_PRINT.*PERSETUJUAN_SAMPEL.*LAYOUT_PRODUKSI.*PRINT.*CUTTING.*QC.*SELESAI/s);
  assert.doesNotMatch(jerseySequence, /JAHIT|PACKING|PENGIRIMAN/);
  assert.match(workflow, /POTONG.*BORDIR.*SABLON.*PRINTING.*JAHIT.*QC.*PACKING.*PENGIRIMAN.*SELESAI/s);
});

test("Work Order dibuat otomatis dan idempoten dari pembayaran serta data PO", () => {
  assert.match(service, /export async function ensureProductionWorkOrder/);
  assert.match(service, /productionWorkOrder: \{ select:/);
  assert.match(service, /purchaseOrder\.garmentType/);
  assert.match(service, /purchaseOrder\.sizes\.reduce/);
  assert.match(crmActions, /await ensureProductionWorkOrder\(tx, actor, created\.id\)/);
  assert.match(crmActions, /export async function editPaymentTransactionAction/);
  assert.match(crmActions, /newTotal\.gt\(payment\.salesOrder\.total\)/);
  assert.doesNotMatch(actions, /configureLegacyProductionAction/);
  assert.match(automationMigration, /PurchaseOrder_agreed_production_data_required/);
  assert.match(schema, /model PaymentTransaction[\s\S]*version\s+Int\s+@default\(1\)/);
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
  assert.match(actions, /parsed\.data\.decision === "REVERT"/);
  assert.match(actions, /targetStep\.position >= currentStep\.position/);
});

test("Kendala kartu dihapus saat proses maju dan diisi saat mundur", () => {
  const move = actions.slice(actions.indexOf("async function moveProduction"), actions.indexOf("export async function moveProductionOptimisticAction"));
  assert.ok(move.length > 0);
  assert.match(move, /obstacleUpdate = null/);
  assert.match(move, /obstacleUpdate = parsed\.data\.note\.slice\(0, 2000\)/);
  // Tanggal jejak Kendala ikut hidup saat diisi dan ikut hilang saat dikosongkan.
  assert.match(move, /\.\.\.\(obstacleUpdate !== undefined \? \{ obstacle: obstacleUpdate, obstacleUpdatedAt: obstacleUpdate === null \? null : now \} : \{\}\)/);
  assert.match(actions, /const obstacleUpdatedAt = obstacle \? new Date\(\) : null/);
  assert.match(actions, /data: \{ obstacle, obstacleUpdatedAt \}/);
  // Setiap perpindahan tahap mencatat kapan kartu masuk kolom barunya.
  assert.match(move, /stageEnteredAt: now/);
  assert.match(service, /stageEnteredAt: new Date\(\)/);
  // Cache SWR harus mengikuti data server terbaru setelah aksi + router.refresh(),
  // supaya perubahan Kendala langsung tampak tanpa menunggu polling 60 detik.
  assert.match(sectionClient, /void mutate\(initialData, \{ revalidate: false \}\)/);
  assert.match(sectionClient, /\}, \[initialData, mutate\]\)/);
});

test("kartu kanban menampilkan tanggal Kendala dan Masuk Pada", () => {
  assert.match(schema, /obstacleUpdatedAt\s+DateTime\?\s+@db\.Timestamptz\(3\)/);
  assert.match(schema, /stageEnteredAt\s+DateTime\?\s+@db\.Timestamptz\(3\)/);
  assert.match(obstacleTimestampMigration, /ADD COLUMN "obstacleUpdatedAt" TIMESTAMPTZ\(3\)/);
  assert.match(obstacleTimestampMigration, /ADD COLUMN "stageEnteredAt" TIMESTAMPTZ\(3\)/);
  assert.match(obstacleTimestampMigration, /CHECK \("obstacle" IS NULL OR "obstacleUpdatedAt" IS NOT NULL\)/);
  // Tanggal Kendala sejajar dengan labelnya, "Masuk Pada" berada di bawah Deadline produksi.
  assert.match(board, /<dt>Masuk Pada<\/dt>/);
  assert.match(board, /DATE_TIME_FORMAT\.format\(new Date\(item\.stageEnteredAt\)\)/);
  assert.match(board, /obstacleUpdatedAt \? <p className="text-xs text-muted-foreground tabular-nums">/);
  assert.match(data, /obstacleUpdatedAt: true,\n\s+stageEnteredAt: true/);
  assert.match(data, /stageEnteredAt: row\.stageEnteredAt\?\.toISOString\(\) \?\? null/);
  assert.match(data, /obstacleUpdatedAt: row\.obstacleUpdatedAt\?\.toISOString\(\) \?\? null/);
});

test("transaksi perpindahan tahap memakai anggaran waktu yang lebih longgar", () => {
  assert.match(actions, /const MOVE_TRANSACTION_OPTIONS = \{/);
  assert.match(actions, /maxWait: 10_000/);
  assert.match(actions, /timeout: 20_000/);
  assert.doesNotMatch(actions, /\}, \{ isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable \}\);/);
});

test("tahap mundur pada kanban memakai pop-up konfirmasi dan kendala opsional", () => {
  const revert = { workOrderId: "DEMO-WO-NON-JERSEY", version: 2, targetStage: "SABLON", decision: "REVERT" };
  assert.equal(moveProductionSchema.safeParse(revert).success, true);
  assert.equal(moveProductionSchema.safeParse({ ...revert, note: "Sablon belum rata" }).success, true);
  assert.match(board, /decision: "REVERT" as const/);
  assert.match(board, /activeItem\.currentStage !== stage/);
  assert.match(board, /Kembalikan ke \$\{PRODUCTION_STAGE_LABEL\[option\.targetStage\]\}/);
  assert.match(schema, /enum ProductionActivityType[\s\S]*STAGE_REVERTED/);
  assert.match(revertMigration, /ProductionActivityType[\s\S]*STAGE_REVERTED/);
});

test("Non-Jersey dapat melewati tahap dengan kendala opsional dan jejak status", () => {
  const move = { workOrderId: "DEMO-WO-NON-JERSEY", version: 1, targetStage: "JAHIT", decision: "SKIP" };
  assert.equal(moveProductionSchema.safeParse(move).success, true);
  assert.equal(moveProductionSchema.safeParse({ ...move, note: "Tidak memerlukan sablon atau printing" }).success, true);
  assert.equal(moveProductionSchema.safeParse({ workOrderId: "DEMO-WO-JERSEY", version: 1, targetStage: "PERSETUJUAN_SAMPEL", decision: "ADVANCE" }).success, true);
  assert.equal(updateProductionObstacleSchema.safeParse({ workOrderId: "DEMO-WO-JERSEY", obstacle: "" }).success, true);
  assert.equal(updateProductionObstacleSchema.safeParse({ workOrderId: "DEMO-WO-JERSEY", obstacle: "Kain belum datang" }).success, true);
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
