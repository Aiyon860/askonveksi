# CMS studio website

## Tujuan

Mengedit konten situs publik per halaman, produk CMS, riwayat versi.

## Prasyarat

- `/cms` dan subpath — role CMS (= OWNER + bypass). [DARI-KODE-SAJA] nav `CMS_ROLES`

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/cms`, `/cms/beranda`, `/cms/produk`, dll. | `app/cms/**` |
| Actions | `cms-products`, editor schema actions |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka `/cms` | Heading `Kelola Website`; `Halaman website` | Hub CMS | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-cms.png` |
| 2 | Editor halaman (contoh beranda) | `Batalkan`, `Simpan & Tayangkan`, `Isi`, `Pratinjau`, `Lihat Website` | Publish section; `Pratinjau` = pane iframe `/cms-preview`; `Lihat Website` → `/` | [TERVERIFIKASI-BROWSER] `/cms/beranda`; `evidence/37-cms-pratinjau-pane.png`, `continue-gapfill4.json` `cmsPane` |
| 3 | Produk CMS | Heading `Produk`; `Tambah produk`, `Hapus` | Kelola produk situs | [TERVERIFIKASI-BROWSER] `/cms/produk` |
| 4 | Portofolio / size chart / katalog / kontak | judul masing-masing halaman | Edit konten | [TERVERIFIKASI-BROWSER] manifest + screenshots `crawl-owner-cms__*.png` |
| 5 | Pengaturan website | `Pengaturan Website` | Site meta | [TERVERIFIKASI-BROWSER] `/cms/pengaturan` |
| 6 | Riwayat | `Riwayat Perubahan`; `Cadangan versi sebelumnya` | Restore versi | [TERVERIFIKASI-BROWSER] `/cms/riwayat` |

## Field form

| Field | Bukti |
| --- | --- |
| Field section per schema CMS | [DARI-KODE-SAJA] — label bervariasi; contoh `Ganti gambar`, `Tambah keunggulan` [TERVERIFIKASI-BROWSER] beranda |
| Produk | Nama produk di daftar (mis. `Kemeja`) | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Sukses simpan | UI message `Perubahan sudah tersimpan dan tayang di website.` | [DARI-KODE-SAJA] `cms-editor.tsx` |
| Validasi / konflik / sibuk | `error.message` dari `CmsValidationError` / `CmsConflictError` / `CmsBusyError` | [DARI-KODE-SAJA] `lib/cms/actions.ts` |
| Unauthorized | `Sesi atau hak akses Anda sudah berubah. Masuk kembali lalu coba lagi.` | [DARI-KODE-SAJA] |
| Gagal umum | `Konten gagal disimpan. Coba lagi.` | [DARI-KODE-SAJA] |

## Efek samping

- Konten publik (`/`, `/produk/...`) mengikuti publish.

## Temuan / keanehan

- Heading beranda publik crawl: `UJI CMS TAUTAN PUBLIK` — data uji terlihat di `/`. [TERVERIFIKASI-BROWSER] manifest `/`
- Designer (`desainer@mail.com`) membuka `/cms` → **404** `This page could not be found.` [TERVERIFIKASI-BROWSER] `evidence/37-cms-denied-designer.png`, `continue-gapfill.json` `cmsDenied`

## Pertanyaan terbuka

- —
