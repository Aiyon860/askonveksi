import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import sharp, { type Metadata, type OutputInfo } from "sharp";

import type { CmsImage } from "@/lib/cms/types";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MAX_EDGE = 6000;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);

export function uploadDir() {
  return resolve(process.env.CMS_UPLOAD_DIR || join(process.cwd(), "data/uploads"));
}

export class MediaValidationError extends Error {}

export type UploadedImage = CmsImage & { width: number; height: number };

export async function saveUploadedImage(file: File, alt = ""): Promise<UploadedImage> {
  if (!(file instanceof File) || file.size === 0) throw new MediaValidationError("Pilih file gambar terlebih dahulu.");
  if (file.size > MAX_BYTES) throw new MediaValidationError("Ukuran gambar maksimal 8 MB.");
  if (alt.length > 300) throw new MediaValidationError("Teks alternatif maksimal 300 karakter.");

  const bytes = Buffer.from(await file.arrayBuffer());
  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: "warning" }).metadata();
  } catch {
    throw new MediaValidationError("File ini bukan gambar yang valid.");
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new MediaValidationError("Format yang didukung hanya JPG, PNG, WebP, dan AVIF.");
  }
  if (!metadata.width || !metadata.height) throw new MediaValidationError("Dimensi gambar tidak terbaca.");
  if (metadata.width > MAX_EDGE || metadata.height > MAX_EDGE) {
    throw new MediaValidationError("Dimensi gambar maksimal 6000 × 6000 piksel.");
  }

  let output: { data: Buffer; info: OutputInfo };
  try {
    output = await sharp(bytes, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new MediaValidationError("Gambar gagal diproses. Coba file lain.");
  }

  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const name = `${randomUUID()}.webp`;
  const relative = `${folder}/${name}`;
  const absolute = join(uploadDir(), folder, name);
  await mkdir(join(uploadDir(), folder), { recursive: true });
  await writeFile(absolute, output.data);

  return {
    src: `/media/${relative}`,
    alt: alt.trim(),
    width: output.info.width,
    height: output.info.height,
  };
}

export async function resolveMediaFile(segments: string[]) {
  if (!segments.length) return null;
  const relative = segments.join("/");
  if (relative.includes("\0") || relative.split("/").some((part) => part === ".." || part.startsWith("."))) return null;
  const root = uploadDir();
  const absolute = resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) return null;
  const extension = extname(absolute).toLowerCase();
  if (![".webp", ".png", ".jpg", ".jpeg", ".avif"].includes(extension)) return null;
  try {
    const info = await stat(absolute);
    if (!info.isFile()) return null;
    return { absolute, size: info.size, extension };
  } catch {
    return null;
  }
}

export function mediaContentType(extension: string) {
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".avif") return "image/avif";
  return "image/webp";
}

export async function readMediaFile(absolute: string) {
  return readFile(absolute);
}
