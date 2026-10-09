import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Penanda "Segera Hadir" untuk halaman yang galeri fotonya belum tersedia.
 * Grid di belakang di-blur dan dibuat non-interaktif; card modal permanen
 * (tanpa tombol tutup) tampil di tengah berisi ilustrasi, teks, dan CTA
 * kembali ke beranda. Navbar dan footer tidak terpengaruh karena overlay
 * hanya menutupi area konten yang dibungkus komponen ini.
 */
export function ComingSoonOverlay({ pageName, children }: { pageName: string; children: ReactNode }) {
  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none blur-md select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center p-4 pt-6 sm:pt-10">
        <div
          role="status"
          className="w-full max-w-md rounded-landing-card border border-landing-border bg-landing-card p-6 text-center shadow-[0_12px_28px_rgb(20_37_53/0.14)] sm:p-8"
        >
          <Image
            src="/cooming-soon.svg"
            alt=""
            width={656}
            height={800}
            className="mx-auto h-40 w-auto object-contain sm:h-48"
            priority={false}
          />
          <p className="mt-5 text-2xl font-bold tracking-[-0.025em] text-landing-text sm:text-3xl">
            Segera Hadir
          </p>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-landing-muted sm:text-base sm:leading-7">
            Galeri foto {pageName} sedang kami siapkan. Silakan kembali lagi nanti atau hubungi kami untuk
            melihat hasil produksi terbaru.
          </p>
          <Link
            href="/#beranda"
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-landing-control bg-landing-accent px-5 text-sm font-semibold text-white outline-none transition-colors hover:bg-landing-accent/90 focus-visible:ring-3 focus-visible:ring-landing-accent/30"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
