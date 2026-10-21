import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isHttpUrl,
  isSafeHref,
  isSafeImageSrc,
  siteContentSchemaWithRules,
} from "../lib/cms/schema.ts";

const seed = JSON.parse(await readFile(new URL("../lib/cms/seed-content.json", import.meta.url), "utf8"));

test("seed konten CMS valid dan siap dipakai", () => {
  const parsed = siteContentSchemaWithRules.safeParse(seed);
  assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues, null, 2));
  assert.equal(parsed.data.products.length > 0, true);
  assert.equal(parsed.data.home.sections.some((section) => section.visible), true);
});

test("link berbahaya ditolak, link aman diterima", () => {
  for (const href of ["https://askonveksi.web.id", "mailto:halo@askonveksi.web.id", "tel:+6281912924898", "/produk/kaos", "/#kontak", "#testimoni"]) {
    assert.equal(isSafeHref(href), true, href);
  }
  for (const href of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "//evil.example", "ftp://example.com"]) {
    assert.equal(isSafeHref(href), false, href);
  }
});

test("gambar hanya boleh path lokal dengan ekstensi gambar", () => {
  assert.equal(isSafeImageSrc("/hero.jpg"), true);
  assert.equal(isSafeImageSrc("/assets/pdh-kemeja/ARTA%20JAYA.webp"), true);
  assert.equal(isSafeImageSrc("/media/2026/10/abc.webp"), true);
  assert.equal(isSafeImageSrc("https://cdn.example.com/hero.jpg"), false);
  assert.equal(isSafeImageSrc("/uploads/script.js"), false);
  assert.equal(isSafeImageSrc("/../etc/passwd.png"), false);
});

test("URL situs wajib http(s)", () => {
  assert.equal(isHttpUrl("https://askonveksi.web.id/"), true);
  assert.equal(isHttpUrl("javascript:alert(1)"), false);
});

test("produk duplikat dan induk tidak valid ditolak", () => {
  const duplicate = structuredClone(seed);
  duplicate.products.push(structuredClone(duplicate.products[0]));
  assert.equal(siteContentSchemaWithRules.safeParse(duplicate).success, false);

  const missingParent = structuredClone(seed);
  missingParent.products[0].parentSlug = "tidak-ada";
  assert.equal(siteContentSchemaWithRules.safeParse(missingParent).success, false);

  const nested = structuredClone(seed);
  const child = nested.products.find((product) => product.parentSlug);
  const childOfChild = structuredClone(child);
  childOfChild.id = "anak-dari-anak";
  childOfChild.parentSlug = child.id;
  nested.products.push(childOfChild);
  assert.equal(siteContentSchemaWithRules.safeParse(nested).success, false);
});

test("section beranda tidak boleh kosong atau duplikat", () => {
  const empty = structuredClone(seed);
  empty.home.sections = [];
  assert.equal(siteContentSchemaWithRules.safeParse(empty).success, false);

  const duplicate = structuredClone(seed);
  duplicate.home.sections = [duplicate.home.sections[0], duplicate.home.sections[0]];
  assert.equal(siteContentSchemaWithRules.safeParse(duplicate).success, false);
});

test("nomor WhatsApp harus digit 8–15", () => {
  const invalid = structuredClone(seed);
  invalid.site.whatsapp = "+62 819-1292-4898";
  assert.equal(siteContentSchemaWithRules.safeParse(invalid).success, false);
});
