# Pembayaran / kwitansi

## Tujuan

Melihat jadwal/status pembayaran di invoice (tab peluang), mencatat/koreksi pembayaran, dan mengunduh kwitansi PDF.

## Prasyarat

- Tidak ada route list khusus; masuk lewat dialog invoice / tab `?tab=invoice` / SO terkait.
- Owner: `owner@mail.com` / `owner123`.

## Route & file kode terkait

| Lokasi | File |
| --- | --- |
| UI invoice | `components/crm/invoice-detail.tsx` |
| Actions | `pay*`, `edit*`, `void*` di `app/actions/crm.ts` |
| Kwitansi | `GET /api/crm/payment-transactions/[id]/kwitansi` |
| Bukti transfer | `.../payment-transactions/[id]/proof` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Dialog invoice tanpa jadwal | `Jadwal pembayaran belum diatur` + instruksi atur DP/Lunas di tab Invoice | Read-only | [TERVERIFIKASI-BROWSER] dialog INV dibatalkan/diganti |
| 2 | Tab invoice peluang (lunas) | `Jenis pembayaran` = `Lunas`; `Jadwal pembayaran` contoh `Pelunasan: Rp 220.000 · tanpa deadline`; teks `Sisa tagihan dibayar penuh pada jatuh tempo.`; ringkas `Rp 220.000 · LUNAS` | Status pelunasan | [TERVERIFIKASI-BROWSER] `evidence/20-invoice-payment-tab.png` |
| 3 | `Lihat Kwitansi` | Link ke `/api/crm/payment-transactions/{id}/kwitansi?preview=1` | PDF | [TERVERIFIKASI-BROWSER] link di tab; fetch status **200**, `content-type: application/pdf`, size ~496KB |
| 4 | Catat pembayaran (form) | Label kode: `Metode pembayaran`, `Tanggal bayar`, `Bukti pembayaran` (+ hint `Wajib untuk QRIS atau Bank.`) | `pay*` action | [DARI-KODE-SAJA] `invoice-detail.tsx` — form record **tidak** disubmit di uji (hindari mutasi) |
| 5 | Koreksi | Summary `Koreksi pembayaran` (edit/void) | edit/void transaction | [DARI-KODE-SAJA] |

## Field form (dari kode UI invoice)

| Field | Wajib? | Bukti |
| --- | --- | --- |
| Metode pembayaran | ya | Label `Metode pembayaran`; opsi contoh di dialog lain: `Tunai`, `Mandiri`, `BNI`, `Transfer` [TERVERIFIKASI-BROWSER] teks opsi; [DARI-KODE-SAJA] NativeSelect |
| Tanggal bayar | tidak/ya tergantung form | `Tanggal bayar` datetime-local [DARI-KODE-SAJA] |
| Bukti pembayaran | kondisional | File picker + hint QRIS/Bank [DARI-KODE-SAJA] |
| Nominal (koreksi) | ya | [DARI-KODE-SAJA] |

## Skenario gagal

| Skenario | Bukti |
| --- | --- |
| Metode tidak aktif | `Metode pembayaran tidak tersedia.` | [DARI-KODE-SAJA] `crm.ts` |
| Tanggal bayar ke depan | `Tanggal pembayaran tidak boleh maju ke masa depan.` / `Tanggal pembayaran tidak valid.` | [DARI-KODE-SAJA] |
| Termin sudah dibayar | `Termin ini sudah dibayar.` / `Pembayaran awal sudah tercatat aktif.` | [DARI-KODE-SAJA] |
| Void/koreksi race | `Pembayaran aktif tidak ditemukan.` / `Pembayaran sudah berubah. Muat ulang halaman.` | [DARI-KODE-SAJA] |
| Nominal invalid | `Nominal harus positif dan total pembayaran tidak boleh melebihi invoice.` | [DARI-KODE-SAJA] |
| Jadwal belum ada | `Jadwal pembayaran belum diatur…` / `Jadwal pembayaran invoice tidak ditemukan.` | [DARI-KODE-SAJA] |

## Efek samping

- Update outstanding invoice/SO; dataset export `mutasi-pembayaran`; kwitansi PDF.

## Temuan / keanehan

- Link `Lihat Kwitansi` muncul di dialog invoice yang sudah punya transaksi, selain di tab peluang. [TERVERIFIKASI-BROWSER] (temuan crawl baris invoice)

## Pertanyaan terbuka

- Submit bayar + void end-to-end dengan data uji terisolasi. [BELUM-TERVERIFIKASI]
