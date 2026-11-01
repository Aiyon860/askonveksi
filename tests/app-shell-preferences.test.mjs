import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("sidebar default terbuka dan preferensi diterapkan sebelum paint", async () => {
  const [layout, shell, toggle, preferences] = await Promise.all([
    read("app/layout.tsx"),
    read("components/app-shell.tsx"),
    read("components/sidebar-collapse-toggle.tsx"),
    read("lib/ui-preferences.ts"),
  ]);

  // Default di server adalah terbuka: atribut collapsed tidak pernah ditulis
  // langsung di <html>, hanya oleh script yang membaca localStorage.
  assert.doesNotMatch(layout, /<html[^>]*data-sidebar/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.match(layout, /PRE_PAINT_PREFERENCES/);
  assert.match(layout, /SIDEBAR_STORAGE_KEY/);
  assert.match(layout, /THEME_STORAGE_KEY/);

  // Lebar kolom mengikuti CSS variable supaya sidebar dan konten bergerak bersama.
  assert.match(shell, /lg:flex/);
  assert.doesNotMatch(shell, /lg:grid-cols-/);
  assert.match(shell, /id="app-sidebar"/);
  assert.match(shell, /<SidebarCollapseToggle \/>/);

  // Konten memakai lebar penuh dan area desktop menggulir sendiri, bukan
  // dokumen, sehingga halaman tidak bisa melewati tinggi layar.
  assert.doesNotMatch(shell, /max-w-\[1600px\]/);
  assert.match(shell, /data-app-scroll/);
  assert.match(shell, /lg:h-svh lg:min-h-0 lg:flex-1 lg:overflow-y-auto/);
  assert.match(shell, /lg:h-svh lg:overflow-hidden/);
  assert.match(shell, /<MainScrollReset \/>/);

  // Toggle menulis atribut yang sama dengan yang dibaca script dan CSS.
  assert.match(toggle, /SIDEBAR_COLLAPSED/);
  assert.match(toggle, /SIDEBAR_STORAGE_KEY/);
  assert.match(toggle, /aria-expanded=\{!collapsed\}/);
  assert.match(toggle, /aria-label=\{label\}/);
  assert.match(preferences, /SIDEBAR_COLLAPSED = "collapsed"/);
  assert.match(preferences, /THEME_DARK = "dark"/);
});

test("label sidebar disembunyikan visual tanpa hilang dari screen reader", async () => {
  const [nav, css] = await Promise.all([read("components/app-nav.tsx"), read("app/globals.css")]);

  assert.match(nav, /className="nav-label"/);
  assert.match(nav, /nav-group-label/);
  assert.match(nav, /nav-group-header/);

  // Hanya desktop dan hanya sidebar aplikasi: drawer mobile tetap berlabel.
  assert.match(css, /@media \(min-width: 64rem\)/);
  assert.match(css, /html\[data-sidebar="collapsed"\] \.app-sidebar-nav \.nav-link/);
  assert.match(css, /clip-path: inset\(50%\)/);
  assert.match(css, /--app-sidebar-width: 4\.75rem/);

  // Animasi memakai width (bukan grid-template-columns) agar tidak reflow tiap frame.
  assert.match(css, /\.app-sidebar \{[^}]*width: var\(--app-sidebar-width, 15rem\)[^}]*transition: width 200ms/);
  assert.doesNotMatch(css, /transition: grid-template-columns/);

  // Ikon grup (penanda, bukan tombol) lebih kecil/redup daripada ikon menu.
  assert.match(css, /html\[data-sidebar="collapsed"\] \.nav-group-header svg \{[^}]*width: 0\.6875rem/);
  assert.match(css, /html\[data-sidebar="collapsed"\] \.app-sidebar-nav \.nav-link svg \{[^}]*width: 1\.25rem/);
  assert.match(css, /html\[data-sidebar="collapsed"\] \.nav-group-header \{[^}]*cursor: default/);
});

test("tooltip sidebar muncul saat collapse dan tidak terpotong sidebar", async () => {
  const [nav, toggle, tooltip, shell] = await Promise.all([
    read("components/app-nav.tsx"),
    read("components/sidebar-collapse-toggle.tsx"),
    read("components/ui/tooltip.tsx"),
    read("components/app-shell.tsx"),
  ]);

  // Tooltip hanya untuk ikon menu/grup saat sidebar desktop diciutkan.
  assert.match(nav, /useSidebarCollapsed/);
  assert.match(nav, /if \(!collapsed\) return link;/);
  assert.match(nav, /<TooltipTrigger render=\{link\} \/>/);
  assert.match(nav, /<TooltipTrigger render=\{header\} \/>/);
  assert.match(nav, /Kelompok menu/);
  assert.match(nav, /item perlu diperiksa/);
  assert.match(nav, /side="right" sideOffset=\{10\}/);

  // Tombol collapse juga memakai tooltip, dan provider memberi delay nyaman.
  assert.match(toggle, /<TooltipContent side="right" sideOffset=\{8\}/);
  assert.match(shell, /<TooltipProvider delay=\{220\} closeDelay=\{0\} timeout=\{300\}>/);

  // Tooltip memakai portal Base UI supaya tidak terpotong overflow sidebar.
  assert.match(tooltip, /@base-ui\/react\/tooltip/);
  assert.match(tooltip, /TooltipPrimitive\.Portal/);
  assert.match(tooltip, /from "@\/lib\/utils"/);
  assert.doesNotMatch(tooltip, /from "cn"/);
});

test("TableViewport mengukur terhadap kontainer scroll konten desktop", async () => {
  const viewport = await read("components/table-viewport.tsx");
  assert.match(viewport, /closest<HTMLElement>\("\[data-app-scroll\]"\)/);
  assert.match(viewport, /scroller\.clientHeight/);
  assert.match(viewport, /elementRect\.top - scroller\.getBoundingClientRect\(\)\.top \+ scroller\.scrollTop/);
  // Ukur ulang setelah resize berhenti supaya animasi sidebar tidak memicu
  // setState dan render ulang tabel setiap frame.
  assert.match(viewport, /settleTimer = window\.setTimeout\(measure, 120\)/);
  assert.match(viewport, /scheduleMeasure\(true\)/);
});

test("pengaturan menyediakan toggle tema dan menyimpannya di browser", async () => {
  const [page, toggle] = await Promise.all([
    read("app/(app)/settings/page.tsx"),
    read("components/theme-toggle.tsx"),
  ]);

  assert.match(page, /<ThemeToggle \/>/);
  assert.match(page, /<CardTitle>Tampilan<\/CardTitle>/);
  assert.match(toggle, /classList\.toggle\(THEME_DARK, nextDark\)/);
  assert.match(toggle, /localStorage\.setItem\(THEME_STORAGE_KEY/);
  assert.match(toggle, /<Switch checked=\{dark\} onCheckedChange=\{setTheme\}/);
});
