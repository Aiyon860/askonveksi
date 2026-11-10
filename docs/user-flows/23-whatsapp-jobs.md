# WhatsApp jobs

## Tujuan

Monitor antrian pengiriman WA; batalkan/retry job gagal.

## Prasyarat

- `/whatsapp/jobs` — `CRM_ROLES` + bypass. [DARI-KODE-SAJA] `page-access.ts:47`

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/whatsapp/jobs` | `app/(app)/whatsapp/jobs/page.tsx` |
| Actions | `app/actions/whatsapp.ts` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Status Pengiriman WhatsApp` | Tabel jobs | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-whatsapp__jobs.png` |
| 2 | `Filter` | Tombol | Filter status | [TERVERIFIKASI-BROWSER] |
| 3 | `Batalkan` | Banyak instance | Cancel job | [TERVERIFIKASI-BROWSER] — sukses [DARI-KODE-SAJA] |

## Field form

| Field | Bukti |
| --- | --- |
| Filter status | Chip/opsi `Semua status`, `Menunggu`, `Sedang diproses`, `Terkirim`, `Akan dicoba lagi`, `Gagal`, `Dibatalkan` + tombol `Filter` [TERVERIFIKASI-BROWSER] `evidence/23-wa-jobs.png` |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Cancel job tidak valid | `Job tidak dapat dibatalkan.` | [DARI-KODE-SAJA] `whatsapp.ts` |
| Retry tidak valid | `Job tidak dapat diulang.` | [DARI-KODE-SAJA] `whatsapp.ts` |

## Efek samping

- Status job mempengaruhi broadcast/campaign.

## Temuan / keanehan

- Manifest menampilkan banyak tombol `Batalkan` (satu per baris).

## Pertanyaan terbuka

- — (aksi baris yang terlihat di sampel = `Batalkan`; retry ada di action untuk status `FAILED`/`CANCELLED` [DARI-KODE-SAJA], tidak muncul di baris `Menunggu`/`Akan dicoba lagi` saat audit)
