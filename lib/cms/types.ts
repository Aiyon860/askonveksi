export type CmsImage = {
  src: string;
  alt: string;
  focus?: "left" | "center" | "right";
};

export type CmsLink = {
  label: string;
  href: string;
  visible: boolean;
};

export type CmsNavItem =
  | { type: "link"; label: string; href: string; visible: boolean }
  | { type: "products"; label: string; visible: boolean };

export type CmsSectionId = string;
export type CmsSectionState = { id: CmsSectionId; visible: boolean };

export type CmsSeo = {
  title: string;
  description: string;
  ogImage: CmsImage | null;
};

export type CmsBenefit = {
  icon: string;
  title: string;
  description: string;
  visible: boolean;
};

export type CmsStep = CmsBenefit;
export type CmsAdvantage = CmsBenefit;

export type CmsHero = {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  primaryCta: { label: string; href: string; whatsappMessage: string };
  secondaryCta: { label: string; href: string };
  image: CmsImage;
  benefits: CmsBenefit[];
};

export type CmsProductsSection = {
  eyebrow: string;
  title: string;
  description: string;
  cta: CmsLink;
};

export type CmsProcessSection = {
  eyebrow: string;
  title: string;
  description: string;
  image: CmsImage;
  overlayLine1: string;
  overlayLine2: string;
  steps: CmsStep[];
};

export type CmsWhySection = {
  eyebrow: string;
  title: string;
  description: string;
  image: CmsImage;
  cta: CmsLink;
  advantages: CmsAdvantage[];
};

export type CmsClientsSection = {
  title: string;
  description: string;
  items: { name: string; logo: CmsImage; visible: boolean }[];
};

export type CmsTestimonialsSection = {
  title: string;
  description: string;
  items: {
    quote: string;
    name: string;
    company: string;
    avatar: CmsImage | null;
    visible: boolean;
  }[];
};

export type CmsCtaSection = {
  title: string;
  description: string;
  buttonLabel: string;
  whatsappMessage: string;
  image: CmsImage;
};

export type CmsFooter = {
  description: string;
  productTitle: string;
  navTitle: string;
  links: CmsLink[];
  socials: { platform: "instagram" | "facebook" | "youtube"; url: string; visible: boolean }[];
  copyright: string;
  tagline: string;
};

export type CmsProduct = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  parentSlug: string | null;
  menuVisible: boolean;
  menuOrder: number;
  catalogVisible: boolean;
  catalogOrder: number;
  cardImage: CmsImage | null;
  gallery: CmsImage[];
  features: string[];
  useCases: string[];
  seoTitle: string;
  seoDescription: string;
  published: boolean;
};

export type CmsPortfolio = {
  seo: CmsSeo;
  sections: CmsSectionState[];
  eyebrow: string;
  title: string;
  description: string;
  items: { name: string; logo: CmsImage; visible: boolean }[];
};

export type CmsSizeChart = {
  seo: CmsSeo;
  sections: CmsSectionState[];
  title: string;
  description: string;
  images: CmsImage[];
};

export type CmsFabric = {
  seo: CmsSeo;
  sections: CmsSectionState[];
  title: string;
  description: string;
  comingSoon: boolean;
  comingSoonTitle: string;
  comingSoonDescription: string;
  comingSoonImage: CmsImage;
  comingSoonButtonLabel: string;
  comingSoonHref: string;
  items: { name: string; image: CmsImage; description: string; visible: boolean }[];
};

export type CmsContact = {
  seo: CmsSeo;
  sections: CmsSectionState[];
  title: string;
  email: { label: string; value: string; href: string };
  address: { label: string; lines: string[] };
  phones: { label: string; items: { label: string; value: string; href: string }[] };
  faq: {
    eyebrow: string;
    title: string;
    items: { question: string; answer: string; visible: boolean }[];
  };
  form: {
    eyebrow: string;
    title: string;
    nameLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    subjectLabel: string;
    subjectPlaceholder: string;
    messageLabel: string;
    messagePlaceholder: string;
    submitLabel: string;
    successLabel: string;
    helperText: string;
  };
  map: { title: string; embedSrc: string; visible: boolean };
  cta: {
    title: string;
    subtitle: string;
    buttonLabel: string;
    whatsappMessage: string;
    image: CmsImage;
  };
};

export type CmsSiteContent = {
  schemaVersion: 1;
  version: number;
  updatedAt: string;
  updatedBy: { id: string; name: string };
  brand: { name: string; logo: CmsImage | null };
  site: {
    url: string;
    title: string;
    description: string;
    ogImage: CmsImage | null;
    whatsapp: string;
    email: string;
    addressLines: string[];
    phones: { label: string; value: string; href: string }[];
    socials: { platform: "instagram" | "facebook" | "youtube"; url: string; visible: boolean }[];
    analyticsId: string;
    searchConsoleVerification: string;
    areaServed: string[];
  };
  nav: {
    items: CmsNavItem[];
    mobileTitle: string;
    cta: { label: string; href: string; visible: boolean };
  };
  home: {
    sections: CmsSectionState[];
    hero: CmsHero;
    products: CmsProductsSection;
    process: CmsProcessSection;
    why: CmsWhySection;
    clients: CmsClientsSection;
    testimonials: CmsTestimonialsSection;
    cta: CmsCtaSection;
  };
  footer: CmsFooter;
  whatsappFab: { visible: boolean; message: string };
  products: CmsProduct[];
  portfolio: CmsPortfolio;
  sizeChart: CmsSizeChart;
  fabric: CmsFabric;
  contact: CmsContact;
  comingSoon: { title: string; description: string; image: CmsImage; buttonLabel: string; href: string };
};

export type CmsHomeSectionId =
  | "hero"
  | "products"
  | "process"
  | "why"
  | "clients"
  | "testimonials"
  | "cta";
