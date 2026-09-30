import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { caretForDigits, countDigits, formatRupiahInput, parseRupiahInput, removeDigitAt } from "../lib/money-input-format.ts";

const root = new URL("..", import.meta.url);

test("input rupiah diformat ribuan id-ID saat mengetik", () => {
  assert.equal(formatRupiahInput("1000"), "1.000");
  assert.equal(formatRupiahInput("10000"), "10.000");
  assert.equal(formatRupiahInput("100000"), "100.000");
  assert.equal(formatRupiahInput("1000000"), "1.000.000");
  assert.equal(formatRupiahInput("123"), "123");
  assert.equal(formatRupiahInput("0"), "0");
  assert.equal(formatRupiahInput(""), "");
  assert.equal(formatRupiahInput("1234567890123456"), "1.234.567.890.123.456");
  // Idempoten: hasil format bisa diformat ulang tanpa berubah.
  assert.equal(formatRupiahInput(formatRupiahInput("2500000")), "2.500.000");
});

test("parse mengambil digit mentah, membuang leading zero, dan membatasi 16 digit", () => {
  assert.equal(parseRupiahInput("Rp 1.000.000"), "1000000");
  assert.equal(parseRupiahInput("1,000,000"), "1000000");
  assert.equal(parseRupiahInput("abc"), "");
  assert.equal(parseRupiahInput("007000"), "7000");
  assert.equal(parseRupiahInput("000"), "0");
  assert.equal(parseRupiahInput("12345678901234567890"), "1234567890123456");
  // Nilai mentah tidak boleh terbaca sebagai 1 oleh z.coerce.number() saat server menerima "1.000".
  assert.equal(parseRupiahInput(formatRupiahInput("1000")), "1000");
});

test("caret tetap di posisi digit yang sama dan backspace pemisah menghapus satu digit", () => {
  assert.equal(countDigits("1.000"), 4);
  assert.equal(caretForDigits("1.000", 1), 1);
  assert.equal(caretForDigits("1.000", 4), 5);
  assert.equal(caretForDigits("12.456", 2), 2);
  assert.equal(caretForDigits("123", 0), 0);
  assert.equal(caretForDigits("1.000", 99), 5);
  assert.equal(removeDigitAt("1000", 0), "0");
  assert.equal(removeDigitAt("12456", 2), "1256");
  assert.equal(removeDigitAt("10", -1), "10");
  assert.equal(removeDigitAt("10", 5), "10");
});

test("MoneyInput menampilkan angka berformat dengan nilai mentah terpisah", async () => {
  const source = await readFile(new URL("components/money-input.tsx", root), "utf8");
  assert.match(source, /type="text"/);
  assert.match(source, /inputMode="numeric"/);
  assert.match(source, /type="hidden"[\s\S]*name=\{name\}[\s\S]*value=\{raw\}/);
  assert.match(source, /setSelectionRange/);
  assert.match(source, /setCustomValidity/);
  assert.doesNotMatch(source, /type="number"/);
});
