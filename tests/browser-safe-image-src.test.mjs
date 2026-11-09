import assert from "node:assert/strict";
import test from "node:test";

import { browserSafeImageSrc } from "../lib/cms/selectors.ts";

test("nama file berkode kurung menjadi path yang nginx bisa layani", () => {
  assert.equal(
    browserSafeImageSrc("/size-chart/WhatsApp%20Image%202026-10-10%20at%2010.14.12%20AM%20%283%29.webp"),
    "/size-chart/WhatsApp Image 2026-10-10 at 10.14.12 AM-3.webp",
  );
  assert.equal(browserSafeImageSrc("/assets/pdh-kemeja/KOV%20(2).webp"), "/assets/pdh-kemeja/KOV-2.webp");
  assert.equal(browserSafeImageSrc("/product/kemeja.png"), "/product/kemeja.png");
});
