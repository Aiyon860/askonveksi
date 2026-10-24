import sanitizeHtml from "sanitize-html";

// Fragmen HTML satu poin invoice: hanya tebal, miring, garis bawah, dan baris baru.
export function sanitizeInvoicePointHtml(value: string) {
  return sanitizeHtml(String(value ?? ""), {
    allowedTags: ["strong", "b", "em", "i", "u", "br"],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    transformTags: { b: "strong", i: "em" },
  }).replace(/<br\s*\/?>/gi, "<br>").trim();
}
