import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getCurrentActor } from "@/lib/auth/session";
import { getFollowUpBadgeCount } from "@/lib/crm/data";
import { getUnreadCustomerReminderCount } from "@/lib/crm/reminder-data";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  if (actor.mustChangePassword) redirect("/account/password");
  const [followUpCount, reminderCount] = await Promise.all([
    getFollowUpBadgeCount(),
    getUnreadCustomerReminderCount(),
  ]);

  return <AppShell actor={actor} followUpCount={followUpCount} reminderCount={reminderCount}>{children}</AppShell>;
}
