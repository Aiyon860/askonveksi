import assert from "node:assert/strict";
import test from "node:test";

import { buildWhatsAppContactUrl } from "../lib/contact.ts";

test("tautan kontak menyusun pesan dan nomor tujuan WhatsApp", () => {
  const url = buildWhatsAppContactUrl(
    { name: "Rani", origin: "Semarang", message: "Saya membutuhkan 50 kemeja PDH." },
    "0812-3456-7890",
  );

  assert.equal(new URL(url).origin, "https://wa.me");
  assert.equal(new URL(url).pathname, "/6281234567890");
  assert.equal(
    new URL(url).searchParams.get("text"),
    "Halo Askonveksi,\n\nSaya Rani dari Semarang.\n\nSaya ingin konsultasi gratis untuk kebutuhan berikut:\nSaya membutuhkan 50 kemeja PDH.",
  );
});

test("tautan kontak memakai nomor resmi Askonveksi secara default", () => {
  const url = buildWhatsAppContactUrl({ name: "Dio", origin: "Kendal", message: "Konsultasi jersey." });

  assert.equal(new URL(url).pathname, "/6281912924898");
  assert.match(new URL(url).searchParams.get("text") ?? "", /Dio dari Kendal/);
});
