import "server-only";

import sharp from "sharp";

const PDF_IMAGE_MAX_PIXELS = 25_000_000;

export async function normalizePdfImage(bytes: Uint8Array) {
  const normalized = await sharp(bytes, { limitInputPixels: PDF_IMAGE_MAX_PIXELS, failOn: "error" })
    .rotate()
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return new Uint8Array(normalized);
}
