# Admin pengguna

## Tujuan

Mengelola akun aplikasi: buat user, edit role/brand, nonaktifkan, reset data uji (berbahaya).

## Prasyarat

- `USER_ADMIN_ROLES`; praktis Developer + bypass Owner/Keuangan. [DARI-KODE-SAJA] `page-access.ts:54`

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/admin/users` | `app/(app)/admin/users/page.tsx` |
| Actions | `app/actions/users.ts` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Pengguna aplikasi` | Daftar user | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-admin__users.png` |
| 2 | Filter / pagination | `Filter`, `Baris per halaman` | Slice tabel | [TERVERIFIKASI-BROWSER] |
| 3 | `Nonaktifkan` | Confirm `Nonaktifkan pengguna?` / `Ya, nonaktifkan` / `Kembali` | Toggle aktif | [TERVERIFIKASI-BROWSER] `evidence/13-deactivate-confirm.png` — submit tidak dijalankan |
| 4 | `Tambah pengguna` / `Buat pengguna` | Form samping; confirm create `Buat pengguna baru?` | Create Auth + AppUser | [TERVERIFIKASI-BROWSER] form labels; confirm title [DARI-KODE-SAJA] `admin/users/page.tsx` — sukses tidak diuji |
| 5 | `Reset data uji` (Developer saja) | Kartu + field `Konfirmasi*`; confirm `Reset semua data uji?` / `Ya, reset data` | Hapus data operasional | [TERVERIFIKASI-BROWSER] `evidence/13-reset-confirm.png` (devd); deskripsi [DARI-KODE-SAJA] — **tidak dieksekusi** |

## Field form

| Field | Label | Wajib? | Bukti |
| --- | --- | --- | --- |
| Nama | `Nama* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Email | `Email* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Role | `Role* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Brand | `Brand* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Password awal | `Password awal* (wajib)` | ya (create) | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Validasi create/update | zod: `Email tidak valid.`, `Password wajib diisi.`, `Nama minimal 2 karakter.`, `Konfirmasi password tidak sama.` | [DARI-KODE-SAJA] `createUserSchema` / `updateUserSchema` |
| Email Auth bentrok | `Akun Auth tidak dapat dibuat. Pastikan email belum terdaftar.` / `…email belum digunakan…` | [DARI-KODE-SAJA] `users.ts` |
| Email AppUser duplikat | `Email sudah digunakan pengguna lain.` | [DARI-KODE-SAJA] |
| Nonaktifkan diri / Owner terakhir | `Anda tidak dapat menonaktifkan akun sendiri.` / `Minimal satu Owner harus tetap aktif.` | [DARI-KODE-SAJA] |
| Reset tanpa teks exact | `Ketik RESET DATA UJI untuk melanjutkan.` | [DARI-KODE-SAJA] |
| Sukses | `Pengguna berhasil dibuat.` / `Pengguna dinonaktifkan.` / `Data uji telah direset…` | [DARI-KODE-SAJA] |

## Efek samping

- `resetTestingDataAction` dapat menghapus data besar — hanya Developer.

## Temuan / keanehan

- Owner crawl dapat membuka `/admin/users` (bypass `hasRole`).

## Pertanyaan terbuka

- —
