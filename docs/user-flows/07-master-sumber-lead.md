# Master: sumber lead

## Tujuan

Mengelola sumber lead untuk pipeline dan analitik.

## Prasyarat

- Sama seperti jenis customer (`MASTER_DATA_ADMIN_ROLES` + bypass). [DARI-KODE-SAJA] `page-access.ts:58`

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/master-data/lead-sources` | `app/(app)/master-data/lead-sources/page.tsx` |
| Actions | `app/actions/master-data.ts` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Sumber lead` | Tabel | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-master-data__lead-sources.png` |
| 2 | CRUD | `Edit`, `Hapus` | Mutasi master | [TERVERIFIKASI-BROWSER] — sukses [DARI-KODE-SAJA] |
| 3 | Impor | `File import` | Import Excel | [TERVERIFIKASI-BROWSER] labels |

## Field form

| Field | Label | Wajib? | Bukti |
| --- | --- | --- | --- |
| Nama | `Nama* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Deskripsi | `Deskripsi` | tidak | [TERVERIFIKASI-BROWSER] |
| File impor | `File import` | ya (impor) | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Nama duplikat | `Nama sudah digunakan. Gunakan nama lain.` | [DARI-KODE-SAJA] `master-data.ts:52` |
| Tanpa file | `Pilih file Excel terlebih dahulu.` | [DARI-KODE-SAJA] `master-data.ts:57` |

## Efek samping

- Audit `LEAD_SOURCE_*`; dipakai filter dashboard/CRM.

## Temuan / keanehan

- Nama sumber di dashboard crawl (Instagram, Walk-in, dll.) selaras master. [TERVERIFIKASI-BROWSER] dashboard `bodyStart`

## Pertanyaan terbuka

- —
