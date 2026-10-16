import { LandingReveal } from "@/components/landing-motion";
import {
  PRODUCT_DETAIL_GALLERIES,
  ProductDetailGallery,
  ProductDetailPlaceholder,
} from "@/components/product-detail-grid";
import { LANDING_PRODUCT_MENU } from "@/lib/navigation";
import { getLandingProduct, type LandingProduct } from "@/lib/products";

/**
 * Halaman produk induk (Kemeja, Kaos, Jersey): judul + deskripsi induk,
 * diikuti galeri penuh tiap sub-produk yang dipisahkan judul sub-produk saja.
 * Urutan anak mengikuti `LANDING_PRODUCT_MENU` (satu sumber kebenaran).
 */
export function getProductChildSlugs(parentSlug: string): string[] {
  const entry = LANDING_PRODUCT_MENU.find(
    (item) => "children" in item && item.href === `/produk/${parentSlug}`,
  );
  if (!entry || !("children" in entry)) return [];
  return entry.children.map((child) => child.href.replace("/produk/", ""));
}

export function ProductParentGrid({
  product,
  childSlugs,
}: {
  product: LandingProduct;
  childSlugs: string[];
}) {
  const children = childSlugs
    .map((slug) => getLandingProduct(slug))
    .filter((child): child is LandingProduct => Boolean(child));

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

        {children.map((child) => {
          const detailImages = PRODUCT_DETAIL_GALLERIES[child.slug];
          return (
            <section key={child.slug} aria-labelledby={`product-child-${child.slug}`} className="mt-12 lg:mt-14">
              <h2
                id={`product-child-${child.slug}`}
                className="text-balance text-center text-2xl font-bold leading-tight tracking-[-0.02em] text-[#142535] sm:text-3xl"
              >
                {child.name}
              </h2>
              {detailImages ? (
                <ProductDetailGallery images={detailImages} />
              ) : (
                <ProductDetailPlaceholder pageName={child.name} />
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
