// Aturan revisi D2: desain hanya boleh berupa gambar PNG/JPG/JPEG.
// PSD dan PDF ditolak karena tidak dapat dirender di kanvas anotasi maupun pratinjau.
export const DESIGN_IMAGE_MIME_TYPES = ["image/png", "image/jpeg"] as const;
export type DesignImageMime = (typeof DESIGN_IMAGE_MIME_TYPES)[number];

export function designImageExtension(name: string) {
  return /\.([a-z0-9]{1,10})$/i.exec(name)?.[1]?.toLowerCase() ?? "";
}

function isPngBytes(bytes: Uint8Array) {
  return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
}

function isJpegBytes(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** Jenis gambar dari isi file. Dipakai untuk memastikan header HTTP selalu benar. */
export function sniffImageContentType(bytes: Uint8Array): DesignImageMime | null {
  if (isPngBytes(bytes)) return "image/png";
  if (isJpegBytes(bytes)) return "image/jpeg";
  return null;
}

/** MIME gambar desain hanya bila ekstensi dan isi file sama-sama cocok. */
export function designImageContentType(name: string, bytes: Uint8Array): DesignImageMime | null {
  const extension = designImageExtension(name);
  const expected = extension === "png" ? "image/png" : extension === "jpg" || extension === "jpeg" ? "image/jpeg" : null;
  if (!expected) return null;
  return sniffImageContentType(bytes) === expected ? expected : null;
}

export function designImageExtensionFor(contentType: DesignImageMime) {
  return contentType === "image/png" ? "png" : "jpg";
}

/** Pesan penolakan yang membedakan PDF dari format lain agar pengguna tahu cara memperbaikinya. */
export function designImageRejection(name: string) {
  const extension = designImageExtension(name);
  if (extension === "pdf") return "File PDF tidak didukung. Unggah gambar PNG, JPG, atau JPEG.";
  if (!["png", "jpg", "jpeg"].includes(extension)) return "Desain hanya boleh berupa gambar PNG, JPG, atau JPEG.";
  return "Isi file tidak sesuai dengan gambar PNG, JPG, atau JPEG.";
}
