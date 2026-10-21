import type { CmsProduct, CmsSectionState, CmsSiteContent } from "@/lib/cms/types";

export type CmsProductMenuEntry =
  | { label: string; href: string }
  | { label: string; href: string; children: { label: string; href: string }[] };

export function waHref(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function whatsappCtaHref(href: string, phone: string, message: string) {
  if (!href.trim() || href.includes("wa.me/")) return waHref(phone, message);
  return href;
}

export function objectPosition(focus?: "left" | "center" | "right") {
  if (focus === "left") return "0% center";
  if (focus === "right") return "100% center";
  return "center";
}

export function orderedProducts(content: CmsSiteContent) {
  return [...content.products].sort((a, b) => a.menuOrder - b.menuOrder || a.name.localeCompare(b.name));
}

export function catalogProducts(content: CmsSiteContent) {
  return [...content.products]
    .filter((product) => product.published && product.catalogVisible)
    .sort((a, b) => a.catalogOrder - b.catalogOrder || a.name.localeCompare(b.name));
}

export function publishedProducts(content: CmsSiteContent) {
  return content.products.filter((product) => product.published);
}

export function getProduct(content: CmsSiteContent, slug: string) {
  return content.products.find((product) => product.id === slug);
}

export function childrenOf(content: CmsSiteContent, slug: string) {
  return content.products
    .filter((product) => product.parentSlug === slug && product.published)
    .sort((a, b) => a.menuOrder - b.menuOrder || a.name.localeCompare(b.name));
}

export function productMenu(content: CmsSiteContent): CmsProductMenuEntry[] {
  const topLevel = orderedProducts(content).filter(
    (product) => product.published && product.menuVisible && !product.parentSlug,
  );
  return topLevel.map((product) => {
    const children = childrenOf(content, product.id).filter((child) => child.menuVisible);
    if (children.length) {
      return {
        label: product.name,
        href: `/produk/${product.id}`,
        children: children.map((child) => ({ label: child.name, href: `/produk/${child.id}` })),
      };
    }
    return { label: product.name, href: `/produk/${product.id}` };
  });
}

export function visibleSections(sections: CmsSectionState[]) {
  return sections.filter((section) => section.visible);
}

export function getSectionVisible(sections: CmsSectionState[], id: string) {
  return sections.some((section) => section.id === id && section.visible);
}

export function renderTemplate(value: string, variables: Record<string, string>) {
  return value.replace(/\{(\w+)\}/g, (match, key: string) => variables[key] ?? match);
}

export function productCardImage(product: CmsProduct) {
  return product.cardImage ?? product.gallery[0] ?? null;
}
