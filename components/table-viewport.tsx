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
  minHeight = 352,
  bottomGap = 24,
  style,
}: {
  children: ReactNode;
  className?: string;
  /** Batas bawah tinggi supaya tabel tetap terpakai di layar pendek. */
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
    observer.observe(document.body);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [bottomGap, minHeight]);

  return (
    <div
      ref={ref}
      className={cn("flex min-h-[22rem] min-w-0 flex-col", className)}
      style={{ ...(height ? { height } : null), ...style }}
    >
      {children}
    </div>
  );
}
