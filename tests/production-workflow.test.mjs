import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { moveProductionSchema, updateProductionObstacleSchema } from "../lib/production/validation.ts";
import {
  boardStagesForGroup,
  parseProductionBoardGroup,
  PRODUCTION_BOARD_GROUPS,
  PRODUCTION_BOARD_GROUP_LABEL,
  RETUR_COLUMN,
  stageRouteForGroup,
} from "../lib/production/workflow.ts";

const [schema, migration, skipMigration, automationMigration, workflow, actions, crmActions, service, seed, packageJson, board, revertMigration, sectionClient, data, obstacleTimestampMigration, productionPage, boardRoute, boardSection, productionDetail, summary, backfillPoScript] = await Promise.all([
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
  readFile(new URL("../app/(app)/produksi/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/produksi/board/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/production/production-board-section.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/(app)/produksi/[id]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/production/production-summary.tsx", import.meta.url), "utf8"),
  readFile(new URL("../scripts/backfill-purchase-order-categories.mjs", import.meta.url), "utf8"),
]);

test("workflow Produksi memiliki dua jalur yang disepakati", () => {
  const jerseySequence = workflow.match(/if \(route === "JERSEY"\) \{\s+return \[([^\]]+)\]/)?.[1] ?? "";
  assert.match(jerseySequence, /TEST_PRINT.*PERSETUJUAN_SAMPEL.*LAYOUT_PRODUKSI.*PRINT.*CUTTING.*QC.*SELESAI/s);
  assert.doesNotMatch(jerseySequence, /JAHIT|PACKING|PENGIRIMAN/);
  assert.match(workflow, /POTONG.*BORDIR.*SABLON.*PRINTING.*JAHIT.*QC.*PACKING.*PENGIRIMAN.*SELESAI/s);
});

test("Work Order dibuat otomatis dan idempoten dari pembayaran serta data PO", () => {
  assert.match(service, /export async function ensureProductionWorkOrder/);
  assert.match(service, /productionWorkOrders: \{ select:/);
  assert.match(service, /purchaseOrder\.garmentType/);
  assert.match(service, /existingByItem/);
  assert.match(service, /purchaseOrderItemId/);
  assert.match(crmActions, /await ensureProductionWorkOrder\(tx, actor, created\.id\)/);
  assert.match(crmActions, /export async function editPaymentTransactionAction/);
  assert.match(crmActions, /newTotal\.gt\(payment\.salesOrder\.total\)/);
  assert.doesNotMatch(actions, /configureLegacyProductionAction/);
  assert.match(automationMigration, /PurchaseOrder_agreed_production_data_required/);
  assert.match(schema, /model PaymentTransaction[\s\S]*version\s+Int\s+@default\(1\)/);
});

test("Work Order satu-ke-banyak dengan Sales Order per item PO dan menyimpan urutan tahap", () => {
  assert.match(schema, /model ProductionWorkOrder[\s\S]*?salesOrderId\s+String(?!\s+@unique)/);
  assert.match(schema, /purchaseOrderItemId\s+String\?/);
  assert.match(schema, /itemName\s+String\?/);
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
  assert.match(actions, /targetStep\.position >= currentStep\.position/);
  assert.match(actions, /parsed\.data\.decision === "TO_RETUR"/);
  assert.match(actions, /targetStep\.position >= currentStep\.position/);
});

test("board produksi auto-refresh setelah kartu dipindah", () => {
  // Cache unstable_cache bertag "production-board" harus di-invalidasi; revalidatePath saja tidak cukup.
  assert.match(actions, /function revalidateProductionBoard\(\)/);
  assert.match(actions, /revalidateTag\("production-board", \{ expire: 0 \}\)/);
  // Transisi menunggu revalidate SWR agar kartu tidak sempat balik ke kolom lama.
  assert.match(board, /await onRefresh\?\.\(\)/);
  assert.match(sectionClient, /onRefresh=\{\(\) => mutate\(\)\}/);
});

test("Kendala kartu dihapus saat proses maju, tidak tersentuh saat masuk Retur", () => {
  const move = actions.slice(actions.indexOf("async function moveProduction"), actions.indexOf("export async function moveProductionOptimisticAction"));
  assert.ok(move.length > 0);
  assert.match(move, /obstacleUpdate = null/);
  // Masuk Retur tidak mengubah Kendala kartu; alasan retur tercatat sebagai repairReason.
  assert.doesNotMatch(move, /obstacleUpdate = parsed\.data\.note/);
  assert.match(move, /repairReason = reason\.slice\(0, 2000\)/);
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

test("mundur hanya lewat Retur dengan alasan wajib; badge Retur menempel permanen", () => {
  const retur = { workOrderId: "DEMO-WO-NON-JERSEY", version: 2, targetStage: "SABLON", decision: "TO_RETUR", note: "Sablon belum rata" };
  assert.equal(moveProductionSchema.safeParse(retur).success, true);
  assert.equal(moveProductionSchema.safeParse({ ...retur, decision: "REVERT" }).success, false);
  assert.equal(moveProductionSchema.safeParse({ ...retur, decision: "QC_REJECT" }).success, false);
  // Keluar dari kolom Retur memakai keputusan sendiri dan selalu ke tahap kartu saat ini.
  assert.equal(moveProductionSchema.safeParse({ workOrderId: retur.workOrderId, version: 2, targetStage: "SABLON", decision: "RELEASE_RETUR" }).success, true);
  assert.match(board, /decision: "TO_RETUR" as const/);
  assert.doesNotMatch(board, /"QC_REJECT" as const/);
  assert.doesNotMatch(board, /"REVERT" as const/);
  assert.match(board, /Masuk Retur, kembali ke \$\{stageLabelForGroup\(option\.targetStage, group\)\}/);
  assert.match(board, /Alasan retur \(wajib\)/);
  assert.match(board, /className="sticky top-0 z-10 font-bold">Retur/);
  assert.match(actions, /Alasan retur minimal 3 karakter/);
  assert.match(actions, /needsRepair = true/);
  // Badge Retur (repairReason) tidak pernah dihapus: tetap menempel walau kartu Selesai.
  assert.doesNotMatch(actions, /repairReason = null/);
  assert.doesNotMatch(actions, /repairRequestedAt = null/);
  assert.match(actions, /parsed\.data\.decision === "RELEASE_RETUR"/);
  assert.match(actions, /if \(order\.needsRepair\) needsRepair = false/);
  // Kolom Retur menampung kartu parkir; badge diambil dari repairReason,
  // warna merahnya hilang hanya saat kartu masuk Selesai.
  assert.match(board, /function isReturParked\(item: BoardItem\) \{\s+return item\.status === "ACTIVE" && item\.needsRepair;\s+\}/);
  assert.match(board, /return isReturParked\(item\) \? RETUR_COLUMN : item\.currentStage/);
  assert.match(board, /const retur = Boolean\(item\.repairReason\)/);
  assert.match(board, /const hot = retur && item\.currentStage !== "SELESAI"/);
  // Kartu Retur selalu di atas.
  assert.match(data, /orderBy: \[\{ needsRepair: "desc" \}, \{ updatedAt: "desc" \}, \{ id: "asc" \}\]/);
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

test("kanban Produksi punya tiga jalur bertingkat dengan filter kategori produk kedua", () => {
  assert.deepEqual(PRODUCTION_BOARD_GROUPS, ["JERSEY", "NON_JERSEY", "AKSESORI"]);
  assert.equal(PRODUCTION_BOARD_GROUP_LABEL.AKSESORI, "Aksesoris");
  assert.equal(parseProductionBoardGroup(undefined), "JERSEY");
  assert.equal(parseProductionBoardGroup(["AKSESORI", "JERSEY"]), "AKSESORI");
  assert.equal(parseProductionBoardGroup("bukan-jalur"), "JERSEY");
  assert.equal(stageRouteForGroup("AKSESORI"), "NON_JERSEY");
  assert.equal(stageRouteForGroup("NON_JERSEY"), "NON_JERSEY");
  assert.equal(stageRouteForGroup("JERSEY"), "JERSEY");

  // Kanban dikelompokkan per produk WO (jenis + kategori item), bukan atribut level PO,
  // agar PO multi-produk (mis. Topi + Jaket) tampil pada jalurnya masing-masing.
  assert.match(data, /purchaseOrderItem: \{ is: \{ garmentType: "AKSESORI" \} \}/);
  assert.match(data, /purchaseOrderItem: \{ is: \{ garmentType: "NON_JERSEY" \} \}/);
  assert.match(data, /purchaseOrderItem: \{ is: \{ productCategoryId \} \}/);
  assert.match(data, /purchaseOrderItem: \{ is: null \}/);
  assert.match(data, /route: group === "JERSEY" \? "JERSEY" : "NON_JERSEY"/);
  assert.match(data, /\["production-board", filter\.group, filter\.productCategoryId \?\? ""\]/);
});

test("kartu Retur berdiam di kolom Retur sampai dipindahkan, badge bertahan, merah hilang di Selesai", () => {
  assert.equal(RETUR_COLUMN, "RETUR");
  for (const group of PRODUCTION_BOARD_GROUPS) {
    const columns = boardStagesForGroup(group, []);
    assert.equal(columns[columns.length - 1], "RETUR");
  }
  // Kolom Retur adalah rumah kartu Retur; kartu tidak diduplikasi di kolom tahap.
  assert.doesNotMatch(board, /!item\.needsRepair/);
  assert.doesNotMatch(board, /key=\{`\$\{item\.id\}-retur`\}/);
  assert.match(board, /itemColumn\(item, previewMove\) === stage/);
  assert.match(board, /Work Order retur/);
  assert.match(board, /Seret kartu ke sini untuk masuk Retur/);
  assert.match(board, /event\.over\.id === RETUR_COLUMN/);
  assert.match(board, /item\.status === "ACTIVE" && item\.needsRepair/);
  assert.match(board, /Belum ada retur/);
  // Drop ke kolom Retur mengunci dialog: langsung isi alasan tanpa pilihan Perubahan.
  assert.match(board, /setReturLocked\(true\)/);
  assert.match(board, /\{returLocked \? null : \(/);
  assert.match(board, /Masuk Retur/);
  // Keluar dari Retur: seret kartu ke kolom tahap; drop ke kolomnya sendiri
  // memakai RELEASE_RETUR tanpa dialog, dan kolom Retur tak menerima drop ulang.
  assert.match(board, /decision: "RELEASE_RETUR"/);
  assert.match(board, /isReturParked\(item\) && targetStage === item\.currentStage/);
  assert.match(board, /if \(isReturParked\(item\)\) return;/);
  // Ringkasan: kartu parkir tidak dihitung ganda di kolom tahapnya.
  assert.match(summary, /item\.currentStage === stage && !parked\(item\)/);
  assert.match(summary, /RETUR_COLUMN/);
});

test("halaman Produksi menampilkan tab jalur dan chip kategori dengan pilihan pertama otomatis", () => {
  assert.match(productionPage, /aria-label="Filter jalur produksi"/);
  assert.match(productionPage, /PRODUCTION_BOARD_GROUPS\.map\(\(target\) =>/);
  assert.match(productionPage, /aria-label="Filter kategori produk"/);
  assert.match(productionPage, /categories\.some\(\(category\) => category\.id === rawKategori\)/);
  assert.match(productionPage, /categories\[0\]\?\.id \?\? null/);
  assert.match(productionPage, /key=\{`\$\{group\}:\$\{kategoriId \?\? ""\}`\}/);
  assert.match(productionPage, /stageRouteForGroup\(group\)/);
  assert.match(boardSection, /getProductionBoard\(\{ group, productCategoryId \}\)/);
  assert.match(sectionClient, /\/api\/produksi\/board\?jalur=\$\{group\}&kategori=\$\{productCategoryId \?\? ""\}/);
  assert.match(boardRoute, /parseProductionBoardGroup\(params\.get\("jalur"\) \?\? undefined\)/);
  assert.match(boardRoute, /entityIdSchema\.safeParse\(rawKategori\)/);
});

test("halaman detail kembali ke kanban pada grup dan kategori yang sama", () => {
  assert.match(productionDetail, /const boardGroup = purchaseOrder\?\.garmentType \?\? workOrder\.route/);
  assert.match(productionDetail, /`\/produksi\?jalur=\$\{boardGroup\}&kategori=\$\{purchaseOrder\.productCategoryId\}`/);
  assert.match(productionDetail, /PRODUCTION_BOARD_GROUP_LABEL\[boardGroup\]/);
  assert.match(summary, /productionStagesForGroup\(group\)/);
});

test("backfill kategori produk PO lama hanya mengisi PO yang masih kosong", () => {
  assert.match(backfillPoScript, /productCategoryId === category\.id/);
  assert.match(backfillPoScript, /sudah punya kategori lain/);
  assert.match(backfillPoScript, /WellWell dan "test" sengaja dibiarkan kosong/);
  assert.match(packageJson, /"db:backfill:po-categories": "node scripts\/backfill-purchase-order-categories\.mjs"/);
});

test("tanggal kanban diserialisasi di dalam cache sehingga cache hit tetap berupa string", () => {
  const readerStart = data.indexOf("export async function getProductionBoard");
  const cached = data.slice(data.indexOf("const getCachedBoardRows"), readerStart);
  const reader = data.slice(readerStart, data.indexOf("export async function getProductionDetail"));
  // unstable_cache menyimpan hasil sebagai JSON (Date -> string); konversi wajib ada di dalam callback.
  assert.match(cached, /deadline: row\.deadline\.toISOString\(\)/);
  assert.match(cached, /updatedAt: row\.updatedAt\.toISOString\(\)/);
  assert.match(cached, /stageEnteredAt: row\.stageEnteredAt\?\.toISOString\(\) \?\? null/);
  assert.match(cached, /obstacleUpdatedAt: row\.obstacleUpdatedAt\?\.toISOString\(\) \?\? null/);
  assert.match(cached, /activeStepId: steps\[0\]\?\.id \?\? null/);
  assert.doesNotMatch(reader, /\.toISOString\(/);
  assert.doesNotMatch(reader, /steps/);
});
