import sanitizeHtml from "sanitize-html";

// Disimpan di sini agar modul ini bisa diuji langsung dengan Node tanpa resolver alias.
const RICH_KEYS = new Set(["description", "quote", "answer", "body", "richText", "comingSoonDescription"]);


export function sanitizeRichText(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    disallowedTagsMode: "discard",
    transformTags: {
      a: (_tagName, attribs) => {
        const href = attribs.href ?? "";
        const safeHref = /^(?:https?:\/\/|mailto:|tel:)/i.test(href) ? href : "";
        const opensNewTab = attribs.target === "_blank";
        return {
          tagName: "a",
          attribs: {
            ...(safeHref ? { href: safeHref } : {}),
            ...(opensNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {}),
          },
        };
      },
    },
  });
}

export function sanitizeCmsContent<T>(value: T): T {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeCmsContent(item)) as T;
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    output[key] = RICH_KEYS.has(key) && typeof child === "string" ? sanitizeRichText(child) : sanitizeCmsContent(child);
  }
  return output as T;
}
