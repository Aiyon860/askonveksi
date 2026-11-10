# Prospek

## Tujuan

Mengelola prospek sebelum menjadi peluang pada pipeline.

## Prasyarat

- Akses CRM view (`/crm/prospek` di bawah `/crm` guard). [DARI-KODE-SAJA] `page-access.ts:44`

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/crm/prospek` | `app/(app)/crm/prospek/page.tsx` |
| Actions | `createProspect*`, `updateProspect*` di `crm.ts` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Prospek` | Tabel prospek | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-crm__prospek.png` |
| 2 | Filter tanggal | `Dari tanggal`, `Sampai tanggal` | Filter | [TERVERIFIKASI-BROWSER] `labels` |
| 3 | `Terapkan` | Tombol | Terapkan filter | [TERVERIFIKASI-BROWSER] |
| 4 | `Export Excel` | Tombol | Export peluang/prospek | [TERVERIFIKASI-BROWSER] |
| 5 | Tombol `Prospek` | Membuka dialog `Tambah Prospek`; aksi `Simpan Prospek` / `Tutup` | Form create | [TERVERIFIKASI-BROWSER] `evidence/15-prospek-create.png`, `continue-gapfill2.json` `prospekDialog` — submit tidak dijalankan |
| 6 | `Edit` baris | Tombol `Edit` | Edit prospek | [TERVERIFIKASI-BROWSER] — sukses [DARI-KODE-SAJA] |

## Field form

| Field | Label | Wajib? | Bukti |
| --- | --- | --- | --- |
| Rentang filter | date inputs | tidak | [TERVERIFIKASI-BROWSER] |
| Baris per halaman | select | tidak | [TERVERIFIKASI-BROWSER] |
| Nama customer | `Nama customer* (wajib)` | ya | [TERVERIFIKASI-BROWSER] dialog |
| Perusahaan/Instansi/Komunitas | text | tidak | [TERVERIFIKASI-BROWSER] |
| Jenis customer | `Jenis customer* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Sumber lead | select | tidak | [TERVERIFIKASI-BROWSER] |
| Sales/PIC | select | tidak | [TERVERIFIKASI-BROWSER] |
| Kota | `Kota* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Asal | `Asal* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| WhatsApp / Email / Instagram | text | tidak | [TERVERIFIKASI-BROWSER] |
| Catatan umum | textarea | tidak | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Tanggal tidak valid | `Tanggal tidak valid.` | [DARI-KODE-SAJA] `crm.ts:152` |
| Field wajib kosong | submit `Simpan Prospek` tanpa isi | HTML5 `:invalid` pada field wajib (locale browser) | [TERVERIFIKASI-BROWSER] `evidence/15-prospek-empty.png` |

## Efek samping

- Konversi prospek → peluang di pipeline.

## Temuan / keanehan

- —

## Pertanyaan terbuka

- — (tombol `Prospek` = modal `Tambah Prospek`)
