#!/usr/bin/env node
import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(process.env.CMS_DATA_DIR || join(root, "data/cms"));
const uploadDir = resolve(process.env.CMS_UPLOAD_DIR || join(root, "data/uploads"));
const backupRoot = resolve(process.env.CMS_BACKUP_DIR || join(root, "data/backups"));

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = join(backupRoot, `cms-${stamp}`);

let copied = 0;
await mkdir(target, { recursive: true });

if (await exists(dataDir)) {
  await cp(dataDir, join(target, "cms"), { recursive: true });
  copied += 1;
  console.log(`Konten dicadangkan: ${join(target, "cms")}`);
} else {
  console.warn(`Direktori konten tidak ditemukan, dilewati: ${dataDir}`);
}

if (await exists(uploadDir)) {
  await cp(uploadDir, join(target, "uploads"), { recursive: true });
  copied += 1;
  console.log(`Gambar dicadangkan: ${join(target, "uploads")}`);
} else {
  console.warn(`Direktori gambar tidak ditemukan, dilewati: ${uploadDir}`);
}

if (!copied) {
  console.error("Tidak ada data yang dicadangkan. Periksa CMS_DATA_DIR dan CMS_UPLOAD_DIR.");
  process.exit(1);
}

console.log(`\nBackup selesai: ${target}`);
console.log("Salin folder ini ke penyimpanan eksternal (mis. object storage atau mesin lain).");
