import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);

test("tabel Project membekukan Tanggal, Customer, Nama order, dan Jenis order", async () => {
  const page = await readFile(new URL("app/(app)/keuangan/pemasukan/page.tsx", root), "utf8");

  // Empat kolom identitas memakai lebar berbasis CSS variable agar offset sticky
  // selalu sama dengan lebar kolom di depannya.
  assert.match(page, /"var\(--project-date\)",\s+\/\/ Tanggal/);
  assert.match(page, /"var\(--project-customer\)",\s+\/\/ Customer/);
  assert.match(page, /"var\(--project-order\)",\s+\/\/ Nama order/);
  assert.match(page, /"var\(--project-type\)",\s+\/\/ Jenis order/);

  // Offset berurutan: 0, tanggal, tanggal+customer, tanggal+customer+order.
  assert.match(page, /const PROJECT_STICKY_LEFT = \[\s*"0px",\s*"var\(--project-date\)",\s*"calc\(var\(--project-date\) \+ var\(--project-customer\)\)",\s*"calc\(var\(--project-date\) \+ var\(--project-customer\) \+ var\(--project-order\)\)",/);

  // Header dan sel beku harus punya latar solid supaya isi yang bergeser tidak tembus.
  assert.match(page, /const PROJECT_STICKY_HEAD = \[\s*"sticky left-0 z-20 bg-muted"/);
  assert.match(page, /const PROJECT_STICKY_CELL = \[\s*"sticky left-0 z-10 bg-card shadow-\[inset_0_-1px_0_var\(--border\)\] group-hover\/row:bg-highlight-surface"/);

  // Lebar tabel = 163rem kolom biasa + empat kolom beku; bukan min-w tetap lagi.
  assert.match(page, /const PROJECT_TABLE_WIDTH = "calc\(163rem \+ var\(--project-date\) \+ var\(--project-customer\) \+ var\(--project-order\) \+ var\(--project-type\)\)"/);
  assert.match(page, /style=\{\{ width: PROJECT_TABLE_WIDTH \}\}/);
  assert.doesNotMatch(page, /min-w-\[197rem\]/);

  // Header, isi, dan footer tetap sejajar karena memakai kolom yang sama.
  assert.match(page, /<TableHead className=\{PROJECT_STICKY_HEAD\[0\]\} style=\{\{ left: PROJECT_STICKY_LEFT\[0\] \}\}>Tanggal<\/TableHead>/);
  assert.match(page, /<TableHead className=\{PROJECT_STICKY_HEAD\[3\]\} style=\{\{ left: PROJECT_STICKY_LEFT\[3\] \}\}>Jenis order<\/TableHead>/);
  assert.match(page, /<TableCell rowSpan=\{dateGroup\.rowCount\} className=\{`\$\{PROJECT_STICKY_CELL\[0\]\}/);
  assert.match(page, /<TableCell rowSpan=\{customerGroup\.rowCount\} className=\{`\$\{PROJECT_STICKY_CELL\[1\]\}/);
  assert.match(page, /<TableCell rowSpan=\{orderGroup\.rowCount\} className=\{`\$\{PROJECT_STICKY_CELL\[2\]\}/);
  assert.match(page, /<TableCell className=\{`\$\{PROJECT_STICKY_CELL\[3\]\}/);
  assert.match(page, /className="group\/row"/);
});

test("di HP hanya Tanggal + Customer yang beku, di layar lebar keempatnya", async () => {
  const page = await readFile(new URL("app/(app)/keuangan/pemasukan/page.tsx", root), "utf8");

  // Lebar ringkas untuk layar kecil; kolom 3 dan 4 baru ikut beku mulai `lg`.
  assert.match(page, /\[--project-date:5\.5rem\] \[--project-customer:6\.5rem\]/);
  assert.match(page, /xl:\[--project-date:7rem\] xl:\[--project-customer:8rem\] xl:\[--project-order:10rem\] xl:\[--project-type:8\.5rem\]/);
  assert.match(page, /"lg:sticky lg:z-20 lg:bg-muted"/);
  assert.match(page, /"lg:sticky lg:z-10 lg:bg-card lg:shadow-\[inset_0_-1px_0_var\(--border\)\] lg:group-hover\/row:bg-highlight-surface"/);

  // Garis batas beku pindah dari Customer (mobile) ke Jenis order (desktop).
  // Garis antar-baris tetap digambar di sel beku pada semua ukuran layar.
  assert.match(page, /shadow-\[inset_-1px_0_0_var\(--border\),inset_0_-1px_0_var\(--border\)\] group-hover\/row:bg-highlight-surface lg:shadow-\[inset_0_-1px_0_var\(--border\)\]/);
  assert.match(page, /lg:shadow-\[inset_-1px_0_0_var\(--border\),inset_0_-1px_0_var\(--border\)\] lg:group-hover\/row:bg-highlight-surface/);
});

test("kolom Jenis busana berganti nama menjadi Jenis order di tabel dan export", async () => {
  const [page, finance, crm, orders] = await Promise.all([
    readFile(new URL("app/(app)/keuangan/pemasukan/page.tsx", root), "utf8"),
    readFile(new URL("lib/export/datasets/finance.ts", root), "utf8"),
    readFile(new URL("lib/export/datasets/crm.ts", root), "utf8"),
    readFile(new URL("lib/export/datasets/orders.ts", root), "utf8"),
  ]);

  for (const source of [page, finance, crm, orders]) {
    assert.match(source, /Jenis order/);
    assert.doesNotMatch(source, /Jenis busana/);
  }

  // Urutan kolom export Project tidak berubah, hanya judulnya.
  assert.ok(
    finance.indexOf('{ header: "Nama order"') < finance.indexOf('{ header: "Jenis order"') &&
      finance.indexOf('{ header: "Jenis order"') < finance.indexOf('{ header: "Total QTY"'),
    "export Project: Nama order, Jenis order, Total QTY berurutan",
  );
});
