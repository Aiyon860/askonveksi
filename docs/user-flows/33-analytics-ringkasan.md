# Analytics ringkasan

## Tujuan

Executive analytics: pipeline, tren harian, laba, refresh & export.

## Prasyarat

- `/analytics` — `ANALYTICS_ROLES` + bypass. [DARI-KODE-SAJA] `page-access.ts:52`

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/analytics` | `app/(app)/analytics/page.tsx` |
| API | `app/api/crm/analytics` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Executive Business Analytics` | Dashboard analitik | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-analytics.png` |
| 2 | Rentang / refresh | Ringkasan: `01 Nov 2026 - 30 Nov 2026`, `Refresh`; lead-sources: `Bulan Ini`…`Custom` | Filter waktu | [TERVERIFIKASI-BROWSER] `evidence/33-analytics.png`, `34-analytics-lead.png` |
| 3 | `Export Excel` | Tombol | Export | [TERVERIFIKASI-BROWSER] |
| 4 | `Ulasan Strategis` | Tombol/tab | Insight section | [TERVERIFIKASI-BROWSER] |

## Field form

| Field | Bukti |
| --- | --- |
| Pilih periode / metrik `Semua`, `Omzet`, `Laba Kotor` | [TERVERIFIKASI-BROWSER] manifest `buttons` |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| API analytics error | JSON `{ error: "Unauthorized or failed to fetch analytics" }` status 401 | [DARI-KODE-SAJA] `app/api/crm/analytics/route.ts` |

## Efek samping

- —

## Temuan / keanehan

- Banyak sub-heading panjang di manifest (pipeline, konversi, dll.).

## Pertanyaan terbuka

- —
