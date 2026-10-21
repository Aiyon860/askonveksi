import { CMS_ICON_OPTIONS } from "@/lib/cms/icons";
import type { CmsSiteContent } from "@/lib/cms/types";

export type CmsField =
  | { kind: "text"; path: string; label: string; help?: string; placeholder?: string; readOnly?: boolean; maxLength?: number }
  | { kind: "textarea"; path: string; label: string; help?: string; rows?: number; maxLength?: number }
  | { kind: "rich"; path: string; label: string; help?: string }
  | { kind: "image"; path: string; label: string; help?: string; focus?: boolean }
  | { kind: "switch"; path: string; label: string; help?: string }
  | { kind: "select"; path: string; label: string; options: { value: string; label: string }[]; help?: string }
  | { kind: "number"; path: string; label: string; help?: string; min?: number; max?: number }
  | { kind: "stringList"; path: string; label: string; help?: string; rows?: number }
  | {
      kind: "list";
      path: string;
      label: string;
      itemLabel: string;
      fields: CmsField[];
      newItem: Record<string, unknown>;
      max?: number;
      help?: string;
    }
  | { kind: "group"; label: string; fields: CmsField[]; help?: string; collapsed?: boolean }
  | { kind: "sections"; path: string; label: string; labels: Record<string, string>; help?: string }
  | { kind: "navItems"; path: string; label: string; help?: string }
  | { kind: "link"; path: string; label: string; help?: string }
  | { kind: "imageList"; path: string; label: string; help?: string }
  | { kind: "seo"; path: string; label?: string }
  | { kind: "divider" };

export type CmsPreviewTarget = "home" | "portfolio" | "sizeChart" | "fabric" | "contact" | "product";

export type CmsEditorPage = {
  id: string;
  title: string;
  description: string;
  preview: CmsPreviewTarget;
  fields: CmsField[];
};

export function cmsFieldKey(field: CmsField, index = 0) {
  if (field.kind === "divider") return `divider-${index}`;
  if (field.kind === "group") return `group-${field.label}-${index}`;
  return field.path;
}

const iconOptions = CMS_ICON_OPTIONS.map((item) => ({ value: item.value, label: item.label }));
const socialOptions = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
];

const text = (path: string, label: string, help?: string, placeholder?: string, readOnly?: boolean): CmsField => ({
  kind: "text",
  path,
  label,
  help,
  placeholder,
  readOnly,
});
const textarea = (path: string, label: string, help?: string, rows = 3): CmsField => ({
  kind: "textarea",
  path,
  label,
  help,
  rows,
});
const rich = (path: string, label: string, help?: string): CmsField => ({ kind: "rich", path, label, help });
const image = (path: string, label: string, help?: string, focus = false): CmsField => ({ kind: "image", path, label, help, focus });
const toggle = (path: string, label: string, help?: string): CmsField => ({ kind: "switch", path, label, help });
const link = (path: string, label: string, help?: string): CmsField => ({ kind: "link", path, label, help });
const seo = (path: string): CmsField => ({ kind: "seo", path, label: "SEO halaman" });
const group = (label: string, fields: CmsField[], help?: string, collapsed = false): CmsField => ({
  kind: "group",
  label,
  fields,
  help,
  collapsed,
});
const list = (
  path: string,
  label: string,
  itemLabel: string,
  fields: CmsField[],
  newItem: Record<string, unknown>,
  help?: string,
  max = 100,
): CmsField => ({ kind: "list", path, label, itemLabel, fields, newItem, help, max });

const benefitFields: CmsField[] = [
  { kind: "select", path: "icon", label: "Ikon", options: iconOptions },
  text("title", "Judul"),
  textarea("description", "Deskripsi", undefined, 2),
  toggle("visible", "Tampilkan"),
];

const socialFields: CmsField[] = [
  { kind: "select", path: "platform", label: "Platform", options: socialOptions },
  text("url", "URL profil", "Contoh: https://instagram.com/namabisnis"),
  toggle("visible", "Tampilkan"),
];

export const homeEditor: CmsEditorPage = {
  id: "beranda",
  title: "Beranda",
  description: "Edit seluruh isi landing page: hero, produk, proses, keunggulan, klien, testimoni, dan CTA.",
  preview: "home",
  fields: [
    {
      kind: "sections",
      path: "home.sections",
      label: "Urutan & bagian yang tampil",
      help: "Gunakan tombol naik/turun dan ikon mata. Minimal satu bagian harus tampil.",
      labels: {
        hero: "Hero + keunggulan",
        products: "Katalog produk",
        process: "Proses produksi",
        why: "Mengapa memilih kami",
        clients: "Logo klien",
        testimonials: "Testimoni",
        cta: "Ajakan kontak (CTA)",
      },
    },
    group("Hero", [
      text("home.hero.eyebrow", "Teks kecil di atas judul"),
      text("home.hero.titleLine1", "Judul baris pertama"),
      text("home.hero.titleLine2", "Judul baris kedua"),
      rich("home.hero.description", "Deskripsi"),
      group("Tombol utama", [
        text("home.hero.primaryCta.label", "Label tombol"),
        text("home.hero.primaryCta.href", "Link tombol", "Boleh link WhatsApp, #anchor, atau URL."),
        textarea("home.hero.primaryCta.whatsappMessage", "Pesan WhatsApp otomatis", undefined, 2),
      ]),
      group("Tombol kedua", [text("home.hero.secondaryCta.label", "Label tombol"), text("home.hero.secondaryCta.href", "Link tombol")]),
      image("home.hero.image", "Gambar latar hero", "Rasio landscape, minimal 1920 × 1080 px.", true),
      list("home.hero.benefits", "Keunggulan di bawah hero", "Keunggulan", benefitFields, {
        icon: "shirt",
        title: "Keunggulan baru",
        description: "Jelaskan manfaatnya.",
        visible: true,
      }),
    ]),
    group("Katalog produk", [
      text("home.products.eyebrow", "Teks kecil"),
      text("home.products.title", "Judul"),
      rich("home.products.description", "Deskripsi"),
      link("home.products.cta", "Tombol lihat semua produk"),
    ]),
    group("Proses produksi", [
      image("home.process.image", "Gambar kiri", "Rasio portrait/landscape, minimal 1200 px.", true),
      text("home.process.overlayLine1", "Teks overlay baris 1"),
      text("home.process.overlayLine2", "Teks overlay baris 2"),
      text("home.process.eyebrow", "Teks kecil"),
      text("home.process.title", "Judul"),
      rich("home.process.description", "Deskripsi"),
      list("home.process.steps", "Langkah produksi", "Langkah", benefitFields, {
        icon: "check",
        title: "Langkah baru",
        description: "Jelaskan langkah ini.",
        visible: true,
      }),
    ]),
    group("Mengapa memilih kami", [
      image("home.why.image", "Gambar latar", "Gunakan gambar landscape.", true),
      text("home.why.eyebrow", "Teks kecil"),
      text("home.why.title", "Judul"),
      rich("home.why.description", "Deskripsi"),
      link("home.why.cta", "Tombol"),
      list("home.why.advantages", "Keunggulan", "Keunggulan", benefitFields, {
        icon: "award",
        title: "Keunggulan baru",
        description: "Jelaskan keunggulan ini.",
        visible: true,
      }),
    ]),
    group("Logo klien", [
      text("home.clients.title", "Judul"),
      rich("home.clients.description", "Deskripsi"),
      list(
        "home.clients.items",
        "Daftar klien",
        "Klien",
        [text("name", "Nama perusahaan"), image("logo", "Logo", "Gunakan PNG/WebP transparan."), toggle("visible", "Tampilkan")],
        { name: "Klien baru", logo: { src: "/client/bri.webp", alt: "Logo klien" }, visible: true },
      ),
    ]),
    group("Testimoni", [
      text("home.testimonials.title", "Judul"),
      rich("home.testimonials.description", "Deskripsi"),
      list(
        "home.testimonials.items",
        "Daftar testimoni",
        "Testimoni",
        [
          rich("quote", "Kutipan"),
          text("name", "Nama"),
          text("company", "Keterangan / perusahaan"),
          image("avatar", "Foto (opsional)"),
          toggle("visible", "Tampilkan"),
        ],
        { quote: "Testimoni baru", name: "Nama klien", company: "Customer", avatar: null, visible: true },
      ),
    ]),
    group("Ajakan kontak (CTA)", [
      text("home.cta.title", "Judul"),
      rich("home.cta.description", "Deskripsi"),
      text("home.cta.buttonLabel", "Label tombol"),
      textarea("home.cta.whatsappMessage", "Pesan WhatsApp otomatis", undefined, 2),
      image("home.cta.image", "Gambar latar", "Gunakan gambar landscape.", true),
    ]),
  ],
};

export const portfolioEditor: CmsEditorPage = {
  id: "portofolio",
  title: "Portofolio",
  description: "Atur judul, deskripsi, logo klien, dan urutan bagian halaman portofolio.",
  preview: "portfolio",
  fields: [
    {
      kind: "sections",
      path: "portfolio.sections",
      label: "Urutan & bagian yang tampil",
      labels: { header: "Judul & deskripsi", grid: "Grid portofolio", cta: "Ajakan kontak" },
    },
    text("portfolio.eyebrow", "Teks kecil"),
    text("portfolio.title", "Judul"),
    rich("portfolio.description", "Deskripsi"),
    list(
      "portfolio.items",
      "Daftar portofolio",
      "Klien",
      [text("name", "Nama perusahaan"), image("logo", "Logo"), toggle("visible", "Tampilkan")],
      { name: "Klien baru", logo: { src: "/client/bri.webp", alt: "Logo klien" }, visible: true },
      undefined,
      200,
    ),
    seo("portfolio.seo"),
  ],
};

export const sizeChartEditor: CmsEditorPage = {
  id: "size-chart",
  title: "Size Chart",
  description: "Ganti judul, deskripsi, dan seluruh gambar panduan ukuran.",
  preview: "sizeChart",
  fields: [
    {
      kind: "sections",
      path: "sizeChart.sections",
      label: "Urutan & bagian yang tampil",
      labels: { header: "Judul & deskripsi", grid: "Grid gambar" },
    },
    text("sizeChart.title", "Judul"),
    rich("sizeChart.description", "Deskripsi"),
    { kind: "imageList", path: "sizeChart.images", label: "Gambar size chart", help: "Urutkan gambar sesuai urutan tampil." },
    seo("sizeChart.seo"),
  ],
};

export const fabricEditor: CmsEditorPage = {
  id: "katalog-kain",
  title: "Katalog Kain",
  description: "Atur judul, mode segera hadir, dan daftar kain.",
  preview: "fabric",
  fields: [
    {
      kind: "sections",
      path: "fabric.sections",
      label: "Urutan & bagian yang tampil",
      labels: { header: "Judul & deskripsi", grid: "Grid kain" },
    },
    text("fabric.title", "Judul"),
    rich("fabric.description", "Deskripsi"),
    toggle("fabric.comingSoon", "Tampilkan overlay \"Segera Hadir\"", "Matikan untuk menampilkan daftar kain."),
    group("Isi overlay segera hadir", [
      text("fabric.comingSoonTitle", "Judul"),
      rich("fabric.comingSoonDescription", "Deskripsi", "Gunakan {pageName} untuk menyisipkan nama halaman."),
      image("fabric.comingSoonImage", "Ilustrasi"),
      text("fabric.comingSoonButtonLabel", "Label tombol"),
      text("fabric.comingSoonHref", "Link tombol"),
    ]),
    list(
      "fabric.items",
      "Daftar kain",
      "Kain",
      [text("name", "Nama kain"), image("image", "Foto kain"), rich("description", "Deskripsi"), toggle("visible", "Tampilkan")],
      { name: "Kain baru", image: { src: "/assets/pdh-kemeja/BUANA.webp", alt: "Kain baru" }, description: "", visible: true },
    ),
    seo("fabric.seo"),
  ],
};

export const contactEditor: CmsEditorPage = {
  id: "kontak",
  title: "Halaman Kontak",
  description: "Edit informasi kontak, FAQ, teks formulir, peta, dan CTA.",
  preview: "contact",
  fields: [
    {
      kind: "sections",
      path: "contact.sections",
      label: "Urutan & bagian yang tampil",
      labels: {
        header: "Judul halaman",
        info: "Informasi kontak",
        faq: "FAQ & formulir",
        map: "Peta",
        cta: "Ajakan kontak",
      },
    },
    text("contact.title", "Judul halaman"),
    group("Informasi kontak", [
      group("Email", [
        text("contact.email.label", "Label"),
        text("contact.email.value", "Alamat email"),
        text("contact.email.href", "Link email", "Contoh: mailto:email@domain.com"),
      ]),
      group("Alamat", [text("contact.address.label", "Label"), { kind: "stringList", path: "contact.address.lines", label: "Baris alamat", rows: 3 }]),
      group("Telepon", [
        text("contact.phones.label", "Label"),
        list(
          "contact.phones.items",
          "Nomor telepon",
          "Nomor",
          [text("label", "Keterangan"), text("value", "Nomor"), text("href", "Link telepon", "Contoh: tel:+62812...")],
          { label: "Admin", value: "08xx-xxxx-xxxx", href: "tel:+6280000000000" },
        ),
      ]),
    ]),
    group("FAQ", [
      text("contact.faq.eyebrow", "Teks kecil"),
      text("contact.faq.title", "Judul"),
      list(
        "contact.faq.items",
        "Daftar pertanyaan",
        "Pertanyaan",
        [text("question", "Pertanyaan"), rich("answer", "Jawaban"), toggle("visible", "Tampilkan")],
        { question: "Pertanyaan baru", answer: "Jawaban", visible: true },
      ),
    ]),
    group("Teks formulir", [
      text("contact.form.eyebrow", "Teks kecil"),
      text("contact.form.title", "Judul"),
      text("contact.form.nameLabel", "Label nama"),
      text("contact.form.namePlaceholder", "Placeholder nama"),
      text("contact.form.emailLabel", "Label email"),
      text("contact.form.emailPlaceholder", "Placeholder email"),
      text("contact.form.phoneLabel", "Label WhatsApp"),
      text("contact.form.phonePlaceholder", "Placeholder WhatsApp"),
      text("contact.form.subjectLabel", "Label kebutuhan"),
      text("contact.form.subjectPlaceholder", "Placeholder kebutuhan"),
      text("contact.form.messageLabel", "Label pesan"),
      text("contact.form.messagePlaceholder", "Placeholder pesan"),
      text("contact.form.submitLabel", "Label tombol kirim"),
      text("contact.form.successLabel", "Label setelah WhatsApp terbuka"),
      textarea("contact.form.helperText", "Teks bantuan", undefined, 2),
    ]),
    group("Peta", [text("contact.map.title", "Judul peta"), text("contact.map.embedSrc", "URL embed Google Maps"), toggle("contact.map.visible", "Tampilkan peta")]),
    group("CTA kontak", [
      text("contact.cta.title", "Judul"),
      textarea("contact.cta.subtitle", "Subjudul", undefined, 2),
      text("contact.cta.buttonLabel", "Label tombol"),
      textarea("contact.cta.whatsappMessage", "Pesan WhatsApp otomatis", undefined, 2),
      image("contact.cta.image", "Gambar latar", undefined, true),
    ]),
    seo("contact.seo"),
  ],
};

export const settingsEditor: CmsEditorPage = {
  id: "pengaturan",
  title: "Pengaturan Website",
  description: "Identitas website, WhatsApp, navigasi, footer, SEO global, dan teks \"Segera Hadir\".",
  preview: "home",
  fields: [
    group("Identitas website", [
      text("brand.name", "Nama brand"),
      image("brand.logo", "Logo website", "Dipakai di navbar, footer, dan halaman login. Kosongkan untuk memakai logo Profil Perusahaan."),
    ]),
    group("Informasi utama", [
      text("site.url", "URL website", "Contoh: https://askonveksi.web.id"),
      text("site.title", "Judul utama website"),
      textarea("site.description", "Deskripsi website", "Dipakai untuk SEO default.", 3),
      image("site.ogImage", "Gambar default saat dibagikan"),
      text("site.whatsapp", "Nomor WhatsApp", "Digit saja, contoh 6281912924898."),
      text("site.email", "Email"),
      { kind: "stringList", path: "site.addressLines", label: "Baris alamat", rows: 3 },
      list(
        "site.phones",
        "Nomor telepon",
        "Nomor",
        [text("label", "Keterangan"), text("value", "Nomor"), text("href", "Link telepon")],
        { label: "Admin", value: "08xx-xxxx-xxxx", href: "tel:+6280000000000" },
      ),
      list("site.socials", "Media sosial", "Sosial", socialFields, { platform: "instagram", url: "", visible: false }),
      text("site.analyticsId", "ID Google Analytics", "Kosongkan jika tidak ingin memuat analytics."),
      text("site.searchConsoleVerification", "Kode verifikasi Google Search Console"),
      { kind: "stringList", path: "site.areaServed", label: "Area layanan", rows: 2 },
    ]),
    group("Navigasi", [
      { kind: "navItems", path: "nav.items", label: "Item navigasi", help: "Tambahkan link atau satu dropdown Produk, lalu atur urutannya." },
      text("nav.mobileTitle", "Judul menu mobile"),
      link("nav.cta", "Tombol kanan navbar"),
    ]),
    group("Footer", [
      rich("footer.description", "Deskripsi footer"),
      text("footer.productTitle", "Judul kolom produk"),
      text("footer.navTitle", "Judul kolom navigasi"),
      list(
        "footer.links",
        "Link footer",
        "Link",
        [text("label", "Label"), text("href", "Link"), toggle("visible", "Tampilkan")],
        { label: "Link baru", href: "/", visible: true },
      ),
      list("footer.socials", "Media sosial footer", "Sosial", socialFields, { platform: "instagram", url: "", visible: false }),
      text("footer.copyright", "Teks copyright", "Gunakan {year} untuk tahun otomatis."),
      text("footer.tagline", "Teks tagline bawah"),
    ]),
    group("Tombol WhatsApp mengambang", [
      toggle("whatsappFab.visible", "Tampilkan tombol WhatsApp"),
      textarea("whatsappFab.message", "Pesan WhatsApp otomatis", undefined, 2),
    ]),
    group("Teks \"Segera Hadir\"", [
      text("comingSoon.title", "Judul"),
      rich("comingSoon.description", "Deskripsi", "Gunakan {pageName} untuk nama halaman."),
      image("comingSoon.image", "Ilustrasi"),
      text("comingSoon.buttonLabel", "Label tombol"),
      text("comingSoon.href", "Link tombol"),
    ]),
  ],
};

export function productEditor(content: CmsSiteContent, index: number): CmsEditorPage {
  const product = content.products[index];
  const parentOptions = [
    { value: "", label: "Tanpa induk (produk mandiri)" },
    ...content.products
      .filter((item) => item.id !== product.id && !item.parentSlug)
      .map((item) => ({ value: item.id, label: item.name })),
  ];
  return {
    id: `produk/${product.id}`,
    title: `Produk: ${product.name}`,
    description: "Edit informasi produk, galeri, fitur, dan pengaturannya.",
    preview: "product",
    fields: [
      group("Informasi produk", [
        text(`products.${index}.id`, "Slug produk", "Slug tidak bisa diubah setelah dibuat.", undefined, true),
        text(`products.${index}.name`, "Nama produk"),
        text(`products.${index}.tagline`, "Tagline"),
        rich(`products.${index}.description`, "Deskripsi"),
        { kind: "select", path: `products.${index}.parentSlug`, label: "Induk produk", options: parentOptions },
        toggle(`products.${index}.published`, "Tampilkan halaman produk"),
      ]),
      group("Kartu & galeri", [
        image(`products.${index}.cardImage`, "Gambar kartu katalog", "Gambar utama di kartu produk."),
        { kind: "imageList", path: `products.${index}.gallery`, label: "Galeri halaman produk", help: "Jika kosong, halaman menampilkan overlay \"Segera Hadir\"." },
      ]),
      group("Fitur & penggunaan", [
        { kind: "stringList", path: `products.${index}.features`, label: "Fitur produk", help: "Satu fitur per baris." },
        { kind: "stringList", path: `products.${index}.useCases`, label: "Cocok untuk", help: "Satu penggunaan per baris." },
      ]),
      group("Urutan tampil", [
        { kind: "number", path: `products.${index}.menuOrder`, label: "Urutan di menu", min: 0, max: 999 },
        { kind: "number", path: `products.${index}.catalogOrder`, label: "Urutan di katalog", min: 0, max: 999 },
        toggle(`products.${index}.menuVisible`, "Tampilkan di menu navigasi"),
        toggle(`products.${index}.catalogVisible`, "Tampilkan di katalog beranda"),
      ]),
      group("SEO produk", [
        text(`products.${index}.seoTitle`, "Judul di Google"),
        textarea(`products.${index}.seoDescription`, "Deskripsi di Google", undefined, 3),
      ]),
    ],
  };
}
