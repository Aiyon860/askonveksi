#!/usr/bin/env node
import { readFile, readdir, unlink } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(process.env.CMS_DATA_DIR || join(root, "data/cms"));
const uploadDir = resolve(process.env.CMS_UPLOAD_DIR || join(root, "data/uploads"));
const apply = process.argv.includes("--apply");

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(absolute)));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

let content;
try {
  content = JSON.parse(await readFile(join(dataDir, "content.json"), "utf8"));
} catch (error) {
  console.error(`Tidak bisa membaca content.json di ${dataDir}. Jalankan cms:setup lebih dulu.`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const referenced = new Set();
const walk = (value) => {
  if (typeof value === "string") {
    const match = value.match(/^\/media\/(.+)$/);
    if (match) referenced.add(decodeURIComponent(match[1]));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) walk(item);
  }
};
walk(content);

let files = [];
try {
  files = await collectFiles(uploadDir);
} catch (error) {
  console.error(`Tidak bisa membaca direktori gambar: ${uploadDir}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const orphans = files.filter((absolute) => !referenced.has(relative(uploadDir, absolute).split("\\").join("/")));

console.log(`Gambar di disk : ${files.length}`);
console.log(`Gambar dipakai : ${referenced.size}`);
console.log(`Gambar yatim   : ${orphans.length}`);

for (const absolute of orphans.slice(0, 30)) {
  console.log(`  - ${relative(uploadDir, absolute)}`);
}
if (orphans.length > 30) console.log(`  … dan ${orphans.length - 30} lainnya`);

if (!orphans.length) process.exit(0);

if (!apply) {
  console.log("\nMode uji. Jalankan ulang dengan --apply untuk menghapus file yatim.");
  process.exit(0);
}

for (const absolute of orphans) {
  await unlink(absolute).catch(() => undefined);
}
console.log(`\n${orphans.length} file yatim dihapus.`);
