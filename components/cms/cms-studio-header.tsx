import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { AppRole } from "@prisma/client";

import { CmsStudioNav } from "@/components/cms/cms-studio-nav";

export function CmsStudioHeader({ actorName, actorRole }: { actorName: string; actorRole: AppRole }) {
  return (
    <header className="nav-surface sticky top-0 z-40 border-b border-nav-line text-nav-ink lg:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-nav-chip-strong text-xs font-semibold text-nav-active-ink">
            AS
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Studio Website</p>
            <p className="truncate text-[11px] text-nav-ink-muted">{actorName}</p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-nav-ink hover:bg-nav-chip"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Aplikasi
        </Link>
      </div>
      <CmsStudioNav actorName={actorName} actorRole={actorRole} variant="mobile" />
    </header>
  );
}
