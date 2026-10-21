import type { MetadataRoute } from "next";

import { getSiteContent } from "@/lib/cms/store";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getSiteContent();
  const base = content.site.url.replace(/\/$/, "");

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/portofolio`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/size-chart`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/katalog-kain`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.7 },
    ...content.products
      .filter((product) => product.published)
      .map((product) => ({
        url: `${base}/produk/${product.id}`,
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
  ];
}
