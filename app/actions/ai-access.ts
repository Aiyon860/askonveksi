"use server";

import { revalidatePath } from "next/cache";

import { messageForError, runRedirectingAction, UserFacingError, flashMessagePath } from "@/lib/actions/response";
import { aiTokenHint, generateAiToken, hashAiToken } from "@/lib/ai/auth";
import type { AiTokenFormState } from "@/lib/ai/form-state";
import { USER_ADMIN_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

const AUDIT_PATH = "/admin/ai-access";
const MAX_ACTIVE_TOKENS = 10;

const EXPIRY_OPTIONS = new Set(["30", "90", "365", "never"]);

/**
 * Membuat token baru. Token asli dikembalikan satu kali ke pemanggil untuk
 * disalin; database hanya menyimpan hash-nya.
 */
export async function createAiTokenAction(
  _previous: AiTokenFormState,
  formData: FormData,
): Promise<AiTokenFormState> {
  try {
    const actor = await requireActor(USER_ADMIN_ROLES);

    const label = String(formData.get("label") ?? "").trim();
    if (label.length < 3 || label.length > 80) {
      return { ok: false, message: "Nama token harus 3–80 karakter." };
    }

    const expiry = String(formData.get("expiresInDays") ?? "90");
    if (!EXPIRY_OPTIONS.has(expiry)) {
      return { ok: false, message: "Masa berlaku token tidak dikenal." };
    }

    const prisma = getPrismaClient();
    const active = await prisma.aiApiToken.count({ where: { revokedAt: null } });
    if (active >= MAX_ACTIVE_TOKENS) {
      return { ok: false, message: `Maksimal ${MAX_ACTIVE_TOKENS} token aktif. Cabut token lama terlebih dahulu.` };
    }

    const token = generateAiToken();
    const expiresAt = expiry === "never" ? null : new Date(Date.now() + Number(expiry) * 24 * 60 * 60 * 1000);

    await prisma.aiApiToken.create({
      data: {
        label,
        tokenHash: hashAiToken(token),
        tokenHint: aiTokenHint(token),
        createdById: actor.id,
        expiresAt,
      },
    });

    revalidatePath(AUDIT_PATH);
    return {
      ok: true,
      message: `Token "${label}" dibuat. Salin sekarang — nilai lengkapnya tidak bisa ditampilkan lagi.`,
      token,
    };
  } catch (error) {
    return { ok: false, message: messageForError(error) };
  }
}

/** Mencabut token: pemanggil berikutnya langsung menerima 403. */
export async function revokeAiTokenAction(formData: FormData) {
  return runRedirectingAction(AUDIT_PATH, async () => {
    await requireActor(USER_ADMIN_ROLES);

    const tokenId = String(formData.get("tokenId") ?? "").trim();
    if (!tokenId) throw new UserFacingError("Token tidak ditemukan.");

    const result = await getPrismaClient().aiApiToken.updateMany({
      where: { id: tokenId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new UserFacingError("Token sudah dicabut atau tidak ditemukan.");

    revalidatePath(AUDIT_PATH);
    return flashMessagePath(AUDIT_PATH, "notice", "Token dicabut. Permintaan berikutnya dengan token ini akan ditolak.");
  });
}
