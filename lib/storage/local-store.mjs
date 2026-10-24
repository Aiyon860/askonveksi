import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, resolve, sep } from "node:path";

const DRIVERS = new Set(["supabase", "hybrid", "local"]);
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export class StorageError extends Error {
  constructor(message, status = 500, code = "STORAGE_ERROR") {
    super(message);
    this.name = "StorageError";
    this.status = status;
    this.code = code;
  }
}

/** Driver aktif. Nilai tidak dikenal langsung gagal agar salah konfigurasi tidak diam-diam memakai Supabase. */
export function storageDriver() {
  const driver = String(process.env.ERP_STORAGE_DRIVER || "supabase").trim().toLowerCase();
  if (!DRIVERS.has(driver)) {
    throw new StorageError(`ERP_STORAGE_DRIVER tidak valid: "${driver}". Gunakan supabase, hybrid, atau local.`, 500, "INVALID_DRIVER");
  }
  return driver;
}

export function storeRoot() {
  ensureStorageReady();
  return resolve(process.env.ERP_STORAGE_DIR || join(process.cwd(), "data/erp-storage"));
}

let readinessKey = null;

/**
 * Guard konfigurasi. Di produksi, driver non-Supabase wajib memakai path absolut
 * agar file tidak pernah ditulis ke folder release yang akan dipangkas deploy.
 */
export function assertStorageReady() {
  const driver = storageDriver();
  if (driver === "supabase") return driver;

  const configured = String(process.env.ERP_STORAGE_DIR || "").trim();
  if (process.env.NODE_ENV === "production") {
    if (!configured) {
      throw new StorageError(
        "ERP_STORAGE_DIR wajib diset di produksi saat ERP_STORAGE_DRIVER bukan supabase.",
        500,
        "INVALID_STORAGE_DIR",
      );
    }
    if (!isAbsolute(configured)) {
      throw new StorageError(
        "ERP_STORAGE_DIR wajib berupa path absolut di produksi.",
        500,
        "INVALID_STORAGE_DIR",
      );
    }
    const root = resolve(configured);
    const cwd = resolve(process.cwd());
    if (root === cwd || root.startsWith(`${cwd}${sep}`)) {
      console.warn("[erp-storage] ERP_STORAGE_DIR berada di dalam folder aplikasi; gunakan volume persisten di luar release.", { root });
    }
  }
  return driver;
}

function ensureStorageReady() {
  const key = `${process.env.ERP_STORAGE_DRIVER || ""}|${process.env.ERP_STORAGE_DIR || ""}|${process.env.NODE_ENV || ""}`;
  if (key === readinessKey) return;
  assertStorageReady();
  readinessKey = key;
}

/**
 * Validasi bucket + path relatif sebelum menyentuh filesystem.
 * Menolak traversal, path absolut, backslash, NUL, segmen kosong/tersembunyi,
 * dan path yang keluar dari folder bucket.
 */
export function resolveSafe(bucket, relativePath) {
  if (typeof bucket !== "string" || !BUCKET_PATTERN.test(bucket)) return null;
  if (typeof relativePath !== "string" || !relativePath) return null;
  if (relativePath.includes("\0") || relativePath.includes("\\")) return null;
  if (isAbsolute(relativePath)) return null;

  const parts = relativePath.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.startsWith("."))) return null;

  const root = storeRoot();
  const bucketRoot = resolve(root, bucket);
  const absolute = resolve(bucketRoot, relativePath);
  if (!absolute.startsWith(`${bucketRoot}${sep}`)) return null;

  return { absolute, bucket, relativePath };
}

function toBuffer(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes;
  if (bytes instanceof ArrayBuffer) return Buffer.from(bytes);
  if (ArrayBuffer.isView(bytes)) return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  throw new StorageError("Isi file tidak valid.", 400, "INVALID_BYTES");
}

/**
 * Tulis atomik. Pembaca tidak pernah melihat file setengah jadi.
 * upsert:true -> rename (menimpa); upsert:false -> link (gagal EEXIST bila sudah ada).
 */
export async function putFile(bucket, relativePath, bytes, { upsert = false } = {}) {
  const target = resolveSafe(bucket, relativePath);
  if (!target) throw new StorageError("Path penyimpanan tidak valid.", 400, "INVALID_PATH");

  const buffer = toBuffer(bytes);
  const folder = dirname(target.absolute);
  await mkdir(folder, { recursive: true, mode: 0o750 });

  const temporary = join(folder, `.tmp-${randomUUID()}`);
  try {
    await writeFile(temporary, buffer, { flag: "wx", mode: 0o640 });
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }

  try {
    if (upsert) {
      await rename(temporary, target.absolute);
    } else {
      await link(temporary, target.absolute);
      await unlink(temporary).catch(() => undefined);
    }
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    if (error && error.code === "EEXIST") {
      throw new StorageError("File sudah ada.", 409, "FILE_EXISTS");
    }
    throw error;
  }
}

export async function getFile(bucket, relativePath) {
  const target = resolveSafe(bucket, relativePath);
  if (!target) return null;
  try {
    return await readFile(target.absolute);
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) return null;
    throw error;
  }
}

export async function statFile(bucket, relativePath) {
  const target = resolveSafe(bucket, relativePath);
  if (!target) return null;
  try {
    const info = await stat(target.absolute);
    return info.isFile() ? { size: info.size } : null;
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) return null;
    throw error;
  }
}

export async function fileExists(bucket, relativePath) {
  return (await statFile(bucket, relativePath)) !== null;
}

/** Hapus best-effort. ENOENT diabaikan; kegagalan lain dikumpulkan. */
export async function removeFiles(bucket, paths) {
  const failed = [];
  for (const relativePath of paths || []) {
    const target = resolveSafe(bucket, relativePath);
    if (!target) {
      failed.push({ path: relativePath, message: "Path tidak valid." });
      continue;
    }
    try {
      await unlink(target.absolute);
    } catch (error) {
      if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) continue;
      failed.push({ path: relativePath, message: error instanceof Error ? error.message : "Gagal menghapus file." });
    }
  }
  return { failed };
}

export function contentTypeFromPath(relativePath) {
  const extension = extname(typeof relativePath === "string" ? relativePath : "").toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".pdf") return "application/pdf";
  return "application/octet-stream";
}
