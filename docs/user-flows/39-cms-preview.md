# CMS preview

## Tujuan

Pratinjau situs seperti pengunjung, memakai konten CMS (termasuk draft/uji), terpisah dari chrome ERP.

## Prasyarat

- Sesi yang boleh membuka area CMS (Owner + bypass). [DARI-KODE-SAJA] layout CMS
- Owner uji berhasil membuka `/cms-preview`. [TERVERIFIKASI-BROWSER]

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/cms-preview` | `app/cms-preview/page.tsx` |
| UI | `components/cms/cms-preview-app.tsx` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka `/cms-preview` | Nav publik: `Beranda`, `Tentang Kami`, `Testimoni`, `Portofolio`, `Size Chart`, `Produk`, `Contact`, `Hubungi Kami` | Landing preview | [TERVERIFIKASI-BROWSER] `evidence/39-cms-preview.png` |
| 2 | Lihat hero | Teks contoh `UJI CMS TAUTAN PUBLIKSeragam dan Apparel Custom`; CTA `Konsultasi Sekarang`, `Lihat Keunggulan` | Konten CMS | [TERVERIFIKASI-BROWSER] |
| 3 | Navigasi produk di preview | Chip/link `Kemeja`, `PDH`, `Jaket`, …; `Lihat Semua Produk` | Mirror katalog | [TERVERIFIKASI-BROWSER] |
| 4 | Nav `Contact` dari preview | Form kontak sama label publik | Mirror `/contact` | [TERVERIFIKASI-BROWSER] `evidence/39-cms-preview-contact.png` |
| 5 | Tab `Pratinjau` di editor CMS | Pane `Pratinjau langsung` + iframe `src=/cms-preview` | Draft belum publish | [TERVERIFIKASI-BROWSER] `evidence/37-cms-pratinjau-pane.png` |

## Field form

| Field | Bukti |
| --- | --- |
| Form kontak di preview | Label `Nama *`, `Email *`, `No. WhatsApp`, `Kebutuhan`, `Pesan *` [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Bukti |
| --- | --- |
| Non-CMS (Designer) ke `/cms` | 404 (bukan halaman preview) [TERVERIFIKASI-BROWSER] `37-cms-denied-designer.png` |

## Efek samping

- Read-only terhadap publish; tidak mengubah data transaksi ERP.

## Temuan / keanehan

- Judul hero mengandung prefix uji `UJI CMS TAUTAN PUBLIK` menempel ke headline (kemungkinan konten seed). [TERVERIFIKASI-BROWSER]

## Pertanyaan terbuka

- — (`Pratinjau` = iframe `/cms-preview`; `Lihat Website` = situs publik `/`)
