# Purchase Order

## Tujuan

Melihat daftar PO, membuka detail ringkas, dan mengelola rantai revisi di tab PO peluang (setuju, deposit, desain, PDF, batalkan).

## Prasyarat

- List `/crm/purchase-orders`: `CRM_VIEW` (+ bypass). Aksi tulis: operator CRM. [DARI-KODE-SAJA]
- Owner uji: `owner@mail.com` / `owner123`.

## Route & file kode terkait

| Route / UI | File |
| --- | --- |
| `/crm/purchase-orders` | `app/(app)/crm/purchase-orders/page.tsx` |
| Dialog list | `components/crm/purchase-order-detail.tsx` |
| Tab peluang `?tab=po` | `app/(app)/crm/peluang/[id]/page.tsx` + form PO |
| Actions | `app/actions/crm.ts` |

## Alur utama

| No | Aksi | Elemen (teks persis) | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka list | Heading `Purchase order` (crawl) / tabel sort | Daftar PO | [TERVERIFIKASI-BROWSER] crawl + dialog uji |
| 2 | Klik baris (`role=button`) | Dialog judul `Detail purchase order`; deskripsi `Informasi pesanan customer dan rincian ukuran.` | Ringkas No. PO, Status, Customer, Kategori, Produk, Material, Warna, Deadline, Deposit, matriks `Ukuran dan jumlah` | [TERVERIFIKASI-BROWSER] `evidence/17-po-detail-dialog.png`; contoh `PO-AS-VER091126-1-R3`, Status `Disepakati` |
| 3 | `Lihat PO` | Link ke `/crm/peluang/{id}?tab=po` | Halaman peluang tab PO: `Purchase Order customer`; revisi; `PDF Customer`, `PDF Penjahit`, `Edit PDF Penjahit` | [TERVERIFIKASI-BROWSER] `evidence/po-follow.png` / follow JSON |
| 4 | `Tutup` | Tombol dialog | Tutup tanpa mutasi | [TERVERIFIKASI-BROWSER] |
| 5 | Aksi tulis (setuju/deposit/revisi/batal) | di tab peluang / form | State machine PO | [DARI-KODE-SAJA] — sukses tidak dijalankan |

## Field form

| Field terlihat di dialog | Contoh nilai uji | Bukti |
| --- | --- | --- |
| No. PO | `PO-AS-VER091126-1-R3` | [TERVERIFIKASI-BROWSER] |
| Status | `Disepakati` | [TERVERIFIKASI-BROWSER] |
| Deposit | `Belum Depo` / `Belum dibayar` | [TERVERIFIKASI-BROWSER] |
| Ukuran dan jumlah | tabel S/M + Total | [TERVERIFIKASI-BROWSER] |
| Draft di detail peluang | Status `Draft`; field tampil: Jenis pakaian, Kategori, Pola, Bahan, Warna, Deposit, Metode dekorasi, Deadline, matriks ukuran, roster | [TERVERIFIKASI-BROWSER] peluang Syaza |
| Form revisi PO (`Revisi PO disepakati`) | Label: `Nomor PO`, `Kategori produk*`, `Perusahaan/Instansi*`, `Bahan*`, `Tanggal order`, `Deadline produksi*`, `Deadline upload desain*`, `Deposit`/`Perlu deposit`, `Ukuran sampel`, `Nama produk*`, `Pola*`, `Warna dasar*`, `Warna variasi`, `Metode dekorasi*` (+ Printing/Sablon/Bordir), mode roster `Tanpa roster`/`Ketik manual`/`Impor Excel`, `Catatan desain`, `Catatan lain` | [TERVERIFIKASI-BROWSER] Veronica `evidence/18-invoice-veronica.png` / `continue-gapfill11.json` `veronicaAfter.labels` |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Detail gagal load | `Detail purchase order tidak dapat dimuat.` | [DARI-KODE-SAJA] `purchase-order-detail.tsx:63` |
| Roster ≠ matriks | `Total roster ... harus sama dengan jumlah pada matriks.` | [DARI-KODE-SAJA] `crm.ts` |

## Efek samping

- Revisi PO, PDF, gate desain/deposit, jalur ke invoice.

## Temuan / keanehan

- Trigger detail = seluruh baris tabel (`DocumentDetailTrigger`), bukan tombol “Detail” terpisah. [TERVERIFIKASI-BROWSER] + [DARI-KODE-SAJA]

## Pertanyaan terbuka

- Form **create** PO kosong dari peluang tanpa PO masih [BELUM-TERVERIFIKASI-BROWSER] (semua peluang Negosiasi sampel sudah punya rantai PO). Label form revisi di atas cukup untuk E2E field mapping.
