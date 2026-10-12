import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  designImageContentType,
  designImageExtensionFor,
  designImageRejection,
  sniffImageContentType,
} from "../lib/design/image.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const PSD = new Uint8Array([0x38, 0x42, 0x50, 0x53, 0x00, 0x01]);

const [
  permissions,
  designActions,
  productionActions,
  productionData,
  designDetail,
  attachmentRoute,
  board,
  sectionClient,
  designTaskActions,
  editor,
  designEditorPage,
  nav,
] = await Promise.all([
  readFile(new URL("../lib/auth/permissions.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/design.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/production.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/production/data.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/production/design-detail.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/desain/[taskId]/attachments/[attachmentId]/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/production/production-board.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/production/production-board-section-client.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/design/design-task-actions.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/production/design-annotation-editor.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/(app)/detail-desain/[workOrderId]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/app-nav.tsx", import.meta.url), "utf8"),
]);

test("D2: desain hanya PNG/JPG/JPEG, PDF dan PSD ditolak", () => {
  assert.equal(designImageContentType("logo.png", PNG), "image/png");
  assert.equal(designImageContentType("logo.jpg", JPEG), "image/jpeg");
  assert.equal(designImageContentType("logo.jpeg", JPEG), "image/jpeg");
  // Ekstensi tidak boleh menipu isi file, dan isi tidak boleh menipu ekstensi.
  assert.equal(designImageContentType("logo.png", JPEG), null);
  assert.equal(designImageContentType("logo.jpg", PNG), null);
  assert.equal(designImageContentType("desain.pdf", PDF), null);
  assert.equal(designImageContentType("desain.psd", PSD), null);
  assert.equal(sniffImageContentType(JPEG), "image/jpeg");
  assert.equal(sniffImageContentType(PDF), null);
  assert.equal(designImageExtensionFor("image/jpeg"), "jpg");
  assert.match(designImageRejection("desain.pdf"), /PDF tidak didukung/);
  assert.match(designImageRejection("desain.psd"), /PNG, JPG, atau JPEG/);
});

test("D2: upload revisi desain memakai validasi gambar bersama", () => {
  assert.match(designActions, /designImageContentType\(file\.name, bytes\)/);
  assert.match(designActions, /designImageRejection\(file\.name\)/);
  assert.match(designActions, /designImageExtensionFor\(contentType\)/);
  assert.doesNotMatch(designActions, /photoshop|psd/i);
});

test("D2: ganti desain Produksi memakai validasi gambar bersama", () => {
  const overwrite = productionActions.slice(
    productionActions.indexOf("export async function overwriteProductionDesignAction"),
    productionActions.indexOf("export async function resetProductionDesignAction"),
  );
  assert.ok(overwrite.length > 0);
  assert.match(overwrite, /designImageContentType\(file\.name, bytes\)/);
  assert.match(overwrite, /designImageRejection\(file\.name\)/);
  assert.match(overwrite, /designImageExtensionFor\(contentType\)/);
  assert.match(overwrite, /storage\.upload\(originalPath, bytes, \{ contentType, upsert: true \}\)/);
  assert.doesNotMatch(overwrite, /photoshop|psd/i);
  // Salinan asli dan Reset memakai tipe gambar hasil deteksi, bukan selalu PNG.
  assert.match(productionActions, /sniffImageContentType\(originalBytes\) \?\? "image\/png"/);
  assert.match(productionActions, /restoredContentType = sniffImageContentType\(originalBytes\)/);
});

test("D2: pratinjau menampilkan PNG dan JPEG", () => {
  assert.match(designDetail, /DESIGN_IMAGE_CONTENT_TYPES = \["image\/png", "image\/jpeg"\]/);
  assert.match(productionData, /contentType: \{ in: \["image\/png", "image\/jpeg"\] \}/);
  assert.match(attachmentRoute, /Content-Type": sniffImageContentType\(bytes\) \?\? attachment\.contentType/);
  assert.match(designTaskActions, /accept="\.png,\.jpg,\.jpeg,image\/png,image\/jpeg"/);
  assert.match(designTaskActions, /PNG, JPG, atau JPEG/);
  assert.doesNotMatch(designTaskActions, /photoshop|PSD/);
  assert.match(editor, /accept="\.png,\.jpg,\.jpeg,image\/png,image\/jpeg"/);
});

test("G2: Admin Customer memakai daftar role khusus lihat tanpa hak ubah", () => {
  assert.match(permissions, /PRODUCTION_ROLES = \["ADMIN_PRODUCTION"\]/);
  assert.match(permissions, /PRODUCTION_VIEW_ROLES = \[\.\.\.PRODUCTION_ROLES, "ADMIN_CUSTOMER"\]/);
  assert.match(permissions, /DETAIL_DESIGN_VIEW_ROLES = \[\.\.\.DETAIL_DESIGN_ROLES, "ADMIN_CUSTOMER"\]/);
  // Bacaan memakai daftar lihat, sedangkan aksi tetap PRODUCTION_ROLES.
  assert.match(productionData, /requireActor\(PRODUCTION_VIEW_ROLES\)/);
  assert.match(designDetail, /requireActor\(DETAIL_DESIGN_VIEW_ROLES\)/);
  assert.doesNotMatch(productionActions, /requireActor\((PRODUCTION_VIEW_ROLES|DETAIL_DESIGN_VIEW_ROLES)\)/);
  assert.match(productionActions, /await requireActor\(PRODUCTION_ROLES\)/);
});

test("G2: kanban Produksi menyembunyikan aksi saat hanya lihat", () => {
  assert.match(productionData, /canManage: isStageRole\(actor\.role\)/);
  assert.match(sectionClient, /canManage=\{board\.canManage !== false\}/);
  assert.match(sectionClient, /Mode lihat saja/);
  assert.match(board, /canManage: boolean/);
  assert.match(board, /const draggable = canManage && !isMoving/);
  assert.match(board, /if \(!canManage \|\| !event\.over\) return/);
  assert.match(board, /\{canManage \? <CardAction>/);
  assert.match(board, /<ProductionObstacle item=\{item\} canManage=\{canManage\} \/>/);
  assert.match(board, /Hanya dapat dilihat oleh tim Produksi\./);
});

test("G2: detail Work Order dan detail desain hanya lihat", () => {
  assert.match(designDetail, /canManage: isStageRole\(actor\.role\)/);
  assert.match(designDetail, /return workOrder \? \{ workOrder, canManage: isStageRole\(actor\.role\) \} : null/);
  assert.match(designEditorPage, /readOnly=\{!canManage \|\| Boolean\(workOrder\.designCompletedAt\)\}/);
  assert.match(designEditorPage, /Mode lihat saja/);
  assert.match(nav, /canViewProduction = isDeveloper \|\| role === "OWNER" \|\| role === "ADMIN_PRODUCTION" \|\| role === "ADMIN_CUSTOMER"/);
});
