import Image from "next/image";

import { LandingReveal, LandingStagger } from "@/components/landing-motion";
import { RichText } from "@/components/rich-text";
import type { CmsClientsSection } from "@/lib/cms/types";

export function LandingClients({ section }: { section: CmsClientsSection }) {
  const clients = section.items.filter((client) => client.visible);

  return (
    <section aria-labelledby="clients-title" className="overflow-hidden bg-[#f5f8fb] text-[#17324d]">
      <div className="mx-auto w-[90%] py-8">
        <LandingReveal>
          <h2 id="clients-title" className="text-2xl font-bold leading-tight tracking-[-0.02em]">
            {section.title}
          </h2>
          <RichText html={section.description} className="mt-2 text-sm leading-6 text-[#5d7082] sm:text-base" />
        </LandingReveal>

        {clients.length < 6 ? (
          <LandingStagger className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {clients.map((client) => (
              <div key={client.name} className="flex h-24 items-center justify-center rounded-xl border border-[#dce5ed] bg-white px-6">
                <Image
                  src={client.logo.src}
                  alt={client.logo.alt || client.name}
                  width={200}
                  height={80}
                  sizes="(max-width: 639px) 45vw, 28vw"
                  className="max-h-16 w-auto max-w-full object-contain"
                />
              </div>
            ))}
          </LandingStagger>
        ) : (
          <LandingReveal className="landing-clients-rail mt-7 overflow-hidden" delay={0.08}>
            <div className="landing-clients-track landing-clients-track-left flex w-max">
              {[false, true].map((duplicate) => (
                <div key={String(duplicate)} aria-hidden={duplicate || undefined} className={duplicate ? "landing-clients-copy flex" : "flex"}>
                  {clients.map((client) => (
                    <div key={`${client.name}-${String(duplicate)}`} className="flex h-24 w-52 shrink-0 items-center justify-center border-l border-[#dce5ed] px-7 first:border-l-0 sm:w-60 lg:w-64">
                      <Image
                        src={client.logo.src}
                        alt={duplicate ? "" : client.logo.alt || client.name}
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
        )}
      </div>
    </section>
  );
}
