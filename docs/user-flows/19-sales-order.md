# Sales Order

## Tujuan

Melihat daftar SO, dialog snapshot, halaman detail `/sales-orders/[id]` (immutable), termasuk aksi batalkan deal.

## Prasyarat

- List CRM SO + bypass. [DARI-KODE-SAJA]
- Owner: `owner@mail.com` / `owner123`.

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/crm/sales-orders` | `app/(app)/crm/sales-orders/page.tsx` |
| `/sales-orders/[id]` | `app/(app)/sales-orders/[id]/page.tsx` |
| Actions | `reverseSalesOrderAction` / cancel di `crm.ts` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka list | Heading `Sales Order`; `Export Excel`, `Filter` | Tabel | [TERVERIFIKASI-BROWSER] |
| 2 | Klik baris | Dialog `Detail Sales Order`; deskripsi `Snapshot pesanan yang sudah disepakati.` | No. SO/PO/Invoice, Status, Customer, Tanggal diterima, tabel produk, Total | [TERVERIFIKASI-BROWSER] `evidence/19-so-detail-dialog.png`; contoh `SO-AS-2026-00240`, Status `Aktif` |
| 3 | `Lihat SO` | Link `/sales-orders/{id}` | Halaman detail: `Item Sales Order` (`Snapshot immutable dari INV-...`); `Work Order produksi`; `Snapshot customer`; `Jejak transaksi` | [TERVERIFIKASI-BROWSER] follow |
| 4 | Batalkan Deal (form) | Section `Batalkan Deal`; teks `Sales Order dibatalkan dan peluang dipindahkan ke Lost. Riwayat transaksi tetap tersimpan.`; field `Alasan pembatalan* (wajib)`; tombol `Batalkan Deal dan kembalikan peluang` | Mutasi cancel | [TERVERIFIKASI-BROWSER] UI form; submit sukses **tidak** dijalankan |
| 5 | `Tutup` dialog | Tombol | Tutup | [TERVERIFIKASI-BROWSER] |

## Field form

| Field | Wajib? | Bukti |
| --- | --- | --- |
| Alasan pembatalan | ya | Label `Alasan pembatalan* (wajib)` [TERVERIFIKASI-BROWSER] |
| Hint audit | — | `Aksi ini dicatat dalam audit log dan tidak menghapus transaksi.` [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Bukti |
| --- | --- |
| Alasan kosong | HTML5 pada `cancelReason`: `Please fill out this field.` (locale browser); tetap di halaman SO | [TERVERIFIKASI-BROWSER] `evidence/19-so-cancel-empty.png`, `continue-gapfill.json` `soCancelEmpty` |
| Reverse/cancel tanpa hak | [DARI-KODE-SAJA] role gates di `crm.ts` |

## Efek samping

- Cancel memindahkan peluang ke Lost; WO/riwayat tetap.

## Temuan / keanehan

- Teks jejak: `Sales Order final tidak dapat diedit.` [TERVERIFIKASI-BROWSER]

## Pertanyaan terbuka

- Kontrol pembayaran di halaman SO vs hanya di tab invoice. Pada SO contoh aktif, kontrol bayar tidak muncul di `main` (pembayaran terlihat di invoice). [TERVERIFIKASI-BROWSER]
