# Master: ukuran pakaian

## Tujuan

Mengelola ukuran pakaian untuk PO/roster dan produksi.

## Prasyarat

- Role `GARMENT_SIZE_ROLES` (`OWNER`, `ADMIN_PO`, + bypass). [DARI-KODE-SAJA] `page-access.ts:56-57`

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/master-data/garment-sizes` | `app/(app)/master-data/garment-sizes/page.tsx` |
| Actions | `app/actions/master-data.ts` (garment size handlers) |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Ukuran pakaian` | Tabel | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-master-data__garment-sizes.png` |
| 2 | CRUD | `Edit`, `Hapus` | Update master | [TERVERIFIKASI-BROWSER] |
| 3 | Impor Excel | `File import` | Bulk import | [TERVERIFIKASI-BROWSER] labels |

## Field form

| Field | Label | Wajib? | Bukti |
| --- | --- | --- | --- |
| Nama | `Nama* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Deskripsi | `Deskripsi` | tidak | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Nama duplikat | `Nama sudah digunakan. Gunakan nama lain.` | [DARI-KODE-SAJA] pola `assertUniqueName` |
| Ukuran tidak ada di CRM | `Ukuran ... belum tersedia di Data Master.` | [DARI-KODE-SAJA] `crm.ts:703` |

## Efek samping

- Dipakai validasi roster PO/invoice.

## Temuan / keanehan

- Path master lain pakai `MASTER_DATA_ADMIN`; ukuran pakai role terpisah.

## Pertanyaan terbuka

- — (form create inline: `Nama* (wajib)`, `Deskripsi`; judul kartu `Tambah ukuran pakaian` — tidak ada field jenis pakaian terpisah) [TERVERIFIKASI-BROWSER] `evidence/08-ukuran-create.png`, `continue-gapfill7.json` `sizes`
