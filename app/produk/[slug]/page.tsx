import { LANDING_PRODUCTS } from "@/lib/products";

export const dynamic = "force-static";

export const dynamicParams = true;

export function generateStaticParams() {
  return LANDING_PRODUCTS.map((product) => ({ slug: product.slug }));
}

export default function ProductDetailPage() {
  return <main className="min-h-[100dvh] bg-white" aria-hidden="true" />;
}
