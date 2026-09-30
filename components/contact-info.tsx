import { Mail, MapPin, PhoneCall } from "lucide-react";

import { LandingReveal, LandingStagger } from "@/components/landing-motion";
import { CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONES } from "@/lib/contact-page";

export function ContactInfo() {
  return (
    <section aria-label="Informasi kontak" className="bg-white">
      <LandingStagger className="mx-auto grid w-[90%] grid-cols-1 gap-10 py-4 sm:grid-cols-3 sm:gap-6">
        <div className="group flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#e4f1fc] transition-transform duration-200 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:scale-105">
            <Mail aria-hidden="true" className="size-6 text-landing-accent" strokeWidth={1.75} />
          </span>
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[#142535]">Email</h2>
          <a
            href={CONTACT_EMAIL.href}
            className="rounded-landing-control text-sm leading-6 text-[#536578] underline-offset-4 outline-none transition-colors hover:text-landing-accent hover:underline focus-visible:ring-3 focus-visible:ring-landing-accent/30"
          >
            {CONTACT_EMAIL.value}
          </a>
        </div>

        <div className="group flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#e4f1fc] transition-transform duration-200 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:scale-105">
            <MapPin aria-hidden="true" className="size-6 text-landing-accent" strokeWidth={1.75} />
          </span>
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[#142535]">Alamat</h2>
          <p className="max-w-xs text-sm leading-6 text-[#536578]">
            {CONTACT_ADDRESS.lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
        </div>

        <div className="group flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#e4f1fc] transition-transform duration-200 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:scale-105">
            <PhoneCall aria-hidden="true" className="size-6 text-landing-accent" strokeWidth={1.75} />
          </span>
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[#142535]">Telepon</h2>
          <p className="flex flex-col gap-1 text-sm leading-6 text-[#536578]">
            {CONTACT_PHONES.phones.map((phone) => (
              <a
                key={phone.label}
                href={phone.href}
                className="rounded-landing-control underline-offset-4 outline-none transition-colors hover:text-landing-accent hover:underline focus-visible:ring-3 focus-visible:ring-landing-accent/30"
              >
                {phone.value} ({phone.label})
              </a>
            ))}
          </p>
        </div>
      </LandingStagger>
    </section>
  );
}

export function ContactHeader() {
  return (
    <section aria-labelledby="contact-title" className="bg-white pt-10 pb-10 sm:pt-12 lg:pt-14">
      <div className="mx-auto w-[90%]">
        <LandingReveal className="mx-auto max-w-2xl text-center">
          <h1
            id="contact-title"
            className="text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-[#142535] sm:text-4xl"
          >
            Kontak Kami
          </h1>
        </LandingReveal>
      </div>
    </section>
  );
}
