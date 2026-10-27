"use client";

import { useEffect, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import { isAutoRefreshRoute } from "@/lib/auto-refresh";

/**
 * Penanda bahwa user sedang membuka sesuatu yang bisa hilang kalau halaman
 * di-refresh: dialog/sheet, menu dropdown, atau elemen yang diberi atribut
 * `data-auto-refresh-pause` (dipakai form/dialog yang butuh perlindungan ekstra).
 */
const BUSY_SELECTOR = [
  "[data-auto-refresh-pause]",
  '[data-slot="dialog-content"]',
  '[data-slot="sheet-content"]',
  '[data-slot="dropdown-menu-content"]',
  '[data-slot="dropdown-menu-sub-content"]',
  "dialog[open]",
].join(",");

const FIELD_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isEditingField(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  return FIELD_TAGS.has(element.tagName);
}

/**
 * Refresh dilewati saat user sedang berinteraksi dengan halaman: ada dialog/menu
 * terbuka, fokus ada di kolom input, atau komponen menandai dirinya dengan
 * `data-auto-refresh-pause`. Dengan begitu refresh tidak pernah menutup dialog
 * atau menghapus isian yang sedang diketik.
 */
function isUserBusy() {
  if (document.querySelector(BUSY_SELECTOR)) return true;
  return isEditingField(document.activeElement);
}

/**
 * Menyegarkan Server Component secara berkala supaya perubahan dari user lain
 * tetap terlihat tanpa reload manual.
 *
 * Hanya berjalan di halaman yang terdaftar di `lib/auto-refresh.ts`; halaman
 * berisi form/checkbox tidak pernah di-refresh otomatis karena bisa mereset
 * isian yang sedang dikerjakan user. Refresh juga dilewati saat tab tidak
 * terlihat, saat refresh sebelumnya belum selesai, dan saat user sedang mengisi
 * form/membuka dialog. Begitu tab kembali aktif, refresh diulang.
 */
export function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const enabled = isAutoRefreshRoute(pathname);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled) return;

    const refresh = () => {
      if (document.visibilityState !== "visible" || pending || isUserBusy()) return;
      startTransition(() => router.refresh());
    };

    const interval = window.setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [enabled, intervalMs, pending, router, startTransition]);

  return null;
}
