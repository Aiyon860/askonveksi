import { createHmac, timingSafeEqual } from "node:crypto";

import { BRAND_COOKIE, isBrand, type Brand } from "./config";

/**
 * Cookie brand aktif ditandatangani HMAC dan diikat ke auth user id.
 * Tujuannya bukan menggantikan sesi Supabase, melainkan mencegah user biasa
 * mengganti cookie manual untuk membaca data brand lain.
 */
function secret() {
  return (
    process.env.BRAND_COOKIE_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    "askonveksi-local-brand-cookie-secret"
  );
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export const BRAND_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function serializeBrandCookie(brand: Brand, userId: string) {
  const payload = `${brand}.${userId}`;
  return `${payload}.${signature(payload)}`;
}

/** Mengembalikan brand hanya bila tanda tangan valid dan milik user yang sedang aktif. */
export function parseBrandCookie(raw: string | undefined | null, userId: string | undefined | null): Brand | null {
  if (!raw || !userId) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [brand, cookieUserId, provided] = parts;
  if (!isBrand(brand) || cookieUserId !== userId) return null;

  const expected = signature(`${brand}.${cookieUserId}`);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;
  return brand;
}

export function brandCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BRAND_COOKIE_MAX_AGE,
  };
}

export { BRAND_COOKIE };
