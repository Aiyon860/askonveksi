# Master: kategori produk

## Tujuan

Mengelola kategori produk (nama, jenis kategori) untuk peluang dan penagihan.

## Prasyarat

- `MASTER_DATA_ADMIN_ROLES` + bypass. [DARI-KODE-SAJA] `page-access.ts:58`

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/master-data/product-categories` | `app/(app)/master-data/product-categories/page.tsx` |
| Validasi | `productCategoryFieldsSchema` di `lib/crm/validation.ts` |
| Actions | `app/actions/master-data.ts` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Kategori produk` | Tabel | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-master-data__product-categories.png` |
| 2 | CRUD | `Edit`, `Hapus` | Simpan | [TERVERIFIKASI-BROWSER] |
| 3 | Impor | `File import` | Import kategori | [TERVERIFIKASI-BROWSER] |

## Field form

| Field | Label | Wajib? | Bukti |
| --- | --- | --- | --- |
| Nama kategori | `Nama kategori* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Jenis kategori | `Jenis kategori* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Nama duplikat | `Nama sudah digunakan. Gunakan nama lain.` | [DARI-KODE-SAJA] |
| Kategori tidak aktif dipilih CRM | `Kategori produk sudah tidak aktif. Pilih kategori lain.` | [DARI-KODE-SAJA] `crm.ts:575` |

## Efek samping

- Grup kategori (`groupProductCategories`) memengaruhi PO.

## Temuan / keanehan

- —

## Pertanyaan terbuka

- — (`Jenis kategori* (wajib)` opsi: `Pilih jenis kategori`, `Jersey`, `Non-jersey`, `Aksesoris`) [TERVERIFIKASI-BROWSER] `evidence/09-kategori-create.png`, `continue-gapfill7.json` `categories.kindOptions`
