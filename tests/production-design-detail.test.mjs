import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { designAnnotationsSchema } from "../lib/production/design-annotations.ts";

const [schema, migration, board, detail, designList, productionDetailPage, actions, pdfRoute, pdf, nav, editor, designEditorPage] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(new URL("../prisma/migrations/20260924010000_production_design_detail/migration.sql", import.meta.url), "utf8"),
  readFile(new URL("../lib/production/data.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/production/design-detail.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(app)/detail-desain/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/(app)/produksi/[id]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/actions/production.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/crm/purchase-order/[id]/pdf/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/crm/purchase-order-pdf.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/app-nav.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/production/design-annotation-editor.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/(app)/detail-desain/[workOrderId]/page.tsx", import.meta.url), "utf8"),
]);

test("WO menunggu anotasi produksi sebelum masuk kanban", () => {
  assert.match(schema, /designCompletedAt\s+DateTime\?/);
  assert.match(migration, /ADD COLUMN "designCompletedAt"/);
  assert.match(board, /designCompletedAt: \{ not: null \}/);
  assert.match(detail, /status: \{ not: "CANCELLED" \}/);
});

test("anotasi menyimpan versi sebelum WO dibuka untuk Produksi", () => {
  assert.match(actions, /upsert: true/);
  assert.match(actions, /contentType: "image\/png"/);
  assert.match(actions, /originalPath/);
  assert.match(actions, /\.exists\(originalPath\)/);
  assert.match(actions, /\[400, 404\]\.includes\(snapshot\.error\.status/);
  assert.match(actions, /upsert: false/);
  assert.match(actions, /designAnnotationsSchema/);
  assert.match(actions, /PRODUCTION_DESIGN_VERSION_SAVED/);
  assert.match(actions, /export async function resetProductionDesignAction/);
  assert.match(actions, /PRODUCTION_DESIGN_RESET/);
  assert.match(actions, /annotations: Prisma\.JsonNull/);
  assert.match(actions, /export async function sendProductionDesignAction/);
  assert.match(actions, /designCompletedAt: new Date\(\)/);
  assert.match(actions, /PRODUCTION_DESIGN_SENT/);
  assert.match(actions, /Desain sudah masuk Produksi dan tidak dapat diubah/);
  assert.match(actions, /\.remove\(\[attachment\.originalPath\]\)/);
  assert.match(actions, /originalPath: null/);
});

test("Detail Desain dan PDF memakai gambar desain yang disetujui", () => {
  assert.match(nav, /href: "\/detail-desain"/);
  assert.match(designList, /rounded-lg border bg-card/);
  assert.match(designList, /border-b p-4/);
  assert.match(designList, /DebouncedSearchInput/);
  assert.match(designList, /DataPagination/);
  assert.match(designList, /SortableTableHead/);
  assert.match(designList, /Pencil data-icon="inline-start"/);
  assert.match(detail, /skip: \(page - 1\) \* pageSize/);
  assert.match(productionDetailPage, /PaymentProofPreview/);
  assert.match(productionDetailPage, /Desain final/);
  assert.match(productionDetailPage, /hoverLabel="Lihat detail desain"/);
  assert.match(pdfRoute, /designTask: \{ select:/);
  assert.match(pdfRoute, /designAttachments/);
  assert.ok(pdf.indexOf("POLA:") < pdf.indexOf("const visibleAssets"));
  assert.ok(pdf.indexOf("const visibleAssets") < pdf.indexOf("const sizeNames"));
});

test("editor anotasi mendukung zoom dan edit langsung pada kanvas", () => {
  assert.match(editor, /const MIN_ZOOM = 25/);
  assert.match(editor, /const MAX_ZOOM = 200/);
  assert.match(editor, /pixelRatio: 1 \/ scale/);
  assert.match(editor, /const editorId = editor\?\.id/);
  assert.match(editor, /resetProductionDesignAction/);
  assert.match(editor, /Mereset\.\.\./);
  assert.match(editor, /readOnly = false/);
  assert.match(editor, /Gambar desain final/);
  assert.match(editor, /const \[isSavingVersion, startSavingVersion\] = useTransition\(\)/);
  assert.match(editor, /const \[isResetting, startResetting\] = useTransition\(\)/);
  assert.match(editor, /const pointerButton = useRef<number \| null>\(null\)/);
  assert.match(editor, /event\.evt\.button !== 0 \|\| pointerButton\.current !== 0/);
  assert.match(editor, /if \(selectedId === note\.id\) editNote\(note\); else selectNote\(note\)/);
  assert.match(editor, /if \(selectedId\) \{ setSelectedId\(null\); return; \}/);
  assert.match(editor, /event\.target\.closest\("\[data-annotation-stage\]"\)/);
  assert.match(editor, /<Rect ref=\{selectionOutline\} visible=\{false\} listening=\{false\} stroke=\{SELECTION_COLOR\}/);
  assert.match(editor, /\(child as Konva\.Text\)\.getTextWidth\(\)/);
  assert.match(editor, /outline\?\.hide\(\)/);
  assert.match(editor, /event\.key === "Delete" \|\| event\.key === "Backspace"/);
  assert.match(editor, /onContextMenu=/);
  assert.match(editor, /function openContextMenu/);
  assert.doesNotMatch(editor, /disabled=\{isBusy \|\| !selectedId\}/);
  assert.doesNotMatch(editor, /PRIMARY_ACTION_DELAY|schedulePrimaryAction/);
  assert.match(editor, /Hapus keterangan/);
});

test("anotasi teks bisa dibuat berdiri sendiri tanpa panah", () => {
  const text = { id: "note-1", type: "text", textX: 10, textY: 20, text: "perbesar logo", fontSize: 22 };
  const parsed = designAnnotationsSchema.safeParse([text]);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data[0].type, "text");
  assert.equal(designAnnotationsSchema.safeParse([{ ...text, text: "" }]).success, true);
  assert.equal(designAnnotationsSchema.safeParse([{ ...text, type: "line" }]).success, false);
  assert.equal(designAnnotationsSchema.safeParse([{ ...text, fontSize: 200 }]).success, false);

  assert.match(editor, /function addTextNote\(\)/);
  assert.match(editor, /const note: DesignText = \{/);
  assert.match(editor, /<Type data-icon="inline-start" \/>Tambah teks/);
  assert.match(editor, /note\.type === "text" \? \(/);
  // Teks kosong dibuang agar tidak menyisakan anotasi tak terlihat di kanvas.
  assert.match(editor, /if \(!text && original\.type === "text"\) \{/);
  assert.match(editor, /pending\?\.type === "text" && !pending\.text/);
});

test("editor anotasi membuat panah hanya lewat klik-tahan-dan-tarik", () => {
  assert.match(editor, /const MIN_ARROW_LENGTH = 12/);
  assert.match(editor, /if \(Math\.hypot\(x2 - x1, y2 - y1\) < MIN_ARROW_LENGTH\) return/);
  assert.doesNotMatch(editor, /clickLineLength/);
  assert.match(editor, /onMouseUp=\{readOnly \? undefined : finishDrawing\}/);
  assert.match(editor, /onMouseLeave=\{readOnly \? undefined : finishDrawing\}/);
  assert.match(editor, /onDblClick=\{readOnly \? undefined : \(event\) => \{ event\.cancelBubble = true; editNote\(note\); \}\}/);
  // Teks anotasi dapat dipisahkan dari panah: node teks bisa diseret sendiri.
  assert.match(editor, /beginDrag\(note\.id, "text", note\.textX, note\.textY\)/);
  assert.match(editor, /if \(current\.kind === "text"\) return \{ \.\.\.note, textX: x, textY: y \}/);
});

test("mengganti desain menulis ulang salinan aslinya dan memuat ulang pratinjau", () => {
  const overwrite = actions.slice(
    actions.indexOf("export async function overwriteProductionDesignAction"),
    actions.indexOf("export async function resetProductionDesignAction"),
  );
  assert.ok(overwrite.length > 0);

  // Byte desain pengganti harus sampai ke originalPath. Kanvas anotasi mode edit dan
  // "Reset perubahan" sama-sama membaca originalPath, sehingga hanya memperbarui path
  // dan originalName membuat nama file berganti tetapi gambar yang tampil tetap lama.
  assert.match(overwrite, /storage\.upload\(originalPath, bytes, \{ contentType, upsert: true \}\)/);
  // Salinan desain lama sengaja tidak dipertahankan karena desainnya memang diganti.
  assert.doesNotMatch(overwrite, /storage\.download\(attachment\.path\)/);
  assert.match(overwrite, /annotations: Prisma\.JsonNull/);
  assert.match(overwrite, /originalName: file\.name\.slice\(0, 255\)/);

  // Redirect tidak me-mount ulang editor, jadi URL gambar memakai token yang
  // diturunkan dari path penyimpanan: path baru setiap desain diganti, sehingga
  // gambar pasti dimuat ulang tanpa bergantung pada status transisi React.
  assert.match(detail, /path: true/);
  assert.match(designEditorPage, /designImageToken\(attachment\.path\)/);
  assert.match(editor, /imageToken: string/);
  assert.match(editor, /&v=\$\{encodeURIComponent\(imageToken\)\}/);
  assert.doesNotMatch(editor, /wasUploading|imageVersion/);
  // Anotasi lama menyesuaikan gambar sebelumnya, jadi ikut disinkronkan dari server.
  assert.match(editor, /JSON\.stringify\(next\) === JSON\.stringify\(previous\)/);
  assert.match(editor, /notesRef\.current = next/);
});
