#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { siteContentSchemaWithRules } from "../lib/cms/schema.ts";
import { sanitizeCmsContent } from "../lib/cms/sanitize.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(process.env.CMS_DATA_DIR || join(root, "data/cms"));
const target = process.argv[2] ? resolve(process.argv[2]) : join(dataDir, "content.json");

let raw;
try {
  raw = JSON.parse(await readFile(target, "utf8"));
} catch (error) {
  if (error?.code === "ENOENT") {
    console.error(`File konten tidak ditemukan: ${target}`);
    console.error("Jalankan `npm run cms:setup` terlebih dahulu, atau berikan path file sebagai argumen.");
    process.exit(1);
  }
  console.error(`File konten bukan JSON yang valid: ${target}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const parsed = siteContentSchemaWithRules.safeParse(sanitizeCmsContent(raw));
if (!parsed.success) {
  console.error(`Konten tidak valid: ${target}`);
  for (const issue of parsed.error.issues.slice(0, 20)) {
    const path = issue.path.length ? issue.path.map(String).join(".") : "(root)";
    console.error(`  - ${path}: ${issue.message}`);
  }
  process.exit(1);
}

const content = parsed.data;
console.log(`Konten valid: ${target}`);
console.log(`  versi          : ${content.version}`);
console.log(`  terakhir diubah: ${content.updatedAt} oleh ${content.updatedBy.name}`);
console.log(`  produk         : ${content.products.length} (${content.products.filter((item) => item.published).length} tayang)`);
console.log(`  size chart     : ${content.sizeChart.images.length} gambar`);
console.log(`  portofolio     : ${content.portfolio.items.length} item`);
