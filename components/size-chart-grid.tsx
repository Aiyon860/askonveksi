import { ImageIcon } from "lucide-react";

import { LandingReveal, LandingStagger } from "@/components/landing-motion";
import { ComingSoonOverlay } from "@/components/coming-soon-overlay";

const PLACEHOLDER_COUNT = 9;

export function SizeChartGrid() {
  return (
    <section aria-labelledby="size-chart-title" className="bg-white pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-24">
      <div className="mx-auto w-[90%]">
        <LandingReveal className="mx-auto max-w-2xl text-center">
          <h1
            id="size-chart-title"
            className="text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-[#142535] sm:text-4xl"
          >
            Size chart
          </h1>
        </LandingReveal>

        <ComingSoonOverlay pageName="Size Chart">
          <LandingStagger className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:mt-12 lg:grid-cols-3 lg:gap-4">
          {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
            <div
              key={`placeholder-${index + 1}`}
              aria-hidden="true"
              className="flex aspect-[3/4] items-center justify-center bg-[#e3eaf1]"
            >
              <ImageIcon className="size-8 text-[#9db4c6] sm:size-10" strokeWidth={1.5} />
            </div>
          ))}
        </LandingStagger>
        </ComingSoonOverlay>
      </div>
    </section>
  );
}
