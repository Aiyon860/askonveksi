import { ProductDetailGallery, ProductDetailPlaceholder } from "@/components/product-detail-grid";
import { LandingReveal } from "@/components/landing-motion";
import { RichText } from "@/components/rich-text";
import type { CmsProduct, CmsSiteContent } from "@/lib/cms/types";

export function ProductParentGrid({
  product,
  children,
  comingSoon,
}: {
  product: CmsProduct;
  children: CmsProduct[];
  comingSoon: CmsSiteContent["comingSoon"];
}) {
  return (
    <section aria-labelledby="product-detail-title" className="bg-white pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-24">
      <div className="mx-auto w-[90%]">
        <LandingReveal className="mx-auto max-w-2xl text-center">
          <h1 id="product-detail-title" className="text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-[#142535] sm:text-4xl">
            {product.name}
          </h1>
          <RichText html={product.description} className="mt-4 text-sm leading-6 text-[#536578] sm:text-base sm:leading-7" />
        </LandingReveal>

        {children.map((child) => (
          <section key={child.id} aria-labelledby={`product-child-${child.id}`} className="mt-12 lg:mt-14">
            <h2 id={`product-child-${child.id}`} className="text-balance text-center text-2xl font-bold leading-tight tracking-[-0.02em] text-[#142535] sm:text-3xl">
              {child.name}
            </h2>
            {child.gallery.length ? (
              <ProductDetailGallery images={child.gallery} />
            ) : (
              <ProductDetailPlaceholder pageName={child.name} comingSoon={comingSoon} />
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
