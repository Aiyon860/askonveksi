import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("kolom Tanggal Project ikut acceptedAt (DP pertama), bukan pelunasan transaksi", () => {
  const groups = readFileSync(new URL("../lib/finance/project-groups.ts", import.meta.url), "utf8");
  const expense = readFileSync(new URL("../lib/finance/expense.ts", import.meta.url), "utf8");
  assert.match(groups, /function projectDateKey/);
  assert.match(groups, /item\.acceptedAt/);
  assert.match(groups, /paidAt: item\.acceptedAt \|\| item\.paidAt/);
  assert.match(expense, /Filter tanggal Project ikut acceptedAt/);
  assert.match(expense, /acceptedAt: \{ gte: state\.from, lt: state\.to \}/);
  assert.doesNotMatch(
    expense.slice(expense.indexOf("function incomeWhere"), expense.indexOf("function mapIncome")),
    /paidAt: \{ gte: state\.from/,
  );
});
