import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";

import { CmsStudioNav } from "@/components/cms/cms-studio-nav";
import { CmsStudioHeader } from "@/components/cms/cms-studio-header";
import { CMS_ROLES, hasRole } from "@/lib/auth/permissions";
import { getCurrentActor } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Kelola Website",
    template: "%s | Kelola Website",
  },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default async function CmsLayout({ children }: { children: ReactNode }) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  if (!hasRole(actor.role, CMS_ROLES)) notFound();

  return (
    <div className="min-h-svh w-full max-w-full overflow-x-clip bg-app-canvas lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
      <aside className="nav-surface sticky top-0 hidden h-svh self-start flex-col border-r border-nav-line text-nav-ink lg:flex">
        <CmsStudioNav actorName={actor.name} actorRole={actor.role} />
      </aside>
      <main className="min-w-0 overflow-x-clip">
        <CmsStudioHeader actorName={actor.name} actorRole={actor.role} />
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
