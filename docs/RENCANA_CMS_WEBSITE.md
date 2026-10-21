# Rencana CMS Website Askonveksi

Status: **siap dieksekusi**  
Cakupan: seluruh halaman publik (landing, portofolio, size chart, katalog kain, kontak, detail produk) + navbar/footer/SEO.  
Prinsip utama: **konten tidak disimpan di database Supabase**. Konten disimpan sebagai file JSON berversi di disk server; gambar di disk server; publikasi langsung dengan cache tag.

---

## 1. Keputusan yang sudah dikunci

| Topik | Keputusan |
|---|---|
| Cakupan halaman | Semua halaman publik sekaligus |
| Yang bisa diedit | Teks, gambar, link, urutan section, sembunyikan section |
| Pengalaman edit | Studio admin dengan live preview di samping |
| Alur simpan | Simpan langsung tayang (tanpa draft), dengan snapshot otomatis untuk undo |
| Penyimpanan | File JSON + gambar di disk server (VPS), **bukan** tabel/bucket database Supabase |
| Akses | `OWNER` + `DEVELOPER` (Developer selalu lolos sesuai aturan proyek) |
| WYSIWYG | Tebal, miring, garis bawah, daftar poin, daftar nomor, tautan, hapus format |
| Gambar | Ganti, hapus, atur teks alternatif, unggah baru; otomatis dioptimalkan ke WebP |
| Batasan | Bukan page builder bebas; section adalah template tetap yang isinya bisa diedit, diurutkan, dan disembunyikan |

---

## 2. Tujuan & definisi selesai

Klien non-IT harus bisa, tanpa menyentuh kode:

1. Mengganti seluruh teks di landing page dan halaman publik lain.
2. Menulis teks berformat (tebal/miring/garis bawah/daftar/tautan).
3. Mengganti, menambah, menghapus, dan mengurutkan gambar di semua slot.
4. Mengubah link tombol, menu navbar, link footer, nomor WhatsApp, dan pesan WhatsApp.
5. Mengurutkan dan menyembunyikan section.
6. Melihat hasilnya langsung di preview sebelum menekan **Simpan & Tayangkan**.
7. Mengembalikan versi sebelumnya bila ada kesalahan.

Selesai bila seluruh inventaris di bagian 4 bisa diedit dari UI, perubahan langsung tampil, dan tidak ada konten/gambar yang ditulis ke database Supabase.

---

## 3. Arsitektur

### 3.1 Mengapa bukan database

Landing page saat ini dirender statis. Membaca konten dari database (apalagi pooler Supabase yang jauh) menambah latensi dan titik gagal untuk halaman yang isinya jarang berubah. Yang dibutuhkan bukan database relasional, melainkan **dokumen konten kecil yang dibaca sekali lalu di-cache**.

```
Admin (OWNER/DEVELOPER)
        │  simpan (Server Action)
        ▼
┌──────────────────────────────┐
│  data/cms/content.json       │  ← dokumen aktif (satu file, ±60–100 KB)
│  data/cms/versions/*.json    │  ← snapshot otomatis (undo)
│  data/uploads/YYYY/MM/*.webp │  ← gambar hasil optimasi
└──────────────────────────────┘
        │  tulis atomik + revalidate tag
        ▼
┌──────────────────────────────┐
│  Next.js (self-hosted/VPS)   │
│  unstable_cache + cache tag  │  ← 1 kali baca per publish, bukan per request
│  halaman statis/ISR          │
└──────────────────────────────┘
        │
        ▼
Pengunjung → HTML statis cepat, tanpa query database
```

### 3.2 Alur baca

- `getSiteContent()` di `lib/cms/store.ts` membaca `content.json` lewat `unstable_cache` dengan tag `cms-content`, `revalidate: false`.
- Semua halaman publik memakai fungsi yang sama. Tidak ada query Prisma/Supabase untuk konten.
- Jika file belum ada (deploy pertama), dipakai `lib/cms/seed-content.json`.
- Jika file rusak/tidak valid, loader mencoba snapshot valid terbaru; jika gagal juga, memakai seed. Landing tidak boleh blank/crash.
- Hasil dibaca di-cache; request berikutnya tidak menyentuh disk.

### 3.3 Alur tulis

- Server Action memvalidasi sesi + role + payload Zod + sanitasi HTML + batas ukuran.
- Sebelum menimpa, snapshot `content.json` disalin ke `versions/`.
- Tulis ke file sementara di direktori yang sama, `fsync`, lalu `rename` (atomik).
- Naikkan `version`, isi `updatedAt`/`updatedBy`.
- Panggil `revalidateTag("cms-content", { expire: 0 })` dan `revalidatePath` untuk halaman publik yang terdampak.
- Kunci tulis berbasis file (`data/cms/.lock`) + antrean in-process agar dua tab tidak menulis bersamaan.
- Optimistic concurrency: editor mengirim `expectedVersion`; jika sudah berubah, simpan ditolak dengan pesan ramah, bukan menimpa diam-diam.

### 3.4 Asumsi deployment

- Aplikasi berjalan **self-hosted** (`next start`/standalone) dengan **disk persisten**.
- Satu instance aplikasi (bukan beberapa pod/worker paralel). Jika nanti di-scale, ganti store ke object storage bersama; schema dan UI tidak perlu berubah.
- `CMS_DATA_DIR` dan `CMS_UPLOAD_DIR` menunjuk ke volume persisten di luar folder build.

---

## 4. Inventaris lengkap konten yang bisa diedit

### 4.1 Navbar (semua halaman)

| Elemen | Field |
|---|---|
| Logo | Gambar, teks alternatif, nama brand |
| Link navigasi | Label, href, urutan, tampil/sembunyi, tambah/hapus; satu daftar berurutan bersama dropdown Produk |
| Label pemicu dropdown | Teks "Produk" bisa diganti |
| Menu Produk | Urutan grup/induk, urutan anak, tampil/sembunyi, label mengikuti nama produk |
| Tombol kanan | Label, link, tampil/sembunyi |
| Menu mobile | Mengikuti item yang sama; judul sheet "Navigasi utama" bisa diganti |

### 4.2 Hero + keunggulan (`/#beranda`, `/#keunggulan`)

- Eyebrow, judul baris 1, judul baris 2, deskripsi.
- Tombol utama: label, link/tujuan, pesan WhatsApp.
- Tombol kedua: label, link.
- Gambar latar: gambar, alt, posisi fokus (kiri/tengah/kanan).
- 4 keunggulan: ikon (pilihan terkurasi), judul, deskripsi, urutan, tampil/sembunyi, tambah/hapus.
- Section tampil/sembunyi dan urutan.

### 4.3 Katalog produk (`/#produk`)

- Eyebrow, judul, deskripsi.
- Tombol "Lihat Semua Produk": label, link, tampil/sembunyi.
- Kartu produk: mengikuti data produk (nama, gambar kartu, alt), urutan, tampil/sembunyi dari katalog.

### 4.4 Detail & halaman induk produk (`/produk/[slug]`)

- Nama, tagline, deskripsi (WYSIWYG).
- Galeri detail: gambar, alt, urutan, hapus/tambah. Saat ini data galeri berada di `PRODUCT_DETAIL_GALLERIES` (`components/product-detail-grid.tsx`), bukan di `lib/products.ts`, dan harus ikut dimigrasi.
- Fitur (satu per baris) dan use case (chip).
- Hubungan induk–anak (Kemeja, Kaos, Jersey) + urutan anak.
- SEO: judul, deskripsi.
- Publikasi: tampil/sembunyi; slug terkunci setelah dibuat.
- Gambar kartu katalog.
- Teks "Segera Hadir" bila galeri kosong: judul, deskripsi, label tombol, link tombol.

### 4.5 Proses produksi (`/#proses`)

- Gambar kiri, alt, posisi fokus.
- Teks overlay 2 baris.
- Eyebrow, judul, deskripsi.
- 5 langkah: ikon, judul, deskripsi, urutan, tampil/sembunyi, tambah/hapus.
- Section tampil/sembunyi dan urutan.

### 4.6 Mengapa memilih (`/#tentang-kami`)

- Gambar latar, alt.
- Eyebrow, judul, deskripsi.
- Tombol: label, link.
- 4 keunggulan: ikon, judul, deskripsi, urutan, tampil/sembunyi, tambah/hapus.
- Section tampil/sembunyi dan urutan.

### 4.7 Logo klien

- Judul, deskripsi.
- Item: nama, logo, alt, urutan, tampil/sembunyi, tambah/hapus.
- Marquee tetap otomatis; jika item sedikit (<6), tampil sebagai grid statis agar tidak ada ruang kosong.
- Section tampil/sembunyi dan urutan.

### 4.8 Testimoni (`/#testimoni`)

- Judul, deskripsi.
- Item: kutipan (WYSIWYG inline), nama, perusahaan/keterangan, avatar opsional, urutan, tampil/sembunyi, tambah/hapus.
- Section tampil/sembunyi dan urutan.

### 4.9 CTA (`/#kontak`)

- Judul, deskripsi (WYSIWYG).
- Label tombol, pesan WhatsApp, gambar latar, alt.
- Section tampil/sembunyi dan urutan.

### 4.10 Footer

- Logo, deskripsi (WYSIWYG).
- Media sosial: platform (pilihan), URL, tampil/sembunyi, tambah/hapus (hanya yang punya URL dirender).
- Judul kolom "Produk" dan "Navigasi".
- Link produk (mengikuti menu produk) dan link navigasi footer: label, href, urutan, tampil/sembunyi, tambah/hapus.
- Copyright, tagline bawah.

### 4.11 Tombol WhatsApp mengambang

- Nomor WhatsApp, pesan default, tampil/sembunyi.
- Nomor global dipakai semua CTA; tiap CTA tetap punya pesan sendiri.

### 4.12 Portofolio (`/portofolio`)

- Eyebrow (termasuk teks "Dipercaya … perusahaan"), judul, deskripsi.
- Item: nama, logo, alt, urutan, tampil/sembunyi, tambah/hapus.
- Section header/grid/CTA: tampil/sembunyi dan urutan.
- CTA memakai konten CTA global (sama dengan landing) agar konsisten.

### 4.13 Size Chart (`/size-chart`)

- Judul, deskripsi.
- Gambar: gambar, alt, urutan, tampil/sembunyi, tambah/hapus. Saat ini berasal dari konstanta `SIZE_CHART_IMAGES` di `components/size-chart-grid.tsx`; path URL-encoded harus dipertahankan persis saat migrasi.
- Section tampil/sembunyi.

### 4.14 Katalog Kain (`/katalog-kain`)

- Judul, deskripsi.
- Mode "Segera Hadir": aktif/nonaktif, judul, deskripsi, ilustrasi, label tombol, link tombol.
- Item kain: nama, gambar, alt, deskripsi, urutan, tampil/sembunyi, tambah/hapus.
- Section tampil/sembunyi.

### 4.15 Kontak (`/contact`)

- Judul header.
- Email: label, nilai, href.
- Alamat: label, baris alamat.
- Telepon: label, daftar nomor (label, nilai, href), tambah/hapus.
- FAQ: eyebrow, judul, item (pertanyaan, jawaban WYSIWYG), urutan, tampil/sembunyi, tambah/hapus.
- Form: eyebrow, judul, label field, placeholder, label tombol, teks bantuan, teks sukses.
- Peta: URL embed, judul iframe, tampil/sembunyi.
- CTA: judul, subjudul, label tombol, pesan WhatsApp, gambar latar.
- Section header/info/FAQ-form/map/CTA: tampil/sembunyi dan urutan.

### 4.16 Pengaturan global & SEO

- Nama situs, template judul, deskripsi default, URL kanonis.
- Logo website (fallback ke Profil Perusahaan bila kosong).
- OG image default, verifikasi Google Search Console.
- Analytics ID (opsional), area layanan, media sosial untuk structured data.
- SEO per halaman: judul, deskripsi, OG image.
- Sitemap dan JSON-LD mengikuti konten.
- `robots.txt` menambahkan `Disallow: /cms/` dan `/cms-preview`.

### 4.17 Gambar yang harus bisa diganti

Seluruh slot gambar yang ada saat ini: hero, `tailor.jpg`, latar `why`, `cta.jpg`, 11 logo klien landing + 27 logo portofolio, logo produk/kartu, 60 gambar galeri produk, 28 gambar size chart, logo website, OG image, ilustrasi "Segera Hadir", dan avatar testimoni (opsional). Tidak ada gambar yang di-hard-code di komponen setelah migrasi.

---

## 5. Model data

Satu dokumen `SiteContent` (Zod + TypeScript):

```ts
type MediaRef = {
  src: string;              // "/media/2026/10/uuid.webp" atau "/hero.jpg"
  alt: string;              // wajib, kecuali dekoratif
  decorative?: boolean;
  focus?: "kiri" | "tengah" | "kanan"; // object-position
};

type LinkItem = { label: string; href: string; visible: boolean };

// Navigasi adalah satu daftar berurutan agar dropdown Produk bisa dipindah
// di antara link lain, bukan selalu di posisi tetap.
type NavItem =
  | ({ type: "link" } & LinkItem)
  | { type: "products"; label: string; visible: boolean };

type SectionState = { id: string; visible: boolean };

type SiteContent = {
  schemaVersion: 1;
  version: number;
  updatedAt: string;        // ISO, diisi server
  updatedBy: { id: string; name: string };

  brand: { name: string; logo: MediaRef | null };
  site: {
    url: string;
    titleTemplate: string;
    description: string;
    ogImage: MediaRef | null;
    whatsapp: string;       // digit saja
    email: string;
    addressLines: string[];
    phones: { label: string; value: string; href: string }[];
    socials: { platform: string; url: string; visible: boolean }[];
    analyticsId?: string;
    searchConsoleVerification?: string;
    areaServed: string[];
  };

  navigation: {
    items: NavItem[];              // termasuk item "products" untuk dropdown
    mobileTitle: string;           // "Navigasi utama"
    cta: LinkItem & { whatsappMessage: string };
  };

  landing: {
    sections: SectionState[];           // urutan = urutan render
    hero: { /* eyebrow, titleLines, descriptionRich, ctas, image, benefits */ };
    products: { /* eyebrow, title, descriptionRich, cta */ };
    process: { /* image, overlayLines, eyebrow, title, descriptionRich, steps */ };
    why: { /* image, eyebrow, title, descriptionRich, cta, advantages */ };
    clients: { /* title, descriptionRich, items */ };
    testimonials: { /* title, descriptionRich, items */ };
    cta: { /* title, descriptionRich, buttonLabel, whatsappMessage, image */ };
  };

  footer: { /* descriptionRich, columnTitles, links, socials, copyright, tagline */ };
  whatsappFab: { visible: boolean; message: string };

  products: Product[];                   // termasuk halaman induk & anak
  portfolioPage: { /* seo, sections, eyebrow, title, descriptionRich, items */ };
  sizeChartPage: { /* seo, sections, title, descriptionRich, images */ };
  fabricPage: { /* seo, sections, title, descriptionRich, comingSoon, items */ };
  contactPage: { /* seo, sections, header, info, faq, form, map, cta */ };

  shared: { comingSoon: { /* title, descriptionRich, buttonLabel, href, image */ } };
};
```

Aturan validasi:

- Batas: JSON maks 2 MB; 100 produk; 60 gambar/produk; 100 item per daftar; rich text 20.000 karakter; field pendek 500 karakter.
- `slug`: hanya `a-z0-9-`, unik, tidak bisa diubah setelah dibuat.
- `href`: hanya `https://`, `http://`, `mailto:`, `tel:`, path internal `/...`, atau anchor `#...`. `javascript:`, `data:`, dan `//domain` ditolak.
- Nomor WhatsApp: 8–15 digit.
- Gambar: hanya path `/media/...` atau aset publik `/...` dengan ekstensi gambar yang diizinkan.
- Minimal satu section terlihat per halaman; jika hero disembunyikan, tampilkan peringatan di editor.
- Link navigasi yang menunjuk anchor section tersembunyi diberi peringatan (tidak diblokir).

---

## 6. Penyimpanan, versi, dan publikasi

### 6.1 Lokasi file

```
data/
  cms/
    content.json
    .lock
    versions/
      2026-10-18T10-15-30-000Z-v12.json
  uploads/
    2026/10/
      <uuid>.webp
lib/cms/
  seed-content.json        # konten awal, ikut repo
```

- `data/cms` dan `data/uploads` **tidak** di-commit; hanya `seed-content.json` yang di-commit.
- `.gitignore` menambahkan `data/` dengan pengecualian bila diperlukan.
- Environment: `CMS_DATA_DIR`, `CMS_UPLOAD_DIR` (default `./data/cms`, `./data/uploads`).
- Permission direktori: dapat ditulis user aplikasi; file 0644, direktori 0755.

### 6.2 Snapshot & rollback

- Setiap simpan membuat snapshot sebelum menimpa.
- Simpan 50 versi terakhir; versi lebih lama dihapus otomatis.
- Halaman `/cms/riwayat` menampilkan waktu, nama penyimpan, ringkasan section yang berubah, tombol **Lihat** dan **Pulihkan**.
- Pulihkan = tulis sebagai versi baru (bukan menghapus riwayat), lalu revalidate.
- Skrip `npm run cms:backup` membuat arsip `data/cms` + `data/uploads`; dijalankan cron harian dan sebelum deploy.

### 6.3 Publikasi langsung

Karena klien memilih "simpan langsung tayang":

1. Editor menekan **Simpan & Tayangkan**.
2. Server menyimpan, membuat snapshot, menaikkan versi.
3. `revalidateTag("cms-content", { expire: 0 })` + `revalidatePath("/", "layout")`.
4. Toast: "Perubahan sudah tayang" + tombol **Lihat Website**.
5. Tidak ada status draft. Kesalahan bisa dipulihkan dari Riwayat.

### 6.4 Revalidasi

- Tag data: `cms-content`.
- Setelah simpan: revalidasi semua path publik (`/`, `/portofolio`, `/size-chart`, `/katalog-kain`, `/contact`, seluruh `/produk/[slug]` yang ada dan yang dihapus).
- Halaman produk memakai `generateStaticParams` dari konten dan `dynamicParams = true` agar produk baru langsung bisa dibuka; produk yang dihapus menjadi 404.
- `generateMetadata` dan JSON-LD membaca konten yang sama (cached).
- Sitemap memuat `/`, `/portofolio`, `/size-chart`, `/katalog-kain`, `/contact`, dan seluruh produk `published`.
- Halaman publik wajib `robots: index, follow`; `/cms` dan `/cms-preview` wajib `noindex`.

---

## 7. Media & gambar

### 7.1 Unggah

- Route: `POST /api/cms/media` (hanya OWNER/DEVELOPER).
- FormData `file` + `alt` opsional.
- Batas 8 MB; maksimal 40 MP; dimensi maksimal 6000 px.
- Tipe diterima: PNG, JPEG, WebP, AVIF. SVG/GIF ditolak (alasan keamanan/animasi).
- Validasi dilakukan dengan `sharp.metadata()` (bukan ekstensi/MIME klien), lalu re-encode.
- Output: WebP kualitas 82, maksimal 2560 px sisi terpanjang, metadata EXIF dihapus, transparansi dipertahankan.
- Nama file UUID; path `/media/YYYY/MM/<uuid>.webp`.
- Respons: `{ src, width, height }`.

### 7.2 Penyajian

- Route `GET /media/[...path]` membaca dari `CMS_UPLOAD_DIR`.
- Proteksi path traversal: resolve path harus berada di dalam root upload; tolak `..`, dotfile, dan ekstensi non-gambar.
- Header: `Content-Type: image/webp`, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`.
- `next/image` tetap dipakai untuk responsive `srcset` dan konversi AVIF/WebP lanjutan.

### 7.3 UX memilih gambar

- Komponen `ImageField` menampilkan thumbnail, tombol **Ganti gambar**, **Hapus**, dan input alt.
- Drag & drop atau klik; progress bar; pesan error spesifik (terlalu besar, bukan gambar, gagal).
- Petunjuk ukuran per slot:
  - Hero 1920×1080 (landscape).
  - Proses/CTA 1600×1000.
  - Logo klien 400×200, latar transparan.
  - Galeri produk 1536×1024.
  - Size chart bebas, minimal 800 px.
- Pilihan posisi fokus (kiri/tengah/kanan) untuk gambar latar agar crop aman.
- "Pilih dari galeri" opsional: daftar media yang pernah diunggah, agar tidak upload ulang.
- Menghapus referensi tidak menghapus file; skrip `cms:clean-orphans` tersedia untuk membersihkan file tak terpakai.

---

## 8. Studio admin (UX untuk non-IT)

### 8.1 Navigasi

Tambahkan grup **Website** di sidebar aplikasi (hanya OWNER/DEVELOPER) yang membuka studio terpisah:

- **Kelola Website** → `/cms` (dashboard)
- **Pengaturan Website** → `/cms/pengaturan`
- **Riwayat Perubahan** → `/cms/riwayat`

Studio `/cms` memakai shell sendiri (sidebar ringkas khusus website + tombol **Kembali ke Aplikasi**), bukan shell CRM, agar klien tidak bingung dengan menu operasional. Dashboard `/cms` berisi kartu besar:

1. Beranda
2. Produk
3. Portofolio
4. Size Chart
5. Katalog Kain
6. Halaman Kontak
7. Pengaturan Website

Setiap kartu menampilkan "Terakhir diubah … oleh …" dan tombol **Edit**.

### 8.2 Tata letak editor

Desktop (≥1280 px):

```
┌─────────────────────────────────────────────────────────────┐
│ ← Kembali   Beranda          [Lihat Website] [Simpan & Tayangkan] │
├───────────────────────┬─────────────────────────────────────┤
│ Panel field           │ Live preview (iframe)               │
│ - Section list        │ [Desktop] [Tablet] [HP]             │
│ - Form section aktif  │                                     │
│   (collapsible)       │                                     │
└───────────────────────┴─────────────────────────────────────┘
```

Mobile/tablet:

- Tab **Isi** dan **Pratinjau**.
- Tombol simpan sticky di bawah.
- Preview full-screen dengan tombol tutup.

### 8.3 Prinsip UX

- Bahasa Indonesia, tanpa istilah teknis (bukan "JSON", "schema", "cache").
- Setiap section punya ikon, judul, dan satu baris penjelasan.
- Field diberi label + contoh: "Judul utama — tampil besar di atas foto."
- Tombol besar, target sentuh ≥44 px.
- Status jelas: "Menyimpan…", "Tersimpan 10.15", "Gagal menyimpan — coba lagi".
- Peringatan sebelum meninggalkan halaman dengan perubahan belum disimpan.
- `Ctrl/Cmd + S` menyimpan.
- Tidak ada drag-only: setiap pengurutan punya tombol naik/turun selain drag handle.
- Preview mengikuti perubahan dengan debounce ±150 ms.
- Klik section di preview → panel section terkait terbuka (postMessage).
- Mode fokus: sembunyikan panel saat preview penuh.
- Bantuan singkat di dashboard: 4 langkah (ganti foto, ganti teks, atur urutan, simpan).
- Validasi menampilkan pesan di field terkait dan fokus ke field pertama yang salah.
- Pemulihan lokal: draft yang belum disimpan disimpan sementara di `localStorage`; saat halaman dibuka lagi, tawarkan **Lanjutkan perubahan** atau **Mulai dari versi tersimpan**. Ini bukan draft publik, hanya pengaman jika tab tertutup/refresh.

### 8.4 Pengurutan & penyembunyian

Komponen `SectionManager`:

- Daftar section dengan drag handle, tombol atas/bawah, ikon mata (tampil/sembunyi), dan label.
- Perubahan langsung tercermin di preview.
- Section yang disembunyikan diberi gaya redup dan peringatan bila ada link navigasi yang menunjuk ke sana.
- Minimal satu section harus terlihat.

### 8.5 Akses

- `app/cms/layout.tsx`: ambil actor; jika belum login `redirect("/login")`; jika bukan OWNER (dan bukan DEVELOPER), `notFound()`.
- Semua Server Action memanggil `requireActor(CMS_ROLES)`; `hasRole` sudah meloloskan DEVELOPER.
- `/cms-preview` juga dicek; bukan OWNER/DEVELOPER → 404.
- Menu Website tidak muncul untuk role lain.
- `robots.txt` men-disallow `/cms` dan `/cms-preview`.

---

## 9. WYSIWYG

- Library: **TipTap** (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`) dimuat dinamis (`ssr: false`) agar tidak membebani halaman publik.
- Toolbar: **Tebal, Miring, Garis bawah, Daftar poin, Daftar nomor, Tautan, Hapus format, Undo/Redo**.
- Dialog tautan: URL + opsi "buka di tab baru"; URL divalidasi.
- Tempel dari Word/Google Docs dibersihkan menjadi teks + format dasar.
- Batas karakter per field ditampilkan.
- Field pendek (label tombol, nama, nomor) tetap input biasa; WYSIWYG untuk paragraf, judul, deskripsi, kutipan, FAQ, footer, dan deskripsi produk.
- Varian `inline` untuk judul/kutipan (hanya bold/italic/underline/link, tanpa blok).
- Sanitasi server-side dengan `sanitize-html`:
  - Tag: `p, br, strong, b, em, i, u, ul, ol, li, a`.
  - Atribut: `a[href, target, rel]`.
  - Protokol: http, https, mailto, tel.
  - `target="_blank"` dipaksa memiliki `rel="noopener noreferrer"`.
  - Semua script/style/event handler dibuang.
- Sanitasi dilakukan saat simpan **dan** saat render publik (defense in depth).
- Render: komponen `RichText` memakai `dangerouslySetInnerHTML` hanya untuk HTML yang sudah disanitasi.

---

## 10. Live preview

- Route preview: `/cms-preview` (client component, tanpa AppShell, auth OWNER/DEVELOPER, `noindex`).
- Editor mengirim draft via `window.postMessage({ type: "cms-preview", page, content })`; preview membalas `{ type: "cms-ready" }`.
- Preview merender komponen publik yang sama dengan situs asli (navbar, section, footer, FAB), sehingga tampilan akurat.
- Device switcher: Desktop 1440 px, Tablet 768 px, HP 390 px; preview diskalakan agar muat panel.
- Preview tidak menulis apa pun ke server.
- Gambar yang baru diunggah langsung tampil (sudah berupa URL `/media/...`).
- Section yang disembunyikan tidak muncul; urutan mengikuti draft.
- Jika iframe gagal dimuat, tampilkan tombol **Muat ulang pratinjau**.

---

## 11. Keamanan

- **Auth & authorization**: cek role di layout, setiap action, dan route upload. Tidak mengandalkan UI.
- **HTML**: allowlist sanitizer; tolak `javascript:`/`data:`; render hanya HTML tersanitasi.
- **Upload**: validasi isi dengan sharp, batas ukuran/piksel, re-encode, UUID, tanpa SVG/GIF, tanpa eksekusi.
- **Path traversal**: media route memvalidasi path resolusi di dalam root.
- **URL**: validasi protokol; tolak protocol-relative dan skema berbahaya.
- **Payload**: batas ukuran JSON/form; Zod `.strict()` untuk membuang field tak dikenal.
- **Concurrency**: `expectedVersion` mencegah overwrite diam-diam.
- **File**: tulis atomik; lock; permission ketat; direktori data di luar `public`.
- **Rahasia**: tidak ada kredensial di konten; analytics ID divalidasi formatnya.
- **Preview**: hanya admin, same-origin; konten dari editor sendiri.
- **Rate limit**: tidak wajib untuk admin terautentikasi; tetap batasi ukuran upload.
- **Audit**: snapshot menyimpan `updatedBy`; tidak menulis ke database.

---

## 12. Performa

Target:

| Metrik | Target |
|---|---|
| Query database untuk konten landing | **0** |
| Waktu baca konten per request | 0 ms (cache), kecuali request pertama setelah publish |
| HTML landing | tetap static/ISR, bukan dynamic per request |
| JS CMS/TipTap di halaman publik | **0 byte** |
| LCP landing | tidak turun >10% dari baseline |
| Publish → perubahan terlihat | <2 detik (revalidate lokal) |
| Ukuran `content.json` | <2 MB (perkiraan 60–100 KB) |

Cara:

- Pisahkan bundle: komponen CMS hanya diimpor di route `/cms`; TipTap dynamic import.
- Gambar dioptimalkan saat upload + `next/image`; tidak ada gambar original besar yang disajikan.
- Cache tag, bukan query per request.
- Revalidasi hanya saat simpan, bukan berkala.
- Jangan menambahkan dependensi berat ke halaman publik.
- Ukur dengan `curl` TTFB + `next build` output; Lighthouse dijalankan di mesin yang punya Chrome (environment ini tidak menyediakan Chrome).

---

## 13. Perubahan file utama

### Baru

```
lib/cms/
  types.ts                 # tipe SiteContent, Product, MediaRef, dll.
  schema.ts                # Zod + batas + validasi URL/slug
  store.ts                 # baca/tulis atomik, cache, versi, fallback
  sanitize.ts              # sanitize-html + aturan allowlist
  media.ts                 # validasi + sharp + simpan file
  paths.ts                 # daftar path publik untuk revalidasi
  actions.ts               # Server Actions simpan/upload/pulihkan
  seed-content.json        # konten awal (migrasi dari hard-code)
app/cms/
  layout.tsx               # shell studio + gate OWNER/DEVELOPER
  page.tsx                 # dashboard
  beranda/page.tsx
  produk/page.tsx
  produk/[slug]/page.tsx
  portofolio/page.tsx
  size-chart/page.tsx
  katalog-kain/page.tsx
  kontak/page.tsx
  pengaturan/page.tsx
  riwayat/page.tsx
app/(preview)/cms-preview/
  layout.tsx               # auth + noindex
  page.tsx                 # preview client
app/api/cms/media/route.ts # upload
app/media/[...path]/route.ts
components/cms/
  cms-studio.tsx
  section-manager.tsx
  preview-pane.tsx
  rich-text-editor.tsx
  rich-text.tsx
  image-field.tsx
  media-library.tsx
  save-bar.tsx
  panels/*.tsx             # panel per section/halaman
scripts/
  cms-setup.mjs            # buat direktori + seed
  cms-validate.mjs         # validasi content.json
  cms-backup.mjs           # arsip data
  cms-clean-orphans.mjs    # bersihkan media tak terpakai
tests/
  cms-store.test.mjs
  cms-sanitize.test.mjs
  cms-media.test.mjs
  cms-schema.test.mjs
```

### Diubah

- `app/page.tsx` — baca konten, render section sesuai urutan, `generateMetadata`, JSON-LD dinamis.
- `app/layout.tsx` — metadata global dari konten.
- `app/portofolio/page.tsx`, `app/size-chart/page.tsx`, `app/katalog-kain/page.tsx`, `app/contact/page.tsx`, `app/produk/[slug]/page.tsx`.
- `app/sitemap.ts`, `app/robots.ts`.
- `components/landing-*.tsx`, `components/site-chrome.tsx`, `components/portfolio-grid.tsx`, `components/size-chart-grid.tsx`, `components/katalog-kain-grid.tsx`, `components/contact-*.tsx`, `components/product-*.tsx`, `components/coming-soon-overlay.tsx` — menerima props konten, bukan konstanta.
- Migrasi konstanta gambar yang masih tersebar: `PRODUCT_DETAIL_GALLERIES` di `components/product-detail-grid.tsx` dan `SIZE_CHART_IMAGES` di `components/size-chart-grid.tsx`.
- `components/app-nav.tsx` — grup Website.
- `lib/auth/permissions.ts` — tambah `CMS_ROLES = ["OWNER"]` (DEVELOPER otomatis lolos lewat `hasRole`).
- `lib/navigation.ts`, `lib/products.ts`, `lib/portfolio.ts`, `lib/contact-page.ts`, `lib/contact.ts`, `lib/site.ts` — dipensiunkan sebagai sumber konten; nilainya dipindah ke seed JSON. `lib/contact.ts` tetap dipakai untuk helper WhatsApp, tetapi nomor dibaca dari konten. `lib/site.ts` tetap dipertahankan sebagai fallback statis sampai `tests/seo.test.mjs` dimigrasi.
- `tests/seo.test.mjs`, `tests/contact.test.mjs` — sesuaikan agar menguji seed/konten baru, bukan konstanta yang sudah dipensiunkan; jangan hapus fallback sebelum tes dimigrasi.
- `next.config.ts` — bila perlu `images` untuk media lokal (biasanya tidak perlu), dan pastikan redirect produk lama tetap.
- `.env.example` — `CMS_DATA_DIR`, `CMS_UPLOAD_DIR`.
- `.gitignore` — `data/`.
- `package.json` — dependensi TipTap + sanitize-html, skrip `cms:*`.
- `AUDIT`/label tidak berubah karena CMS tidak menulis AuditEvent DB.

---

## 14. Rencana kerja (todo)

### Fase 0 — Fondasi (1–2 hari)

- [ ] Konfirmasi path volume persisten di VPS; buat `data/cms` dan `data/uploads`; set permission.
- [ ] Tambah `CMS_DATA_DIR`, `CMS_UPLOAD_DIR` di `.env.example` dan dokumentasi deploy.
- [ ] Tambah dependensi: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `sanitize-html`, `@types/sanitize-html`.
- [ ] Tulis `lib/cms/types.ts` + `schema.ts` lengkap dengan batas dan validasi URL/slug.
- [ ] Migrasikan seluruh konten hard-code ke `lib/cms/seed-content.json` (zero visual change).
- [ ] Tulis `store.ts`: baca cache, fallback seed, tulis atomik, lock, snapshot, versi, concurrency.
- [ ] Tulis `sanitize.ts` + `media.ts` (sharp) + route media.
- [ ] Skrip `cms:setup`, `cms:validate`, `cms:backup`, `cms:clean-orphans`.
- [ ] Tes unit: schema, store, sanitizer, media, path traversal.

### Fase 1 — Publik membaca konten (2–3 hari)

- [ ] Refactor navbar/footer/FAB menjadi komponen view berbasis props.
- [ ] Refactor seluruh section landing: hero, produk, proses, why, klien, testimoni, CTA.
- [ ] Terapkan urutan + sembunyikan section di landing.
- [ ] Refactor halaman portofolio, size chart, katalog kain, kontak.
- [ ] Refactor halaman produk induk/detail + `generateStaticParams` + `dynamicParams = true`.
- [ ] `generateMetadata` + JSON-LD + sitemap/robots dari konten.
- [ ] Pastikan halaman publik `index, follow`; `/cms` dan `/cms-preview` `noindex`.
- [ ] Migrasi `PRODUCT_DETAIL_GALLERIES` dan `SIZE_CHART_IMAGES` ke konten.
- [ ] Sesuaikan `tests/seo.test.mjs` dan `tests/contact.test.mjs`.
- [ ] Pastikan tidak ada sisa impor konstanta hard-code di komponen publik.
- [ ] Verifikasi visual parity di 390/768/1280/1440 px (screenshot/manual).
- [ ] Ukur baseline vs sesudah: TTFB, ukuran HTML, JS publik, LCP.

### Fase 2 — Fondasi studio (2–3 hari)

- [ ] Layout `/cms` + gate role + grup menu Website.
- [ ] Dashboard kartu halaman + status terakhir diubah.
- [ ] Shell studio: panel kiri, preview kanan, save bar, toast, unsaved guard, Ctrl/Cmd+S.
- [ ] State draft + Server Action simpan + concurrency + revalidate + pesan sukses/gagal.
- [ ] Preview iframe + postMessage + device switcher + klik section.
- [ ] `RichTextEditor` TipTap + toolbar + dialog link + counter + sanitasi.
- [ ] `ImageField` + uploader progress + alt + replace/remove + media library.
- [ ] `SectionManager` drag + tombol naik/turun + eye toggle + peringatan.

### Fase 3 — Editor semua halaman (3–4 hari)

- [ ] Beranda: hero + 4 keunggulan.
- [ ] Beranda: katalog produk + pengaturan kartu.
- [ ] Manajer produk: tambah/edit/hapus, induk–anak, urutan menu, publikasi.
- [ ] Editor produk: deskripsi, galeri, fitur, use case, SEO, gambar kartu.
- [ ] Beranda: proses + langkah.
- [ ] Beranda: why + keunggulan.
- [ ] Beranda: klien + testimoni.
- [ ] Beranda: CTA + tombol WhatsApp mengambang.
- [ ] Navbar + footer + link + sosial.
- [ ] Pengaturan website: brand, WhatsApp, SEO, analytics, OG.
- [ ] Portofolio.
- [ ] Size chart.
- [ ] Katalog kain + mode segera hadir.
- [ ] Kontak: info, FAQ, form, peta, CTA.
- [ ] Teks "Segera Hadir" untuk produk/galeri kosong.

### Fase 4 — Keamanan, riwayat, verifikasi (2 hari)

- [ ] Halaman Riwayat + lihat + pulihkan.
- [ ] Backup script + cron + dokumentasi restore.
- [ ] Audit keamanan: auth setiap action, upload, sanitizer, URL, path traversal, payload.
- [ ] Empty/loading/error state di semua panel; pesan Bahasa Indonesia.
- [ ] Uji mobile admin 360 px; keyboard; focus; screen reader label.
- [ ] Jalankan `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build -- --webpack`.
- [ ] Uji manual alur klien: edit tiap section, upload gambar, simpan, lihat publik, pulihkan versi.
- [ ] Ukur performa akhir + bandingkan baseline.
- [ ] Tulis panduan singkat untuk klien (1 halaman) + runbook deploy/backup.

Total perkiraan: **10–14 hari kerja** untuk satu developer, termasuk verifikasi.

---

## 15. Kriteria penerimaan

1. **100% inventaris bagian 4** bisa diedit dari UI tanpa deploy.
2. Semua textarea paragraf memakai WYSIWYG dan hasil bold/italic/underline/list/link bertahan setelah simpan dan reload.
3. Semua slot gambar bisa diganti/dihapus/ditambah; gambar baru otomatis WebP dan tampil di publik.
4. Urutan dan visibilitas section bekerja di landing dan halaman publik lain.
5. Link navbar/footer/tombol bisa diubah; link berbahaya ditolak dengan pesan jelas.
6. Simpan langsung tayang <2 detik; tidak ada konten lama yang tersaji setelah reload.
7. Riwayat dan pulihkan versi bekerja.
8. Hanya OWNER/DEVELOPER yang bisa membuka `/cms`; role lain 404 dan action ditolak.
9. Tidak ada tabel, bucket, atau query Supabase baru untuk konten/gambar.
10. Halaman publik tidak memuat JavaScript CMS/TipTap.
11. Landing tetap static/ISR dan LCP tidak turun >10%.
12. Admin nyaman dipakai di HP 360 px dan keyboard.
13. `npm test`, lint, typecheck, dan build lolos.
14. Backup dan restore sudah diuji.

---

## 16. Verifikasi

### Otomatis

- `node --test tests/cms-*.test.mjs`
- `npm test`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build -- --webpack`
- `npm run cms:validate`

### Manual (wajib, karena environment ini tidak punya Chrome)

- Matriks halaman × viewport: 360, 390, 768, 1280, 1440.
- Untuk setiap halaman: ubah teks, ubah gambar, ubah link, sembunyikan section, ubah urutan, simpan, buka publik, hard refresh.
- Uji WYSIWYG: tebal, miring, garis bawah, bullet, numbered, link, paste dari Word, teks panjang.
- Uji upload: JPG/PNG/WebP valid, file 9 MB, PDF, SVG, gambar 8000 px, nama file aneh.
- Uji konflik: buka dua tab, simpan dari tab lama → harus ditolak dengan pesan.
- Uji pulihkan versi.
- Uji akses role lain (ADMIN_CUSTOMER, KEUANGAN) → 404.
- Uji preview desktop/tablet/HP.
- Uji keyboard: Tab, Enter, Escape, Ctrl/Cmd+S.
- Cek HTML publik: tidak ada script editor, metadata benar, JSON-LD valid.
- Cek `content.json` dan `data/uploads` tidak terekspos lewat URL publik.

### Performance

- `curl -sI` untuk TTFB/Cache-Control landing.
- Bandingkan ukuran HTML dan daftar chunk JS sebelum/sesudah.
- Lighthouse dijalankan di mesin dengan Chrome; catat LCP/CLS/INP sebelum dan sesudah.
- Pastikan `content.json` tidak dibaca ulang per request (log/benchmark).

---

## 17. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Disk VPS tidak persisten / pindah ke Vercel | Dokumentasikan kebutuhan volume; store diabstraksi agar bisa pindah ke R2/S3 tanpa ubah UI |
| Beberapa instance/worker → cache & file tidak sinkron | Jalankan satu instance; jika scale, gunakan shared volume + custom cache handler/object storage |
| File JSON rusak | Tulis atomik + snapshot + fallback snapshot terbaru + seed + backup harian |
| Dua tab saling menimpa | `expectedVersion` + pesan konflik |
| XSS lewat WYSIWYG | Allowlist sanitizer saat simpan dan render; tes payload |
| Upload berbahaya | Validasi isi dengan sharp, re-encode, tanpa SVG/GIF, batas ukuran/piksel |
| Path traversal media | Resolve path + cek prefix root + tolak dotfile |
| Gambar terlalu besar / lambat | Optimasi otomatis + `next/image` + cache immutable |
| Klien bingung | Bahasa Indonesia, label jelas, preview, bantuan singkat, urutan tombol naik/turun |
| Section disembunyikan memutus anchor | Peringatan di editor + daftar link terdampak |
| Produk baru tidak muncul | `dynamicParams = true` + revalidate path |
| Produk dihapus masih di sitemap | Sitemap dibangun dari produk `published` |
| Root layout noindex | Metadata publik per halaman tetap `index`; CMS/preview `noindex` |
| Kehilangan konten saat deploy | `data/` di luar build, volume persisten, backup sebelum deploy |

---

## 18. Yang tidak termasuk (agar ekspektasi jelas)

- Page builder bebas (menambah tipe section baru dari nol, mengatur kolom, HTML mentah).
- Pengeditan warna, font, shadow, atau CSS global (desain tetap; hanya isi yang berubah).
- Multi-bahasa.
- Penjadwalan publikasi (draft/schedule).
- Approval workflow multi-user.
- Editor gambar lanjutan (crop manual, filter).
- Migrasi gambar lama ke storage baru (aset `/public` tetap dipakai).
- Pengeditan label aksesibilitas (`aria-label`), pesan validasi sistem, dan teks UI internal yang tidak tampil ke pengunjung.
- Perubahan pada modul CRM/keuangan/produksi.

Jika salah satu dibutuhkan, buat fase terpisah setelah CMS inti stabil.

---

## 19. Catatan implementasi Next.js 16

Sebelum menulis kode, baca ulang dokumentasi lokal:

- `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`
- `.../03-api-reference/04-functions/revalidateTag.md`
- `.../03-api-reference/04-functions/unstable_cache.md`
- `.../01-getting-started/15-route-handlers.md`
- `.../02-guides/self-hosting.md`
- `.../03-api-reference/03-file-conventions/02-route-segment-config/dynamicParams.md`

Poin penting:

- Proyek **tidak** memakai `cacheComponents`; gunakan `unstable_cache` + `revalidateTag(tag, { expire: 0 })`.
- `revalidateTag` single-argument sudah deprecated.
- `dynamicParams` tidak tersedia bila `cacheComponents` diaktifkan.
- Route Handler GET tidak di-cache secara default; route media memakai header cache sendiri.
- Self-hosted + disk persisten mendukung ISR dan image optimization.
- Halaman produk saat ini `force-static` + `dynamicParams=false`; ubah agar produk dari CMS bisa bertambah.

---

## 20. Runbook deploy & backup

1. Siapkan volume: `/var/lib/askonveksi/cms` dan `/var/lib/askonveksi/uploads`; owner = user aplikasi.
2. Set `CMS_DATA_DIR` dan `CMS_UPLOAD_DIR` di environment produksi.
3. Jalankan `npm run cms:setup` sekali untuk membuat direktori dan menyalin seed.
4. Deploy aplikasi seperti biasa; pastikan volume tidak ikut terhapus.
5. Jadwalkan `npm run cms:backup` harian (cron) ke direktori/backup eksternal.
6. Sebelum deploy: backup; sesudah deploy: buka `/`, `/cms`, simpan satu perubahan kecil, verifikasi publik.
7. Rollback aplikasi tidak menghapus `data/`; rollback konten dilakukan dari `/cms/riwayat`.
8. Jika pindah hosting, salin `data/cms` + `data/uploads` dan set env yang sama.

---

## 21. Ringkasan satu paragraf

CMS ini adalah studio admin milik sendiri, bukan WordPress dan bukan page builder. Konten berupa satu dokumen JSON berversi yang disimpan di disk VPS, dibaca sekali lalu di-cache, sehingga landing tetap secepat situs statis tanpa query database. Klien mengedit lewat panel berbahasa Indonesia dengan live preview, WYSIWYG untuk teks, penggantian gambar yang otomatis dioptimalkan, serta pengurutan/penyembunyian section. Setiap simpan langsung tayang, tetapi selalu dibuatkan snapshot sehingga bisa dipulihkan. Akses hanya OWNER dan DEVELOPER, dan seluruh konten/gambar tidak pernah masuk ke database Supabase.
