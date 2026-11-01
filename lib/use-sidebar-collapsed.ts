"use client";

import { useSyncExternalStore } from "react";

import { SIDEBAR_COLLAPSED, subscribeToUiPreferences } from "@/lib/ui-preferences";

const DESKTOP_QUERY = "(min-width: 64rem)";

/**
 * Sidebar hanya collapse di desktop. Di bawah breakpoint `lg`, drawer mobile
 * selalu berlabel, jadi tooltip ikon tidak boleh ikut muncul di sana.
 */
function getSnapshot() {
  return (
    document.documentElement.dataset.sidebar === SIDEBAR_COLLAPSED &&
    window.matchMedia(DESKTOP_QUERY).matches
  );
}

const getServerSnapshot = () => false;

function subscribe(onChange: () => void) {
  const unsubscribePreferences = subscribeToUiPreferences(onChange);
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => {
    unsubscribePreferences();
    media.removeEventListener("change", onChange);
  };
}

export function useSidebarCollapsed() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
