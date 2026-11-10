# Desain revisi (CRM)

## Tujuan

Mengunggah / mengubah file desain per produk pada PO draft di tab peluang, sebagai versi terpisah (maks. 4) yang menjadi acuan produksi.

## Prasyarat

- Role uploader: `DESIGN_UPLOADER_ROLES` (Admin Customer / Admin PO) + bypass Owner/Developer/Keuangan. [DARI-KODE-SAJA] `design.ts:78`, `permissions.ts`
- PO berstatus **Draft** (bukan Disepakati). [DARI-KODE-SAJA] `design.ts:102`
- Jika checkbox deposit aktif: deposit harus lunas kecuali gate override. [DARI-KODE-SAJA] `design.ts:44-46`
- Data uji: peluang Syaza `…/crm/peluang/cmw94ed6q0002j4z7ybrvjxhw?tab=po`, PO draft `PO-AS-SYA091126-1-R4` (tanpa deposit, sudah 1/4 versi). [TERVERIFIKASI-BROWSER]

## Route & file kode terkait

| Lokasi | File |
| --- | --- |
| Tab PO peluang | `app/(app)/crm/peluang/[id]/page.tsx` |
| UI aksi | `components/crm/purchase-order-agreement-action.tsx` |
| Action | `uploadDesignRevisionAction` — `app/actions/design.ts` |

## Alur utama

| No | Aksi | Elemen (teks persis) | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka peluang `?tab=po` (PO draft) | Status `Draft`; aksi `Ubah Design` / `Upload Desain`; `Kirim 1 set PDF`; `Sepakati PO terbaru` | Toolbar desain | [TERVERIFIKASI-BROWSER] `evidence/29-peluang-po-tab.png` |
| 2 | Baca status desain | `Desain tersimpan dan dipakai ulang. Gunakan Ubah Design hanya bila ingin mengganti gambar.` | Info | [TERVERIFIKASI-BROWSER] |
| 3 | Klik `Ubah Design` | Dialog judul `Ubah desain`; deskripsi `Desain lama tetap dipakai bila tidak ada file baru. Unggah file hanya untuk produk yang ingin diganti; versi baru disimpan terpisah.` | Form unggah | [TERVERIFIKASI-BROWSER] `evidence/29-design-upload-dialog.png` |
| 4 | (PO belum punya desain) | Tombol `Upload Desain`; judul dialog `Unggah desain`; deskripsi single/multi produk | Form sama | [DARI-KODE-SAJA] `purchase-order-agreement-action.tsx:73-103` — **tidak ada PO draft tanpa revisi / multi-item di DB lokal** saat audit (hanya 1 draft: sudah 1/4 versi, 1 item), jadi dialog first-upload tidak difoto [BELUM-TERVERIFIKASI-BROWSER] |
| 4b | Admin Customer buka PO draft yang sama | Tombol `Ubah Design` tampak | Role uploader UI | [TERVERIFIKASI-BROWSER] `evidence/29-michelle-po-design-btn.png` (`michelle@mail.com`) |
| 5 | `Batal` / `Tutup` | Tombol | Tutup tanpa unggah | [TERVERIFIKASI-BROWSER] |
| 6 | `Unggah desain` dengan file valid | Submit form | Simpan revisi + storage + audit; redirect default list PO | [DARI-KODE-SAJA] — **sukses tidak dijalankan** |
| 7 | `Kirim 1 set PDF` | Confirm `Kirim 1 set PDF ke customer?` | Tandai PDF terkirim | [DARI-KODE-SAJA] UI tombol [TERVERIFIKASI-BROWSER]; confirm/submit tidak dijalankan |

## Field form

| Field | Tipe | Wajib? | Aturan | Bukti |
| --- | --- | --- | --- | --- |
| `designTaskId` | hidden | ya | UUID task | [TERVERIFIKASI-BROWSER] name di dialog; [DARI-KODE-SAJA] |
| Legend produk | — | — | Satu produk: `Desain`; multi: nama item | [TERVERIFIKASI-BROWSER] `Desain` |
| File desain | file multi | ya (1 produk) | Label `File desain* (wajib)`; `accept` `.png,.jpg,.jpeg`; hint `PNG atau JPG, maksimal 5 file dan 5 MB per file. Versi tersimpan 1/4.`; tombol `Pilih file` / `Belum ada file` | [TERVERIFIKASI-BROWSER] |
| Catatan revisi | textarea | tidak | Label `Catatan revisi`; placeholder `Contoh: Perubahan warna logo depan.`; max 4000 | [TERVERIFIKASI-BROWSER] + [DARI-KODE-SAJA] |

## Skenario gagal

| Skenario | Aksi | Pesan / hasil | Bukti |
| --- | --- | --- | --- |
| File kosong (1 produk) | Submit tanpa file | HTML5 `Please fill out this field.` pada input file | [TERVERIFIKASI-BROWSER] `evidence/29-design-upload-empty.png` |
| Tidak ada file (server) | — | `Pilih minimal satu file desain.` | [DARI-KODE-SAJA] `design.ts:119` |
| Task id invalid | — | `Tugas desain tidak valid.` | [DARI-KODE-SAJA] `:80` |
| Task hilang | — | `Tugas desain tidak ditemukan.` | [DARI-KODE-SAJA] `:101` |
| PO sudah disepakati | — | `Desain PO yang sudah disepakati tidak dapat diubah.` | [DARI-KODE-SAJA] `:102` |
| Deposit belum bayar | — | `Deposit desain belum dibayar. Isi Deposit pada tab PO terlebih dahulu.` | [DARI-KODE-SAJA] `:46` |
| File > 5 MB | — | `Setiap file desain maksimal 5 MB (...).` | [DARI-KODE-SAJA] `:56` |
| Bukan PNG/JPG | — | `designImageRejection(...)` | [DARI-KODE-SAJA] `:60` |
| >5 file / produk | — | `Maksimal lima file setiap versi desain {nama}.` | [DARI-KODE-SAJA] `:115` |
| Versi ke-5 | — | `Batas 4 versi desain {nama} sudah tercapai.` | [DARI-KODE-SAJA] `:116`; limit `DESIGN_REVISION_LIMIT=4` |
| Tombol disabled | deposit menunggu | title/tooltip `Menunggu deposit dibayar. Klik Isi Deposit.` | [DARI-KODE-SAJA] `:77-78` |
| Bukan role uploader | — | title `Hanya Admin Customer atau Admin PO yang dapat mengunggah.` | [DARI-KODE-SAJA] `:75` (Owner tetap lolos `hasRole`) |

## Efek samping

- File di storage bucket desain PO; baris `DesignRevision` + audit `DESIGN_REVISION_UPLOADED`.
- Membuka gate `Kirim 1 set PDF` / sepakati (setelah desain lengkap).

## Temuan / keanehan

1. Label tombol memakai campuran bahasa: **`Ubah Design`** (Design Inggris) vs judul dialog **`Ubah desain`**. [TERVERIFIKASI-BROWSER]
2. Kode komentar menyebut “Ubah Design”; `title` atribut tombol memakai “Ubah desain”. [DARI-KODE-SAJA] `purchase-order-agreement-action.tsx:72-90`

## Pertanyaan terbuka

- Perlu data uji PO draft baru (0 revisi, ≥2 produk) untuk memfoto dialog `Unggah desain` multi-field — sengaja tidak dibuat agar tidak menambah data. [BELUM-TERVERIFIKASI-BROWSER]
