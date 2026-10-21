import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LandingWhatsAppFab } from "@/components/landing-whatsapp-fab";
import { ProductDetailGrid } from "@/components/product-detail-grid";
import { ProductParentGrid } from "@/components/product-parent-grid";
import { SiteFooter, SiteNavbar } from "@/components/site-chrome";
import { childrenOf, getProduct } from "@/lib/cms/selectors";
import { getSiteContent } from "@/lib/cms/store";

export const dynamicParams = true;

export async function generateStaticParams() {
  const content = await getSiteContent();
  return content.products.filter((product) => product.published).map((product) => ({ slug: product.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const content = await getSiteContent();
  const product = getProduct(content, slug);
  if (!product || !product.published) return { title: "Produk" };
  const description = product.seoDescription || product.description.replace(/<[^>]+>/g, " ").slice(0, 160);
  return {
    title: product.seoTitle || product.name,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title: product.seoTitle || product.name,
      description,
      images: product.cardImage ? [product.cardImage.src] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await getSiteContent();
  const product = getProduct(content, slug);
  if (!product || !product.published) notFound();

  const children = childrenOf(content, product.id);

  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <SiteNavbar />
      <div className="flex-1">
        {children.length > 0 ? (
          <ProductParentGrid product={product} comingSoon={content.comingSoon}>
            {children}
          </ProductParentGrid>
        ) : (
          <ProductDetailGrid product={product} comingSoon={content.comingSoon} />
        )}
      </div>
      <SiteFooter />
      <LandingWhatsAppFab
        phone={content.site.whatsapp}
        message={content.whatsappFab.message}
        visible={content.whatsappFab.visible}
      />
    </main>
  );
}
