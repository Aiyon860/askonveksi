import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeCmsContent, sanitizeRichText } from "../lib/cms/sanitize.ts";

test("format WYSIWYG yang diizinkan dipertahankan", () => {
  const html = sanitizeRichText(
    "<p><strong>Seragam</strong> <em>custom</em> <u>rapi</u></p><ul><li>Satu</li></ul><ol><li>Dua</li></ol>",
  );
  assert.match(html, /<strong>Seragam<\/strong>/);
  assert.match(html, /<em>custom<\/em>/);
  assert.match(html, /<u>rapi<\/u>/);
  assert.match(html, /<ul><li>Satu<\/li><\/ul>/);
  assert.match(html, /<ol><li>Dua<\/li><\/ol>/);
});

test("script, style, dan event handler dibuang", () => {
  const html = sanitizeRichText(
    '<p onclick="alert(1)">Halo</p><script>alert(1)</script><img src=x onerror="alert(1)"><style>body{display:none}</style>',
  );
  assert.doesNotMatch(html, /script/i);
  assert.doesNotMatch(html, /onclick/i);
  assert.doesNotMatch(html, /onerror/i);
  assert.doesNotMatch(html, /<img/i);
  assert.doesNotMatch(html, /<style/i);
  assert.match(html, /Halo/);
});

test("tautan javascript dan data dibuang", () => {
  assert.doesNotMatch(sanitizeRichText('<a href="javascript:alert(1)">Klik</a>'), /javascript:/i);
  assert.doesNotMatch(sanitizeRichText('<a href="data:text/html,<script>alert(1)</script>">Klik</a>'), /data:/i);
  assert.match(sanitizeRichText('<a href="https://askonveksi.web.id">Klik</a>'), /href="https:\/\/askonveksi\.web\.id"/);
});

test("target blank selalu mendapat rel noopener noreferrer", () => {
  const html = sanitizeRichText('<a href="https://example.com" target="_blank">Buka</a>');
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test("sanitasi konten menyisir field kaya teks bersarang", () => {
  const result = sanitizeCmsContent({
    home: {
      hero: { description: '<p>Halo <script>alert(1)</script><strong>dunia</strong></p>' },
      testimonials: { items: [{ quote: '<a href="javascript:alert(1)">Kutipan</a>', name: "Nama" }] },
    },
    contact: { faq: { items: [{ question: "Apa?", answer: "<p>Jawaban <em>aman</em></p>" }] } },
  });

  assert.doesNotMatch(result.home.hero.description, /script/i);
  assert.match(result.home.hero.description, /<strong>dunia<\/strong>/);
  assert.doesNotMatch(result.home.testimonials.items[0].quote, /javascript:/i);
  assert.match(result.contact.faq.items[0].answer, /<em>aman<\/em>/);
  assert.equal(result.contact.faq.items[0].question, "Apa?");
});
