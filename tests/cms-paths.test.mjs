import assert from "node:assert/strict";
import test from "node:test";

import { arrayAtPath, getAtPath, moveAtPath, pushAtPath, removeAtPath, setAtPath } from "../lib/cms/paths.ts";

const sample = {
  home: { sections: [{ id: "hero", visible: true }, { id: "cta", visible: true }] },
  products: [{ name: "Kemeja" }],
};

test("membaca nilai bersarang termasuk indeks array", () => {
  assert.equal(getAtPath(sample, "home.sections.1.id"), "cta");
  assert.deepEqual(arrayAtPath(sample, "home.sections").length, 2);
  assert.equal(getAtPath(sample, "tidak.ada"), undefined);
});

test("setAtPath tidak mengubah objek asli", () => {
  const next = setAtPath(sample, "home.sections.0.visible", false);
  assert.equal(sample.home.sections[0].visible, true);
  assert.equal(next.home.sections[0].visible, false);
  assert.equal(next.home.sections[1].visible, true);
});

test("tambah, hapus, dan geser item array", () => {
  const added = pushAtPath(sample, "home.sections", { id: "why", visible: true });
  assert.equal(added.home.sections.length, 3);

  const removed = removeAtPath(added, "home.sections", 1);
  assert.deepEqual(removed.home.sections.map((item) => item.id), ["hero", "why"]);

  const moved = moveAtPath(sample, "home.sections", 0, 1);
  assert.deepEqual(moved.home.sections.map((item) => item.id), ["cta", "hero"]);

  const unchanged = moveAtPath(sample, "home.sections", 0, -1);
  assert.deepEqual(unchanged.home.sections.map((item) => item.id), ["hero", "cta"]);
});
