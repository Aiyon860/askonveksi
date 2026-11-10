# Pipeline peluang

## Tujuan

Mengelola peluang di board CRM: stage, aktivitas, PO/invoice entry point, repeat order.

## Prasyarat

- `/crm` → `CRM_VIEW_ROLES` + bypass.

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/crm` | `app/(app)/crm/page.tsx`, `pipeline-board` |
| `/crm/peluang/[id]` | detail peluang |
| Actions | `moveOpportunity*`, PO/invoice dari peluang di `crm.ts` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka `/crm` | Heading `Pipeline CRM`; kolom `Follow Up`, `Negosiasi`, `Deal (SO)`, `Lost`; tombol `Repeat Order` | Kanban/board | [TERVERIFIKASI-BROWSER] `evidence/16-pipeline-board.png`, `continue-gapfill2.json` `stages` |
| 2 | Filter | Label `Cari customer`, `Bulan dibuat`, `Kategori produk` | Filter board | [TERVERIFIKASI-BROWSER] `labels` |
| 3 | `Repeat Order` | Tombol | Alur repeat order | [TERVERIFIKASI-BROWSER] — alur dalam [DARI-KODE-SAJA] |
| 4 | Drag pindah stage | Dialog `Konfirmasi perubahan status`; field `Status tujuan`; bila Lost: `Alasan lost`; tombol `Konfirmasi pindah status` | `moveOpportunityStageAction` | [DARI-KODE-SAJA] `pipeline-board.tsx` — drag live tidak dijalankan |
| 5 | Buka kartu peluang | Link `/crm/peluang/[id]` | Detail: tab PO / Invoice & Deal / Riwayat; aksi PDF & `Tambah PO` | [TERVERIFIKASI-BROWSER] `evidence/16-peluang-detail.png`, `continue-gapfill2.json` `peluang` |

## Field form

| Field | Label | Bukti |
| --- | --- | --- |
| Cari customer | text | [TERVERIFIKASI-BROWSER] |
| Bulan dibuat | filter | [TERVERIFIKASI-BROWSER] |
| Kategori produk | filter | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Deal gagal diselesaikan | `Transaksi Deal belum dapat diselesaikan. Silakan coba lagi.` | [DARI-KODE-SAJA] `crm.ts:632` |
| Transisi tidak diizinkan | `Status {dari} tidak dapat langsung dipindahkan ke {ke}.` | [DARI-KODE-SAJA] `crm.ts` `moveOpportunityStage` |
| Race / versi | `Status sudah berubah. Muat ulang board.` | [DARI-KODE-SAJA] |
| Deal via drag tanpa hak/syarat | Alert UI: `Deal memerlukan Owner atau Admin` / `Belum dapat dipindahkan ke Deal` / `Jadwal pembayaran belum tersedia` | [DARI-KODE-SAJA] `pipeline-board.tsx` |
| Alasan lost kosong | zod `Alasan lost wajib diisi.` | [DARI-KODE-SAJA] `moveOpportunitySchema` |

## Efek samping

- Aktivitas komunikasi, follow-up, force reminder (aksi tersembunyi index).

## Temuan / keanehan

- —

## Pertanyaan terbuka

- — (kolom UI: `Follow Up`, `Negosiasi`, `Deal (SO)`, `Lost`; filter juga menyebut `Repeat Order`)
