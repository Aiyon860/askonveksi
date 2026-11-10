# Master: profil perusahaan

## Tujuan

Data legal/tampilan perusahaan, logo, tanda tangan, dan catatan default invoice.

## Prasyarat

- `MASTER_DATA_ADMIN_ROLES` + bypass.

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/master-data/business-profile` | `app/(app)/master-data/business-profile/page.tsx` |
| Schema | `businessProfileSchema` |
| Storage logo | `lib/storage/erp-storage.ts`, API terkait |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Profil perusahaan` | Form profil | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-master-data__business-profile.png` |
| 2 | Isi & `Simpan profil perusahaan` | Tombol simpan | Update profil + audit | [TERVERIFIKASI-BROWSER] — sukses [DARI-KODE-SAJA] |
| 3 | Unggah logo/tanda tangan | Label `Logo`, `Tanda tangan` | Upload storage | [TERVERIFIKASI-BROWSER] labels |

## Field form

| Field | Label | Wajib? | Bukti |
| --- | --- | --- | --- |
| Nama perusahaan | `Nama perusahaan* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Telepon | `Telepon` | tidak | [TERVERIFIKASI-BROWSER] |
| Email | `Email` | tidak | [TERVERIFIKASI-BROWSER] |
| Alamat | `Alamat` | tidak | [TERVERIFIKASI-BROWSER] |
| Catatan invoice | `Template catatan invoice (bisa diedit)` | tidak | [TERVERIFIKASI-BROWSER] |
| Penandatangan | `Nama`, `Jabatan` | tidak | [TERVERIFIKASI-BROWSER] |
| Logo/TTD | upload; `Hapus gambar (kembali ke teks saja)` | tidak | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Nama kosong / pendek | HTML5 `:invalid` atau zod `Nama perusahaan minimal 2 karakter.` | [TERVERIFIKASI-BROWSER] empty submit; [DARI-KODE-SAJA] `businessProfileSchema` |
| Email tidak valid | `Format email perusahaan tidak valid.` | [DARI-KODE-SAJA] |
| Logo/TTD > 2 MB | `{Logo\|Tanda tangan} maksimal 2 MB.` | [DARI-KODE-SAJA] `readBusinessImage` |
| Format salah | `{Logo\|Tanda tangan} harus berupa PNG, JPG, atau WebP yang valid.` | [DARI-KODE-SAJA] |
| Sukses | `Profil perusahaan berhasil diperbarui.` | [DARI-KODE-SAJA] |

## Efek samping

- Revalidate tag logo situs (`SITE_LOGO_CACHE_TAG`).

## Temuan / keanehan

- —

## Pertanyaan terbuka

- —
