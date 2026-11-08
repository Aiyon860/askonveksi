import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Brand } from "@/lib/brand/config";
import { DEFAULT_BRAND } from "@/lib/brand/config";
import { normalizePdfImage } from "@/lib/crm/pdf-image";

const BRAND_LOGO_FILE: Record<Brand, string> = {
  ASKONVEKSI: "public/brand/askonveksi-logo.png",
  SAGA: "public/brand/saga.jpeg",
};

/** Logo brand terbaru dalam bentuk PNG siap embed pdf-lib. */
export async function readDefaultBrandLogoPng(brand: Brand = DEFAULT_BRAND) {
  const relative = BRAND_LOGO_FILE[brand] ?? BRAND_LOGO_FILE[DEFAULT_BRAND];
  return normalizePdfImage(new Uint8Array(await readFile(join(process.cwd(), relative))));
}
