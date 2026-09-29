import type { MetadataRoute } from "next";

import { LANDING_PRODUCTS } from "@/lib/products";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL.toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: new URL("/portofolio", SITE_URL).toString(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...LANDING_PRODUCTS.map((product) => ({
      url: new URL(`/produk/${product.slug}`, SITE_URL).toString(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
