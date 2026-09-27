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
] as const satisfies readonly LandingNavLink[];

export const LANDING_PRODUCT_HREF = "/#produk";

export const LANDING_CONTACT_HREF = "/#kontak";

export const LANDING_FOOTER_LINKS = [
  ...LANDING_NAV_LINKS,
  { href: LANDING_PRODUCT_HREF, label: "Produk" },
  { href: LANDING_CONTACT_HREF, label: "Kontak" },
] as const satisfies readonly LandingNavLink[];
