"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Memberi tinggi pasti pada area tabel = sisa ruang layar setelah header,
 * filter, dan elemen lain di atasnya. Dengan begitu hanya isi tabel yang
 * bergulir: header (sticky) dan pagination (footer) tetap terlihat, dan kartu
 * tabel memenuhi sisa halaman tanpa ruang kosong di bawahnya.
 *
 * Tinggi diukur dari posisi dokumen elemen ini, bukan posisi viewport, supaya
 * nilainya tetap sama saat halaman sudah digulir.
 */
export function TableViewport({
  children,
  className,
  minHeight = 0,
  bottomGap = 32,
  style,
}: {
  children: ReactNode;
  className?: string;
  /**
   * Batas bawah tinggi. Bawaannya 0: area tabel harus boleh menyusut agar
   * seluruh kartu (header + tabel + pagination) tetap muat di layar tanpa
   * memaksa halaman ikut tergulir.
   */
  minHeight?: number;
  /** Jarak aman di bawah kartu (px). */
  bottomGap?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const documentTop = element.getBoundingClientRect().top + window.scrollY;
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const next = Math.max(minHeight, Math.floor(viewportHeight - documentTop - bottomGap));
        setHeight((current) => (current === next ? current : next));
      });
    };

    measure();
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    // Pantau body dan induk langsung: tinggi bagian di atas tabel (mis. banner
    // atau flash message) bisa berubah setelah render dan menggeser tabel.
    observer.observe(document.body);
    if (element.parentElement) observer.observe(element.parentElement);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [bottomGap, minHeight]);

  return (
    <div
      ref={ref}
      className={cn("flex min-h-0 min-w-0 flex-col", className)}
      // `flex: 0 0 auto` mengunci tinggi terukur. Tanpa ini, `flex-1` dari
      // pemanggil menimpa tinggi tersebut dan kartu tabel kembali memanjang,
      // sehingga footer ikut tergulir bersama halaman.
      style={{ ...(height ? { height, flex: "0 0 auto" } : null), ...style }}
    >
      {children}
    </div>
  );
}
