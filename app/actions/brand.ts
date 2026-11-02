"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getCurrentActor } from "@/lib/auth/session";
import { BRAND_COOKIE, isBrand, type Brand } from "@/lib/brand/config";
import { brandCookieOptions, serializeBrandCookie } from "@/lib/brand/cookie";

export type SwitchBrandResult =
  | { ok: true; brand: Brand }
  | { ok: false; message: string };

/**
 * Mengganti brand aktif. Hanya OWNER, KEUANGAN, dan DEVELOPER yang boleh.
 * Cookie ditandatangani dan diikat ke auth user id, jadi tidak bisa dipalsukan
 * oleh akun yang tidak berhak.
 */
export async function switchBrandAction(nextBrand: unknown): Promise<SwitchBrandResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, message: "Sesi Anda sudah berakhir. Silakan masuk lagi." };
  if (!actor.canSwitchBrand) return { ok: false, message: "Akun Anda tidak memiliki akses untuk berpindah brand." };
  if (!isBrand(nextBrand)) return { ok: false, message: "Brand tidak dikenal." };

  const cookieStore = await cookies();
  cookieStore.set(BRAND_COOKIE, serializeBrandCookie(nextBrand, actor.authUserId), brandCookieOptions());

  // Tema dan seluruh data brand ikut berganti pada render berikutnya.
  revalidatePath("/", "layout");
  return { ok: true, brand: nextBrand };
}
