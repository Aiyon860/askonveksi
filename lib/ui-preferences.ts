/**
 * Satu sumber untuk preferensi tampilan yang dipersist di browser.
 * Script pre-paint di root layout memakai kunci yang sama, jadi nilai di sini
 * tidak boleh diubah tanpa mengubah kedua sisi sekaligus.
 */
export const THEME_STORAGE_KEY = "askonveksi-theme";
export const SIDEBAR_STORAGE_KEY = "askonveksi-sidebar";

export const THEME_LIGHT = "light";
export const THEME_DARK = "dark";

export const SIDEBAR_EXPANDED = "expanded";
export const SIDEBAR_COLLAPSED = "collapsed";

export type ThemePreference = typeof THEME_LIGHT | typeof THEME_DARK;
export type SidebarPreference = typeof SIDEBAR_EXPANDED | typeof SIDEBAR_COLLAPSED;

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === THEME_LIGHT || value === THEME_DARK;
}

export function isSidebarPreference(value: string | null): value is SidebarPreference {
  return value === SIDEBAR_EXPANDED || value === SIDEBAR_COLLAPSED;
}

/**
 * Preferensi disimpan di DOM (<html>) agar script pre-paint, CSS, dan React
 * membaca sumber yang sama. Event ini memberi tahu komponen klien bahwa
 * nilainya berubah, termasuk perubahan dari tab lain lewat event `storage`.
 */
export const UI_PREFERENCES_EVENT = "askonveksi:preferences";

export function subscribeToUiPreferences(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(UI_PREFERENCES_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(UI_PREFERENCES_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function notifyUiPreferencesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UI_PREFERENCES_EVENT));
}
