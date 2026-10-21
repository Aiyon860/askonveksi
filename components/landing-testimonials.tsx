import { UserRound } from "lucide-react";
import Image from "next/image";

import { LandingReveal, LandingStagger } from "@/components/landing-motion";
import { RichText } from "@/components/rich-text";
import type { CmsTestimonialsSection } from "@/lib/cms/types";

export function LandingTestimonials({ section }: { section: CmsTestimonialsSection }) {
  const testimonials = section.items.filter((testimonial) => testimonial.visible);

  return (
    <section id="testimoni" aria-labelledby="testimonials-title" className="scroll-mt-20 bg-white py-10 sm:py-12">
      <div className="mx-auto w-[90%]">
        <LandingReveal>
          <h2 id="testimonials-title" className="text-2xl font-bold leading-tight tracking-[-0.02em] text-[#17324d]">
            {section.title}
          </h2>
          <RichText html={section.description} className="mt-2 text-sm leading-6 text-[#5d7082] sm:text-base" />
        </LandingReveal>

        <LandingStagger className="mt-6 grid gap-5 lg:grid-cols-3 lg:gap-6">
          {testimonials.map((testimonial, index) => (
            <blockquote key={`${testimonial.name}-${index}`} className="grid min-h-40 grid-cols-[3.5rem_1fr] gap-4 rounded-xl border border-[#dde6ee] bg-white p-5">
              {testimonial.avatar ? (
                <Image
                  src={testimonial.avatar.src}
                  alt={testimonial.avatar.alt || testimonial.name}
                  width={56}
                  height={56}
                  className="size-14 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-14 items-center justify-center rounded-full bg-[#e4f1fc] text-landing-accent" aria-hidden="true">
                  <UserRound className="size-7" strokeWidth={1.8} />
                </span>
              )}
              <div className="flex min-w-0 flex-col">
                <RichText html={testimonial.quote} className="text-sm leading-6 text-[#42566a]" />
                <footer className="mt-auto pt-4">
                  <cite className="not-italic">
                    <span className="block text-sm font-semibold text-[#17324d]">{testimonial.name}</span>
                    <span className="mt-1 block text-sm text-[#6a7c8d]">{testimonial.company}</span>
                  </cite>
                </footer>
              </div>
            </blockquote>
          ))}
        </LandingStagger>
      </div>
    </section>
  );
}
