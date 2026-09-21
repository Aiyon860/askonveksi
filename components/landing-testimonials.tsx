import { UserRound } from "lucide-react";

import { LandingReveal, LandingStagger } from "@/components/landing-motion";

const testimonials = [
  {
    quote: "CAKEUPPP POLLL!!! Sablon Dtf nya high quality, bahannya juga bagus, pengerjaannya cepet bgtt!! Makasih as konveksii Recommendedd bangett si inehhh",
    name: "Muhammad Alaudin Candra Pratama",
    company: "Customer",
  },
  {
    quote: "Hasil sablon nya bagus, bahan nya juga enak pokoknya sesuai sama desain yg dikirim, keren bgtt",
    name: "Nisrina Salsabila",
    company: "Customer",
  },
  {
    quote: "tempatnya oke, menawarkan kualitas bahan yang baik dengan harga yang bersaing, cocok untuk kebutuhan seragam, workshirt atau custom",
    name: "Prokopton",
    company: "Customer",
  },
] as const;

export function LandingTestimonials() {
  return (
    <section id="testimoni" aria-labelledby="testimonials-title" className="bg-white py-10 sm:py-12">
      <div className="mx-auto w-[90%]">
        <LandingReveal>
          <h2 id="testimonials-title" className="text-2xl font-bold leading-tight tracking-[-0.02em] text-[#17324d]">
            Testimoni Klien
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#5d7082] sm:text-base">Kepuasan pelanggan adalah prioritas kami.</p>
        </LandingReveal>

        <LandingStagger className="mt-6 grid gap-5 lg:grid-cols-3 lg:gap-6">
          {testimonials.map((testimonial) => (
            <blockquote key={testimonial.name} className="grid min-h-40 grid-cols-[3.5rem_1fr] gap-4 rounded-xl border border-[#dde6ee] bg-white p-5">
              <span className="flex size-14 items-center justify-center rounded-full bg-[#e4f1fc] text-landing-accent" aria-hidden="true">
                <UserRound className="size-7" strokeWidth={1.8} />
              </span>
              <div className="flex min-w-0 flex-col">
                <p className="text-sm leading-6 text-[#42566a]">“{testimonial.quote}”</p>
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
