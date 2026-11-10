# Dashboard CRM

## Tujuan

Ringkasan eksekutif metrik penjualan, pipeline, produksi, dan kas untuk monitoring harian.

## Prasyarat

- Role dengan akses `DASHBOARD_ROLES`; `DEVELOPER`/`OWNER`/`KEUANGAN` bypass via `hasRole`. [DARI-KODE-SAJA] `lib/auth/page-access.ts:41`
- Sesi aktif Owner (crawl).

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/dashboard` | `app/(app)/dashboard/page.tsx` |
| API agregat | `app/api/crm/dashboard/**` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka `/dashboard` | Heading `Dashboard`; sub `Ringkasan metrik eksekutif, pipeline penjualan, dan performa operasional bisnis` (dari manifest teks nav) | Halaman metrik tampil | [TERVERIFIKASI-BROWSER] manifest headings: `Dashboard`, `Tren 01 Nov 2026 - 30 Nov 2026`, dll.; `evidence/crawl-owner-dashboard.png` |
| 2 | Pilih rentang tanggal | Tombol tanggal `01 Nov 2026 - 30 Nov 2026` | Filter periode grafik | [TERVERIFIKASI-BROWSER] manifest `buttons` |
| 3 | Filter sumber lead / kategori | `Filter:`, opsi `Semua Sumber Lead`, `Instagram`, dll. | Slice data dashboard | [TERVERIFIKASI-BROWSER] manifest `bodyStart` |
| 4 | `Export Excel` | Tombol `Export Excel` | Unduh workbook via export client | [TERVERIFIKASI-BROWSER] manifest; detail dataset [DARI-KODE-SAJA] fitur 40 |
| 5 | Cari global | Placeholder `Cari menu, produk, atau transaksi...` | Navigasi cepat | [TERVERIFIKASI-BROWSER] manifest `inputs` |
| 6 | `Keluar` | Tombol `Keluar` | Logout | [TERVERIFIKASI-BROWSER] manifest `buttons` |

## Field form

| Field | Tipe | Wajib? | Aturan | Bukti |
| --- | --- | --- | --- | --- |
| Pencarian global | text | tidak | — | [TERVERIFIKASI-BROWSER] manifest |
| Filter periode | date range UI | tidak | — | [TERVERIFIKASI-BROWSER] manifest |
| Filter lead/kategori | select/checkbox | tidak | — | [TERVERIFIKASI-BROWSER] manifest `bodyStart` |

## Skenario gagal

| Skenario | Pesan / hasil | Bukti |
| --- | --- | --- |
| Tanpa sesi | Redirect `/login` | [DARI-KODE-SAJA] pola `(app)` layout |
| Role tanpa akses dashboard | Designer buka `/dashboard` → redirect landing `/absensi` (bukan halaman error) | [TERVERIFIKASI-BROWSER] `evidence/03-dashboard-denied-designer.png`, `continue-gapfill7.json` `designerDash` |

## Efek samping

- Export memanggil API export + worker browser (fitur 40).

## Temuan / keanehan

- Banyak section heading sekaligus (funnel, produksi, kas, CRM hari ini). [TERVERIFIKASI-BROWSER]

## Section / metrik (Owner, Nov 2026)

Heading section: `Tren …`, `Order Terbaru`, `Komparasi Kinerja Tim Sales (PIC)`, `Komparasi Omzet Kategori Produk`, `Analisa & Insights`, `Sales & Marketing Conversion Funnel`, `Segmentasi Tipe Pelanggan`, `Top 5 Pelanggan Paling Berharga`, `Komparasi Likuiditas Kas & Piutang`, `Kinerja Tim Sales / PIC`, `Menara Kontrol Operasional Produksi Konveksi`, `Kesehatan Arus Kas & Piutang`, `Tindak Lanjut CRM Hari Ini`. Tile contoh: `Total Lead`, `Total Deal` (+ filter sumber lead & kategori). [TERVERIFIKASI-BROWSER] `evidence/03-dashboard-tiles.png`, `continue-gapfill6.json`

## Pertanyaan terbuka

- —
