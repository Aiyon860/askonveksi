"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  notifyUiPreferencesChanged,
  SIDEBAR_COLLAPSED,
  SIDEBAR_EXPANDED,
  SIDEBAR_STORAGE_KEY,
} from "@/lib/ui-preferences";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";

/**
 * Hanya mengubah atribut `data-sidebar` di <html>; lebar grid dan tampilan
 * ikon diatur CSS. Dengan begitu sidebar tidak perlu dirender ulang dan
 * layout konten ikut menyesuaikan tanpa pergeseran manual.
 */
export function SidebarCollapseToggle() {
  // DOM adalah sumber kebenaran yang sama dengan script pre-paint dan CSS,
  // jadi state tidak bisa berbeda dengan tampilan yang sudah dilihat user.
  const collapsed = useSidebarCollapsed();

  function toggleSidebar() {
    const next = !collapsed;
    const root = document.documentElement;
    root.dataset.sidebar = next ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED);
    } catch {
      // Preferensi gagal disimpan, tetapi sidebar tetap bekerja pada sesi ini.
    }
    notifyUiPreferencesChanged();
  }

  const label = collapsed ? "Bentangkan sidebar" : "Ciutkan sidebar";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            aria-controls="app-sidebar"
            aria-expanded={!collapsed}
            aria-label={label}
            className="app-sidebar-toggle shrink-0 text-nav-ink hover:bg-nav-chip focus-visible:ring-nav-chip-strong"
          >
            {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </Button>
        }
      />
      <TooltipContent side="right" sideOffset={8} className="px-3 py-1.5 text-xs font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
