# Master: metode pembayaran

## Tujuan

Daftar metode bayar untuk invoice/SO/pembayaran.

## Prasyarat

- `MASTER_DATA_ADMIN_ROLES` + bypass.

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/master-data/payment-methods` | `app/(app)/master-data/payment-methods/page.tsx` |
| Actions | `app/actions/master-data.ts` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Metode pembayaran` | Tabel | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-master-data__payment-methods.png` |
| 2 | CRUD | `Edit`, `Hapus` | Mutasi | [TERVERIFIKASI-BROWSER] |
| 3 | Export/Impor | `Export Excel`, `Pilih file` | Excel | [TERVERIFIKASI-BROWSER] `buttons` |

## Field form

| Field | Label | Wajib? | Bukti |
| --- | --- | --- | --- |
| Nama | `Nama* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Deskripsi | `Deskripsi` | tidak | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Nama duplikat | `Nama sudah digunakan. Gunakan nama lain.` | [DARI-KODE-SAJA] |
| Tanpa file impor | `Pilih file Excel terlebih dahulu.` | [DARI-KODE-SAJA] |

## Efek samping

- Referensi transaksi pembayaran.

## Temuan / keanehan

- Tombol `Export Excel` hadir di halaman master ini. [TERVERIFIKASI-BROWSER]

## Pertanyaan terbuka

- —
