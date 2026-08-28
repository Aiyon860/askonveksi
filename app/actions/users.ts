"use server";

import { Prisma } from "@prisma/client";

import { flashMessagePath, UserFacingError, runRedirectingAction } from "@/lib/actions/response";
import { USER_ADMIN_ROLES } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { createUserSchema, firstValidationMessage, toggleUserSchema, updateUserSchema } from "@/lib/crm/validation";
import { getPrismaClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

function usersReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length > 1_000) return "/admin/users";

  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost" || url.pathname !== "/admin/users") return "/admin/users";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/admin/users";
  }
}

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

export async function updateUserAction(formData: FormData) {
  const returnTo = usersReturnPath(formData.get("returnTo"));

  return runRedirectingAction(returnTo, async () => {
    const actor = await requireActor(USER_ADMIN_ROLES);
    const parsed = updateUserSchema.safeParse({
      userId: formData.get("userId"),
      updatedAt: formData.get("updatedAt"),
      name: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role"),
    });

    if (!parsed.success) throw new UserFacingError(firstValidationMessage(parsed.error));

    const prisma = getPrismaClient();
    const target = await prisma.appUser.findUnique({
      where: { id: parsed.data.userId },
      select: {
        id: true,
        authUserId: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
    if (!target) throw new UserFacingError("Pengguna tidak ditemukan.");
    if (target.updatedAt.toISOString() !== parsed.data.updatedAt) {
      throw new UserFacingError("Data pengguna sudah berubah. Muat ulang lalu coba lagi.");
    }

    const email = parsed.data.email.toLowerCase();
    const changedFields = [
      ...(target.name !== parsed.data.name ? ["name"] : []),
      ...(target.email !== email ? ["email"] : []),
      ...(target.role !== parsed.data.role ? ["role"] : []),
    ];
    if (!changedFields.length) return flashMessagePath(returnTo, "notice", "Tidak ada perubahan pengguna.");

    if (target.id === actor.id && (target.email !== email || target.role !== parsed.data.role)) {
      throw new UserFacingError("Email dan role akun sendiri tidak dapat diubah dari halaman ini.");
    }

    if (target.email !== email) {
      const duplicate = await prisma.appUser.findUnique({ where: { email }, select: { id: true } });
      if (duplicate && duplicate.id !== target.id) throw new UserFacingError("Email sudah digunakan pengguna lain.");
    }

    const roleWillChange = target.role !== parsed.data.role;
    const emailWillChange = target.email !== email;
    const admin = emailWillChange ? createAdminClient() : null;

    if (admin) {
      const { error } = await admin.auth.admin.updateUserById(target.authUserId, { email });
      if (error) throw new UserFacingError("Email Auth tidak dapat diperbarui. Pastikan email belum digunakan.");
    }

    try {
      await prisma.$transaction(
        async (tx) => {
          if (target.role === "OWNER" && target.isActive && parsed.data.role !== "OWNER") {
            const activeOwners = await tx.appUser.count({ where: { role: "OWNER", isActive: true } });
            if (activeOwners <= 1) throw new UserFacingError("Minimal satu Owner harus tetap aktif.");
          }

          const updated = await tx.appUser.updateMany({
            where: { id: target.id, updatedAt: target.updatedAt },
            data: { name: parsed.data.name, email, role: parsed.data.role },
          });
          if (updated.count !== 1) throw new UserFacingError("Data pengguna sudah berubah. Muat ulang lalu coba lagi.");

          await tx.auditEvent.create({
            data: {
              actorId: actor.id,
              entityType: "AppUser",
              entityId: target.id,
              action: "USER_UPDATED",
              changedFields,
              ...(roleWillChange ? { metadata: { previousRole: target.role, role: parsed.data.role } } : {}),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (databaseError) {
      if (admin) await admin.auth.admin.updateUserById(target.authUserId, { email: target.email });
      throw databaseError;
    }

    return flashMessagePath(returnTo, "notice", "Pengguna berhasil diperbarui.");
  });
}

export async function toggleUserActiveAction(formData: FormData) {
  const returnTo = usersReturnPath(formData.get("returnTo"));

  return runRedirectingAction(returnTo, async () => {
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

    return flashMessagePath(returnTo, "notice", parsed.data.isActive ? "Pengguna diaktifkan." : "Pengguna dinonaktifkan.");
  });
}
