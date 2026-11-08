"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useSWRConfig } from "swr";

import { switchBrandAction } from "@/app/actions/brand";
import { Switch } from "@/components/ui/switch";
import { BRAND_THEME, brandLabel, type Brand } from "@/lib/brand/config";
import { cn } from "@/lib/utils";

/**
 * Sakelar brand untuk sidebar dan drawer mobile.
 * Hanya dirender untuk OWNER, KEUANGAN, dan DEVELOPER (`actor.canSwitchBrand`).
 * Perpindahan disimpan sebagai cookie bertanda tangan di server.
 */
export function BrandSwitcher({
  brand,
  className,
  compact = false,
}: {
  brand: Brand;
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isSaga = brand === "SAGA";
  const nextBrand: Brand = isSaga ? "ASKONVEKSI" : "SAGA";
  const accent = BRAND_THEME[brand].accent;

  function change(next: boolean) {
    const target: Brand = next ? "SAGA" : "ASKONVEKSI";
    if (target === brand) return;
    setError(null);
    startTransition(async () => {
      const result = await switchBrandAction(target);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Dashboard/analytics/pipeline di-cache SWR tanpa brand di key.
      // Tanpa invalidate, angka brand lama tetap tampil sampai refresh manual.
      await mutate(() => true, undefined, { revalidate: true });
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "brand-switcher rounded-xl border border-nav-line bg-nav-chip/70 px-3 py-2.5 text-nav-ink",
        className,
      )}
      data-brand-switcher={brand.toLowerCase()}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full ring-2 ring-nav-ink/15"
            style={{ backgroundColor: accent }}
          />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-nav-ink-muted">
              Brand aktif
            </p>
            <p className="truncate text-sm font-semibold leading-tight text-nav-ink">
              {brandLabel(brand)}
            </p>
          </div>
        </div>
        <Switch
          checked={isSaga}
          onCheckedChange={change}
          disabled={pending}
          size="sm"
          aria-label={`Ganti ke brand ${brandLabel(nextBrand)}`}
          title={`Ganti ke ${brandLabel(nextBrand)}`}
        />
      </div>
      {!compact ? (
        <p className="mt-1.5 pl-[21px] text-[11px] leading-snug text-nav-ink-muted">
          {pending ? "Berpindah brand..." : `Geser untuk pindah ke ${brandLabel(nextBrand)}.`}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1.5 pl-[21px] text-[11px] font-medium leading-snug text-rose-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
