import Image from "next/image";

import { LandingReveal } from "@/components/landing-motion";

const clients = [
  { name: "Pertamina", src: "/client/pertamina.webp" },
  { name: "Bank Jateng", src: "/client/bankjateng.webp" },
  { name: "BRI", src: "/client/bri.webp" },
  { name: "PNM", src: "/client/pnm.webp" },
  { name: "J&T Express", src: "/client/jnt.webp" },
  { name: "Otorita Ibu Kota Nusantara", src: "/client/oikn.webp" },
  { name: "Akpol", src: "/client/akpol.webp" },
  { name: "Bareskrim", src: "/client/bareskim.webp" },
  { name: "Polantas", src: "/client/polantas.webp" },
  { name: "Universitas Diponegoro", src: "/client/undip.webp" },
  { name: "Universitas Negeri Semarang", src: "/client/unnes.webp" },
] as const;

export function LandingClients() {
  return (
    <section aria-labelledby="clients-title" className="overflow-hidden bg-[#f5f8fb] text-[#17324d]">
      <div className="mx-auto w-[90%] py-8">
        <LandingReveal>
          <h2 id="clients-title" className="text-2xl font-bold leading-tight tracking-[-0.02em]">
            Dipercaya oleh Berbagai Perusahaan &amp; Instansi
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#5d7082] sm:text-base">
            Kami telah melayani ratusan perusahaan, instansi, komunitas, dan brand di seluruh Indonesia.
          </p>
        </LandingReveal>

        <LandingReveal className="landing-clients-rail mt-7 overflow-hidden" delay={0.08}>
          <div className="landing-clients-track landing-clients-track-left flex w-max">
            {[false, true].map((duplicate) => (
              <div key={String(duplicate)} aria-hidden={duplicate || undefined} className={duplicate ? "landing-clients-copy flex" : "flex"}>
                {clients.map((client) => (
                  <div key={client.name} className="flex h-24 w-52 shrink-0 items-center justify-center border-l border-[#dce5ed] px-7 first:border-l-0 sm:w-60 lg:w-64">
                    <Image
                      src={client.src}
                      alt={duplicate ? "" : client.name}
                      width={200}
                      height={80}
                      sizes="(max-width: 639px) 45vw, (max-width: 1023px) 28vw, 15vw"
                      className="max-h-16 w-auto max-w-full object-contain"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
