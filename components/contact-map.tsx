import { LandingReveal } from "@/components/landing-motion";
import { CONTACT_MAP_EMBED_SRC, CONTACT_MAP_TITLE } from "@/lib/contact-page";

export function ContactMap() {
  return (
    <section aria-label="Peta lokasi" className="bg-white">
      <div className="mx-auto w-[90%] py-16 sm:py-20">
        <LandingReveal className="overflow-hidden rounded-landing-card border border-[#dde6ee]">
          <iframe
            title={CONTACT_MAP_TITLE}
            src={CONTACT_MAP_EMBED_SRC}
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
