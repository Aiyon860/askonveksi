import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account/",
        "/admin/",
        "/analytics/",
        "/api/",
        "/campaigns/",
        "/crm/",
        "/customers/",
        "/dashboard",
        "/desain",
        "/keuangan/",
        "/login",
        "/master-data/",
        "/produksi/",
        "/sales-orders/",
        "/settings",
        "/whatsapp/",
      ],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
    host: SITE_URL.origin,
  };
}
