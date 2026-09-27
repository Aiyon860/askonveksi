import "server-only";

import { randomUUID } from "node:crypto";

import { UserFacingError } from "@/lib/actions/response";
import { createAdminClient } from "@/lib/supabase/admin";

export const PAYMENT_PROOF_BUCKET = "payment-proofs";
export const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024;
const types = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export type PaymentProof = { proofPath: string; proofFileName: string; proofMimeType: string; proofSize: number };

function detectedType(bytes: Uint8Array) {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && String.fromCharCode(...bytes.slice(1, 4)) === "PNG") return "image/png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export function proofRequired(methodName: string) { return methodName === "QRIS" || methodName.startsWith("BANK"); }

export async function uploadPaymentProof(value: FormDataEntryValue | null, owner: string): Promise<PaymentProof | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > PAYMENT_PROOF_MAX_BYTES) throw new UserFacingError("Bukti pembayaran maksimal 5 MB.");
  const bytes = new Uint8Array(await value.arrayBuffer());
  const mime = detectedType(bytes);
  if (!mime || !types.has(value.type) || value.type !== mime) throw new UserFacingError("Bukti harus PDF, JPEG, PNG, atau WebP yang valid.");
  const extension = mime === "application/pdf" ? "pdf" : mime.split("/")[1].replace("jpeg", "jpg");
  const proofPath = `${owner}/${randomUUID()}.${extension}`;
  const { error } = await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).upload(proofPath, bytes, { contentType: mime, upsert: false });
  if (error) throw new UserFacingError("Bukti tidak dapat diunggah.");
  return { proofPath, proofFileName: value.name.replace(/[\\/\r\n]/g, "-").slice(0, 255) || `bukti.${extension}`, proofMimeType: mime, proofSize: value.size };
}

export async function deletePaymentProof(path: string | null | undefined) {
  if (path) await createAdminClient().storage.from(PAYMENT_PROOF_BUCKET).remove([path]);
}
