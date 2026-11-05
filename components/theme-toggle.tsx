"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Switch } from "@/components/ui/switch";
import {
  notifyUiPreferencesChanged,
  subscribeToUiPreferences,
  THEME_DARK,
  THEME_LIGHT,
  THEME_STORAGE_KEY,
} from "@/lib/ui-preferences";

const getDarkSnapshot = () => document.documentElement.classList.contains(THEME_DARK);
const getServerDarkSnapshot = () => false;

/**
 * Tema diterapkan pada <html> supaya dialog, popover, dan portal ikut berubah.
 * Pilihan disimpan di localStorage dan dipulihkan sebelum paint oleh script
 * di root layout, jadi tidak ada kedipan tema terang saat halaman dimuat.
 */
export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribeToUiPreferences,
    getDarkSnapshot,
    getServerDarkSnapshot,
  );

  function setTheme(nextDark: boolean) {
    document.documentElement.classList.toggle(THEME_DARK, nextDark);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextDark ? THEME_DARK : THEME_LIGHT);
    } catch {
      // Preferensi gagal disimpan, tetapi tema tetap berlaku pada sesi ini.
    }
    notifyUiPreferencesChanged();
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
          {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">Mode gelap</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Gunakan tema gelap di seluruh aplikasi. Preferensi disimpan di browser ini.
          </p>
        </div>
      </div>
      <Switch checked={dark} onCheckedChange={setTheme} aria-label="Aktifkan mode gelap" />
    </div>
  );
}
