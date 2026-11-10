# Log aktivitas

## Tujuan

Audit trail: lihat perubahan entitas dan aktor.

## Prasyarat

- `/log-aktivitas` — `AUDIT_VIEW_ROLES` + bypass. [DARI-KODE-SAJA] `page-access.ts:53`

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/log-aktivitas` | `app/(app)/log-aktivitas/page.tsx` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Log aktivitas` | Tabel audit | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-log-aktivitas.png` |
| 2 | Filter | `Terapkan` | Filter events | [TERVERIFIKASI-BROWSER] |
| 3 | `Lihat` | Tombol per baris | Detail perubahan | [TERVERIFIKASI-BROWSER] |

## Field form

| Field | Bukti |
| --- | --- |
| Filter | `Dari tanggal`, `Sampai tanggal`, `Pelaku`, `Jenis entitas`, `Baris per halaman` + `Terapkan` [TERVERIFIKASI-BROWSER] `evidence/35-log-aktivitas-filters.png` |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Tanpa akses (Designer) | Buka `/log-aktivitas` → redirect landing `/absensi` | [TERVERIFIKASI-BROWSER] `evidence/35-log-denied-designer.png` |

## Efek samping

- Read-only.

## Temuan / keanehan

- Banyak tombol `Lihat` repetitif di manifest.

## Pertanyaan terbuka

- — (filter + denial sudah terverifikasi)
