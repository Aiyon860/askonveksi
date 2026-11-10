# Keuangan pengeluaran

## Tujuan

Catat, edit, hapus, reimburse pengeluaran operasional.

## Prasyarat

- `FINANCE_ROLES` + bypass.

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/keuangan/pengeluaran` | `app/(app)/keuangan/pengeluaran/page.tsx` |
| `/keuangan/pengeluaran/riwayat` | riwayat soft-delete |
| Actions | expense actions di finance |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka pengeluaran | Heading `Pengeluaran` | Tabel | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-keuangan__pengeluaran.png` |
| 2 | Tab `Pengeluaran` / filter | `Terapkan` | Filter | [TERVERIFIKASI-BROWSER] |
| 3 | Tombol `Pengeluaran` | Dialog `Tambah pengeluaran`; `Simpan pengeluaran` / `Tutup` | Form create | [TERVERIFIKASI-BROWSER] `evidence/31-expense-create.png`, `continue-gapfill2.json` `expenseDialog` — submit tidak dijalankan |
| 4 | `Edit` / `Hapus` | Tombol baris | Mutasi | [TERVERIFIKASI-BROWSER] — sukses [DARI-KODE-SAJA] |
| 5 | Riwayat hapus | Heading `Riwayat Hapus Pengeluaran` | `/keuangan/pengeluaran/riwayat` | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-keuangan__pengeluaran__riwayat.png` |

## Field form

| Field | Label | Wajib? | Bukti |
| --- | --- | --- | --- |
| Digunakan untuk apa | `Digunakan untuk apa* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Customer | `Customer (opsional, untuk filter)` | tidak | [TERVERIFIKASI-BROWSER] |
| Tanggal digunakan | `Tanggal digunakan* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Nominal | `Nominal* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Kategori | `Kategori* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Metode pembayaran | `Metode pembayaran* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Reimburse | `Bisa diganti (reimburse)` | tidak | [TERVERIFIKASI-BROWSER] |
| Bukti | `Bukti pengeluaran* (wajib)` + `Pilih file` | ya | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Field wajib kosong | HTML5 `:invalid` pada dialog `Tambah pengeluaran` | [TERVERIFIKASI-BROWSER] `evidence/31-expense-empty.png` |

## Efek samping

- Export dataset `pengeluaran`, `pengeluaran-terhapus`.

## Temuan / keanehan

- —

## Pertanyaan terbuka

- — (CTA daftar = tombol `Pengeluaran` → judul dialog `Tambah pengeluaran`)
