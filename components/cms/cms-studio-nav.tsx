"use client";

import {
  ArrowLeft,
  ExternalLink,
  History,
  Home,
  Images,
  Layers,
  Mail,
  Ruler,
  Settings2,
  Shirt,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL } from "@/lib/crm/constants";
import { cn } from "@/lib/utils";
import type { AppRole } from "@prisma/client";

const items = [
  { href: "/cms", label: "Ringkasan", icon: Home },
  { href: "/cms/beranda", label: "Beranda", icon: Home },
  { href: "/cms/produk", label: "Produk", icon: Shirt },
  { href: "/cms/portofolio", label: "Portofolio", icon: Images },
  { href: "/cms/size-chart", label: "Size Chart", icon: Ruler },
  { href: "/cms/katalog-kain", label: "Katalog Kain", icon: Layers },
  { href: "/cms/kontak", label: "Halaman Kontak", icon: Mail },
  { href: "/cms/pengaturan", label: "Pengaturan Website", icon: Settings2 },
  { href: "/cms/riwayat", label: "Riwayat Perubahan", icon: History },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/cms") return pathname === "/cms";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CmsStudioNav({
  actorName,
  actorRole,
  variant = "sidebar",
}: {
  actorName: string;
  actorRole: AppRole;
  variant?: "sidebar" | "mobile";
}) {
  const pathname = usePathname();

  if (variant === "mobile") {
    return (
      <nav aria-label="Navigasi studio website" className="flex gap-1 overflow-x-auto px-3 pb-3">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium",
                active ? "bg-nav-chip-strong text-nav-active-ink" : "text-nav-ink hover:bg-nav-chip",
              )}
            >
              <Icon aria-hidden="true" className={cn("size-4", !active && "text-nav-tone-website")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="grid size-9 place-items-center rounded-lg bg-nav-chip-strong text-sm font-semibold text-nav-active-ink">
          AS
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-nav-ink">Studio Website</p>
          <p className="truncate text-xs text-nav-ink-muted">Askonveksi</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-nav-line px-3 py-4">
        <nav aria-label="Navigasi studio website" className="flex flex-col gap-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                  active ? "bg-nav-chip-strong font-semibold text-nav-active-ink" : "text-nav-ink hover:bg-nav-chip",
                )}
              >
                <Icon aria-hidden="true" className={cn("size-4", !active && "text-nav-tone-website")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex flex-col gap-2 border-t border-nav-line p-3">
        <div className="rounded-xl border border-nav-line bg-nav-chip p-3">
          <p className="truncate text-sm font-medium text-nav-ink">{actorName}</p>
          <Badge variant="outline" className="mt-1 border-nav-line bg-transparent text-nav-ink">
            {ROLE_LABEL[actorRole]}
          </Badge>
        </div>
        <Link
          href="/dashboard"
          className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-nav-ink hover:bg-nav-chip"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Kembali ke Aplikasi
        </Link>
        <Link
          href="/"
          target="_blank"
          className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-nav-ink hover:bg-nav-chip"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          Lihat Website
        </Link>
      </div>
    </>
  );
}
