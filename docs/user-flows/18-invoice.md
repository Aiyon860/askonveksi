# Invoice

## Tujuan

Melihat daftar invoice, detail ringkas (nilai, jadwal, status), membuka tab Invoice di peluang, unduh PDF preview.

## Prasyarat

- `/crm/invoices` — CRM view/operator + bypass. [DARI-KODE-SAJA]
- Owner: `owner@mail.com` / `owner123`.

## Route & file kode terkait

| Route / UI | File |
| --- | --- |
| `/crm/invoices` | `app/(app)/crm/invoices/page.tsx` |
| Dialog | komponen invoice detail (list trigger) |
| Tab `?tab=invoice` | peluang page + `components/crm/invoice-detail.tsx` |
| PDF | `/api/crm/invoice/[id]/pdf` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka list | Heading `Invoice`; `Export Excel`, `Filter` | Tabel | [TERVERIFIKASI-BROWSER] |
| 2 | Klik baris | Dialog `Detail invoice`; deskripsi `Nilai tagihan, jadwal pembayaran, dan status pelunasan.` | No. Invoice, No. PO, Status, tabel produk/Add On, Subtotal/Diskon/Deposit/Total, catatan | [TERVERIFIKASI-BROWSER] `evidence/18-invoice-detail-dialog.png` |
| 3 | Lihat jadwal | Teks `Jadwal pembayaran belum diatur` + hint `Atur jadwal pembayaran (DP/Lunas) dari tab Invoice sebelum invoice diterbitkan; tgl. jatuh tempo dan deadline diisi manual pada form draft.` | Info read-only di dialog | [TERVERIFIKASI-BROWSER] |
| 4 | `Kelola Invoice` | Link `/crm/peluang/{id}?tab=invoice` | Rantai revisi invoice di peluang | [TERVERIFIKASI-BROWSER] |
| 5 | Preview PDF | Link kosong-teks ke `/api/crm/invoice/.../pdf?preview=1` | PDF | [TERVERIFIKASI-BROWSER] href di dialog |
| 6 | Issue/revisi/batal | actions crm | Mutasi status | [DARI-KODE-SAJA] — tidak dijalankan |

## Field form

| Area | Label / teks | Bukti |
| --- | --- | --- |
| Dialog ringkas | No. Invoice, No. PO, Status, Customer, Tanggal dibuat, grid produk | [TERVERIFIKASI-BROWSER] |
| Tab peluang | `Invoice konveksi`; `Informasi invoice`; `Jenis pembayaran`; `Jadwal pembayaran`; `Tgl. jatuh tempo` | [TERVERIFIKASI-BROWSER] follow tab |
| Draft create | Tab `Invoice & Deal` / `Belum ada` pada PO masih Draft | Form issue belum bisa dibuka tanpa sepakati PO (mutasi) | [TERVERIFIKASI-BROWSER] Syaza `?tab=invoice` — CTA create tidak muncul; label create tetap [DARI-KODE-SAJA] `invoice-form.tsx` |

## Skenario gagal

| Skenario | Bukti |
| --- | --- |
| Validasi item invoice ≠ PO | [DARI-KODE-SAJA] `crm.ts` pesan item |

## Efek samping

- Deal/SO setelah pembayaran; WhatsApp invoice (aksi terpisah).

## Temuan / keanehan

- Status contoh: `Dibatalkan`, `Digantikan`, serta invoice lunas di tab lain menampilkan `Lihat Kwitansi`. [TERVERIFIKASI-BROWSER]

## Pertanyaan terbuka

- Form **issue** invoice baru: sampel lokal tidak punya PO `Disepakati` + `Invoice Belum ada` tanpa mutasi. Tab Veronica menampilkan invoice terbit/dibatalkan + aksi `Kirim ulang` / `Batalkan invoice terbit` / `Salin pesan invoice` [TERVERIFIKASI-BROWSER] `evidence/18-invoice-veronica.png`.
