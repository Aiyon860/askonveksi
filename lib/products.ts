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
];

export function getLandingProduct(slug: string): LandingProduct | undefined {
  return LANDING_PRODUCTS.find((product) => product.slug === slug);
}
