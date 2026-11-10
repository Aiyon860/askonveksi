# Laporan keuangan

## Tujuan

Laporan keuangan agregat dan export workbook.

## Prasyarat

- `/keuangan/laporan` — FINANCE + bypass.

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/keuangan/laporan` | `app/(app)/keuangan/laporan/page.tsx` |
| API | `app/api/export/finance-workbook/route.ts` |
| Dataset | `laporan` di `lib/export/registry.ts:81-87` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Laporan`; sub `Detail Laporan` | Ringkasan | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-keuangan__laporan.png` |
| 2 | `Export Excel` / `Terapkan` | Tombol | Export laporan | [TERVERIFIKASI-BROWSER] |

## Field form

| Field | Bukti |
| --- | --- |
| Filter periode | `Dari tanggal`, `Sampai tanggal` + `Terapkan` / `Reset` [TERVERIFIKASI-BROWSER] `evidence/32-laporan-filters.png` |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Export gagal | `Data export gagal dimuat.` | [DARI-KODE-SAJA] export route |
| Tanpa hak | `Anda tidak berhak mengekspor data ini.` | [DARI-KODE-SAJA] |

## Efek samping

- File XLSX di client worker.

## Temuan / keanehan

- —

## Pertanyaan terbuka

- —
