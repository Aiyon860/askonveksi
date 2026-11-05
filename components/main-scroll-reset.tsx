"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

/**
 * Sejak desktop memakai <main> sebagai kontainer gulir, scroll dokumen tidak
 * lagi kembali ke atas saat pindah halaman. Komponen ini mengembalikan posisi
 * area konten ke atas agar halaman baru selalu dibuka dari judulnya.
 */
export function MainScrollReset() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const element = document.querySelector<HTMLElement>("[data-app-scroll]");
    if (element) element.scrollTop = 0;
  }, [pathname]);

  return null;
}
