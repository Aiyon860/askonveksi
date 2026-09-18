"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";

import { cn } from "@/lib/utils";

type ClientLogo = {
  name: string;
  src: string;
};

const majorClients: ClientLogo[] = [
  { name: "BRI", src: "/client/bri.webp" },
  { name: "Pertamina", src: "/client/pertamina.webp" },
  { name: "J&T Express", src: "/client/jnt.webp" },
  { name: "Polantas", src: "/client/polantas.webp" },
  { name: "UNDIP", src: "/client/undip.webp" },
];

const supportingClients: ClientLogo[] = [
  { name: "Bareskrim Polri", src: "/client/bareskim.webp" },
  { name: "UNNES", src: "/client/unnes.webp" },
  { name: "Bank Jateng", src: "/client/bankjateng.webp" },
  { name: "OIKN Nusantara", src: "/client/oikn.webp" },
  { name: "AKPOL", src: "/client/akpol.webp" },
  { name: "PNM", src: "/client/pnm.webp" },
  { name: "BUCG HK", src: "/client/BUCGHK.webp" },
];

function ClientRail({
  clients,
  direction,
  size,
  label,
}: {
  clients: ClientLogo[];
  direction: "left" | "right";
  size: "major" | "supporting";
  label: string;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="landing-clients-rail mx-auto max-w-[592px] overflow-hidden outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-landing-ring sm:max-w-[784px] lg:max-w-[960px]"
    >
      <div
        className={cn(
          "landing-clients-track flex w-max",
          direction === "left" ? "landing-clients-track-left" : "landing-clients-track-right",
        )}
      >
        {[false, true].map((duplicate) => (
          <ul
            key={String(duplicate)}
            aria-hidden={duplicate || undefined}
            className={cn(
              "landing-clients-copy flex shrink-0 px-2 lg:px-3",
              size === "major" ? "gap-4 sm:gap-5 lg:gap-6" : "gap-3 sm:gap-4",
            )}
          >
            {clients.map((client) => (
              <li
                key={client.name}
                className={cn(
                  "landing-client-card grid shrink-0 place-items-center rounded-landing-card border border-landing-border bg-landing-card text-landing-muted transition-[transform,border-color] duration-300 ease-[var(--ease-out)] hover:border-transparent",
                  size === "major"
                    ? "size-[120px] p-5 sm:size-[160px] lg:size-[200px]"
                    : "size-[72px] p-3 sm:size-[96px] lg:size-[120px]",
                )}
              >
                <Image
                  src={client.src}
                  alt={client.name}
                  width={160}
                  height={160}
                  className="max-h-full max-w-full object-contain"
                />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export function LandingClients({ headingClassName }: { headingClassName: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      id="klien"
      aria-labelledby="clients-title"
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: false, amount: 0.18 }}
      variants={{
        hidden: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
        visible: { transition: { staggerChildren: 0.12 } },
      }}
      className="relative isolate scroll-mt-24 overflow-hidden bg-landing-canvas py-24 sm:py-32"
    >
      <noscript>
        <style>{`.landing-clients-reveal{opacity:1!important;transform:none!important;filter:none!important;clip-path:none!important}`}</style>
      </noscript>

      <div className="relative z-10 mx-auto max-w-[1200px] px-5 text-center sm:px-8">
        <motion.h2
          id="clients-title"
          variants={{
            hidden: {
              opacity: 0,
              y: 24,
              filter: "blur(8px)",
              clipPath: "inset(0 0 100% 0)",
              transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
            },
            visible: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              clipPath: "inset(0 0 0% 0)",
              transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          className={cn(
            headingClassName,
            "landing-clients-reveal text-center text-4xl font-semibold leading-tight tracking-[-0.035em] text-landing-text sm:text-5xl lg:text-6xl",
          )}
        >
          Dibuat untuk Berbagai Kebutuhan
        </motion.h2>

        <motion.p
          variants={{
            hidden: { opacity: 0, y: 16, filter: "blur(5px)", transition: { duration: 0.24 } },
            visible: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          className="landing-clients-reveal mx-auto mt-4 max-w-xl text-base leading-6 text-landing-muted sm:text-lg sm:leading-7"
        >
          Dari komunitas hingga perusahaan, setiap pesanan dimulai dari kebutuhan yang berbeda. Lihat proses dan karya
          terbaru Askonveksi bersama 19K+ pengikut di Instagram.
        </motion.p>
      </div>

      <div className="relative z-10 mt-12 space-y-4 sm:mt-16 sm:space-y-6">
        <motion.div
          variants={{
            hidden: {
              opacity: 0,
              x: 140,
              clipPath: "inset(0 0 0 100%)",
              transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
            },
            visible: {
              opacity: 1,
              x: 0,
              clipPath: "inset(0 0% 0 0)",
              transition: { duration: 0.78, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          className="landing-clients-reveal"
        >
          <ClientRail clients={majorClients} direction="left" size="major" label="Logo lima klien utama" />
        </motion.div>

        <motion.div
          variants={{
            hidden: {
              opacity: 0,
              x: -140,
              clipPath: "inset(0 100% 0 0)",
              transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
            },
            visible: {
              opacity: 1,
              x: 0,
              clipPath: "inset(0 0 0 0%)",
              transition: { duration: 0.78, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          className="landing-clients-reveal"
        >
          <ClientRail clients={supportingClients} direction="right" size="supporting" label="Logo tujuh klien lainnya" />
        </motion.div>
      </div>
    </motion.section>
  );
}
