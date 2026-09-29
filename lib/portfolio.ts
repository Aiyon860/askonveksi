export type PortfolioItem = {
  /** Display name, e.g. "Nama Portofolio 1" (placeholder for now) */
  name: string;
  /** Category chip, e.g. "Kemeja" */
  category: string;
};

/**
 * Portfolio placeholder entries — single source of truth for the
 * /portofolio grid. Replace names with real project titles and add
 * image sources when real portfolio photos are available.
 */
export const PORTFOLIO_ITEMS: PortfolioItem[] = [
  { name: "Nama Portofolio 1", category: "Kemeja" },
  { name: "Nama Portofolio 2", category: "Kaos" },
  { name: "Nama Portofolio 3", category: "Jaket" },
  { name: "Nama Portofolio 4", category: "Poloshirt" },
  { name: "Nama Portofolio 5", category: "Wearpack" },
  { name: "Nama Portofolio 6", category: "Lanyard" },
  { name: "Nama Portofolio 7", category: "Rompi" },
  { name: "Nama Portofolio 8", category: "Totebag" },
  { name: "Nama Portofolio 9", category: "Jersey" },
];
