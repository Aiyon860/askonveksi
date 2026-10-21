import Image from "next/image";
import Link from "next/link";

import { LandingReveal } from "@/components/landing-motion";
import { RichText } from "@/components/rich-text";
import type { CmsProductMenuEntry } from "@/lib/cms/selectors";
import type { CmsFooter } from "@/lib/cms/types";

const PRODUCT_GROUPS = (menu: CmsProductMenuEntry[]) => menu.filter((entry) => "children" in entry);
const PRODUCT_SINGLES = (menu: CmsProductMenuEntry[]) => menu.filter((entry) => !("children" in entry));

const footerLinkClassName =
  "inline-flex min-h-10 items-center text-sm text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

function SocialIcon({ platform }: { platform: string }) {
  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current">
        <path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6Zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      </svg>
    );
  }
  if (platform === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.024 1.792-4.694 4.533-4.694 1.312 0 2.686.236 2.686.236v2.973H15.83c-1.491 0-1.956.931-1.956 1.887v2.258h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
    </svg>
  );
}

export function LandingFooter({
  footer,
  menu,
  brandName,
  logoSrc,
  logoUnoptimized = false,
}: {
  footer: CmsFooter;
  menu: CmsProductMenuEntry[];
  brandName: string;
  logoSrc: string;
  logoUnoptimized?: boolean;
}) {
  return (
    <footer className="bg-[#071d32] text-white">
      <div className="mx-auto w-[90%] py-10 sm:py-12">
        <LandingReveal className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,0.8fr)] lg:gap-12">
          <div className="flex flex-col gap-5">
            <Link
              href="/#beranda"
              aria-label={`${brandName}, kembali ke beranda`}
              className="flex w-fit items-center gap-3 rounded-landing-control outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            >
              <span className="rounded-2xl bg-white px-3 py-2">
                <Image
                  src={logoSrc}
                  alt={brandName}
                  width={1920}
                  height={1080}
                  className="h-10 w-auto object-contain"
                  unoptimized={logoUnoptimized}
                />
              </span>
            </Link>
            <RichText html={footer.description} className="max-w-xs text-sm leading-6 text-white/60" />
            <div className="flex items-center gap-2" aria-label={`Media sosial ${brandName}`}>
              {footer.socials
                .filter((social) => social.visible && social.url.trim())
                .map((social) => (
                  <a
                    key={social.platform}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${social.platform} ${brandName}`}
                    className="flex size-11 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <SocialIcon platform={social.platform} />
                  </a>
                ))}
            </div>
          </div>

          <nav aria-label={`Produk ${brandName}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">{footer.productTitle}</p>
            <div className="mt-4 grid grid-cols-1 gap-7 min-[420px]:grid-cols-2">
              <ul className="flex flex-col gap-5">
                {PRODUCT_GROUPS(menu).map((entry) =>
                  "children" in entry ? (
                    <li key={entry.label}>
                      <Link
                        href={entry.href}
                        className="text-sm font-semibold text-white underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        {entry.label}
                      </Link>
                      <ul className="mt-1.5 flex flex-col">
                        {entry.children.map((child) => (
                          <li key={child.href}>
                            <Link href={child.href} className={footerLinkClassName}>
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ) : null,
                )}
              </ul>
              <ul className="flex flex-col">
                {PRODUCT_SINGLES(menu).map((entry) =>
                  "children" in entry ? null : (
                    <li key={entry.href}>
                      <Link href={entry.href} className={footerLinkClassName}>
                        {entry.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </nav>

          <nav aria-label="Navigasi footer">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">{footer.navTitle}</p>
            <ul className="mt-4 flex flex-col">
              {footer.links
                .filter((link) => link.visible)
                .map((link) => (
                  <li key={`${link.href}-${link.label}`}>
                    <Link href={link.href} className={footerLinkClassName}>
                      {link.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>
        </LandingReveal>

        <LandingReveal
          className="mt-10 flex flex-col gap-2 border-t border-white/15 pt-5 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between"
          delay={0.08}
        >
          <p>{footer.copyright.replace("{year}", String(new Date().getFullYear()))}</p>
          <p>{footer.tagline}</p>
        </LandingReveal>
      </div>
    </footer>
  );
}
