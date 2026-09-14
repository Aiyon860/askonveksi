import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("finance keeps the requested expense methods and ownership guards", async () => {
  const [schema, actions, income] = await Promise.all([
    readFile(new URL("prisma/schema.prisma", root), "utf8"),
    readFile(new URL("app/actions/finance.ts", root), "utf8"),
    readFile(new URL("app/(app)/keuangan/pemasukan/page.tsx", root), "utf8"),
  ]);
  for (const method of ["QRIS", "TUNAI", "BANK_A", "BANK_B", "PRIBADI"]) assert.match(schema, new RegExp(`\\b${method}\\b`));
  assert.match(actions, /current\.createdById !== actor\.id/);
  assert.match(actions, /current\.paymentMethod !== "PRIBADI"/);
  for (const column of ["Total HPP", "Keuntungan", "Laba Bersih", "Margin", "DP", "Lunas"]) assert.match(income, new RegExp(column));
});
