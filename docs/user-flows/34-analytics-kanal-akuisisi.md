# Analytics kanal akuisisi

## Tujuan

Analisis efektivitas sumber lead / kanal marketing.

## Prasyarat

- `/analytics/lead-sources` — sama dengan analytics (ANALYTICS + bypass).

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/analytics/lead-sources` | `app/(app)/analytics/lead-sources/page.tsx` |
| API | lead-sources analytics |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Analisis Sumber Lead & Efektivitas Kanal` | Charts/tables | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-analytics__lead-sources.png` |
| 2 | Preset waktu | `Bulan Ini`, `30 Hari`, `7 Hari`, `Tahun Ini`, `Semua Data`, `Custom` | Filter | [TERVERIFIKASI-BROWSER] `buttons` |
| 3 | `Export Excel` | Tombol | Export | [TERVERIFIKASI-BROWSER] |

## Field form

| Field | Bukti |
| --- | --- |
| Kontrol periode | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Load gagal | JSON `{ error: "Unauthorized or failed to fetch lead source analytics" }` | [DARI-KODE-SAJA] `app/api/crm/analytics/lead-sources/route.ts` |

## Efek samping

- Memakai master sumber lead.

## Temuan / keanehan

- Subheading `Komparasi Efektivitas Antar Kanal`, `Matriks Kualitas & Klasifikasi Kanal`. [TERVERIFIKASI-BROWSER]

## Pertanyaan terbuka

- —
