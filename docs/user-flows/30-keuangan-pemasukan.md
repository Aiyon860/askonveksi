# Keuangan pemasukan (Project)

## Tujuan

Melacak project/HPP pemasukan per SO; edit HPP; dasar laporan laba.

## Prasyarat

- `/keuangan/pemasukan`; `/keuangan` redirect ke sini. [DARI-KODE-SAJA] index alias
- `FINANCE_ROLES` + bypass. [DARI-KODE-SAJA] `page-access.ts:42`

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/keuangan/pemasukan` | `app/(app)/keuangan/pemasukan/page.tsx` |
| Actions | finance HPP di `app/actions/**` |
| Export | dataset `project`, `rincian-hpp` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Project` | Tabel project | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-keuangan__pemasukan.png` |
| 2 | `Export Excel` / `Terapkan` | Tombol | Export/filter | [TERVERIFIKASI-BROWSER] |
| 3 | `Edit HPP` | Tombol per baris | Dialog edit HPP | [TERVERIFIKASI-BROWSER] — simpan [DARI-KODE-SAJA] |

## Field form

| Field | Bukti |
| --- | --- |
| Filter | `Dari tanggal`, `Sampai tanggal`, `Pembayaran`, `Status HPP`, `Baris per halaman` [TERVERIFIKASI-BROWSER] `continue-gapfill6.json` |
| Edit HPP | Dialog `Edit HPP · …`; per baris: `Nominal (Rp)`, `Deskripsi`, `Tanggal bayar`, `Metode`, `Bukti TF (opsional)`; aksi `Tambah baris` / `Hapus` / `Simpan HPP` / `Tutup` [TERVERIFIKASI-BROWSER] `evidence/30-pemasukan-hpp.png` |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Baris HPP berlebih | `Maksimal 12 baris {Kain\|…}.` | [DARI-KODE-SAJA] `finance.ts` |
| Tanggal/metode kosong pada baris nominal | `Tanggal pembayaran {jenis} wajib diisi.` / `Metode pembayaran {jenis} wajib dipilih.` | [DARI-KODE-SAJA] |
| Produk tidak lengkap | `Produk HPP tidak lengkap. Muat ulang halaman.` / `Biaya HPP tidak valid.` | [DARI-KODE-SAJA] |

## Efek samping

- Analytics laba kotor. [TERVERIFIKASI-BROWSER] `/analytics` headings

## Temuan / keanehan

- Judul halaman `Project` bukan kata “Pemasukan”. [TERVERIFIKASI-BROWSER]

## Pertanyaan terbuka

- —
