"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ContactRound, LayoutDashboard, KanbanSquare, UsersRound } from "lucide-react";

import { cn } from "@/lib/utils";

const mainItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/crm", label: "Pipeline", icon: KanbanSquare },
  { href: "/crm/pelanggan", label: "Customer", icon: ContactRound },
] as const;

function isPathWithin(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isNavItemActive(pathname: string, href: string) {
  if (href === "/crm") {
    return pathname === href || isPathWithin(pathname, "/crm/peluang") || isPathWithin(pathname, "/sales-orders");
  }

  return isPathWithin(pathname, href);
}

export function AppNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const items = isOwner
    ? [...mainItems, { href: "/admin/users", label: "Pengguna", icon: UsersRound } as const]
    : mainItems;

  return (
    <nav aria-label="Navigasi utama" className="flex min-w-0 gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
