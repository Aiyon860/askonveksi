# Master: jenis customer

## Tujuan

Mengelola daftar jenis customer (CRUD, impor Excel) untuk CRM.

## Prasyarat

- Role `MASTER_DATA_ADMIN_ROLES` (+ `DEVELOPER`/`OWNER`/`KEUANGAN` bypass). [DARI-KODE-SAJA] `page-access.ts:58`
- Sesi aktif.

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/master-data/customer-types` | `app/(app)/master-data/customer-types/page.tsx` |
| Actions | `app/actions/master-data.ts` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Jenis customer` | Tabel master | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-master-data__customer-types.png` |
| 2 | Tambah/edit inline | `Edit`, `Hapus` | Simpan baris | [TERVERIFIKASI-BROWSER] manifest `buttons` — submit [DARI-KODE-SAJA] |
| 3 | Impor Excel | `File import` | `importCustomerType*` | [TERVERIFIKASI-BROWSER] label manifest — sukses tidak diuji |
| 4 | Pagination | `Baris per halaman` | Ganti halaman | [TERVERIFIKASI-BROWSER] manifest `labels` |

## Field form

| Field | Label | Wajib? | Validasi | Bukti |
| --- | --- | --- | --- | --- |
| Nama | `Nama* (wajib)` | ya | unik, skema master | [TERVERIFIKASI-BROWSER]; [DARI-KODE-SAJA] `master-data.ts:52` |
| Deskripsi | `Deskripsi` | tidak | — | [TERVERIFIKASI-BROWSER] |
| File | `File import` | ya (impor) | `Pilih file Excel terlebih dahulu.` | [DARI-KODE-SAJA] `master-data.ts:57` |

## Skenario gagal

| Skenario | Pesan persis | Bukti |
| --- | --- | --- |
| Nama duplikat | `Nama sudah digunakan. Gunakan nama lain.` | [DARI-KODE-SAJA] `master-data.ts:52` |
| Duplikat DB saat impor | `Data jenis customer memiliki nama duplikat. Rapikan data sebelum import.` | [DARI-KODE-SAJA] `master-data.ts:68` |
| Tanpa file impor | `Pilih file Excel terlebih dahulu.` | [DARI-KODE-SAJA] `master-data.ts:57` |

## Efek samping

- Audit event `CUSTOMER_TYPE_*`.

## Temuan / keanehan

- —

## Pertanyaan terbuka

- — (submit `Tambah jenis customer` tanpa nama → HTML5 `:invalid` / `Please fill out this field.` locale browser) [TERVERIFIKASI-BROWSER] `evidence/06-jenis-customer-empty.png`
