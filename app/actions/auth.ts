"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { flashMessagePath, UserFacingError, runRedirectingAction } from "@/lib/actions/response";
import { landingPathForRole } from "@/lib/auth/landing-path";
import { APP_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { BRAND_COOKIE, canSwitchBrand } from "@/lib/brand/config";
import { brandCookieOptions, parseBrandCookie, serializeBrandCookie } from "@/lib/brand/cookie";
import { firstValidationMessage, loginSchema, updatePasswordSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  return runRedirectingAction("/login", async () => {
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
    });

    if (error || !data.user) {
      throw new UserFacingError("Email atau password tidak cocok.");
    }

    const profile = await getPrismaClient().appUser.findUnique({
      where: { authUserId: data.user.id },
      select: { isActive: true, role: true, brand: true },
    });

    if (!profile?.isActive) {
      await supabase.auth.signOut({ scope: "local" });
      throw new UserFacingError("Akun tidak aktif atau belum terdaftar di aplikasi.");
    }

    // Brand terakhir yang dipakai dipertahankan untuk Owner/Keuangan/Developer.
    // Akun non-switcher selalu dikembalikan ke brand asalnya.
    const cookieStore = await cookies();
    const remembered = canSwitchBrand(profile.role)
      ? parseBrandCookie(cookieStore.get(BRAND_COOKIE)?.value, data.user.id)
      : null;
    cookieStore.set(BRAND_COOKIE, serializeBrandCookie(remembered ?? profile.brand, data.user.id), brandCookieOptions());

    return landingPathForRole(profile.role);
  });
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

export async function updatePasswordAction(formData: FormData) {
  return runRedirectingAction("/account/password", async () => {
    const actor = await requireActor(APP_ROLES);
    const parsed = updatePasswordSchema.safeParse({
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });

    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) throw new UserFacingError("Password belum dapat diperbarui. Silakan coba lagi.");

    await getPrismaClient().auditEvent.create({
      data: {
        actorId: actor.id,
        entityType: "AppUser",
        entityId: actor.id,
        action: "PASSWORD_CHANGED",
        changedFields: ["password"],
      },
    });

    return flashMessagePath(landingPathForRole(actor.role), "notice", "Password berhasil diperbarui.");
  });
}
