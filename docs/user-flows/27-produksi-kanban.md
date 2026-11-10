# Produksi kanban

## Tujuan

Board produksi: tahap WO, hambatan, assign, catatan, QC, retur.

## Prasyarat

- `/produksi` — `PRODUCTION_VIEW_ROLES`; aksi mutasi `ADMIN_PO` + bypass.

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/produksi`, `/produksi/[id]` | `app/(app)/produksi/**` |
| Actions | `app/actions/production.ts` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka `/produksi` | Heading `Produksi` | Kanban board | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-produksi.png` |
| 2 | `Export Excel` | Tombol | Export dataset `produksi` | [TERVERIFIKASI-BROWSER] |
| 3 | Aksi kartu | `Retur`, `Wajib QC`, `Revisi sampel` | Update tahap/status | [TERVERIFIKASI-BROWSER] — mutasi [DARI-KODE-SAJA] |
| 4 | Buka `/produksi/[id]` | Detail WO | Tahapan, ringkasan SO, catatan, `Buka kembali` | [TERVERIFIKASI-BROWSER] `evidence/27-produksi-wo-detail.png`, `continue-gapfill.json` `produksiWo` |

## Field form

| Field | Bukti |
| --- | --- |
| Filter board | `Cari di Jersey`, `Status` [TERVERIFIKASI-BROWSER] `continue-gapfill.json` `produksi.filters` |
| Kolom kanban | `Test Print`, `Persetujuan Sampel`, `Layout Design`, `Print`, `Cutting`, `QC`, `Selesai`, `Retur` [TERVERIFIKASI-BROWSER] |
| Catatan WO | `Catatan* (wajib)` [TERVERIFIKASI-BROWSER] detail |
| Buka kembali | `Tahap tujuan* (wajib)`, `Alasan* (wajib)`, tombol `Buka kembali Work Order` [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| WO berubah / tidak aktif | `Work Order sudah berubah. Muat ulang halaman.` / `Work Order tidak aktif atau tidak ditemukan.` | [DARI-KODE-SAJA] `production.ts` |
| Role / PIC | `Role Anda tidak dapat memproses tahap ini.` / `Ambil penugasan PIC tahap ini sebelum memperbarui progres.` | [DARI-KODE-SAJA] |
| QC / lewati | `Kartu harus melewati QC terlebih dahulu…` / `Lewati tahap hanya tersedia untuk alur Non-Jersey…` | [DARI-KODE-SAJA] |
| Retur selesai | `Work Order selesai hanya dapat masuk Retur.` / `Alasan retur minimal 3 karakter.` | [DARI-KODE-SAJA] |

## Efek samping

- Dashboard “Menara Kontrol Operasional Produksi”. [TERVERIFIKASI-BROWSER] dashboard headings

## Temuan / keanehan

- —

## Pertanyaan terbuka

- —
