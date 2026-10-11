import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteFooter, SiteNavbar } from "@/components/site-chrome";
import { LandingWhatsAppFab } from "@/components/landing-whatsapp-fab";
import { ProductDetailGrid } from "@/components/product-detail-grid";
import { getProductChildSlugs, ProductParentGrid } from "@/components/product-parent-grid";
import { LANDING_PRODUCTS, getLandingProduct } from "@/lib/products";

export const dynamic = "force-static";

export const dynamicParams = false;

export function generateStaticParams() {
  return LANDING_PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = getLandingProduct(slug);

  if (!product) {
    return { title: "Produk" };
  }

  return {
    title: product.name,
    description: product.description,
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getLandingProduct(slug);

  if (!product) {
    notFound();
  }

  const childSlugs = getProductChildSlugs(slug);

  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <SiteNavbar />
      <div className="flex-1">
        {childSlugs.length > 0 ? (
          <ProductParentGrid product={product} childSlugs={childSlugs} />
        ) : (
          <ProductDetailGrid product={product} />
        )}
      </div>
      <SiteFooter />
      <LandingWhatsAppFab />
    </main>
  );
}
