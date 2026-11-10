# Customer (list/detail/CRUD/impor/arsip)

## Tujuan

Kelola basis customer: daftar, detail, tambah/edit, impor Excel, arsip/pulihkan, aksi terkait CRM.

## Prasyarat

- Role `CRM_VIEW_ROLES` (+ bypass DEVELOPER/OWNER/KEUANGAN). [DARI-KODE-SAJA] `page-access.ts:45`
- Alias `/crm/pelanggan` → `/customers`. [DARI-KODE-SAJA] redirect pages
- Master jenis customer / sumber lead sebaiknya sudah ada sebelum create lengkap.

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/customers`, `/customers/[id]` | `app/(app)/customers/**` |
| Actions | `app/actions/crm.ts` (`createCustomerAction`, `updateCustomerAction`, `importCustomersAction`, `archiveCustomerAction`, `restoreCustomerAction`, …) |

## Alur utama

| No | Aksi | Elemen (label/teks persis) | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka `/customers` | Heading `Data customer` | Tabel | [TERVERIFIKASI-BROWSER] `evidence/crawl-owner-customers.png` |
| 2 | Filter | `Semua customer` | Filter | [TERVERIFIKASI-BROWSER] |
| 3 | Ekspor/impor | `Export Excel`, `Import Excel` | Unduh/unggah | [TERVERIFIKASI-BROWSER] tombol; unduh isi [BELUM-TERVERIFIKASI] |
| 4 | `Tambah customer` | Tombol membuka dialog | Form create | [TERVERIFIKASI-BROWSER] `evidence/14-customer-create-dialog.png` |
| 5 | Batal di tengah | Tutup dialog tanpa simpan (Escape) | Tidak menambah data | [TERVERIFIKASI-BROWSER] dialog create dibuka lalu ditutup tanpa submit sukses |
| 6 | `Edit` / `Arsipkan` baris | Tombol berulang per baris | Update / arsip | [TERVERIFIKASI-BROWSER] keberadaan tombol; eksekusi arsip tidak dijalankan (hindari ubah data) |
| 7 | Klik baris / buka `/customers/[id]` | Row `role=link` → detail | Halaman profil: ringkasan order, aktivitas, form edit, `Arsipkan`, `Buat peluang` | [TERVERIFIKASI-BROWSER] `evidence/14-customer-detail.png`, `continue-gapfill4.json` |

## Field form

| Field | Tipe | Wajib? | Aturan validasi | Contoh | Bukti |
| --- | --- | --- | --- | --- | --- |
| Nama customer | text | ya | label `Nama customer* (wajib)` | `PT Contoh` | [TERVERIFIKASI-BROWSER] dialog |
| Perusahaan/Instansi/Komunitas | text | tidak | label persis itu | — | [TERVERIFIKASI-BROWSER] |
| Jenis customer | select | ya | `Jenis customer* (wajib)` | dari master | [TERVERIFIKASI-BROWSER] |
| Sumber lead | select | tidak | `Sumber lead` | — | [TERVERIFIKASI-BROWSER] |
| Sales/PIC | select | tidak | `Sales/PIC` | — | [TERVERIFIKASI-BROWSER] |
| Kota | text | tidak | `Kota` | — | [TERVERIFIKASI-BROWSER] |
| WhatsApp | text | tidak | `WhatsApp` | — | [TERVERIFIKASI-BROWSER] |
| Email | email | tidak | `Email` | — | [TERVERIFIKASI-BROWSER] |
| Instagram | text | tidak | `Instagram` | — | [TERVERIFIKASI-BROWSER] |
| Alamat | textarea | tidak | `Alamat` | — | [TERVERIFIKASI-BROWSER] |
| Catatan umum | textarea | tidak | `Catatan umum` | — | [TERVERIFIKASI-BROWSER] |
| Pagination | — | — | `Baris per halaman` | — | [TERVERIFIKASI-BROWSER] |

Validasi server/zod: `Nama customer minimal 2 karakter.`, `Format email tidak valid.`, `Isi minimal satu kontak: WhatsApp, email, atau Instagram.`, `Kota dan asal wajib diisi.` (prospek). [DARI-KODE-SAJA] `lib/crm/validation.ts`; UI kosong create = HTML5 [TERVERIFIKASI-BROWSER].

## Skenario gagal

| Skenario | Aksi | Pesan error persis | Bukti |
| --- | --- | --- | --- |
| Impor tanpa file | submit impor | `Pilih file Excel customer terlebih dahulu.` | [DARI-KODE-SAJA] `crm.ts` (pesan impor) |
| Master duplikat saat impor | impor | teks berisi `memiliki data duplikat. Rapikan data master sebelum import.` | [DARI-KODE-SAJA] |
| Field wajib kosong di dialog | submit create tanpa isi | HTML5 `:invalid` pada field wajib (locale browser: `Please fill out this field.`) | [TERVERIFIKASI-BROWSER] `evidence/14-customer-create-empty.png`, `continue-gapfill.json` `customerEmpty` |

## Efek samping

- Create/update menulis `Customer` + audit; arsip mengubah status tampilan list.

## Temuan / keanehan

- Dialog create punya `hasDialog: 1` saat `Tambah customer` diklik. [TERVERIFIKASI-BROWSER]

## Pertanyaan terbuka

- — (detail punya `Reminder repeat order`, `Catat aktivitas`, `Buat peluang`, `Simpan perubahan`, `Arsipkan`; tidak ada tombol “Buka WA” eksplisit di `main` contoh Hangry) [TERVERIFIKASI-BROWSER]
