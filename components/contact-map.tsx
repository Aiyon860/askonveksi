import { LandingReveal } from "@/components/landing-motion";
import type { CmsContact } from "@/lib/cms/types";

export function ContactMap({ map }: { map: CmsContact["map"] }) {
  return (
    <section aria-label="Peta lokasi" className="bg-white">
      <div className="mx-auto w-[90%] py-16 sm:py-20">
        <LandingReveal className="overflow-hidden rounded-landing-card border border-[#dde6ee]">
          <iframe
            title={map.title}
            src={map.embedSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            className="h-80 w-full border-0 sm:h-96"
          />
        </LandingReveal>
      </div>
    </section>
  );
}
