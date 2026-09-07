import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getCurrentActor } from "@/lib/auth/session";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  if (actor.mustChangePassword) redirect("/account/password");

  return <AppShell actor={actor}>{children}</AppShell>;
}
