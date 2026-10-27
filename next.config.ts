import type { NextConfig } from "next";

function attendanceSecurityHeaders() {
  return [
    { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Kamera & lokasi dibutuhkan halaman absensi. Mikrofon tetap diblokir.
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(process.env.NODE_ENV === "production"
      ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
      : []),
  ];
}

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    // Mengaktifkan forbidden()/unauthorized() supaya halaman yang ditolak
    // dirender sebagai 403 buatan sendiri, bukan error bawaan Next.
    authInterrupts: true,
    serverActions: {
      bodySizeLimit: "28mb",
    },
    useTypeScriptCli: false,
    serverSourceMaps: false,
    webpackMemoryOptimizations: true,
    // "konva"/"react-konva" SENGAJA tidak dioptimasi: optimizePackageImports
    // memecah barrel import sehingga singleton Konva terduplikasi dan node
    // bentuk (Rect/Image/...) tidak terdaftar -> "has no node with the type".
    optimizePackageImports: ["lucide-react", "recharts", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    maximumRedirects: 0,
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/produk/polo", destination: "/produk/poloshirt", permanent: true },
      { source: "/produk/jaket", destination: "/produk/jacket", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // immutable hanya di production: nama chunk dev tidak di-hash per konten,
        // sehingga immutable membuat dynamic import (next/dynamic) memakai cache lama.
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: process.env.NODE_ENV === "production" ? "public, max-age=31536000, immutable" : "no-cache, must-revalidate" }],
      },
      {
        // Khusus rute pratinjau studio website: diizinkan dimuat di dalam iframe
        // oleh domain aplikasi itu sendiri ('self' / SAMEORIGIN), baik di localhost
        // maupun saat di-hosting di Vercel (misal: askonveksi.web.id).
        source: "/cms-preview",
        headers: [
          { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
      {
        source: "/cms-preview/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
      {
        // Halaman absensi butuh kamera untuk foto dan geolocation untuk bukti lokasi.
        source: "/absensi",
        headers: attendanceSecurityHeaders(),
      },
      {
        source: "/absensi/:path*",
        headers: attendanceSecurityHeaders(),
      },
      {
        // Seluruh halaman lain dilindungi penuh dari framing / clickjacking.
        // /absensi dikecualikan karena sudah punya blok Permissions-Policy sendiri.
        source: "/((?!cms-preview|absensi).*)",
        headers: [
          { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
