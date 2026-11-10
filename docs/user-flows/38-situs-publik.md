# Situs publik

## Tujuan

Halaman marketing tanpa login: beranda, produk, portofolio, size chart, katalog kain, kontak + lead form.

## Prasyarat

- Tidak perlu auth.
- Konten dari CMS publish.

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/` | `app/page.tsx` |
| `/produk/[slug]` | `app/produk/[slug]/page.tsx` |
| `/portofolio`, `/size-chart`, `/katalog-kain`, `/contact` | `app/**/page.tsx` |
| Lead API | `app/api/public/leads` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka `/` | Heading kampanye (`UJI CMS TAUTAN PUBLIK...`, `Bahan Berkualitas`, dll.) | Landing | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-public-home.png` |
| 2 | Nav `Produk` | Tombol/link `Produk` | Menu produk | [TERVERIFIKASI-BROWSER] beberapa halaman |
| 3 | `/produk/kemeja` | Heading `Kemeja`; sub `Kemeja PDH/PDL`, `Workshirt` | Detail produk | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-produk__kemeja.png` |
| 4 | `/portofolio` | `Portofolio Kami` | Galeri | [TERVERIFIKASI-BROWSER] `evidence/crawl-owner-portofolio.png` |
| 5 | `/size-chart` | `Size chart` | Tabel ukuran | [TERVERIFIKASI-BROWSER] `evidence/crawl-owner-size-chart.png` |
| 6 | `/katalog-kain` | `Katalog Kain` | Daftar kain | [TERVERIFIKASI-BROWSER] `evidence/crawl-owner-katalog-kain.png` |
| 7 | `/contact` | `Kontak Kami`; FAQ; form + `Kirim via WhatsApp` | Kontak + CTA WA | [TERVERIFIKASI-BROWSER] `evidence/38-contact-public.png`, `continue-gapfill.json` `contact` |

## Field form

| Field | Label | Wajib? | Bukti |
| --- | --- | --- | --- |
| Nama | `Nama *` | ya | [TERVERIFIKASI-BROWSER] |
| Email | `Email *` | ya | [TERVERIFIKASI-BROWSER] |
| No. WhatsApp | `No. WhatsApp` | tidak | [TERVERIFIKASI-BROWSER] |
| Kebutuhan | `Kebutuhan` | tidak | [TERVERIFIKASI-BROWSER] |
| Pesan | `Pesan *` | ya | [TERVERIFIKASI-BROWSER] |
| Submit | `Kirim via WhatsApp` | — | membuka WA dengan format otomatis [TERVERIFIKASI-BROWSER] |
| FAQ accordion | pertanyaan di halaman | — | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Lead API validasi | `Format permintaan tidak didukung.` (415), `Permintaan tidak dapat diproses.` (403), `Data yang dikirim terlalu besar.` (413), `Terlalu banyak permintaan…` (429), `Periksa kembali data formulir.` (422), sukses `Terima kasih. Tim Askonveksi akan menghubungi Anda.` | [DARI-KODE-SAJA] `app/api/public/leads/route.ts` |

## Efek samping

- Lead masuk CRM jika API sukses.

## Temuan / keanehan

- Teks uji CMS terpampang di beranda publik.

## Pertanyaan terbuka

- — (form kontak ada, submit = `Kirim via WhatsApp`, bukan email API di UI)
