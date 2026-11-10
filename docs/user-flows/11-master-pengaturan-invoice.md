# Master: pengaturan invoice

## Tujuan

Mengatur poin teks **Keterangan** dan **Syarat & Ketentuan** yang dicetak pada PDF invoice.

## Prasyarat

- Role area Owner (`requireOwnerAreaPage`) + bypass Developer/Keuangan via `hasRole`. [DARI-KODE-SAJA]
- Sesi Owner uji: `owner@mail.com` / `owner123`.

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/master-data/invoice-settings` | `app/(app)/master-data/invoice-settings/page.tsx` |
| Editor | `components/invoice-settings-editor.tsx` |
| Action | `saveInvoiceSettingsAction` |

## Alur utama

| No | Aksi | Elemen (teks persis) | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Judul `Pengaturan invoice`; deskripsi `Poin Keterangan dan Syarat & Ketentuan yang dicetak pada PDF invoice. Enter membuat poin baru, Shift+Enter menambah baris dalam poin yang sama, dan teks bisa ditebalkan, dimiringkan, atau digarisbawahi.` | Form dua kolom | [TERVERIFIKASI-BROWSER] `evidence/11-invoice-settings-deep.png` |
| 2 | Edit poin rich text | Toolbar `Tebal`, `Miring`, `Garis bawah`; hint `Enter membuat poin baru. Shift+Enter menambah baris dalam poin yang sama.` | Poin berubah di state client | [TERVERIFIKASI-BROWSER] |
| 3 | Simpan | Tombol `Simpan pengaturan`; pending `Menyimpan pengaturan...`; ringkasan `N poin akan dicetak pada PDF invoice.` | Persist DB | [TERVERIFIKASI-BROWSER] tombol; sukses submit **tidak** dijalankan (hindari ubah data) [DARI-KODE-SAJA] action |

## Field form

| Field | Tipe | Wajib? | Aturan | Bukti |
| --- | --- | --- | --- | --- |
| Kolom `Keterangan` | rich text multi-poin | konten per poin | Judul kartu `Keterangan`; deskripsi `Teks yang dicetak sebagai blok "Keterangan" pada PDF invoice. Enter membuat poin baru.`; counter `N poin` | [TERVERIFIKASI-BROWSER]; [DARI-KODE-SAJA] `invoice-settings-editor.tsx:34-40` |
| Kolom `Syarat & Ketentuan` | rich text multi-poin | konten per poin | Judul `Syarat & Ketentuan`; deskripsi di bawah Keterangan | [TERVERIFIKASI-BROWSER]; [DARI-KODE-SAJA] `tsx:41-47` |
| Payload tersembunyi `points` | JSON | ya saat submit | Client validasi panjang | [DARI-KODE-SAJA] |

Saat uji Owner: **7 poin** Keterangan + **10 poin** Syarat (17 total). [TERVERIFIKASI-BROWSER]

## Skenario gagal

| Skenario | Pesan persis | Bukti |
| --- | --- | --- |
| Poin terlalu pendek | `Setiap poin minimal 2 karakter. Perbaiki atau kosongkan poin tersebut sebelum menyimpan.` | [DARI-KODE-SAJA] `invoice-settings-editor.tsx:75-78` |
| Poin terlalu panjang | `Setiap poin maksimal 1000 karakter.` | [DARI-KODE-SAJA] `:81-84` |
| Terlalu banyak poin | `Maksimal 20 poin per kolom.` | [DARI-KODE-SAJA] `:87-89` |

## Efek samping

- PDF invoice baru memakai poin tersimpan.

## Temuan / keanehan

- Crawl awal tidak mengekstrak `<label>` karena editor bukan input ber-label klasik. [TERVERIFIKASI-BROWSER]

## Pertanyaan terbuka

- — (notice sukses: `Pengaturan invoice berhasil disimpan.`) [DARI-KODE-SAJA] `master-data.ts` flash `notice`
