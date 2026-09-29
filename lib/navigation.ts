export type LandingNavLink = {
  href: string;
  label: string;
};

/** Shared landing navigation — single source of truth for navbar and footer. */
export const LANDING_NAV_LINKS = [
  { href: "/#beranda", label: "Beranda" },
  { href: "/#tentang-kami", label: "Tentang Kami" },
  { href: "/#testimoni", label: "Testimoni" },
  { href: "/portofolio", label: "Portofolio" },
  { href: "/size-chart", label: "Size Chart" },
  { href: "/katalog-kain", label: "Katalog Kain" },
  { href: "/contact", label: "Contact" },
] as const satisfies readonly LandingNavLink[];

export const LANDING_PRODUCT_HREF = "/#produk";

export const LANDING_CONTACT_HREF = "/#kontak";

export type LandingProductMenuItem = {
  label: string;
  href: string;
};

export type LandingProductMenuEntry =
  | { label: string; href: string }
  | { label: string; children: readonly LandingProductMenuItem[] };

/**
 * Clean & simple product menu for navbar dropdown + footer.
 * Group headers (Kemeja, Kaos) are non-clickable labels.
 * Every menu href has a matching entry in LANDING_PRODUCTS
 * so /produk/[slug] renders a full detail page.
 */
export const LANDING_PRODUCT_MENU = [
  {
    label: "Kemeja",
    children: [
      { label: "Kemeja PDH/PDL", href: "/produk/kemeja-pdh-pdl" },
      { label: "Workshirt", href: "/produk/workshirt" },
      { label: "Seragam Kerja", href: "/produk/seragam-kerja" },
    ],
  },
  { label: "Wearpack", href: "/produk/wearpack" },
  { label: "Poloshirt", href: "/produk/poloshirt" },
  {
    label: "Kaos",
    children: [
      { label: "Sablon DTF/Plastisol", href: "/produk/kaos-sablon" },
      { label: "Vneck", href: "/produk/kaos-vneck" },
      { label: "Raglan", href: "/produk/kaos-raglan" },
    ],
  },
  { label: "Jacket", href: "/produk/jacket" },
  { label: "Lanyard", href: "/produk/lanyard" },
  { label: "Rompi / Vest / Apron", href: "/produk/rompi-vest-apron" },
  { label: "Totebag / Topi", href: "/produk/totebag-topi" },
  { label: "Gantungan Kunci", href: "/produk/gantungan-kunci" },
] as const satisfies readonly LandingProductMenuEntry[];

export const LANDING_FOOTER_LINKS = [
  ...LANDING_NAV_LINKS.slice(0, 4),
  { href: LANDING_PRODUCT_HREF, label: "Produk" },
  ...LANDING_NAV_LINKS.slice(4),
  { href: LANDING_CONTACT_HREF, label: "Kontak" },
] as const satisfies readonly LandingNavLink[];
