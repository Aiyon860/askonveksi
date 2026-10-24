import "server-only";

import { createAdminClient } from "../supabase/admin.ts";
import {
  contentTypeFromPath,
  fileExists,
  getFile,
  putFile,
  removeFiles,
  resolveSafe,
  storageDriver,
} from "./local-store.mjs";

export const PO_DESIGNS_BUCKET = "crm-po-designs";
export const BUSINESS_ASSETS_BUCKET = "business-assets";
export const PAYMENT_PROOFS_BUCKET = "payment-proofs";
export const WHATSAPP_MEDIA_BUCKET = process.env.WHATSAPP_MEDIA_BUCKET || "whatsapp-media";

export type ErpStorageError = { message: string; status?: number; statusCode?: string };
export type ErpStorageFile = { arrayBuffer(): Promise<ArrayBuffer>; type: string };
export type ErpUploadOptions = { contentType?: string; upsert?: boolean };
export type ErpStorageResult<T> =
  | { data: T; error: null }
  | { data: null; error: ErpStorageError };

export type ErpStorage = {
  upload(
    path: string,
    bytes: Uint8Array,
    opts?: ErpUploadOptions,
  ): Promise<ErpStorageResult<{ path: string }>>;
  download(path: string): Promise<ErpStorageResult<ErpStorageFile>>;
  remove(paths: string[]): Promise<ErpStorageResult<null>>;
  exists(path: string): Promise<ErpStorageResult<boolean>>;
};

function supabaseClient(bucket: string) {
  return createAdminClient().storage.from(bucket);
}

function toStorageError(error: unknown): ErpStorageError {
  const candidate = error as { message?: unknown; status?: unknown } | null;
  const message = typeof candidate?.message === "string" ? candidate.message : "Kesalahan penyimpanan.";
  const status = typeof candidate?.status === "number" ? candidate.status : 500;
  return { message, status, statusCode: String(status) };
}

function missingError(): ErpStorageError {
  return { message: "File tidak ditemukan.", status: 404, statusCode: "404" };
}

function invalidPathError(): ErpStorageError {
  return { message: "Path penyimpanan tidak valid.", status: 400, statusCode: "400" };
}

// Log fallback dibatasi agar backfill file lama tidak membanjiri log PM2.
const FALLBACK_LOG_INTERVAL_MS = 10 * 60 * 1000;
const fallbackLogAt = new Map<string, number>();

function logFallback(bucket: string, path: string) {
  const key = `${bucket}/${path}`;
  const now = Date.now();
  const last = fallbackLogAt.get(key) ?? 0;
  if (now - last < FALLBACK_LOG_INTERVAL_MS) return;
  if (fallbackLogAt.size > 1000) fallbackLogAt.clear();
  fallbackLogAt.set(key, now);
  console.info("[erp-storage] fallback-supabase", { bucket, path });
}

/**
 * Adapter dengan bentuk yang sama seperti `supabase.storage.from(bucket)`.
 * Tujuannya: call site cukup mengganti satu baris konstruksi, tanpa mengubah
 * nama method, argumen, maupun pemeriksaan `{ data, error }`.
 */
export function erpStorage(bucket: string): ErpStorage {
  return {
    async upload(path, bytes, opts = {}) {
      const driver = storageDriver();
      if (driver === "supabase") return supabaseClient(bucket).upload(path, bytes, opts);

      try {
        await putFile(bucket, path, bytes, { upsert: opts.upsert ?? false });
      } catch (error) {
        return { data: null, error: toStorageError(error) };
      }

      if (driver === "hybrid") {
        const { error } = await supabaseClient(bucket).upload(path, bytes, opts);
        if (error) {
          // Fail-hard: jangan tinggalkan file yang hanya ada di VPS, karena rollback
          // ke driver supabase akan menghilangkannya.
          const { failed } = await removeFiles(bucket, [path]);
          console.error("[erp-storage] hybrid-put-rollback", {
            bucket,
            path,
            message: error.message,
            cleanupFailed: failed.length,
          });
          return { data: null, error };
        }
      }

      return { data: { path }, error: null };
    },

    async download(path) {
      const driver = storageDriver();
      if (driver === "supabase") return supabaseClient(bucket).download(path);

      // Path tidak valid tidak boleh diteruskan ke Supabase: validasi traversal
      // harus berlaku sama di semua driver.
      if (!resolveSafe(bucket, path)) return { data: null, error: invalidPathError() };

      let buffer: Buffer | null;
      try {
        buffer = await getFile(bucket, path);
      } catch (error) {
        return { data: null, error: toStorageError(error) };
      }

      if (buffer) {
        return {
          data: new Blob([new Uint8Array(buffer)], { type: contentTypeFromPath(path) }),
          error: null,
        };
      }

      if (driver === "local") return { data: null, error: missingError() };

      logFallback(bucket, path);
      return supabaseClient(bucket).download(path);
    },

    async remove(paths) {
      const driver = storageDriver();
      if (driver === "supabase") {
        const result = await supabaseClient(bucket).remove(paths);
        return result.error ? { data: null, error: result.error } : { data: null, error: null };
      }

      const local = await removeFiles(bucket, paths);
      if (driver === "local") {
        return {
          data: null,
          error: local.failed.length ? toStorageError({ message: local.failed[0]?.message, status: 500 }) : null,
        };
      }

      const remote = await supabaseClient(bucket).remove(paths);
      if (local.failed.length || remote.error) {
        console.error("[erp-storage] remove-partial", {
          bucket,
          localFailed: local.failed.length,
          remoteMessage: remote.error?.message,
        });
        return {
          data: null,
          error: local.failed.length
            ? toStorageError({ message: local.failed[0]?.message, status: 500 })
            : remote.error,
        };
      }

      return { data: null, error: null };
    },

    async exists(path) {
      const driver = storageDriver();
      if (driver === "supabase") {
        const result = await supabaseClient(bucket).exists(path);
        return result.error ? { data: null, error: result.error } : { data: result.data, error: null };
      }

      if (!resolveSafe(bucket, path)) return { data: null, error: invalidPathError() };

      try {
        if (await fileExists(bucket, path)) return { data: true, error: null };
      } catch (error) {
        return { data: null, error: toStorageError(error) };
      }

      if (driver === "local") return { data: false, error: null };

      // Hybrid: snapshot lama mungkin baru ada di Supabase (belum di-backfill).
      const result = await supabaseClient(bucket).exists(path);
      return result.error ? { data: null, error: result.error } : { data: result.data, error: null };
    },
  };
}
