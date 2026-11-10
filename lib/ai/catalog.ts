import "server-only";

import { SITE_URL } from "@/lib/site";

import { AI_RANGE_PRESETS } from "@/lib/ai/scope";

/**
 * Alamat kanonis API/MCP yang ditampilkan ke asisten AI.
 *
 * Default memakai domain produksi (`lib/site.ts`), bukan origin permintaan,
 * supaya URL yang dibaca AI tetap benar walau diakses lewat IP/host sementara.
 * Timpa dengan `AI_PUBLIC_BASE_URL` bila domain berubah.
 */
export function aiBaseUrl() {
  const override = process.env.AI_PUBLIC_BASE_URL?.trim();
  return (override || SITE_URL.origin).replace(/\/$/, "");
}

/**
 * Katalog metrik: satu-satunya tempat definisi disimpan, dipakai REST
 * (`GET /api/ai`) maupun tool MCP `analytics_catalog`. Asisten AI memakai ini
 * untuk tahu pertanyaan apa yang bisa dijawab dan bagaimana angka dihitung.
 */
export function buildAiCatalog(baseUrl: string) {
  return {
    name: "Askonveksi Sales Analytics",
    version: "1.0.0",
    description:
      "API baca-saja berisi agregat penjualan CRM: omzet, pesanan, HPP, laba kotor, produk terlaris, sebaran kota/sumber lead customer, tren, dan pipeline.",
    baseUrl,
    authentication: {
      scheme: "Bearer",
      header: "Authorization: Bearer <token>",
      alternative: "x-api-key: <token>",
      notes: "Token dibuat di aplikasi (Pengaturan → Akses AI) oleh Developer/Owner dan bisa dicabut kapan saja.",
    },
    conventions: {
      currency: "IDR, nilai penuh (bukan ribuan/jutaan).",
      timezone: "Periode dihitung dengan batas hari Asia/Jakarta.",
      omzet: "Hanya SalesOrder berstatus ACTIVE. Draft dan Sales Order batal tidak dihitung.",
      period: `Preset: ${[...AI_RANGE_PRESETS, "today", "yesterday"].join(", ")}. Atau from/to berformat YYYY-MM-DD.`,
      brand: "brand=ASKONVEKSI (default), SAGA, atau ALL.",
      privacy:
        "Tidak ada nomor WhatsApp, email, alamat, atau nama lengkap customer. Nama pada top customer disamarkan dan hanya kode customer yang dikirim.",
    },
    limits: {
      requestsPerMinute: 60,
      maxRowsPerSection: 25,
      maxProducts: 50,
    },
    dataQuality:
      "Setiap respons menyertakan `quality` berisi persentase kelengkapan kota dan sumber lead. Jika rendah, sampaikan keterbatasan itu saat menyimpulkan.",
    endpoints: [
      {
        path: "/api/ai/overview",
        method: "GET",
        params: ["preset|from/to", "brand"],
        returns: ["revenue", "orders", "volume", "cost", "byBrand", "quality"],
        description: "Ringkasan omzet, jumlah pesanan, AOV, HPP, laba kotor, margin, dan pertumbuhan vs periode sebelumnya.",
      },
      {
        path: "/api/ai/products",
        method: "GET",
        params: ["preset|from/to", "brand", "limit (1-50, default 10)"],
        returns: ["products", "byGarmentType", "notes"],
        description: "Produk dengan omzet/pcs terbesar dan sebaran jenis pakaian (JERSEY, NON_JERSEY, AKSESORI).",
      },
      {
        path: "/api/ai/customers",
        method: "GET",
        params: ["preset|from/to", "brand", "groupBy=city|source|type|lifecycle (opsional)"],
        returns: ["byCity", "byLeadSource", "byCustomerType", "lifecycle", "repeat", "topCustomers", "quality"],
        description: "Customer berasal dari kota mana, dari sumber lead apa, jenis customer, repeat order, dan top customer (nama disamarkan).",
      },
      {
        path: "/api/ai/timeseries",
        method: "GET",
        params: ["preset|from/to", "brand", "granularity=day|week|month (default month)"],
        returns: ["granularity", "points (bucket, revenue, orders, pcs)"],
        description: "Tren omzet/pesanan/pcs per hari, minggu, atau bulan.",
      },
      {
        path: "/api/ai/pipeline",
        method: "GET",
        params: ["preset|from/to", "brand"],
        returns: ["stages", "totals", "staleFollowUps"],
        description: "Jumlah peluang per tahap, win rate, nilai peluang terbuka, nilai invoice belum dibayar, dan follow-up yang lewat tenggat.",
      },
    ],
    examples: [
      `${baseUrl}/api/ai/overview?preset=this-year&brand=ALL`,
      `${baseUrl}/api/ai/products?preset=90d&limit=10`,
      `${baseUrl}/api/ai/customers?preset=this-year&groupBy=city`,
      `${baseUrl}/api/ai/timeseries?preset=this-year&granularity=month`,
    ],
    mcp: { endpoint: `${baseUrl}/api/mcp`, transport: "Streamable HTTP (stateless)" },
  };
}
