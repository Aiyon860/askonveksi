import { LandingFooter } from "@/components/landing-footer";
import { LandingNavbar } from "@/components/landing-navbar";
import { getSiteContent } from "@/lib/cms/store";
import { productMenu } from "@/lib/cms/selectors";
import { getSiteLogo } from "@/lib/site-logo";

async function chromeData() {
  const content = await getSiteContent();
  const fallback = content.brand.logo ? null : await getSiteLogo().catch(() => null);
  return {
    content,
    menu: productMenu(content),
    brandName: content.brand.name,
    logoSrc: content.brand.logo?.src ?? fallback?.src ?? "/new-logo.webp",
    logoUnoptimized: content.brand.logo ? false : Boolean(fallback?.unoptimized),
  };
}

export async function SiteNavbar() {
  const data = await chromeData();
  return (
    <LandingNavbar
      nav={data.content.nav}
      menu={data.menu}
      brandName={data.brandName}
      logoSrc={data.logoSrc}
      logoUnoptimized={data.logoUnoptimized}
    />
  );
}

export async function SiteFooter() {
  const data = await chromeData();
  return (
    <LandingFooter
      footer={data.content.footer}
      menu={data.menu}
      brandName={data.brandName}
      logoSrc={data.logoSrc}
      logoUnoptimized={data.logoUnoptimized}
    />
  );
}
