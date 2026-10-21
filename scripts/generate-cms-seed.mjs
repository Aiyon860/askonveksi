import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ASKONVEKSI_WHATSAPP } from "../lib/contact.ts";
import {
  CONTACT_ADDRESS,
  CONTACT_CTA,
  CONTACT_EMAIL,
  CONTACT_FAQS,
  CONTACT_MAP_EMBED_SRC,
  CONTACT_MAP_TITLE,
  CONTACT_PHONES,
} from "../lib/contact-page.ts";
import { PRODUCT_DETAIL_GALLERIES, SIZE_CHART_IMAGES } from "../lib/cms/legacy-media.ts";
import { LANDING_NAV_LINKS, LANDING_PRODUCT_MENU } from "../lib/navigation.ts";
import { PORTFOLIO_ITEMS } from "../lib/portfolio.ts";
import { LANDING_PRODUCTS } from "../lib/products.ts";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "../lib/site.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const img = (src, alt = "", focus) => ({ src, alt, ...(focus ? { focus } : {}) });
const link = (label, href, visible = true) => ({ label, href, visible });

const heroBenefits = [
  { icon: "shirt", title: "Bahan Berkualitas", description: "Pilihan bahan yang nyaman dan tahan lama", visible: true },
  { icon: "spool", title: "Jahitan Presisi", description: "Hasil rapi dan kuat dengan standar tinggi", visible: true },
  { icon: "paintbrush", title: "Custom Desain", description: "Bebas desain, warna, ukuran, dan logo", visible: true },
  { icon: "clock", title: "On Time Production", description: "Komitmen pada ketepatan waktu produksi", visible: true },
];

const processSteps = [
  { icon: "chat", title: "Konsultasi & Desain", description: "Diskusi kebutuhan, konsep, dan desain", visible: true },
  { icon: "clipboard", title: "Pemilihan Bahan", description: "Bahan sesuai spesifikasi", visible: true },
  { icon: "shirt", title: "Produksi", description: "Cutting, jahit, bordir/sablon", visible: true },
  { icon: "badge-check", title: "Finishing", description: "Quality control dan packing", visible: true },
  { icon: "truck", title: "Pengiriman", description: "Tepat waktu ke seluruh Indonesia", visible: true },
];

const whyAdvantages = [
  { icon: "handshake", title: "Pengalaman", description: "Bertahun-tahun di industri konveksi dan apparel", visible: true },
  { icon: "user-check", title: "Tim Profesional", description: "Didukung oleh tenaga kerja terampil dan berpengalaman", visible: true },
  { icon: "factory", title: "Kapasitas Produksi Besar", description: "Siap menangani pemesanan dalam jumlah kecil maupun besar", visible: true },
  { icon: "dollar", title: "Harga Kompetitif", description: "Kualitas terbaik dengan harga yang bersaing", visible: true },
];

const clients = [
  { name: "Pertamina", src: "/client/pertamina.webp" },
  { name: "Bank Jateng", src: "/client/bankjateng.webp" },
  { name: "BRI", src: "/client/bri.webp" },
  { name: "PNM", src: "/client/pnm.webp" },
  { name: "J&T Express", src: "/client/jnt.webp" },
  { name: "Otorita Ibu Kota Nusantara", src: "/client/oikn.webp" },
  { name: "Akpol", src: "/client/akpol.webp" },
  { name: "Bareskrim", src: "/client/bareskim.webp" },
  { name: "Polantas", src: "/client/polantas.webp" },
  { name: "Universitas Diponegoro", src: "/client/undip.webp" },
  { name: "Universitas Negeri Semarang", src: "/client/unnes.webp" },
];

const testimonials = [
  {
    quote:
      "CAKEUPPP POLLL!!! Sablon Dtf nya high quality, bahannya juga bagus, pengerjaannya cepet bgtt!! Makasih as konveksii Recommendedd bangett si inehhh",
    name: "Muhammad Alaudin Candra Pratama",
    company: "Customer",
  },
  {
    quote: "Hasil sablon nya bagus, bahan nya juga enak pokoknya sesuai sama desain yg dikirim, keren bgtt",
    name: "Nisrina Salsabila",
    company: "Customer",
  },
  {
    quote:
      "tempatnya oke, menawarkan kualitas bahan yang baik dengan harga yang bersaing, cocok untuk kebutuhan seragam, workshirt atau custom",
    name: "Prokopton",
    company: "Customer",
  },
];

const topLevelOrder = new Map();
const childOrder = new Map();
const parentByChild = new Map();
let topIndex = 0;

for (const entry of LANDING_PRODUCT_MENU) {
  const slug = entry.href.replace("/produk/", "");
  topLevelOrder.set(slug, topIndex++);
  if ("children" in entry) {
    entry.children.forEach((child, index) => {
      const childSlug = child.href.replace("/produk/", "");
      parentByChild.set(childSlug, slug);
      childOrder.set(childSlug, index);
    });
  }
}

const products = LANDING_PRODUCTS.map((product, index) => {
  const detailGallery = PRODUCT_DETAIL_GALLERIES[product.slug] ?? [];
  const parentSlug = parentByChild.get(product.slug) ?? null;
  return {
    id: product.slug,
    name: product.name,
    tagline: product.tagline,
    description: product.description,
    parentSlug,
    menuVisible: topLevelOrder.has(product.slug) || parentByChild.has(product.slug),
    menuOrder: parentSlug ? (childOrder.get(product.slug) ?? 999) : (topLevelOrder.get(product.slug) ?? 999),
    catalogVisible: !product.hideFromCatalog,
    catalogOrder: index,
    cardImage: product.gallery[0] ? img(product.gallery[0].src, product.gallery[0].alt) : null,
    gallery: detailGallery.map((image) => img(image.src, image.alt)),
    features: [...product.features],
    useCases: [...product.useCases],
    seoTitle: product.name,
    seoDescription: product.description.slice(0, 500),
    published: true,
  };
});

const navItems = LANDING_NAV_LINKS.flatMap((item, index) => {
  const entries = [{ type: "link", label: item.label, href: item.href, visible: true }];
  if (index === 4) entries.push({ type: "products", label: "Produk", visible: true });
  return entries;
});

const content = {
  schemaVersion: 1,
  version: 0,
  updatedAt: new Date("2026-10-18T00:00:00.000Z").toISOString(),
  updatedBy: { id: "seed", name: "Konten awal" },

  brand: { name: SITE_NAME, logo: null },

  site: {
    url: SITE_URL.toString(),
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    ogImage: img("/hero.jpg", "Produksi seragam custom Askonveksi di Semarang"),
    whatsapp: ASKONVEKSI_WHATSAPP,
    email: CONTACT_EMAIL.value,
    addressLines: [...CONTACT_ADDRESS.lines],
    phones: CONTACT_PHONES.phones.map((phone) => ({ label: phone.label, value: phone.value, href: phone.href })),
    socials: [
      { platform: "instagram", url: "https://www.instagram.com/askonveksi_/", visible: true },
      { platform: "facebook", url: "", visible: false },
      { platform: "youtube", url: "", visible: false },
    ],
    analyticsId: "G-Y62NZQ54D0",
    searchConsoleVerification: "zpSFhEruGw-d1qYEo8_X9PNJdEwqRgTwUsUk3mhqIPs",
    areaServed: ["Semarang", "Jawa Tengah"],
  },

  nav: {
    items: navItems,
    mobileTitle: "Navigasi utama",
    cta: { label: "Hubungi Kami", href: "/#kontak", visible: true },
  },

  home: {
    sections: [
      { id: "hero", visible: true },
      { id: "products", visible: true },
      { id: "process", visible: true },
      { id: "why", visible: true },
      { id: "clients", visible: true },
      { id: "testimonials", visible: true },
      { id: "cta", visible: true },
    ],
    hero: {
      eyebrow: "Konveksi di Semarang",
      titleLine1: "Konveksi di Semarang untuk",
      titleLine2: "Seragam dan Apparel Custom",
      description:
        "Askonveksi melayani pembuatan seragam dan apparel custom untuk perusahaan, instansi, sekolah, komunitas, dan brand di Semarang serta berbagai wilayah Jawa Tengah.",
      primaryCta: {
        label: "Konsultasi Sekarang",
        href: `https://wa.me/${ASKONVEKSI_WHATSAPP}?text=${encodeURIComponent("Halo Askonveksi, saya ingin konsultasi pembuatan seragam.")}`,
        whatsappMessage: "Halo Askonveksi, saya ingin konsultasi pembuatan seragam.",
      },
      secondaryCta: { label: "Lihat Keunggulan", href: "#keunggulan" },
      image: img("/hero.jpg", "Dua pekerja konveksi meninjau desain pakaian di ruang jahit"),
      benefits: heroBenefits,
    },
    products: {
      eyebrow: "Produk Kami",
      title: "Berbagai Pilihan Apparel Sesuai Kebutuhan Anda",
      description:
        "Kami memproduksi berbagai jenis seragam dan apparel dengan kualitas terbaik, cocok untuk kebutuhan perusahaan, instansi, komunitas, sekolah, dan brand.",
      cta: link("Lihat Semua Produk", "/#katalog-produk"),
    },
    process: {
      eyebrow: "Proses Produksi Kami",
      title: "Terlengkap, Modern, dan Terpercaya",
      description:
        "Dengan dukungan tenaga kerja berpengalaman dan mesin modern, kami memastikan setiap tahap produksi berjalan dengan standar kualitas tinggi.",
      image: img("/tailor.jpg", "Proses pemotongan kain di workshop Askonveksi"),
      overlayLine1: "Dari Desain",
      overlayLine2: "Hingga Siap Pakai",
      steps: processSteps,
    },
    why: {
      eyebrow: "Mengapa Memilih Askonveksi?",
      title: "Layanan Konveksi di Jawa Tengah untuk Kebutuhan Bisnis",
      description:
        "Kami melayani kebutuhan seragam custom untuk bisnis di Semarang dan berbagai wilayah Jawa Tengah, dari konsultasi desain hingga produk siap dikirim.",
      image: img("/hero.jpg", ""),
      cta: link("Konsultasikan Kebutuhan", "#kontak"),
      advantages: whyAdvantages,
    },
    clients: {
      title: "Dipercaya oleh Berbagai Perusahaan & Instansi",
      description: "Kami telah melayani ratusan perusahaan, instansi, komunitas, dan brand di seluruh Indonesia.",
      items: clients.map((client) => ({
        name: client.name,
        logo: img(client.src, client.name),
        visible: true,
      })),
    },
    testimonials: {
      title: "Testimoni Klien",
      description: "Kepuasan pelanggan adalah prioritas kami.",
      items: testimonials.map((item) => ({ ...item, avatar: null, visible: true })),
    },
    cta: {
      title: "Siap Membuat Seragam Impian Anda?",
      description:
        "<p>Konsultasikan kebutuhan apparel bisnis Anda sekarang juga.</p><p>Tim kami siap membantu memberikan solusi terbaik.</p>",
      buttonLabel: "Hubungi Kami Sekarang",
      whatsappMessage: "Halo Askonveksi, saya ingin berkonsultasi mengenai pembuatan seragam.",
      image: img("/cta.jpg", "Koleksi pakaian produksi Askonveksi"),
    },
  },

  footer: {
    description:
      "<p>Konveksi di Semarang untuk seragam dan apparel custom — kemeja, wearpack, kaos, jaket, hingga merchandise.</p>",
    productTitle: "Produk",
    navTitle: "Navigasi",
    links: [
      link("Beranda", "/#beranda"),
      link("Tentang Kami", "/#tentang-kami"),
      link("Testimoni", "/#testimoni"),
      link("Portofolio", "/portofolio"),
      link("Size Chart", "/size-chart"),
      link("Katalog Kain", "/katalog-kain"),
      link("Contact", "/contact"),
      link("Kontak", "/#kontak"),
    ],
    socials: [
      { platform: "instagram", url: "https://www.instagram.com/askonveksi_/", visible: true },
      { platform: "facebook", url: "", visible: false },
      { platform: "youtube", url: "", visible: false },
    ],
    copyright: "© {year} Askonveksi. All rights reserved.",
    tagline: "Konveksi di Semarang untuk Seragam dan Apparel Custom",
  },

  whatsappFab: {
    visible: true,
    message: "Halo Askonveksi, saya ingin konsultasi pembuatan seragam.",
  },

  products,

  portfolio: {
    seo: {
      title: "Portofolio",
      description:
        "Portofolio hasil produksi seragam dan apparel custom Askonveksi di Semarang untuk perusahaan, instansi, komunitas, dan brand.",
      ogImage: null,
    },
    sections: [
      { id: "header", visible: true },
      { id: "grid", visible: true },
      { id: "cta", visible: true },
    ],
    eyebrow: `Dipercaya ${PORTFOLIO_ITEMS.length} perusahaan & instansi`,
    title: "Portofolio Kami",
    description:
      "Kumpulan hasil produksi seragam dan apparel custom untuk perusahaan, instansi, komunitas, dan brand yang telah memercayakan kebutuhannya kepada Askonveksi.",
    items: PORTFOLIO_ITEMS.map((item) => ({
      name: item.name,
      logo: img(item.src, `Logo ${item.name}`),
      visible: true,
    })),
  },

  sizeChart: {
    seo: {
      title: "Size Chart",
      description: "Panduan ukuran pakaian Askonveksi untuk memastikan seragam dan apparel custom Anda pas dipakai.",
      ogImage: null,
    },
    sections: [
      { id: "header", visible: true },
      { id: "grid", visible: true },
    ],
    title: "Size chart",
    description: "Panduan ukuran pakaian Askonveksi untuk memastikan seragam dan apparel custom Anda pas dipakai.",
    images: SIZE_CHART_IMAGES.map((image) => img(image.src, image.alt)),
  },

  fabric: {
    seo: {
      title: "Katalog Kain",
      description: "Katalog pilihan kain Askonveksi untuk seragam dan apparel custom Anda.",
      ogImage: null,
    },
    sections: [
      { id: "header", visible: true },
      { id: "grid", visible: true },
    ],
    title: "Katalog Kain",
    description: "Katalog pilihan kain Askonveksi untuk seragam dan apparel custom Anda.",
    comingSoon: true,
    comingSoonTitle: "Segera Hadir",
    comingSoonDescription:
      "Galeri foto {pageName} sedang kami siapkan. Silakan kembali lagi nanti atau hubungi kami untuk melihat hasil produksi terbaru.",
    comingSoonImage: img("/cooming-soon.svg", ""),
    comingSoonButtonLabel: "Kembali ke Beranda",
    comingSoonHref: "/#beranda",
    items: [],
  },

  contact: {
    seo: {
      title: "Kontak Kami",
      description: "Hubungi Askonveksi untuk konsultasi dan pemesanan seragam serta apparel custom.",
      ogImage: null,
    },
    sections: [
      { id: "header", visible: true },
      { id: "info", visible: true },
      { id: "faq", visible: true },
      { id: "map", visible: true },
      { id: "cta", visible: true },
    ],
    title: "Kontak Kami",
    email: { label: CONTACT_EMAIL.label, value: CONTACT_EMAIL.value, href: CONTACT_EMAIL.href },
    address: { label: CONTACT_ADDRESS.label, lines: [...CONTACT_ADDRESS.lines] },
    phones: {
      label: CONTACT_PHONES.label,
      items: CONTACT_PHONES.phones.map((phone) => ({ label: phone.label, value: phone.value, href: phone.href })),
    },
    faq: {
      eyebrow: "FAQ",
      title: "Masih ragu? Mungkin jawaban Anda ada di bawah.",
      items: CONTACT_FAQS.map((faq) => ({ question: faq.question, answer: faq.answer, visible: true })),
    },
    form: {
      eyebrow: "Hubungi Kami",
      title: "Ceritakan kebutuhan Anda.",
      nameLabel: "Nama",
      namePlaceholder: "Nama lengkap Anda",
      emailLabel: "Email",
      emailPlaceholder: "nama@email.com",
      phoneLabel: "No. WhatsApp",
      phonePlaceholder: "08xx-xxxx-xxxx",
      subjectLabel: "Kebutuhan",
      subjectPlaceholder: "Mis. Seragam kerja 50 pcs",
      messageLabel: "Pesan",
      messagePlaceholder: "Ceritakan kebutuhan seragam atau apparel Anda",
      submitLabel: "Kirim via WhatsApp",
      successLabel: "WhatsApp Terbuka",
      helperText: "Pesan Anda akan dibuka di WhatsApp dengan format otomatis — tinggal tekan kirim.",
    },
    map: { title: CONTACT_MAP_TITLE, embedSrc: CONTACT_MAP_EMBED_SRC, visible: true },
    cta: {
      title: CONTACT_CTA.title,
      subtitle: CONTACT_CTA.subtitle,
      buttonLabel: CONTACT_CTA.buttonLabel,
      whatsappMessage: "Halo Askonveksi, saya ingin meminta penawaran untuk kebutuhan seragam.",
      image: img("/cta.jpg", ""),
    },
  },

  comingSoon: {
    title: "Segera Hadir",
    image: img("/cooming-soon.svg", ""),
    description:
      "Galeri foto {pageName} sedang kami siapkan. Silakan kembali lagi nanti atau hubungi kami untuk melihat hasil produksi terbaru.",
    buttonLabel: "Kembali ke Beranda",
    href: "/#beranda",
  },
};

const { siteContentSchemaWithRules } = await import("../lib/cms/schema.ts");
const parsed = siteContentSchemaWithRules.safeParse(content);
if (!parsed.success) {
  console.error(parsed.error.issues.slice(0, 20));
  process.exitCode = 1;
} else {
  const target = join(root, "lib/cms/seed-content.json");
  await writeFile(target, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  console.log(`Seed ditulis: ${target} (${products.length} produk, ${content.sizeChart.images.length} size chart)`);
}
