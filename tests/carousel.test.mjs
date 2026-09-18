import assert from "node:assert/strict";
import test from "node:test";

import { getShortestCarouselDelta, wrapCarouselIndex } from "../lib/carousel.ts";

test("indeks carousel berputar di kedua arah", () => {
  assert.equal(wrapCarouselIndex(4, 4), 0);
  assert.equal(wrapCarouselIndex(-1, 4), 3);
});

test("pilihan titik memakai arah putar terpendek", () => {
  assert.equal(getShortestCarouselDelta(0, 3, 4), -1);
  assert.equal(getShortestCarouselDelta(3, 0, 4), 1);
});
