"use client";

import { useEffect } from "react";

import type { Brand } from "@/lib/brand/config";
import { brandDataAttribute } from "@/lib/brand/config";

/**
 * Menyalin brand aktif ke `<html data-brand>` agar portal (dialog, sheet,
 * dropdown, toast) yang dirender di luar pohon AppShell tetap memakai tema
 * brand yang sama. Atribut di AppShell sudah benar sejak HTML pertama; ini
 * hanya menyusul untuk elemen portal setelah hidrasi.
 */
export function BrandThemeAttribute({ brand }: { brand: Brand }) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.brand;
    root.dataset.brand = brandDataAttribute(brand);
    return () => {
      if (previous) root.dataset.brand = previous;
      else delete root.dataset.brand;
    };
  }, [brand]);

  return null;
}
