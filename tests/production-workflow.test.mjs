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

const [schema, migration, skipMigration, automationMigration, workflow, actions, crmActions, service, seed, packageJson, board, revertMigration, sectionClient, data, obstacleTimestampMigration, productionPage, boardRoute, boardSection, productionDetail, summary, backfillPoScript, qcRevertedMigration, boardFilters] = await Promise.all([
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
  readFile(new URL("../prisma/migrations/20261017000000_production_qc_reverted/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../lib/production/board-filters.ts", import.meta.url), "utf8"),
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
  // Kunci kolom dipasang urgent sebelum startTransition: update di dalam callback
  // async terbukti bisa tidak ter-commit (log: lockStage macet di save sebelumnya).
  assert.match(board, /setSavingMove\(\{ id: item\.id, stage: lockStage \}\);\s+startMoving\(async \(\) => \{/);
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

test("alasan Mundur langsung (REVERT) menimpa Text Area Kendala kartu beserta jejak waktunya", () => {
  const move = actions.slice(actions.indexOf("async function moveProduction"), actions.indexOf("export async function moveProductionOptimisticAction"));
  assert.ok(move.length > 0);
  const revertBranch = move.slice(move.indexOf('decision === "REVERT"'), move.indexOf("const nextStage"));
  // Alasan REVERT (sudah di-trim, dibatasi 2000 karakter) menggantikan isi Kendala lama;
  // timestamp ikut terisi agar sesuai constraint "obstacle tanpa tanggal" di DB.
  assert.match(revertBranch, /obstacleUpdate = reason\.slice\(0, 2000\)/);
  assert.doesNotMatch(revertBranch, /obstacleUpdate = parsed\.data\.note/);
  // Masuk Retur tetap tidak menyentuh Kendala; alasan retur tercatat sebagai repairReason.
  const toReturBranch = move.slice(move.indexOf('decision === "TO_RETUR"'), move.indexOf('decision === "REVERT"'));
  assert.doesNotMatch(toReturBranch, /obstacleUpdate/);
  // Tulis obstacle + jejak waktu hanya saat obstacleUpdate terisi; ikut tercatat di audit.
  assert.match(move, /\.\.\.\(obstacleUpdate !== undefined \? \{ obstacle: obstacleUpdate, obstacleUpdatedAt: obstacleUpdate === null \? null : now \} : \{\}\)/);
  assert.match(move, /\.\.\.\(obstacleUpdate !== undefined \? \["obstacle", "obstacleUpdatedAt"\] : \[\]\)/);
  // Client optimistik: Text Area Kendala langsung berubah tanpa menunggu refresh SWR.
  assert.match(board, /obstacle: move\.decision === "REVERT" \? note\?\.trim\(\)\.slice\(0, 2000\) \?\? null : undefined/);
  assert.match(board, /obstacleUpdatedAt: move\.decision === "REVERT" \? new Date\(\)\.toISOString\(\) : undefined/);
  assert.match(board, /alasan disimpan ke Kendala/);
});

test("kartu membawa pil Retur atau Wajib QC selalu di posisi paling atas kolom tahap; kolom Retur tetap terbaru di atas", () => {
  // Retur hanya "merah" (naik ke atas) sampai Selesai; Wajib QC selalu selama menempel.
  assert.match(board, /function isHighlightedCard\(item: BoardItem\) \{\s+return Boolean\(item\.qcReverted\) \|\| \(Boolean\(item\.repairReason\) && item\.currentStage !== "SELESAI"\);\s+\}/);
  // Sort stabil di kolom tahap: kartu merah di atas, urutan asli dijaga di dalam kelompoknya.
  assert.match(board, /if \(!isReturColumn\) stageItems\.sort\(\(a, b\) => Number\(isHighlightedCard\(b\)\) - Number\(isHighlightedCard\(a\)\)\);/);
  // Kolom Retur tidak di-sort ulang: semua kartunya memegang pil Retur, terbaru di atas.
  assert.doesNotMatch(board, /if \(isReturColumn\) stageItems\.sort/);
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
  assert.match(data, /obstacleUpdatedAt: true,\n\s+qcReverted: true,\n\s+stageEnteredAt: true/);
  assert.match(data, /stageEnteredAt: row\.stageEnteredAt\?\.toISOString\(\) \?\? null/);
  assert.match(data, /obstacleUpdatedAt: row\.obstacleUpdatedAt\?\.toISOString\(\) \?\? null/);
});

test("transaksi perpindahan tahap memakai anggaran waktu yang lebih longgar", () => {
  assert.match(actions, /const MOVE_TRANSACTION_OPTIONS = \{/);
  assert.match(actions, /maxWait: 10_000/);
  assert.match(actions, /timeout: 20_000/);
  assert.doesNotMatch(actions, /\}, \{ isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable \}\);/);
});

test("mundur langsung dengan alasan wajib tanpa parkir Retur; badge Retur menempel permanen", () => {
  const retur = { workOrderId: "DEMO-WO-NON-JERSEY", version: 2, targetStage: "SABLON", decision: "TO_RETUR", note: "Sablon belum rata" };
  assert.equal(moveProductionSchema.safeParse(retur).success, true);
  assert.equal(moveProductionSchema.safeParse({ ...retur, decision: "REVERT" }).success, true);
  assert.equal(moveProductionSchema.safeParse({ ...retur, decision: "QC_REJECT" }).success, false);
  // Keluar dari kolom Retur memakai keputusan sendiri dan selalu ke tahap kartu saat ini.
  assert.equal(moveProductionSchema.safeParse({ workOrderId: retur.workOrderId, version: 2, targetStage: "SABLON", decision: "RELEASE_RETUR" }).success, true);
  assert.match(board, /decision: "TO_RETUR" as const/);
  assert.doesNotMatch(board, /"QC_REJECT" as const/);
  // Seret mundur diubah jadi REVERT: isi alasan lalu pindah ke tujuan tanpa parkir.
  assert.match(board, /decision: "REVERT"/);
  assert.doesNotMatch(board, /name="moveOption"/);
  assert.doesNotMatch(board, /Perubahan<\/FieldLabel>/);
  assert.match(board, /Mundur ke \$\{stageLabelForGroup\(move\.targetStage, group\)\}/);
  assert.match(board, /Alasan \(wajib\)/);
  assert.match(board, /className="sticky top-0 z-10 font-bold">Retur/);
  assert.match(actions, /Alasan retur minimal 3 karakter/);
  assert.match(actions, /Alasan mundur minimal 3 karakter/);
  assert.match(actions, /parsed\.data\.decision === "REVERT"/);
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

test("peringatan Wajib QC menempel saat kartu ditarik mundur dari QC dan dilepas saat kartu masuk QC lagi", () => {
  const move = actions.slice(actions.indexOf("async function moveProduction"), actions.indexOf("export async function moveProductionOptimisticAction"));
  assert.ok(move.length > 0);
  // Kolom flag berdiri sendiri dari Retur (default false, tanpa backfill).
  assert.match(schema, /qcReverted\s+Boolean\s+@default\(false\)/);
  assert.match(qcRevertedMigration, /ADD COLUMN "qcReverted" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(move, /qcReverted: true,\n\s+stageSequence: true/);
  // Set: hanya REVERT dari posisi di QC ke tahap sebelumnya yang menempelkan peringatan.
  assert.match(move, /if \(order\.currentStage === "QC" && qcIndex >= 0 && targetIndex < qcIndex\) qcRevertedUpdate = true/);
  const toReturBranch = move.slice(move.indexOf('decision === "TO_RETUR"'), move.indexOf('decision === "REVERT"'));
  assert.doesNotMatch(toReturBranch, /qcReverted/);
  const reopenBranch = move.slice(move.indexOf("if (order.status === \"COMPLETED\")"), move.indexOf("const currentStep"));
  assert.doesNotMatch(reopenBranch, /qcReverted/);
  // Clear: mendarat di QC (keputusan apa pun) selalu melepas peringatan.
  assert.match(move, /let qcRevertedUpdate: boolean \| undefined = parsed\.data\.targetStage === "QC" \? false : undefined/);
  // Gate server: tujuan mendarat setelah QC ditolak selama peringatan menempel.
  assert.match(move, /order\.qcReverted && qcIndex >= 0 && targetIndex > qcIndex/);
  assert.match(move, /harus melewati QC terlebih dahulu untuk melepas peringatan Wajib QC/);
  // Perubahan flag ikut tercatat di audit; hanya ditulis bila berubah.
  assert.match(move, /\.\.\.\(qcRevertedUpdate !== undefined \? \{ qcReverted: qcRevertedUpdate \} : \{\}\)/);
  assert.match(move, /\.\.\.\(qcRevertedUpdate !== undefined \? \["qcReverted"\] : \[\]\)/);
  // Client: papan menyaring tujuan melewati QC, optimistik, dan menampilkan kartu merah + badge.
  assert.match(board, /item\.qcReverted && qcIndex >= 0/);
  assert.match(board, /option\.targetStage\) <= qcIndex/);
  assert.match(board, /qcReverted: move\.targetStage === "QC" \? false : move\.decision === "REVERT" && item\.currentStage === "QC" \? true : undefined/);
  assert.match(board, /qcWarn = Boolean\(item\.qcReverted\)/);
  assert.match(board, /\(hot \|\| qcWarn\) && "border-destructive\/70 bg-destructive\/10"/);
  assert.match(board, />Wajib QC<\/Badge>/);
  // Data board & halaman detail ikut membawa flag.
  assert.match(data, /qcReverted: true,\n\s+stageEnteredAt: true/);
  assert.match(productionDetail, /qcWarning/);
  assert.match(productionDetail, />Wajib QC</);
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
  // Aturan where tinggal di lib/production/board-filters.ts agar halaman, API, dan
  // export memakai sumber yang sama.
  assert.match(boardFilters, /purchaseOrderItem: \{ is: \{ garmentType: "AKSESORI" \} \}/);
  assert.match(boardFilters, /purchaseOrderItem: \{ is: \{ garmentType: "NON_JERSEY" \} \}/);
  assert.match(boardFilters, /purchaseOrderItem: \{ is: \{ productCategoryId \} \}/);
  assert.match(boardFilters, /purchaseOrderItem: \{ is: null \}/);
  assert.match(boardFilters, /route: group === "JERSEY" \? "JERSEY" : "NON_JERSEY"/);
  assert.match(data, /productionBoardCacheKey\(filter\)/);
  assert.match(boardFilters, /"production-board",/);
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
  assert.match(board, /itemColumn\(item, previewMove, activeSavingMove\) === stage/);
  // Kunci kolom hanya dilepas saat data yang masuk sudah mencerminkan hasil save
  // (kebal dari data basi: polling atau revalidasi ter-dedupe di tengah save).
  assert.match(board, /const activeSavingMove = savingSettled \? null : savingMove;/);
  assert.match(board, /Work Order retur/);
  assert.match(board, /Seret kartu ke sini untuk masuk Retur/);
  assert.match(board, /event\.over\.id === RETUR_COLUMN/);
  assert.match(board, /item\.status === "ACTIVE" && item\.needsRepair/);
  assert.match(board, /Belum ada retur/);
  // Drop ke kolom Retur: dialog langsung isi alasan (tanpa pilihan Perubahan).
  assert.doesNotMatch(board, /returLocked/);
  assert.doesNotMatch(board, /moveOption/);
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
  assert.match(boardSection, /getProductionBoard\(\{ group, productCategoryId, filters \}\)/);
  assert.match(boardSection, /filters=\{filters\}/);
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

test("Jersey: kartu ber-badge Retur/Wajib QC boleh melewati tahap; kartu biasa tetap satu-ke-satu", () => {
  // Server: hak lompat Jersey = badge Retur permanen (repairReason) atau Wajib QC (qcReverted).
  assert.match(actions, /const badgeSkip = order\.route === "JERSEY" && \(order\.qcReverted \|\| Boolean\(order\.repairReason\)\)/);
  assert.match(actions, /order\.route !== "NON_JERSEY" && !badgeSkip/);
  assert.match(actions, /needsRepair: true,\s+repairReason: true,\s+qcReverted: true,/);
  // Gerbang QC tidak disentuh: kartu Wajib QC tetap maksimal mendarat di kolom QC.
  assert.match(actions, /if \(order\.qcReverted && qcIndex >= 0 && targetIndex > qcIndex\)/);
  // Kartu Jersey tanpa badge masih terkunci maju satu tahap; lompat wajib minimal 2 langkah.
  assert.match(actions, /nextStage !== parsed\.data\.targetStage/);
  assert.match(actions, /if \(targetIndex <= currentIndex \+ 1\) throw new UserFacingError\("Lewati tahap harus menuju setelah tahap berikutnya\."\)/);
  // Client: opsi SKIP muncul untuk kartu ber-badge; filter gerbang QC tetap langkah terakhir.
  assert.match(board, /const canSkip = item\.route === "NON_JERSEY" \|\| Boolean\(item\.qcReverted\) \|\| Boolean\(item\.repairReason\)/);
  assert.match(board, /return options\.filter\(\(option\) => item\.stageSequence\.indexOf\(option\.targetStage\) <= qcIndex\)/);
  // Jejak lompatan identik pola SKIP Non-Jersey: antara SKIPPED, aktivitas STAGE_SKIPPED, obstacle dihapus.
  assert.match(actions, /activityType = "STAGE_SKIPPED"/);
  assert.match(actions, /data: \{ status: "SKIPPED", startedAt: null, completedAt: now \}/);
  // Satu drag maju (termasuk keluar parkir Retur) dieksekusi langsung tanpa dialog.
  assert.match(board, /option\.decision === "ADVANCE" \|\| option\.decision === "SKIP"/);
});
