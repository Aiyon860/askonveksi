import { ImageIcon } from "lucide-react";

import { LandingReveal, LandingStagger } from "@/components/landing-motion";
import type { LandingProduct } from "@/lib/products";

const PLACEHOLDER_COUNT = 9;

export function ProductDetailGrid({ product }: { product: LandingProduct }) {
  return (
    <section aria-labelledby="product-detail-title" className="bg-white pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-24">
      <div className="mx-auto w-[90%]">
        <LandingReveal className="mx-auto max-w-2xl text-center">
          <h1
            id="product-detail-title"
            className="text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-[#142535] sm:text-4xl"
          >
            {product.name}
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#536578] sm:text-base sm:leading-7">{product.description}</p>
        </LandingReveal>

        <LandingStagger className="mt-10 grid grid-cols-3 gap-2 sm:gap-3 lg:mt-12 lg:gap-4">
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
      </div>
    </section>
  );
}
