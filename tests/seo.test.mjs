import assert from "node:assert/strict";
import test from "node:test";

import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "../lib/site.ts";

test("metadata utama menargetkan pencarian konveksi lokal", () => {
  assert.match(SITE_TITLE, /Konveksi di Semarang/i);
  assert.match(SITE_DESCRIPTION, /Semarang/i);
  assert.match(SITE_DESCRIPTION, /Jawa Tengah/i);
  assert.ok(SITE_TITLE.length >= 50 && SITE_TITLE.length <= 60);
  assert.ok(SITE_DESCRIPTION.length >= 140 && SITE_DESCRIPTION.length <= 160);
  assert.equal(SITE_URL.origin, "https://askonveksi.web.id");
  assert.equal(SITE_URL.pathname, "/");
});
