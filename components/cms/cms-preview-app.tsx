"use client";

import { Fragment, type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ContactCta } from "@/components/contact-cta";
import { ContactFaqForm } from "@/components/contact-faq-form";
import { ContactHeader, ContactInfo } from "@/components/contact-info";
import { ContactMap } from "@/components/contact-map";
import { KatalogKainGrid, KatalogKainHeader } from "@/components/katalog-kain-grid";
import { LandingClients } from "@/components/landing-clients";
import { LandingCta } from "@/components/landing-cta";
import { LandingFooter } from "@/components/landing-footer";
import { LandingHero } from "@/components/landing-hero";
import { LandingNavbar } from "@/components/landing-navbar";
import { LandingProcess } from "@/components/landing-process";
import { LandingProducts } from "@/components/landing-products";
import { LandingTestimonials } from "@/components/landing-testimonials";
import { LandingWhatsAppFab } from "@/components/landing-whatsapp-fab";
import { LandingWhy } from "@/components/landing-why";
import { PortfolioGrid, PortfolioHeader } from "@/components/portfolio-grid";
import { ProductDetailGrid } from "@/components/product-detail-grid";
import { ProductParentGrid } from "@/components/product-parent-grid";
import { SizeChartGrid, SizeChartHeader } from "@/components/size-chart-grid";
import type { CmsPreviewTarget } from "@/lib/cms/editors";
import { catalogProducts, childrenOf, getProduct, productMenu, visibleSections } from "@/lib/cms/selectors";
import type { CmsSiteContent } from "@/lib/cms/types";

type PreviewState = {
  page: CmsPreviewTarget;
  content: CmsSiteContent;
  productId?: string;
};

const PREVIEW_STORAGE_KEY = "cms-preview-data";

// Cache ditulis oleh panel editor (PreviewPane) dan hanya dibaca sekali saat mount.
// Pembaruan konten berikutnya selalu datang lewat postMessage, jadi tidak perlu subscribe.
function subscribeToPreviewCache() {
  return () => {};
}

function getCachedPreviewSnapshot(): string | null {
  try {
    return window.sessionStorage.getItem(PREVIEW_STORAGE_KEY);
  } catch {
    return null;
  }
}

function parsePreviewSnapshot(raw: string | null): PreviewState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PreviewState> | null;
    if (!parsed?.page || !parsed.content) return null;
    return {
      page: parsed.page,
      content: parsed.content,
      productId: typeof parsed.productId === "string" ? parsed.productId : undefined,
    };
  } catch {
    return null;
  }
}

export function CmsPreviewApp() {
  const cachedSnapshot = useSyncExternalStore(
    subscribeToPreviewCache,
    getCachedPreviewSnapshot,
    () => null,
  );
  const cachedState = useMemo(() => parsePreviewSnapshot(cachedSnapshot), [cachedSnapshot]);
  const [liveState, setLiveState] = useState<PreviewState | null>(null);
  const state = liveState ?? cachedState;

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "cms-preview-ping") {
        window.parent.postMessage({ type: "cms-preview-ready" }, window.location.origin);
        return;
      }
      if (event.data?.type !== "cms-preview") return;
      setLiveState({
        page: event.data.page as CmsPreviewTarget,
        content: event.data.content as CmsSiteContent,
        productId: typeof event.data.productId === "string" ? event.data.productId : undefined,
      });
    }
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "cms-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!state) {
    return (
      <div className="grid min-h-dvh place-items-center bg-white text-sm text-muted-foreground">
        Menyiapkan pratinjau…
      </div>
    );
  }

  const { content, page, productId } = state;
  const phone = content.site.whatsapp;
  const logo = content.brand.logo?.src ?? "/new-logo.webp";
  const menu = productMenu(content);

  const chrome = (
    <>
      <LandingNavbar nav={content.nav} menu={menu} brandName={content.brand.name} logoSrc={logo} />
    </>
  );

  let body: ReactNode = null;

  if (page === "home") {
    const sectionMap: Record<string, ReactNode> = {
      hero: <LandingHero hero={content.home.hero} phone={phone} />,
      products: <LandingProducts section={content.home.products} products={catalogProducts(content)} />,
      process: <LandingProcess section={content.home.process} />,
      why: <LandingWhy section={content.home.why} />,
      clients: <LandingClients section={content.home.clients} />,
      testimonials: <LandingTestimonials section={content.home.testimonials} />,
      cta: <LandingCta section={content.home.cta} phone={phone} />,
    };
    body = visibleSections(content.home.sections).map((section) => (
      <Fragment key={section.id}>{sectionMap[section.id] ?? null}</Fragment>
    ));
  }

  if (page === "portfolio") {
    const sectionMap: Record<string, ReactNode> = {
      header: (
        <div className="mx-auto w-[90%] pt-10 sm:pt-12 lg:pt-14">
          <PortfolioHeader portfolio={content.portfolio} />
        </div>
      ),
      grid: (
        <div className="mx-auto w-[90%] pb-16 sm:pb-20 lg:pb-24">
          <PortfolioGrid portfolio={content.portfolio} />
        </div>
      ),
      cta: <LandingCta section={content.home.cta} phone={phone} />,
    };
    body = visibleSections(content.portfolio.sections).map((section) => (
      <Fragment key={section.id}>{sectionMap[section.id] ?? null}</Fragment>
    ));
  }

  if (page === "sizeChart") {
    const sectionMap: Record<string, ReactNode> = {
      header: (
        <div className="mx-auto w-[90%] pt-10 sm:pt-12 lg:pt-14">
          <SizeChartHeader sizeChart={content.sizeChart} />
        </div>
      ),
      grid: (
        <div className="mx-auto w-[90%] pb-16 sm:pb-20 lg:pb-24">
          <SizeChartGrid sizeChart={content.sizeChart} />
        </div>
      ),
    };
    body = visibleSections(content.sizeChart.sections).map((section) => (
      <Fragment key={section.id}>{sectionMap[section.id] ?? null}</Fragment>
    ));
  }

  if (page === "fabric") {
    const sectionMap: Record<string, ReactNode> = {
      header: (
        <div className="mx-auto w-[90%] pt-10 sm:pt-12 lg:pt-14">
          <KatalogKainHeader fabric={content.fabric} />
        </div>
      ),
      grid: (
        <div className="mx-auto w-[90%] pb-16 sm:pb-20 lg:pb-24">
          <KatalogKainGrid fabric={content.fabric} comingSoon={content.comingSoon} />
        </div>
      ),
    };
    body = visibleSections(content.fabric.sections).map((section) => (
      <Fragment key={section.id}>{sectionMap[section.id] ?? null}</Fragment>
    ));
  }

  if (page === "contact") {
    const sectionMap: Record<string, ReactNode> = {
      header: <ContactHeader title={content.contact.title} />,
      info: <ContactInfo contact={content.contact} />,
      faq: <ContactFaqForm contact={content.contact} phone={phone} />,
      map: content.contact.map.visible ? <ContactMap map={content.contact.map} /> : null,
      cta: <ContactCta section={content.contact.cta} phone={phone} />,
    };
    body = visibleSections(content.contact.sections).map((section) => (
      <Fragment key={section.id}>{sectionMap[section.id] ?? null}</Fragment>
    ));
  }

  if (page === "product") {
    const product = getProduct(content, productId ?? "") ?? content.products.find((item) => item.published);
    if (!product) {
      body = <p className="mx-auto w-[90%] py-16 text-center text-sm text-muted-foreground">Belum ada produk.</p>;
    } else {
      const children = childrenOf(content, product.id);
      body =
        children.length > 0 ? (
          <ProductParentGrid product={product} comingSoon={content.comingSoon}>
            {children}
          </ProductParentGrid>
        ) : (
          <ProductDetailGrid product={product} comingSoon={content.comingSoon} />
        );
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-white">
      {chrome}
      <div className="flex-1">{body}</div>
      <LandingFooter
        footer={content.footer}
        menu={menu}
        brandName={content.brand.name}
        logoSrc={logo}
      />
      <LandingWhatsAppFab phone={phone} message={content.whatsappFab.message} visible={content.whatsappFab.visible} />
    </main>
  );
}
