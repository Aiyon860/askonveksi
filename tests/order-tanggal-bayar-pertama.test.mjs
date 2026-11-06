import assert from "node:assert/strict";
import test from "node:test";

import { clusterOrderMasukDates } from "../scripts/order-tanggal-bayar-pertama.mjs";

test("Kak Angga multi-baris ikut DP 21 September karena berbagi tanggal pelunasan", () => {
  const map = clusterOrderMasukDates([
    {
      id: "besar",
      name: "Kak Angga Arsa MESS",
      firstPayDay: "2026-09-21",
      payDays: ["2026-09-21", "2026-09-25", "2026-10-01"],
    },
    { id: "kecil1", name: "Kak Angga Arsa MESS", firstPayDay: "2026-10-01", payDays: ["2026-10-01"] },
    { id: "kecil2", name: "Kak Angga Arsa MESS", firstPayDay: "2026-10-01", payDays: ["2026-10-01"] },
  ]);
  assert.equal(map.get("besar"), "2026-09-21");
  assert.equal(map.get("kecil1"), "2026-09-21");
  assert.equal(map.get("kecil2"), "2026-09-21");
});

test("order nama sama tanpa berbagi tanggal bayar tetap sendiri", () => {
  const map = clusterOrderMasukDates([
    { id: "a", name: "ORADO", firstPayDay: "2026-08-05", payDays: ["2026-08-05"] },
    { id: "b", name: "ORADO", firstPayDay: "2026-08-20", payDays: ["2026-08-20"] },
  ]);
  assert.equal(map.get("a"), "2026-08-05");
  assert.equal(map.get("b"), "2026-08-20");
});

test("order nama sama beda bulan jauh tidak digabung", () => {
  const map = clusterOrderMasukDates([
    { id: "a", name: "Dr Okty", firstPayDay: "2025-11-20", payDays: ["2025-11-20"] },
    { id: "b", name: "Dr Okty", firstPayDay: "2026-01-21", payDays: ["2026-01-21"] },
  ]);
  assert.equal(map.get("a"), "2025-11-20");
  assert.equal(map.get("b"), "2026-01-21");
});
