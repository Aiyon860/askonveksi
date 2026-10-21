import { z } from "zod";

import type { CmsSiteContent } from "@/lib/cms/types";

const SAFE_HREF = /^(?:https?:\/\/[^\s]+|mailto:[^\s]+|tel:[^\s]+|\/(?!\/)[^\s]*|#[^\s]+)$/i;
const SAFE_IMAGE_SRC = /^\/(?!\/)[^\s]+\.(?:avif|webp|png|jpe?g|svg)$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HTTP_URL = /^https?:\/\/[^\s]+$/i;

export function isSafeHref(value: string) {
  return SAFE_HREF.test(value);
}

export function isSafeImageSrc(value: string) {
  if (!SAFE_IMAGE_SRC.test(value)) return false;
  return !value.split("/").some((part) => part === ".." || part === ".");
}

export function isHttpUrl(value: string) {
  return HTTP_URL.test(value);
}

const shortText = z.string().max(240);
const mediumText = z.string().max(1000);
const richText = z.string().max(20_000);

const hrefSchema = z.string().max(600).refine(isSafeHref, "Link harus berupa http(s), mailto, tel, path internal, atau anchor.");
const imageSrcSchema = z
  .string()
  .max(600)
  .refine(isSafeImageSrc, "Gambar harus memakai path lokal /... dengan ekstensi gambar yang didukung.");

export const cmsImageSchema = z.object({
  src: imageSrcSchema,
  alt: z.string().max(300),
  focus: z.enum(["left", "center", "right"]).optional(),
});

const linkSchema = z.object({
  label: shortText,
  href: hrefSchema,
  visible: z.boolean(),
});

const benefitSchema = z.object({
  icon: z.string().max(60),
  title: shortText,
  description: mediumText,
  visible: z.boolean(),
});

const sectionStateSchema = z.object({
  id: z.string().max(40),
  visible: z.boolean(),
});

const uniqueSections = (value: { id: string }[]) =>
  new Set(value.map((item) => item.id)).size === value.length;

const homeSectionsSchema = z
  .array(sectionStateSchema)
  .min(1)
  .max(7)
  .refine(uniqueSections, "Section beranda tidak boleh duplikat.");

const smallSectionsSchema = z
  .array(sectionStateSchema)
  .min(1)
  .max(6)
  .refine(uniqueSections, "Section halaman tidak boleh duplikat.");

export const seoSchema = z.object({
  title: shortText,
  description: z.string().max(500),
  ogImage: cmsImageSchema.nullable(),
});

export const productSchema = z.object({
  id: z.string().min(2).max(80).regex(SLUG, "Slug produk hanya boleh huruf kecil, angka, dan tanda hubung."),
  name: shortText,
  tagline: z.string().max(300),
  description: richText,
  parentSlug: z.string().max(80).nullable(),
  menuVisible: z.boolean(),
  menuOrder: z.number().int().min(0).max(999),
  catalogVisible: z.boolean(),
  catalogOrder: z.number().int().min(0).max(999),
  cardImage: cmsImageSchema.nullable(),
  gallery: z.array(cmsImageSchema).max(60),
  features: z.array(z.string().max(300)).max(30),
  useCases: z.array(z.string().max(120)).max(30),
  seoTitle: shortText,
  seoDescription: z.string().max(500),
  published: z.boolean(),
});

export const siteContentSchema = z.object({
  schemaVersion: z.literal(1),
  version: z.number().int().min(0),
  updatedAt: z.string().max(40),
  updatedBy: z.object({ id: z.string().max(80), name: z.string().max(160) }),

  brand: z.object({
    name: shortText,
    logo: cmsImageSchema.nullable(),
  }),

  site: z.object({
    url: z.string().max(300).refine(isHttpUrl, "URL situs harus diawali http:// atau https://."),
    title: z.string().max(200),
    description: z.string().max(500),
    ogImage: cmsImageSchema.nullable(),
    whatsapp: z.string().regex(/^\d{8,15}$/, "Nomor WhatsApp harus 8–15 digit tanpa tanda plus/spasi."),
    email: z.string().max(320),
    addressLines: z.array(z.string().max(300)).max(10),
    phones: z.array(z.object({ label: shortText, value: z.string().max(60), href: hrefSchema })).max(10),
    socials: z
      .array(
        z.object({
          platform: z.enum(["instagram", "facebook", "youtube"]),
          url: z.string().max(600),
          visible: z.boolean(),
        }),
      )
      .max(10),
    analyticsId: z.string().max(80),
    searchConsoleVerification: z.string().max(200),
    areaServed: z.array(z.string().max(120)).max(20),
  }),

  nav: z.object({
    items: z
      .array(
        z.discriminatedUnion("type", [
          z.object({ type: z.literal("link"), label: shortText, href: hrefSchema, visible: z.boolean() }),
          z.object({ type: z.literal("products"), label: shortText, visible: z.boolean() }),
        ]),
      )
      .min(1)
      .max(20),
    mobileTitle: shortText,
    cta: z.object({ label: shortText, href: hrefSchema, visible: z.boolean() }),
  }),

  home: z.object({
    sections: homeSectionsSchema,
    hero: z.object({
      eyebrow: shortText,
      titleLine1: shortText,
      titleLine2: shortText,
      description: richText,
      primaryCta: z.object({ label: shortText, href: hrefSchema, whatsappMessage: mediumText }),
      secondaryCta: z.object({ label: shortText, href: hrefSchema }),
      image: cmsImageSchema,
      benefits: z.array(benefitSchema).max(12),
    }),
    products: z.object({
      eyebrow: shortText,
      title: shortText,
      description: richText,
      cta: linkSchema,
    }),
    process: z.object({
      eyebrow: shortText,
      title: shortText,
      description: richText,
      image: cmsImageSchema,
      overlayLine1: shortText,
      overlayLine2: shortText,
      steps: z.array(benefitSchema).max(12),
    }),
    why: z.object({
      eyebrow: shortText,
      title: shortText,
      description: richText,
      image: cmsImageSchema,
      cta: linkSchema,
      advantages: z.array(benefitSchema).max(12),
    }),
    clients: z.object({
      title: shortText,
      description: richText,
      items: z
        .array(z.object({ name: shortText, logo: cmsImageSchema, visible: z.boolean() }))
        .max(100),
    }),
    testimonials: z.object({
      title: shortText,
      description: richText,
      items: z
        .array(
          z.object({
            quote: richText,
            name: shortText,
            company: shortText,
            avatar: cmsImageSchema.nullable(),
            visible: z.boolean(),
          }),
        )
        .max(50),
    }),
    cta: z.object({
      title: shortText,
      description: richText,
      buttonLabel: shortText,
      whatsappMessage: mediumText,
      image: cmsImageSchema,
    }),
  }),

  footer: z.object({
    description: richText,
    productTitle: shortText,
    navTitle: shortText,
    links: z.array(linkSchema).max(20),
    socials: z
      .array(
        z.object({
          platform: z.enum(["instagram", "facebook", "youtube"]),
          url: z.string().max(600),
          visible: z.boolean(),
        }),
      )
      .max(10),
    copyright: z.string().max(300),
    tagline: z.string().max(300),
  }),

  whatsappFab: z.object({ visible: z.boolean(), message: mediumText }),

  products: z.array(productSchema).max(100),

  portfolio: z.object({
    seo: seoSchema,
    sections: smallSectionsSchema,
    eyebrow: shortText,
    title: shortText,
    description: richText,
    items: z.array(z.object({ name: shortText, logo: cmsImageSchema, visible: z.boolean() })).max(200),
  }),

  sizeChart: z.object({
    seo: seoSchema,
    sections: smallSectionsSchema,
    title: shortText,
    description: richText,
    images: z.array(cmsImageSchema).max(100),
  }),

  fabric: z.object({
    seo: seoSchema,
    sections: smallSectionsSchema,
    title: shortText,
    description: richText,
    comingSoon: z.boolean(),
    comingSoonTitle: shortText,
    comingSoonDescription: richText,
    comingSoonImage: cmsImageSchema,
    comingSoonButtonLabel: shortText,
    comingSoonHref: hrefSchema,
    items: z
      .array(
        z.object({
          name: shortText,
          image: cmsImageSchema,
          description: z.string().max(1000),
          visible: z.boolean(),
        }),
      )
      .max(100),
  }),

  contact: z.object({
    seo: seoSchema,
    sections: smallSectionsSchema,
    title: shortText,
    email: z.object({ label: shortText, value: z.string().max(320), href: hrefSchema }),
    address: z.object({ label: shortText, lines: z.array(z.string().max(300)).max(10) }),
    phones: z.object({
      label: shortText,
      items: z.array(z.object({ label: shortText, value: z.string().max(60), href: hrefSchema })).max(10),
    }),
    faq: z.object({
      eyebrow: shortText,
      title: shortText,
      items: z
        .array(z.object({ question: z.string().max(300), answer: richText, visible: z.boolean() }))
        .max(50),
    }),
    form: z.object({
      eyebrow: shortText,
      title: shortText,
      nameLabel: shortText,
      namePlaceholder: shortText,
      emailLabel: shortText,
      emailPlaceholder: shortText,
      phoneLabel: shortText,
      phonePlaceholder: shortText,
      subjectLabel: shortText,
      subjectPlaceholder: shortText,
      messageLabel: shortText,
      messagePlaceholder: mediumText,
      submitLabel: shortText,
      successLabel: shortText,
      helperText: mediumText,
    }),
    map: z.object({ title: shortText, embedSrc: z.string().max(1000), visible: z.boolean() }),
    cta: z.object({
      title: shortText,
      subtitle: z.string().max(1000),
      buttonLabel: shortText,
      whatsappMessage: mediumText,
      image: cmsImageSchema,
    }),
  }),

  comingSoon: z.object({
    title: shortText,
    description: richText,
    image: cmsImageSchema,
    buttonLabel: shortText,
    href: hrefSchema,
  }),
});

function validateProducts(value: CmsSiteContent) {
  const ids = new Set<string>();
  for (const product of value.products) {
    if (ids.has(product.id)) return "Slug produk tidak boleh duplikat.";
    ids.add(product.id);
  }
  for (const product of value.products) {
    if (!product.parentSlug) continue;
    if (product.parentSlug === product.id) return `Produk "${product.name}" tidak boleh menjadi induk dirinya sendiri.`;
    const parent = value.products.find((item) => item.id === product.parentSlug);
    if (!parent) return `Induk produk "${product.name}" tidak ditemukan.`;
    if (parent.parentSlug) return `Produk "${product.name}" hanya boleh satu tingkat di bawah induk.`;
  }
  return null;
}

export const siteContentSchemaWithRules = siteContentSchema.superRefine((value, ctx) => {
  const productError = validateProducts(value as CmsSiteContent);
  if (productError) ctx.addIssue({ code: "custom", message: productError, path: ["products"] });
});

export type ParsedSiteContent = z.infer<typeof siteContentSchema>;
