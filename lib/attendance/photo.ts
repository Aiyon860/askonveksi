import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import sharp, { type Metadata } from "sharp";

import { ATTENDANCE_MAX_PHOTO_BYTES } from "./constants.ts";
import { isValidDateKey } from "./time.ts";

const MAX_PIXELS = 40_000_000;
const MAX_EDGE = 1280;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export function attendanceUploadDir() {
  return resolve(
    /* turbopackIgnore: true */
    process.env.ATTENDANCE_UPLOAD_DIR || join(process.cwd(), "data/attendance"),
  );
}

export class AttendancePhotoError extends Error {}

function safeSegment(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new AttendancePhotoError("Data pegawai tidak valid.");
  }
  return value;
}

export function attendancePhotoRelativePath(userId: string, dateKey: string, id = randomUUID()) {
  if (!isValidDateKey(dateKey)) throw new AttendancePhotoError("Tanggal absensi tidak valid.");
  return `${safeSegment(userId)}/${dateKey.slice(0, 4)}/${dateKey.slice(5, 7)}/${safeSegment(id)}.webp`;
}

/** Validasi path relatif dari DB sebelum menyentuh filesystem. */
export function resolveAttendancePhotoPath(relativePath: string | null | undefined) {
  if (!relativePath || relativePath.includes("\0") || relativePath.includes("\\")) return null;
  if (!relativePath.endsWith(".webp")) return null;
  const parts = relativePath.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.startsWith("."))) {
    return null;
  }

  const root = attendanceUploadDir();
  const absolute = resolve(root, relativePath);
  if (absolute === root || !absolute.startsWith(`${root}${sep}`)) return null;
  return { relativePath, absolute };
}

export async function resolveAttendancePhoto(relativePath: string | null | undefined) {
  const path = resolveAttendancePhotoPath(relativePath);
  if (!path) return null;

  try {
    const info = await stat(/* turbopackIgnore: true */ path.absolute);
    if (!info.isFile() || info.size === 0) return null;
    return { ...path, size: info.size };
  } catch {
    return null;
  }
}

export async function readAttendancePhoto(relativePath: string | null | undefined) {
  const file = await resolveAttendancePhoto(relativePath);
  if (!file) return null;
  return { ...file, bytes: await readFile(file.absolute) };
}

export async function saveAttendancePhoto(input: {
  userId: string;
  dateKey: string;
  bytes: Buffer;
}) {
  const relativePath = attendancePhotoRelativePath(input.userId, input.dateKey);
  const path = resolveAttendancePhotoPath(relativePath);
  if (!path) throw new AttendancePhotoError("Path foto absensi tidak valid.");

  await mkdir(dirname(path.absolute), { recursive: true, mode: 0o750 });
  await writeFile(path.absolute, input.bytes, { flag: "wx", mode: 0o640 });
  return relativePath;
}

export async function deleteAttendancePhoto(relativePath: string | null | undefined) {
  const path = resolveAttendancePhotoPath(relativePath);
  if (!path) return;
  try {
    await unlink(path.absolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[attendance:delete-photo]", error);
    }
  }
}

export type OptimizedAttendancePhoto = {
  bytes: Buffer;
  mimeType: "image/webp";
  size: number;
  width: number;
  height: number;
};

/**
 * Foto kamera dire-encode ulang ke WebP agar metadata EXIF (termasuk GPS dari
 * kamera) hilang dan ukuran file terkendali.
 */
export async function optimizeAttendancePhoto(file: File): Promise<OptimizedAttendancePhoto> {
  if (!(file instanceof File) || file.size === 0) {
    throw new AttendancePhotoError("Ambil foto terlebih dahulu.");
  }
  if (file.size > ATTENDANCE_MAX_PHOTO_BYTES) {
    throw new AttendancePhotoError("Ukuran foto maksimal 5 MB.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "warning" }).metadata();
  } catch {
    throw new AttendancePhotoError("Foto tidak dapat dibaca. Ambil ulang foto.");
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format) || !metadata.width || !metadata.height) {
    throw new AttendancePhotoError("Format foto tidak didukung. Gunakan kamera untuk mengambil foto.");
  }

  try {
    const output = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "warning" })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (output.data.length === 0 || output.data.length > ATTENDANCE_MAX_PHOTO_BYTES) {
      throw new AttendancePhotoError("Foto terlalu besar setelah diproses. Ambil ulang foto.");
    }

    return {
      bytes: output.data,
      mimeType: "image/webp",
      size: output.data.length,
      width: output.info.width,
      height: output.info.height,
    };
  } catch (error) {
    if (error instanceof AttendancePhotoError) throw error;
    throw new AttendancePhotoError("Foto gagal diproses. Ambil ulang foto.");
  }
}
