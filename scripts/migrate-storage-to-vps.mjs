import "dotenv/config";

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { putFile, resolveSafe, statFile, storeRoot } from "../lib/storage/local-store.mjs";

const BUCKETS = ["crm-po-designs", "business-assets", "payment-proofs", "whatsapp-media"];
const PAGE_SIZE = 100;
const flags = new Set(process.argv.slice(2));
const dryRun = flags.has("--dry-run");
const verifyOnly = flags.has("--verify");

function fail(message) {
  console.error(`[storage-migrate] ${message}`);
  process.exit(1);
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !supabaseKey) fail("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SECRET_KEY wajib diset.");
if (!process.env.ERP_STORAGE_DIR) fail("ERP_STORAGE_DIR wajib diset (path absolut volume VPS).");

const storage = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } }).storage;
const root = storeRoot();

async function listBucket(bucket) {
  const objects = [];
  const folders = [""];

  while (folders.length) {
    const prefix = folders.shift();
    let offset = 0;

    for (;;) {
      const { data, error } = await storage.from(bucket).list(prefix, { limit: PAGE_SIZE, offset });
      if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
      const items = data ?? [];

      for (const item of items) {
        // Supabase membuat objek penanda folder kosong; bukan file ERP.
        if (item.name === ".emptyFolderPlaceholder") continue;
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id) {
          objects.push({ path, size: Number(item.metadata?.size ?? 0) });
        } else if (!folders.includes(path)) {
          folders.push(path);
        }
      }

      if (items.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  return objects;
}

async function walkLocal(bucket) {
  const bucketRoot = join(root, bucket);
  const files = [];

  async function walk(folder, prefix) {
    let entries;
    try {
      entries = await readdir(folder, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(join(folder, entry.name), path);
      } else if (entry.isFile()) {
        const info = await stat(join(folder, entry.name));
        files.push({ path, size: info.size });
      }
    }
  }

  await walk(bucketRoot, "");
  return files;
}

async function verifyBucket(bucket) {
  const remote = await listBucket(bucket);
  const local = await walkLocal(bucket);
  const localByPath = new Map(local.map((file) => [file.path, file.size]));
  const remotePaths = new Set(remote.map((file) => file.path));
  const missing = [];
  const mismatched = [];

  for (const file of remote) {
    const localSize = localByPath.get(file.path);
    if (localSize === undefined) missing.push(file);
    else if (localSize !== file.size) mismatched.push({ ...file, localSize });
  }

  const extra = local.filter((file) => !remotePaths.has(file.path));
  const remoteBytes = remote.reduce((sum, file) => sum + file.size, 0);

  console.log(
    `[verify] ${bucket}: remote=${remote.length} (${formatBytes(remoteBytes)}) local=${local.length} ` +
      `missing=${missing.length} mismatched=${mismatched.length} extra=${extra.length}`,
  );

  for (const file of missing.slice(0, 20)) console.error(`  - hilang: ${file.path} (${file.size} B)`);
  for (const file of mismatched.slice(0, 20)) console.error(`  - ukuran beda: ${file.path} remote=${file.size} local=${file.localSize}`);
  for (const file of extra.slice(0, 20)) console.error(`  - ekstra lokal: ${file.path} (${file.size} B)`);

  return missing.length + mismatched.length + extra.length;
}

async function migrateBucket(bucket) {
  const objects = await listBucket(bucket);
  const summary = { objects: objects.length, bytes: objects.reduce((sum, file) => sum + file.size, 0), skipped: 0, written: 0, failed: 0 };

  for (const object of objects) {
    if (!resolveSafe(bucket, object.path)) {
      summary.failed += 1;
      console.error(`[migrate] path tidak valid, dilewati: ${bucket}/${object.path}`);
      continue;
    }

    try {
      const existing = await statFile(bucket, object.path);
      if (existing && existing.size === object.size) {
        summary.skipped += 1;
        continue;
      }

      if (dryRun) {
        summary.written += 1;
        continue;
      }

      const { data, error } = await storage.from(bucket).download(object.path);
      if (error || !data) throw new Error(error?.message || "download kosong");

      const bytes = Buffer.from(await data.arrayBuffer());
      if (bytes.length !== object.size) {
        throw new Error(`ukuran download ${bytes.length} B != metadata ${object.size} B`);
      }

      await putFile(bucket, object.path, bytes, { upsert: true });
      const written = await statFile(bucket, object.path);
      if (!written || written.size !== object.size) {
        throw new Error(`verifikasi tulis gagal: ${written?.size ?? "tidak ada"} B != ${object.size} B`);
      }

      summary.written += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(`[migrate] gagal ${bucket}/${object.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(
    `[${dryRun ? "dry-run" : "migrate"}] ${bucket}: objects=${summary.objects} bytes=${formatBytes(summary.bytes)} ` +
      `written=${summary.written} skipped=${summary.skipped} failed=${summary.failed}`,
  );

  return summary.failed;
}

console.log(`[storage-migrate] driver=${process.env.ERP_STORAGE_DRIVER || "supabase"} root=${root}`);
if (verifyOnly) console.log("[storage-migrate] mode verify: tidak menulis file");

let failures = 0;
for (const bucket of BUCKETS) {
  try {
    failures += verifyOnly ? await verifyBucket(bucket) : await migrateBucket(bucket);
  } catch (error) {
    failures += 1;
    console.error(`[storage-migrate] bucket ${bucket} gagal: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) {
  console.error(`[storage-migrate] selesai dengan ${failures} masalah.`);
  process.exitCode = 1;
} else {
  console.log("[storage-migrate] selesai tanpa masalah.");
}
