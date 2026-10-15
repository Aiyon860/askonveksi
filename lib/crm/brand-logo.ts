import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { normalizePdfImage } from "@/lib/crm/pdf-image";

/** Logo brand terbaru (sama dengan fallback logo situs) dalam bentuk PNG siap embed pdf-lib. */
export async function readDefaultBrandLogoPng() {
  return normalizePdfImage(new Uint8Array(await readFile(join(process.cwd(), "public/new-logo.webp"))));
}
