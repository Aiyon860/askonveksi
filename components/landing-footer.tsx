import Image from "next/image";
import Link from "next/link";

import { LandingReveal } from "@/components/landing-motion";

const footerLinks = [
  { href: "#beranda", label: "Beranda" },
  { href: "#tentang-kami", label: "Tentang Kami" },
  { href: "#produk", label: "Produk" },
  { href: "#testimoni", label: "Testimoni" },
  { href: "#kontak", label: "Kontak" },
] as const;

export function LandingFooter() {
  return (
    <footer className="bg-[#071d32] text-white">
      <div className="mx-auto w-[90%] py-7 sm:py-8">
        <LandingReveal className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <Link href="#beranda" aria-label="Askonveksi, kembali ke beranda" className="flex w-fit items-center gap-3 rounded-landing-control outline-none focus-visible:ring-2 focus-visible:ring-white/80">
            <Image src="/brand/askonveksi-mark.png" alt="" width={494} height={410} className="h-10 w-auto object-contain" />
            <span className="leading-none">
              <span className="block text-base font-semibold tracking-[-0.02em]">Askonveksi</span>
              <span className="mt-1 block text-sm text-white/60">Custom Uniform &amp; Apparel</span>
            </span>
          </Link>

          <nav aria-label="Navigasi footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 lg:justify-center">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-flex min-h-11 items-center text-sm font-medium text-white/75 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-4" aria-label="Media sosial Askonveksi">
            <a
              href="https://www.instagram.com/askonveksi_/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram Askonveksi"
              className="flex size-11 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current">
                <path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6Zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
              </svg>
            </a>
            <span title="Facebook Askonveksi" className="flex size-11 items-center justify-center text-white/75">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.024 1.792-4.694 4.533-4.694 1.312 0 2.686.236 2.686.236v2.973H15.83c-1.491 0-1.956.931-1.956 1.887v2.258h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z" />
              </svg>
            </span>
            <span title="YouTube Askonveksi" className="flex size-11 items-center justify-center text-white/75">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
              </svg>
            </span>
          </div>
        </LandingReveal>

        <LandingReveal className="mt-5 flex flex-col gap-2 border-t border-white/15 pt-5 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between" delay={0.08}>
          <p>© {new Date().getFullYear()} Askonveksi. All rights reserved.</p>
          <p>Konveksi di Semarang untuk Seragam dan Apparel Custom</p>
        </LandingReveal>
      </div>
    </footer>
  );
}
