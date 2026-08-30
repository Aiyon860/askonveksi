import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getCurrentActor } from "@/lib/auth/session";
import { getFollowUpBadgeCount } from "@/lib/crm/data";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  if (actor.mustChangePassword) redirect("/account/password");
  const followUpCount = await getFollowUpBadgeCount();

  return <AppShell actor={actor} followUpCount={followUpCount}>{children}</AppShell>;
}
