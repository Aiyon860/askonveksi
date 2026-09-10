import assert from "node:assert/strict";
import test from "node:test";

import { designStatus } from "../lib/design/status.ts";

test("status desain membedakan belum diunggah, terlambat, dan versi yang sudah tersedia", () => {
  const today = new Date("2026-09-10T08:00:00.000Z");
  assert.equal(designStatus(new Date("2026-09-09T00:00:00.000Z"), 0, today), "TERLAMBAT");
  assert.equal(designStatus(new Date("2026-09-10T00:00:00.000Z"), 0, today), "BELUM_DIUPLOAD");
  assert.equal(designStatus(new Date("2026-09-01T00:00:00.000Z"), 1, today), "SUDAH_DIUPLOAD");
});
