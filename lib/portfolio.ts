export type PortfolioItem = {
  /** Display name, e.g. "BRI" (company name) */
  name: string;
  /** Company logo source, e.g. "/client/bri.webp" */
  src: string;
};

/**
 * Portfolio entries — single source of truth for the
 * /portofolio grid. Named by company; only companies with
 * an available logo file in /public/client are listed.
 */
export const PORTFOLIO_ITEMS: PortfolioItem[] = [
  { name: "BRI", src: "/client/bri.webp" },
  { name: "PT Aegis Jaya Metalindo", src: "/client/aegis.webp" },
  { name: "OIKN Nusantara", src: "/client/oikn.webp" },
  { name: "Orado", src: "/client/orado.webp" },
  { name: "Gekraf", src: "/client/gekraf.webp" },
  { name: "KOV", src: "/client/kov.webp" },
  { name: "AKPOL", src: "/client/akpol.webp" },
  { name: "KHAF", src: "/client/kahf.webp" },
  { name: "BUCG HK", src: "/client/BUCGHK.webp" },
  { name: "PNM", src: "/client/pnm.webp" },
  { name: "Bareskrim Polri", src: "/client/bareskim.webp" },
  { name: "Dishub Kota Semarang", src: "/client/dishub-semarang.webp" },
  { name: "Pertamina", src: "/client/pertamina.webp" },
  { name: "U-Winfly", src: "/client/uwinfly.webp" },
  { name: "Polantas", src: "/client/polantas.webp" },
  { name: "Polres Bojonegoro", src: "/client/polres-bojonegoro.webp" },
  { name: "Bank Jateng", src: "/client/bankjateng.webp" },
  { name: "J&T Express", src: "/client/jnt.webp" },
  { name: "BPN Kab Semarang", src: "/client/bpn.webp" },
  { name: "Virgin Bakery", src: "/client/virgin.webp" },
  { name: "UNDIP", src: "/client/undip.webp" },
  { name: "UNNES", src: "/client/unnes.webp" },
  { name: "Unisula", src: "/client/unisula.webp" },
  { name: "USM", src: "/client/usm.webp" },
  { name: "Udinus", src: "/client/udinus.webp" },
  { name: "Unika", src: "/client/unika.webp" },
  { name: "Puskesmas Bangetayu", src: "/client/puskesmas-bangetayu.webp" },
];
