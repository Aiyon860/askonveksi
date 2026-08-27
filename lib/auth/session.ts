import "server-only";

import type { AppRole } from "@prisma/client";
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
  mustChangePassword: boolean;
};

export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const authUserId = data?.claims?.sub;

  if (error || typeof authUserId !== "string") {
    return null;
  }

  const actor = await getPrismaClient().appUser.findUnique({
    where: { authUserId },
    select: {
      id: true,
      authUserId: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
    },
  });

  if (!actor?.isActive) {
    return null;
  }

  return {
    id: actor.id,
    authUserId: actor.authUserId,
    email: actor.email,
    name: actor.name,
    role: actor.role,
    mustChangePassword: actor.mustChangePassword,
  };
});

export async function requireActor(
  allowedRoles: readonly AppRole[] = CRM_ROLES,
  options: { allowPasswordChange?: boolean } = {},
) {
  const actor = await getCurrentActor();

  if (!actor || !hasRole(actor.role, allowedRoles)) {
    throw new Error("UNAUTHORIZED");
  }
  if (actor.mustChangePassword && !options.allowPasswordChange) {
    throw new Error("PASSWORD_CHANGE_REQUIRED");
  }

  return actor;
}
