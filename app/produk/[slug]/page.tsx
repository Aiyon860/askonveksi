import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LandingFooter } from "@/components/landing-footer";
import { LandingNavbar } from "@/components/landing-navbar";
import { ProductDetailGrid } from "@/components/product-detail-grid";
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

  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <LandingNavbar />
      <div className="flex-1">
        <ProductDetailGrid product={product} />
      </div>
      <LandingFooter />
    </main>
  );
}
