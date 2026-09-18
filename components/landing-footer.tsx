"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";

import ScrollReveal from "@/components/react-bits/scroll-reveal";
import { landingLinks } from "@/lib/landing-links";
import { cn } from "@/lib/utils";

const socials = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/askonveksi_/",
    external: true,
    path: "M7.03.084C5.753.144 4.881.348 4.119.647c-.789.308-1.458.72-2.123 1.388C1.331 2.703.921 3.372.616 4.162.321 4.926.12 5.799.064 7.076.008 8.354-.005 8.764.002 12.023c.006 3.259.02 3.667.082 4.947.061 1.277.264 2.149.564 2.911.308.789.72 1.457 1.388 2.123.668.665 1.336 1.074 2.128 1.38.763.295 1.636.496 2.914.552 1.277.056 1.688.069 4.946.063 3.258-.006 3.668-.021 4.948-.082 1.28-.06 2.147-.265 2.91-.563.789-.308 1.457-.72 2.122-1.388.665-.668 1.075-1.338 1.38-2.128.295-.764.496-1.636.552-2.913.056-1.281.069-1.69.063-4.948-.006-3.258-.021-3.667-.082-4.946-.061-1.28-.264-2.149-.563-2.912-.308-.789-.72-1.457-1.388-2.123C21.298 1.33 20.628.921 19.838.617 19.074.321 18.202.12 16.924.065 15.647.009 15.236-.005 11.977.001 8.718.008 8.31.022 7.03.084Zm.14 21.693c-1.17-.051-1.805-.245-2.228-.408-.561-.216-.96-.477-1.382-.895-.422-.418-.681-.819-.9-1.378-.164-.424-.362-1.058-.417-2.228-.059-1.265-.072-1.644-.079-4.848-.007-3.204.005-3.583.061-4.848.05-1.169.245-1.805.408-2.228.216-.561.476-.96.895-1.382.419-.422.818-.681 1.378-.9.423-.165 1.058-.361 2.227-.417 1.266-.06 1.645-.072 4.848-.079 3.203-.007 3.584.005 4.85.061 1.169.051 1.805.244 2.228.408.561.216.96.475 1.382.895.422.419.681.818.9 1.379.165.422.362 1.056.417 2.226.06 1.266.074 1.645.08 4.848.005 3.203-.006 3.584-.061 4.848-.051 1.17-.245 1.806-.408 2.23-.216.56-.477.96-.896 1.381-.419.422-.818.681-1.378.9-.422.165-1.058.362-2.226.417-1.266.06-1.645.072-4.85.079-3.204.007-3.582-.006-4.848-.061ZM16.953 5.586a1.44 1.44 0 1 0 1.437-1.442 1.44 1.44 0 0 0-1.437 1.442ZM5.839 12.012c.006 3.403 2.77 6.156 6.172 6.15 3.403-.007 6.157-2.77 6.151-6.174-.007-3.403-2.771-6.156-6.174-6.15-3.403.007-6.156 2.771-6.15 6.174ZM8 12.008a4 4 0 1 1 4.008 3.992A4 4 0 0 1 8 12.008Z",
  },
  {
    label: "TikTok",
    href: null,
    external: false,
    path: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z",
  },
  {
    label: "WhatsApp",
    href: "#form-kontak",
    external: false,
    path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z",
  },
] as const;

export function LandingFooter({ headingClassName }: { headingClassName: string }) {
  const reduceMotion = useReducedMotion();
  const reveal = {
    hidden: reduceMotion ? { opacity: 1 } : { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.footer
      aria-label="Footer Askonveksi"
      initial={reduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: false, amount: 0.12 }}
      variants={{ hidden: { opacity: 0.55, y: 24 }, visible: { opacity: 1, y: 0 } }}
      transition={{ duration: reduceMotion ? 0.2 : 0.65, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden bg-landing-card pt-16 sm:pt-20"
    >
      <motion.div
        className="mx-auto grid max-w-[1200px] gap-10 px-6 sm:grid-cols-2 sm:px-10 lg:grid-cols-[1.35fr_0.65fr_auto] lg:gap-16 lg:px-12"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.1 } } }}
      >
        <motion.div variants={reveal} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
          <motion.div
            whileHover={reduceMotion ? undefined : { scale: 1.06, rotate: -2 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            className="mb-5 w-fit"
          >
            <Link
              href="#beranda"
              aria-label="Askonveksi, kembali ke beranda"
              className="inline-flex rounded-landing-control outline-none focus-visible:ring-3 focus-visible:ring-landing-accent/30"
            >
              <Image
                src="/brand/askonveksi-mark.png"
                alt=""
                width={494}
                height={410}
                className="h-12 w-auto object-contain sm:h-14"
              />
            </Link>
          </motion.div>
          <p className="max-w-sm text-base font-medium leading-6 text-landing-text">
            Seragam custom untuk komunitas, organisasi, sekolah, instansi, dan perusahaan. Konsultasi dan desain gratis.
          </p>
        </motion.div>

        <motion.nav
          aria-label="Navigasi footer"
          variants={reveal}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="mb-3 text-sm font-semibold text-landing-text">Navigasi</p>
          <ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-1">
            {landingLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex min-h-11 items-center rounded-landing-control text-sm text-landing-muted underline-offset-4 outline-none transition-colors hover:text-landing-accent hover:underline focus-visible:ring-3 focus-visible:ring-landing-accent/30"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </motion.nav>

        <motion.div
          className="sm:col-span-2 lg:col-span-1"
          variants={reveal}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="mb-4 text-sm font-semibold text-landing-text">Lihat karya terbaru</p>
          <ul className="flex gap-3" aria-label="Media sosial dan kontak Askonveksi">
            {socials.map((social) => (
              <motion.li
                key={social.label}
                title={social.href ? social.label : `${social.label} Askonveksi, tautan belum tersedia`}
                whileHover={reduceMotion ? undefined : { y: -4, scale: 1.06 }}
                className="flex size-12 items-center justify-center rounded-landing-nav bg-landing-fog text-landing-text transition-colors hover:bg-landing-cta hover:text-landing-accent"
              >
                {social.href ? (
                  <a
                    href={social.href}
                    target={social.external ? "_blank" : undefined}
                    rel={social.external ? "noreferrer" : undefined}
                    aria-label={social.label === "WhatsApp" ? "Mulai konsultasi via WhatsApp" : "Buka Instagram Askonveksi"}
                    className="flex size-full items-center justify-center rounded-landing-nav outline-none focus-visible:ring-3 focus-visible:ring-landing-accent/30"
                  >
                    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
                      <path d={social.path} />
                    </svg>
                  </a>
                ) : (
                  <span aria-label={`${social.label} Askonveksi, tautan belum tersedia`}>
                    <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
                      <path d={social.path} />
                    </svg>
                  </span>
                )}
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </motion.div>

      <ScrollReveal
        baseOpacity={0.28}
        baseRotation={0}
        blurStrength={12}
        splitBy="characters"
        rotationEnd="bottom bottom"
        wordAnimationEnd="bottom bottom"
        containerClassName="!mx-0 !mb-0 !mt-6 !max-w-none sm:!mt-8"
        textClassName={cn(
          headingClassName,
          "translate-y-1/4 whitespace-nowrap text-center !text-[clamp(3.9rem,15.8vw,12rem)] !font-semibold !leading-[0.86] !tracking-[-0.055em] !text-landing-accent",
        )}
      >
        askonveksi
      </ScrollReveal>
    </motion.footer>
  );
}
