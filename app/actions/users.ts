"use server";

import { Prisma } from "@prisma/client";

import { flashMessagePath, UserFacingError, runRedirectingAction } from "@/lib/actions/response";
import { USER_ADMIN_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { createUserSchema, firstValidationMessage, toggleUserSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createUserAction(formData: FormData) {
  return runRedirectingAction("/admin/users", async () => {
    const actor = await requireActor(USER_ADMIN_ROLES);
    const parsed = createUserSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role"),
      temporaryPassword: formData.get("temporaryPassword"),
    });

    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const admin = createAdminClient();
    const email = parsed.data.email.toLowerCase();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: parsed.data.temporaryPassword,
      email_confirm: true,
    });

    if (error || !data.user) {
      throw new UserFacingError("Akun Auth tidak dapat dibuat. Pastikan email belum terdaftar.");
    }

    try {
      const prisma = getPrismaClient();
      await prisma.$transaction(async (tx) => {
        const created = await tx.appUser.create({
          data: {
            authUserId: data.user.id,
            email,
            name: parsed.data.name,
            role: parsed.data.role,
            isActive: true,
            mustChangePassword: true,
          },
          select: { id: true },
        });

        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            entityType: "AppUser",
            entityId: created.id,
            action: "USER_CREATED",
            changedFields: ["email", "name", "role", "isActive", "mustChangePassword"],
            metadata: { role: parsed.data.role },
          },
        });
      });
    } catch (databaseError) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw databaseError;
    }

    return flashMessagePath("/admin/users", "notice", "Pengguna berhasil dibuat.");
  });
}

export async function toggleUserActiveAction(formData: FormData) {
  return runRedirectingAction("/admin/users", async () => {
    const actor = await requireActor(USER_ADMIN_ROLES);
    const parsed = toggleUserSchema.safeParse({
      userId: formData.get("userId"),
      isActive: formData.get("isActive"),
    });

    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));
    if (parsed.data.userId === actor.id && !parsed.data.isActive) {
      throw new UserFacingError("Anda tidak dapat menonaktifkan akun sendiri.");
    }

    const prisma = getPrismaClient();
    await prisma.$transaction(
      async (tx) => {
        const target = await tx.appUser.findUnique({
          where: { id: parsed.data.userId },
          select: { id: true, role: true, isActive: true },
        });
        if (!target) throw new UserFacingError("Pengguna tidak ditemukan.");

        if (target.role === "OWNER" && target.isActive && !parsed.data.isActive) {
          const activeOwners = await tx.appUser.count({ where: { role: "OWNER", isActive: true } });
          if (activeOwners <= 1) throw new UserFacingError("Minimal satu Owner harus tetap aktif.");
        }

        await tx.appUser.update({
          where: { id: target.id },
          data: { isActive: parsed.data.isActive },
        });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            entityType: "AppUser",
            entityId: target.id,
            action: parsed.data.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
            changedFields: ["isActive"],
            metadata: { isActive: parsed.data.isActive },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return flashMessagePath("/admin/users", "notice", parsed.data.isActive ? "Pengguna diaktifkan." : "Pengguna dinonaktifkan.");
  });
}
