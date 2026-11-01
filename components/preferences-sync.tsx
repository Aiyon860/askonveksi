"use client";

import { useLayoutEffect } from "react";

import {
  notifyUiPreferencesChanged,
  SIDEBAR_COLLAPSED,
  SIDEBAR_EXPANDED,
  SIDEBAR_STORAGE_KEY,
  THEME_DARK,
  THEME_LIGHT,
  THEME_STORAGE_KEY,
} from "@/lib/ui-preferences";

/**
 * Script inline di root layout sudah menerapkan preferensi sebelum paint.
 * Komponen ini mengulanginya setelah hydrate agar state tetap benar saat
 * React me-remount <html> di development (Strict Mode) atau setelah soft
 * navigation. Tanpa ini, sidebar/tema bisa kembali ke default.
 */
export function PreferencesSync() {
  useLayoutEffect(() => {
    function apply() {
      try {
        const root = document.documentElement;
        const theme = localStorage.getItem(THEME_STORAGE_KEY);
        if (theme === THEME_DARK) root.classList.add(THEME_DARK);
        else if (theme === THEME_LIGHT) root.classList.remove(THEME_DARK);

        const sidebar = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (sidebar === SIDEBAR_COLLAPSED) root.dataset.sidebar = SIDEBAR_COLLAPSED;
        else if (sidebar === SIDEBAR_EXPANDED) root.dataset.sidebar = SIDEBAR_EXPANDED;
      } catch {
        // localStorage tidak tersedia (mode privat): pakai default terang + sidebar terbuka.
      }
    }

    apply();

    // Sinkronkan tab lain: event `storage` membawa nilai baru, lalu komponen
    // toggle membaca ulang DOM yang sudah diperbarui di sini.
    function onStorage(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY && event.key !== SIDEBAR_STORAGE_KEY) return;
      apply();
      notifyUiPreferencesChanged();
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}
