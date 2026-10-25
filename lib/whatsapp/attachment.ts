import "server-only";

import { randomUUID } from "node:crypto";

import { UserFacingError } from "@/lib/actions/response";
import { erpStorage, WHATSAPP_MEDIA_BUCKET } from "@/lib/storage/erp-storage";

/** Batas ukuran gambar WhatsApp (sama dengan lampiran Kotak Masuk). */
export const WHATSAPP_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export type WhatsAppImageAttachment = {
  path: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  kind: "IMAGE";
};

/** Deteksi tipe gambar dari magic bytes; ekstensi/nama file tidak dipercaya. */
export function sniffImageMimeType(bytes: Uint8Array) {
  if (bytes.length < 12) return null;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (isJpeg) return "image/jpeg";
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (isPng) return "image/png";
  const isWebp = new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (isWebp) return "image/webp";
  return null;
}

export function safeMediaFileName(name: string, fallbackExtension = "jpg") {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || `${randomUUID()}.${fallbackExtension}`;
}

/**
 * Unggah satu gambar WhatsApp ke storage.
 * `prefix` menentukan umur file: `broadcast-temp/` dihapus otomatis oleh worker,
 * `campaign/` disimpan selama campaign ada.
 */
export async function uploadWhatsAppImage(file: File, prefix: "broadcast-temp" | "campaign"): Promise<WhatsAppImageAttachment> {
  if (file.size > WHATSAPP_IMAGE_MAX_BYTES) throw new UserFacingError("Gambar maksimal 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffImageMimeType(bytes);
  if (!mimeType) throw new UserFacingError("Gambar harus berupa JPG, PNG, atau WebP yang valid.");
  const fileName = safeMediaFileName(file.name, mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg");
  const path = `${prefix}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${fileName}`;
  const result = await erpStorage(WHATSAPP_MEDIA_BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false });
  if (result.error) throw new UserFacingError("Gambar belum dapat disimpan.");
  return { path, mimeType, fileName, sizeBytes: file.size, kind: "IMAGE" };
}

/** Hapus file media WhatsApp; kegagalan dicatat, bukan menggagalkan aksi bisnis. */
export async function removeWhatsAppMedia(paths: string[]) {
  if (!paths.length) return;
  try {
    await erpStorage(WHATSAPP_MEDIA_BUCKET).remove(paths);
  } catch (error) {
    console.error("[whatsapp-media] gagal menghapus media", paths, error);
  }
}
