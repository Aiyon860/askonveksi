export type InvoicePointRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decode entity HTML yang lazim muncul dari editor / migrasi data lama. */
export function decodeInvoicePointEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(hex ? entity.slice(2) : entity.slice(1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

type Style = { bold: boolean; italic: boolean; underline: boolean };

/**
 * Ubah fragmen HTML poin invoice menjadi run teks bergaya untuk PDF.
 * Hanya strong/b, em/i, u, br, p, dan div yang dikenali; tag lain dibuang
 * tetapi teksnya tetap dipertahankan. `\n` pada run menandai baris paksa.
 */
export function parseInvoicePointRuns(html: string): InvoicePointRun[] {
  const runs: InvoicePointRun[] = [];
  const styles: Style = { bold: false, italic: false, underline: false };
  let buffer = "";

  function flush() {
    if (!buffer) return;
    runs.push({ text: buffer, bold: styles.bold, italic: styles.italic, underline: styles.underline });
    buffer = "";
  }

  const source = String(html ?? "");
  const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  let cursor = 0;
  for (const match of source.matchAll(tagPattern)) {
    const index = match.index ?? 0;
    buffer += decodeInvoicePointEntities(source.slice(cursor, index));
    cursor = index + match[0].length;
    const tag = match[1].toLowerCase();
    const closing = match[0][1] === "/";
    if (tag === "br") {
      buffer += "\n";
      continue;
    }
    if (tag === "strong" || tag === "b") {
      flush();
      styles.bold = !closing;
    } else if (tag === "em" || tag === "i") {
      flush();
      styles.italic = !closing;
    } else if (tag === "u") {
      flush();
      styles.underline = !closing;
    } else if ((tag === "p" || tag === "div") && closing) {
      buffer += "\n";
    }
  }
  buffer += decodeInvoicePointEntities(source.slice(cursor));
  flush();
  return runs;
}

/** Teks terlihat (tanpa tag) untuk validasi panjang, jumlah poin, dan pengujian. */
export function invoicePointPlainText(html: string) {
  return parseInvoicePointRuns(html)
    .map((run) => run.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
