#!/usr/bin/env node
import { access, chmod, copyFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(process.env.CMS_DATA_DIR || join(root, "data/cms"));
const uploadDir = resolve(process.env.CMS_UPLOAD_DIR || join(root, "data/uploads"));
const seed = join(root, "lib/cms/seed-content.json");
const content = join(dataDir, "content.json");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

await mkdir(join(dataDir, "versions"), { recursive: true });
await mkdir(uploadDir, { recursive: true });

if (await exists(content)) {
  console.log(`Konten sudah ada, tidak ditimpa: ${content}`);
} else {
  await copyFile(seed, content);
  console.log(`Konten awal disalin ke: ${content}`);
}

await chmod(dataDir, 0o755).catch(() => undefined);
await chmod(uploadDir, 0o755).catch(() => undefined);
await chmod(content, 0o644).catch(() => undefined);

console.log("");
console.log("Direktori CMS siap:");
console.log(`  CMS_DATA_DIR   = ${dataDir}`);
console.log(`  CMS_UPLOAD_DIR = ${uploadDir}`);
console.log("");
console.log("Pastikan kedua direktori berada di volume persisten dan dapat ditulis user aplikasi.");
