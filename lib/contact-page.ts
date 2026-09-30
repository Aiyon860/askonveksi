/**
 * Single source of truth for the /contact page.
 * TODO: ganti semua nilai placeholder di bawah dengan data asli Askonveksi.
 */

export const CONTACT_EMAIL = {
  label: "Email",
  // TODO: ganti dengan alamat email asli.
  value: "email@askonveksi.com",
  href: "mailto:email@askonveksi.com",
};

export const CONTACT_ADDRESS = {
  label: "Alamat",
  // TODO: ganti dengan alamat lengkap workshop.
  lines: ["Jl. Contoh No. 123,", "Semarang, Jawa Tengah"],
};

export const CONTACT_PHONES = {
  label: "Telepon",
  phones: [
    // TODO: ganti dengan nomor admin asli.
    { label: "Admin 1", value: "08xx-xxxx-xxxx", href: "tel:+6280000000000" },
    { label: "Admin 2", value: "08xx-xxxx-xxxx", href: "tel:+6280000000000" },
  ],
};

/** Google Maps embed (tanpa API key). TODO: ganti query dengan alamat persis workshop. */
export const CONTACT_MAP_EMBED_SRC = "https://www.google.com/maps?q=Semarang,+Jawa+Tengah,+Indonesia&output=embed";
export const CONTACT_MAP_TITLE = "Peta lokasi Askonveksi";

export type ContactFaq = {
  question: string;
  answer: string;
};

export const CONTACT_FAQS: ContactFaq[] = [
  {
    question: "Berapa minimum order?",
    // TODO: konfirmasi angka minimum order per model/desain.
    answer:
      "Minimum pemesanan custom adalah 12 pcs per model dan desain. Untuk jumlah di bawah itu, hubungi admin — kami bantu carikan opsi yang paling sesuai.",
  },
  {
    question: "Berapa lama waktu pengerjaan?",
    // TODO: konfirmasi estimasi lead time standar.
    answer:
      "Waktu pengerjaan standar 7–14 hari kerja setelah desain disetujui dan DP diterima, tergantung antrean dan kompleksitas model. Untuk kebutuhan mendesak, diskusikan dengan admin agar bisa diatur prioritasnya.",
  },
  {
    question: "Model apa saja yang bisa dibuat?",
    answer:
      "Kami memproduksi kemeja, PDH/PDL, workshirt, seragam kerja, wearpack, poloshirt, kaos (sablon DTF/plastisol, vneck, raglan), jacket, rompi, vest, apron, topi, totebag, lanyard, hingga gantungan kunci. Desain mengikuti kebutuhan Anda — konsultasi desain gratis.",
  },
  {
    question: "Bagaimana proses pembayaran?",
    // TODO: konfirmasi skema DP dan pelunasan.
    answer:
      "Produksi dimulai setelah DP 50% diterima, dan pelunasan dilakukan sebelum barang dikirim atau diambil. Pembayaran via transfer bank, dan progres pengerjaan dikabari berkala melalui WhatsApp.",
  },
];

export const CONTACT_CTA = {
  title: "Dapatkan Penawaran Terbaik",
  subtitle: "Konsultasikan Kebutuhan Seragam Anda",
  buttonLabel: "Kontak Marketing",
};
