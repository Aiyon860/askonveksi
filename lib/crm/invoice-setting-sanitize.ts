import sanitizeHtml from "sanitize-html";

import { INVOICE_POINT_FONT_MAX, INVOICE_POINT_FONT_MIN } from "./invoice-setting-html.ts";

/** Tag `<fs pt="18">` hanya boleh berisi angka ukuran yang masuk akal. */
function fontSizeTag(tagName: string, attribs: Record<string, string>): { tagName: string; attribs: Record<string, string> } {
  const pt = Number(attribs.pt);
  const valid = Number.isFinite(pt) && pt >= INVOICE_POINT_FONT_MIN && pt <= INVOICE_POINT_FONT_MAX;
  // Tag tanpa ukuran sah dibuang, teksnya tetap tampil dengan ukuran dasar.
  return valid ? { tagName, attribs: { pt: String(pt) } } : { tagName: "span", attribs: {} };
}

// Fragmen HTML satu poin invoice: tebal, miring, garis bawah, baris baru, dan ukuran teks.
export function sanitizeInvoicePointHtml(value: string) {
  return sanitizeHtml(String(value ?? ""), {
    allowedTags: ["strong", "b", "em", "i", "u", "br", "fs"],
    allowedAttributes: { fs: ["pt"] },
    disallowedTagsMode: "discard",
    transformTags: { b: "strong", i: "em", fs: fontSizeTag },
  }).replace(/<br\s*\/?>/gi, "<br>").trim();
}
