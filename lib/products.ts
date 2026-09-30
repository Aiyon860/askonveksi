export type LandingProduct = {
  /** URL slug, also used as folder name in /produk/[slug] */
  slug: string;
  /** Display name, e.g. "Kaos" */
  name: string;
  /** Short tagline shown under the product name */
  tagline: string;
  /** 2-3 sentence description for the detail page */
  description: string;
  /** Gallery images: [main photo, cutout render] */
  gallery: { src: string; alt: string }[];
  /** Category-only bento gallery slots (7 cells). Placeholder srcs point at the
   * product cutout PNG; replace each entry with a real photo when available. */
  bento: { src: string; alt: string }[];
  /** Selling points rendered as a checklist on the detail page */
  features: string[];
  /** Ideal use cases rendered as chips */
  useCases: string[];
  /** Hide from the landing catalog grid (detail page stays available).
   * Used for products that have no catalog photo yet. */
  hideFromCatalog?: boolean;
};

export const LANDING_PRODUCTS: LandingProduct[] = [
  {
    slug: "kemeja",
    name: "Kemeja",
    tagline: "Formal, rapi, dan nyaman untuk identitas tim Anda",
    description:
      "Kemeja custom dengan potongan presisi dan jahitan rapi, diproduksi dari bahan pilihan yang nyaman dipakai seharian. Cocok untuk seragam kantor, instansi, dan komunitas yang ingin tampil profesional dan konsisten.",
    gallery: [
      { src: "/product/kemeja.png", alt: "Produk Kemeja Askonveksi" },
      { src: "/kemeja.jpeg", alt: "Detail kemeja produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/kemeja.png",
      alt: `Galeri Kemeja Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan pilihan: katun, TC, atau sesuai permintaan",
      "Sablon logo & bordir nama di dada",
      "Ukuran S sampai XXL, bisa custom ukuran",
      "Jahitan presisi dengan finishing rapi",
    ],
    useCases: ["Seragam kantor", "Instansi & pegawai", "Komunitas", "Event"],
  },
  {
    slug: "pdh",
    name: "PDH",
    tagline: "Pakaian Dinas Harian yang tegas dan tahan pakai",
    description:
      "PDH custom untuk kebutuhan dinas harian instansi dan perusahaan. Diproduksi dengan bahan yang kuat namun tetap nyaman, lengkap dengan atribut sesuai standar instansi Anda.",
    gallery: [
      { src: "/product/pdh.png", alt: "Produk PDH Askonveksi" },
      { src: "/pdh.jpeg", alt: "Detail PDH produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/pdh.png",
      alt: `Galeri PDH Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan dril / twill yang kokoh dan adem",
      "Pita & atribut dinas sesuai standar",
      "Bordir logo dan nama pegawai",
      "Konsistensi warna untuk pemesanan lanjutan",
    ],
    useCases: ["Instansi pemerintah", "Badan usaha", "Satpam & operator"],
  },
  {
    slug: "jaket",
    name: "Jaket",
    tagline: "Hangat, awet, dan siap jadi identitas komunitas",
    description:
      "Jaket custom dengan bahan tebal berkualitas dan jahitan kuat, dirancang untuk pemakaian rutin. Pilihan tepat untuk seragam komunitas, almamater, hingga merchandise brand.",
    gallery: [
      { src: "/product/jaket.png", alt: "Produk Jaket Askonveksi" },
      { src: "/jaket.jpeg", alt: "Detail jaket produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/jaket.png",
      alt: `Galeri Jaket Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan waterproof / fleece sesuai kebutuhan",
      "Bordir & sablon logo yang tahan lama",
      "Varian jaket yarndye, bomber, dan hoodie",
      "Resleting & aksesoris berkualitas",
    ],
    useCases: ["Komunitas & klub", "Almamater", "Merchandise brand"],
  },
  {
    slug: "rompi",
    name: "Rompi",
    tagline: "Fungsional dan mudah dikenali untuk tim lapangan",
    description:
      "Rompi custom untuk kebutuhan kerja lapangan, event, dan organisasi. Dirancang fungsional dengan saku dan detail yang bisa disesuaikan, tetap nyaman dipakai dalam waktu lama.",
    gallery: [
      { src: "/product/rompi.png", alt: "Produk Rompi Askonveksi" },
      { src: "/rompi.jpeg", alt: "Detail rompi produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/rompi.png",
      alt: `Galeri Rompi Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan kuat dengan jahitan Reinforced stitch",
      "Desain saku dan detail fungsional",
      "Sablon / bordir logo instansi",
      "Warna mencolok untuk visibilitas tim",
    ],
    useCases: ["Relawan & event", "Petugas lapangan", "Organisasi"],
  },
  {
    slug: "jersey",
    name: "Jersey",
    tagline: "Performa di lapangan, desain bebas",
    description:
      "Jersey custom dengan bahan performance yang ringan, menyerap keringat, dan cepat kering. Desain bebas full print: nama, nomor punggung, hingga logo sponsor untuk tampil solid di lapangan.",
    gallery: [
      { src: "/product/jersey.png", alt: "Produk Jersey Askonveksi" },
      { src: "/jersey.jpeg", alt: "Detail jersey produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/jersey.png",
      alt: `Galeri Jersey Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan microfiber yang ringan dan adem",
      "Sablon full print / sublim yang tidak pecah",
      "Nama, nomor punggung, dan logo sponsor",
      "Tersedia setelan lengkap dengan celana",
    ],
    useCases: ["Tim futsal & sepak bola", "Komunitas sepeda", "Turnamen"],
  },
  {
    slug: "kaos",
    name: "Kaos",
    tagline: "Nyaman dipakai harian, desain sesuai karakter",
    description:
      "Kaos custom dengan bahan lembut dan sablon berkualitas yang tidak mudah luntur. Pilihan populer untuk seragam komunitas, event, hingga merchandise brand yang ingin tampil beda.",
    gallery: [
      { src: "/product/kaos.png", alt: "Produk Kaos Askonveksi" },
      { src: "/kaos.jpeg", alt: "Detail kaos produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/kaos.png",
      alt: `Galeri Kaos Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan cotton combed 30s, 24s, hingga supersoft",
      "Sablon DTF, plastisol, dan digital",
      "Ukuran anak sampai XXXL",
      "Desain bebas, konsultasi gratis",
    ],
    useCases: ["Komunitas", "Event & reunion", "Merchandise brand"],
  },
  {
    slug: "apron",
    name: "Apron",
    tagline: "Pelindung kerja yang tetap rapi dan profesional",
    description:
      "Apron custom untuk UMKM, kafe, dapur produksi, dan workshop. Dibuat dari bahan yang kuat dan mudah dibersihkan, dengan detail saku serta tali yang dapat disesuaikan kebutuhan kerja Anda.",
    gallery: [
      { src: "/product/apron.png", alt: "Produk Apron Askonveksi" },
      { src: "/apron.jpeg", alt: "Detail apron produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/apron.png",
      alt: `Galeri Apron Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan canvas / twill yang tebal dan awet",
      "Model dada dan pinggang sesuai permintaan",
      "Sablon logo bisnis Anda",
      "Tali yang dapat disesuaikan",
    ],
    useCases: ["Kafe & restoran", "UMKM & workshop", "Kelas memasak"],
  },
  {
    slug: "polo",
    name: "Polo",
    tagline: "Kasual namun tetap tampil rapi",
    description:
      "Polo custom dengan kerah yang tetap tersusun meski dipakai seharian. Kombinasi sempurna antara kasual dan formal untuk seragam tim, klub, maupun event perusahaan.",
    gallery: [
      { src: "/product/polo.png", alt: "Produk Polo Askonveksi" },
      { src: "/polo.jpeg", alt: "Detail polo produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/polo.png",
      alt: `Galeri Polo Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan cotton pique / lacoste yang adem",
      "Kerah dan manset yang tidak melar",
      "Bordir dada yang presisi",
      "Ukuran S sampai XXL",
    ],
    useCases: ["Seragam tim", "Event perusahaan", "Klub & komunitas"],
  },
  {
    slug: "kemeja-pdh-pdl",
    name: "Kemeja PDH/PDL",
    tagline: "Seragam dinas harian dan lapangan sesuai standar instansi",
    description:
      "Kemeja PDH/PDL custom untuk kebutuhan dinas harian maupun pakaian dinas lapangan. Diproduksi dengan bahan yang kuat namun tetap nyaman, lengkap dengan atribut, pita, dan bordir sesuai standar instansi Anda.",
    gallery: [
      { src: "/product/kemeja.png", alt: "Produk Kemeja PDH/PDL Askonveksi" },
      { src: "/kemeja.jpeg", alt: "Detail kemeja PDH/PDL produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/kemeja.png",
      alt: `Galeri Kemeja PDH/PDL Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan dril / twill yang kokoh dan adem",
      "Atribut, pita, dan pangkat sesuai standar",
      "Bordir logo dan nama pegawai",
      "Potongan PDH dan PDL sesuai kebutuhan",
    ],
    useCases: ["Instansi pemerintah", "Perusahaan", "Satpam & operator"],
    hideFromCatalog: true,
  },
  {
    slug: "workshirt",
    name: "Workshirt",
    tagline: "Kemeja kerja yang rapi untuk aktivitas operasional",
    description:
      "Workshirt custom untuk seragam kerja operasional harian. Bahannya kuat dan mudah dirawat, dengan potongan yang tetap rapi dipakai bergerak dan detail saku yang fungsional untuk kebutuhan kerja.",
    gallery: [
      { src: "/product/kemeja.png", alt: "Produk Workshirt Askonveksi" },
      { src: "/kemeja.jpeg", alt: "Detail workshirt produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/kemeja.png",
      alt: `Galeri Workshirt Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan twill / drill yang tahan pakai",
      "Saku dada fungsional",
      "Bordir logo perusahaan",
      "Ukuran S sampai XXL, bisa custom ukuran",
    ],
    useCases: ["Tim operasional", "Teknisi", "Logistik & gudang"],
    hideFromCatalog: true,
  },
  {
    slug: "seragam-kerja",
    name: "Seragam Kerja",
    tagline: "Identitas tim yang konsisten untuk operasional harian",
    description:
      "Seragam kerja custom untuk perusahaan, instansi, dan tim operasional. Didesain agar nyaman dipakai seharian dengan bahan yang awet, warna yang konsisten antar-batch, dan identitas perusahaan yang jelas.",
    gallery: [
      { src: "/product/pdh.png", alt: "Produk Seragam Kerja Askonveksi" },
      { src: "/pdh.jpeg", alt: "Detail seragam kerja produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/pdh.png",
      alt: `Galeri Seragam Kerja Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan drill / twill yang kokoh dan adem",
      "Konsistensi warna untuk pemesanan lanjutan",
      "Bordir logo dan nama karyawan",
      "Model atasan dan bawahan sesuai kebutuhan",
    ],
    useCases: ["Perusahaan & pabrik", "Instansi", "Tim lapangan"],
    hideFromCatalog: true,
  },
  {
    slug: "wearpack",
    name: "Wearpack",
    tagline: "Pakaian safety menyatu untuk kerja lapangan",
    description:
      "Wearpack custom untuk kebutuhan kerja lapangan, proyek, dan industri. Model menyatu dari atas sampai bawah dengan bahan yang kuat, dilengkapi reflektor opsional serta saku fungsional untuk peralatan kerja.",
    gallery: [
      { src: "/product/jaket.png", alt: "Produk Wearpack Askonveksi" },
      { src: "/jaket.jpeg", alt: "Detail wearpack produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/jaket.png",
      alt: `Galeri Wearpack Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan drill / kanvas yang tebal dan kuat",
      "Reflektor safety opsional",
      "Saku fungsional untuk peralatan",
      "Bordir logo perusahaan dan nama",
    ],
    useCases: ["Proyek & konstruksi", "Tambang & industri", "Mekanik & teknisi"],
    hideFromCatalog: true,
  },
  {
    slug: "poloshirt",
    name: "Poloshirt",
    tagline: "Kasual namun tetap tampil rapi",
    description:
      "Poloshirt custom dengan kerah yang tetap tersusun meski dipakai seharian. Kombinasi sempurna antara kasual dan formal untuk seragam tim, klub, maupun event perusahaan.",
    gallery: [
      { src: "/product/polo.png", alt: "Produk Poloshirt Askonveksi" },
      { src: "/polo.jpeg", alt: "Detail poloshirt produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/polo.png",
      alt: `Galeri Poloshirt Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan cotton pique / lacoste yang adem",
      "Kerah dan manset yang tidak melar",
      "Bordir dada yang presisi",
      "Ukuran S sampai XXL",
    ],
    useCases: ["Seragam tim", "Event perusahaan", "Klub & komunitas"],
    hideFromCatalog: true,
  },
  {
    slug: "kaos-sablon",
    name: "Sablon DTF/Plastisol",
    tagline: "Kaos sablon tajam dengan hasil yang tahan lama",
    description:
      "Kaos sablon custom dengan pilihan teknik DTF atau plastisol sesuai kebutuhan desain Anda. Hasil sablon tajam, warnanya keluar, dan tidak mudah pecah, dicetak di atas bahan kaos yang lembut dan nyaman.",
    gallery: [
      { src: "/product/kaos.png", alt: "Produk Kaos Sablon Askonveksi" },
      { src: "/kaos.jpeg", alt: "Detail kaos sablon produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/kaos.png",
      alt: `Galeri Kaos Sablon Askonveksi ${i + 1}`,
    })),
    features: [
      "Teknik DTF untuk desain full color detail",
      "Plastisol untuk hasil timbul yang awet",
      "Bahan cotton combed 30s hingga 24s",
      "Desain bebas, konsultasi gratis",
    ],
    useCases: ["Merchandise brand", "Komunitas", "Event & reunion"],
    hideFromCatalog: true,
  },
  {
    slug: "kaos-vneck",
    name: "Vneck",
    tagline: "Kaos kerah V yang simpel dan modern",
    description:
      "Kaos Vneck custom dengan potongan kerah V yang simpel dan modern. Nyaman untuk pemakaian harian dengan bahan yang lembut, cocok untuk seragam komunitas, merchandise, maupun pakaian santai tim.",
    gallery: [
      { src: "/product/kaos.png", alt: "Produk Kaos Vneck Askonveksi" },
      { src: "/kaos.jpeg", alt: "Detail kaos vneck produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/kaos.png",
      alt: `Galeri Kaos Vneck Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan cotton combed yang lembut",
      "Rib kerah V yang tidak melar",
      "Sablon DTF, plastisol, dan digital",
      "Ukuran anak sampai XXXL",
    ],
    useCases: ["Komunitas", "Merchandise brand", "Seragam santai"],
    hideFromCatalog: true,
  },
  {
    slug: "kaos-raglan",
    name: "Raglan",
    tagline: "Kaos lengan raglan dengan kombinasi warna bebas",
    description:
      "Kaos raglan custom dengan potongan lengan khas dan kombinasi warna badan-lengan yang bebas Anda tentukan. Model yang populer untuk jersey santai, seragam komunitas, dan merchandise dengan karakter kuat.",
    gallery: [
      { src: "/product/kaos.png", alt: "Produk Kaos Raglan Askonveksi" },
      { src: "/kaos.jpeg", alt: "Detail kaos raglan produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/kaos.png",
      alt: `Galeri Kaos Raglan Askonveksi ${i + 1}`,
    })),
    features: [
      "Kombinasi warna badan dan lengan bebas",
      "Bahan cotton combed yang adem",
      "Sablon sesuai desain Anda",
      "Ukuran anak sampai XXXL",
    ],
    useCases: ["Komunitas & klub", "Jersey santai", "Merchandise"],
    hideFromCatalog: true,
  },
  {
    slug: "jacket",
    name: "Jacket",
    tagline: "Hangat, awet, dan siap jadi identitas komunitas",
    description:
      "Jacket custom dengan bahan tebal berkualitas dan jahitan kuat, dirancang untuk pemakaian rutin. Pilihan tepat untuk seragam komunitas, almamater, hingga merchandise brand.",
    gallery: [
      { src: "/product/jaket.png", alt: "Produk Jacket Askonveksi" },
      { src: "/jaket.jpeg", alt: "Detail jacket produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/jaket.png",
      alt: `Galeri Jacket Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan waterproof / fleece sesuai kebutuhan",
      "Bordir & sablon logo yang tahan lama",
      "Varian jaket yarndye, bomber, dan hoodie",
      "Resleting & aksesoris berkualitas",
    ],
    useCases: ["Komunitas & klub", "Almamater", "Merchandise brand"],
    hideFromCatalog: true,
  },
  {
    slug: "lanyard",
    name: "Lanyard",
    tagline: "Tali ID custom untuk identitas acara dan kantor",
    description:
      "Lanyard custom untuk kebutuhan ID card karyawan, kepanitiaan event, dan aksesoris komunitas. Dicetak dengan desain dan warna sesuai identitas Anda, lengkap dengan pilihan pengait dan stopper.",
    gallery: [
      { src: "/product/kaos.png", alt: "Produk Lanyard Askonveksi" },
      { src: "/kaos.jpeg", alt: "Detail lanyard produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/kaos.png",
      alt: `Galeri Lanyard Askonveksi ${i + 1}`,
    })),
    features: [
      "Cetak desain full color dua sisi",
      "Lebar tali 1,5 cm dan 2 cm",
      "Pilihan pengait besi dan plastik",
      "Stopper dan aksesoris opsional",
    ],
    useCases: ["ID karyawan", "Kepanitiaan event", "Komunitas"],
    hideFromCatalog: true,
  },
  {
    slug: "rompi-vest-apron",
    name: "Rompi / Vest / Apron",
    tagline: "Pelapis fungsional untuk kerja dan usaha",
    description:
      "Rompi, vest, dan apron custom untuk kebutuhan kerja lapangan, event, hingga usaha kuliner. Dirancang fungsional dengan saku dan detail yang bisa disesuaikan, tetap nyaman dipakai dalam waktu lama.",
    gallery: [
      { src: "/product/rompi.png", alt: "Produk Rompi Vest Apron Askonveksi" },
      { src: "/rompi.jpeg", alt: "Detail rompi vest apron produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/rompi.png",
      alt: `Galeri Rompi Vest Apron Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan kuat dengan jahitan rapi",
      "Model rompi, vest, dan apron dada / pinggang",
      "Sablon / bordir logo usaha Anda",
      "Saku dan tali yang dapat disesuaikan",
    ],
    useCases: ["Relawan & event", "Kafe & UMKM", "Petugas lapangan"],
    hideFromCatalog: true,
  },
  {
    slug: "totebag-topi",
    name: "Totebag / Topi",
    tagline: "Aksesoris custom untuk brand dan souvenir",
    description:
      "Totebag dan topi custom untuk merchandise brand, souvenir event, maupun kebutuhan komunitas. Totebag tersedia dalam bahan kanvas dan spunbond, topi dalam model snapback, trucker, dan baseball dengan bordir atau sablon logo.",
    gallery: [
      { src: "/product/kaos.png", alt: "Produk Totebag Topi Askonveksi" },
      { src: "/kaos.jpeg", alt: "Detail totebag topi produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/kaos.png",
      alt: `Galeri Totebag Topi Askonveksi ${i + 1}`,
    })),
    features: [
      "Totebag kanvas dan spunbond berbagai ukuran",
      "Topi snapback, trucker, dan baseball",
      "Sablon atau bordir logo",
      "Cocok untuk souvenir dan merchandise",
    ],
    useCases: ["Souvenir event", "Merchandise brand", "Komunitas"],
    hideFromCatalog: true,
  },
  {
    slug: "gantungan-kunci",
    name: "Gantungan Kunci",
    tagline: "Souvenir kecil yang mudah dibawa pulang",
    description:
      "Gantungan kunci custom untuk souvenir event, merchandise komunitas, maupun pelengkap paket seminar kit. Tersedia dalam bahan akrilik, karet, dan besi dengan desain dua sisi sesuai identitas Anda.",
    gallery: [
      { src: "/product/kaos.png", alt: "Produk Gantungan Kunci Askonveksi" },
      { src: "/kaos.jpeg", alt: "Detail gantungan kunci produksi Askonveksi" },
    ],
    bento: Array.from({ length: 7 }, (_, i) => ({
      src: "/product/kaos.png",
      alt: `Galeri Gantungan Kunci Askonveksi ${i + 1}`,
    })),
    features: [
      "Bahan akrilik, karet, dan besi",
      "Desain dua sisi full color",
      "Ring dan rantai berkualitas",
      "Mulai dari jumlah kecil",
    ],
    useCases: ["Souvenir event", "Seminar kit", "Merchandise komunitas"],
    hideFromCatalog: true,
  },
];

export function getLandingProduct(slug: string): LandingProduct | undefined {
  return LANDING_PRODUCTS.find((product) => product.slug === slug);
}
