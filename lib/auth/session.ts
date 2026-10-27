import "server-only";

import type { AppRole } from "@prisma/client";
import { forbidden } from "next/navigation";
import { cache } from "react";

import { getPrismaClient } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

import { CRM_ROLES, hasRole } from "./permissions";

export type Actor = {
  id: string;
  authUserId: string;
  email: string;
  name: string;
  role: AppRole;
};

/** Ditolak karena role, bukan karena sesi habis. Dipetakan ke 403, bukan 500. */
export class AccessDeniedError extends Error {
  // Pesan dipertahankan "UNAUTHORIZED" agar pemeriksaan lama di route/aksi
  // (yang memetakannya ke 403) tetap bekerja tanpa diubah satu per satu.
  constructor(message = "UNAUTHORIZED") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const authUserId = data?.claims?.sub;

  if (error || typeof authUserId !== "string") {
    return null;
  }

  // Gangguan sesaat ke pooler (timeout/connect) tidak boleh merobohkan halaman:
  // kontrak fungsi ini Actor | null, jadi kegagalan baca = anggap belum masuk.
  let actor: { id: string; authUserId: string; email: string; name: string; role: AppRole; isActive: boolean } | null;
  try {
    actor = await getPrismaClient().appUser.findUnique({
      where: { authUserId },
      select: {
        id: true,
        authUserId: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });
  } catch {
    return null;
  }

  if (!actor?.isActive) {
    return null;
  }

  return {
    id: actor.id,
    authUserId: actor.authUserId,
    email: actor.email,
    name: actor.name,
    role: actor.role,
  };
});

export async function requireActor(
  allowedRoles: readonly AppRole[] = CRM_ROLES,
) {
  const actor = await getCurrentActor();

  if (!actor || !hasRole(actor.role, allowedRoles)) {
    throw new AccessDeniedError();
  }

  return actor;
}

/**
 * Guard untuk Server Component / halaman: kegagalan akses dirender sebagai
 * halaman 403 buatan sendiri (bukan error bawaan Next).
 */
export async function requirePageActor(
  allowedRoles: readonly AppRole[] = CRM_ROLES,
) {
  try {
    return await requireActor(allowedRoles);
  } catch (error) {
    if (error instanceof AccessDeniedError) forbidden();
    throw error;
  }
}

export async function requireDeveloperActor() {
  const actor = await getCurrentActor();

  if (!actor || actor.role !== "DEVELOPER") {
    throw new AccessDeniedError();
  }

  return actor;
}
