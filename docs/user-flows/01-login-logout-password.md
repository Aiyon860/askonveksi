# Login / logout / ganti password

## Tujuan

Masuk ke ruang kerja dengan email+password Supabase, keluar sesi, dan memperbarui password akun.

## Prasyarat

- App berjalan di `http://localhost:3000` (`npm run dev`).
- Profil `AppUser` aktif terhubung ke Auth (`authUserId`).
- Password uji lokal mengikuti `{local-part}123` (lihat tabel akun di `00-index.md`). Owner + enam role lain diverifikasi login UI; `devf@example.com` diverifikasi API.

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/login` | `app/login/page.tsx` |
| `/account/password` | `app/account/password/page.tsx` |
| actions | `app/actions/auth.ts` |
| validasi | `lib/crm/validation.ts` (`loginSchema`, `updatePasswordSchema`) |
| landing per role | `lib/auth/landing-path.ts` |

## Alur utama

| No | Aksi user | Elemen (label/teks persis) | Hasil yang terjadi | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka `/login` | Judul kartu `Masuk ke ruang kerja`; deskripsi `Kelola pipeline, customer, penawaran, dan Sales Order dari satu tempat.`; tombol `Masuk`; footer `© 2026 ASKONVEKSI` | Form login tampil | [TERVERIFIKASI-BROWSER] `evidence/01-login-form.png` |
| 2 | Isi Email + Password valid → `Masuk` | Label `Email* (wajib)`, `Password* (wajib)` | Redirect landing per role: Owner/Keuangan/Admin Customer/Developer → `/dashboard`; Admin PO → `/produksi`; Designer/Admin Saga → `/absensi` | [TERVERIFIKASI-BROWSER] `evidence/01-login-owner-success.png`, `01-login-admin-customer.png`, `01-login-admin-po.png`, `01-login-keuangan.png`, `01-login-designer.png`, `01-login-admin-saga.png`, `01-login-developer.png`; [DARI-KODE-SAJA] `landing-path.ts:14-18` |
| 3 | Sudah login lalu buka `/login` | — | Redirect ke landing role | [DARI-KODE-SAJA] `app/login/page.tsx:16-17` |
| 4 | Buka `/account/password` saat sesi aktif | Judul `Amankan akun Anda`; deskripsi `Perbarui password akun bila diperlukan.`; tombol `Simpan password` | Form ganti password | [TERVERIFIKASI-BROWSER] `evidence/crawl-owner-account__password.png` |
| 5 | Isi password baru + konfirmasi → `Simpan password` | Label `Password baru* (wajib)`, `Ulangi password baru* (wajib)`; deskripsi `Password dapat memakai karakter apa pun.`; pending `Memperbarui...` | Update Auth password + audit `PASSWORD_CHANGED` + flash notice lalu landing | [DARI-KODE-SAJA] `auth.ts:63-88` — **tidak dijalankan sukses** (mengubah password akun nyata) |
| 6 | Logout | Tombol `Keluar` di chrome app | Redirect ke `/login`; judul `Masuk ke ruang kerja` | [TERVERIFIKASI-BROWSER] `evidence/01-logout-result.png`, `continue-gapfill.json` `logout` |

## Field form

### Login

| Field | Tipe | Wajib? | Aturan validasi | Contoh nilai valid | Bukti |
| --- | --- | --- | --- | --- | --- |
| Email | email | ya (HTML `required` + zod) | `z.email("Email tidak valid.").trim().max(320)` | `owner@mail.com` | [TERVERIFIKASI-BROWSER] label; [DARI-KODE-SAJA] `validation.ts:524-527`, `login/page.tsx:33-34` |
| Password | password | ya | `z.string().min(1).max(128)` | `owner123`, `michelle123`, `nina123`, … | [TERVERIFIKASI-BROWSER] |

### Ganti password

| Field | Tipe | Wajib? | Aturan validasi | Contoh nilai valid | Bukti |
| --- | --- | --- | --- | --- | --- |
| Password baru | password | ya | min 1, max 128; “karakter apa pun” | `apa-saja` | [DARI-KODE-SAJA] `validation.ts:529-542`, `account/password/page.tsx:27-29` |
| Ulangi password baru | password | ya | harus sama; pesan `Konfirmasi password tidak sama.` | sama dengan di atas | [DARI-KODE-SAJA] |

## Skenario gagal

| Skenario | Aksi | Pesan error persis | Bukti |
| --- | --- | --- | --- |
| Field kosong | Klik `Masuk` tanpa isi | HTML5 browser: `Please fill out this field.` pada Email (locale browser en) | [TERVERIFIKASI-BROWSER] `evidence/01-login-empty-html5.png` |
| Password salah | Email `owner@mail.com` + password sembarang → `Masuk` | Judul flash `Periksa kembali`; isi `Email atau password tidak cocok.` | [TERVERIFIKASI-BROWSER] `evidence/01-login-wrong-password.png`; [DARI-KODE-SAJA] `auth.ts:31-32` |
| Email tidak valid (server) | Kirim email ilegal melewati HTML5 | `Email tidak valid.` | [DARI-KODE-SAJA] `loginSchema` |
| Akun nonaktif / tanpa profil | Login Auth OK tapi `AppUser` tidak aktif | `Akun tidak aktif atau belum terdaftar di aplikasi.` | [DARI-KODE-SAJA] `auth.ts:40-42` |
| Konfirmasi password beda | Password `abc` + konfirmasi `xyz` → `Simpan password` | Flash judul `Periksa kembali`; isi `Konfirmasi password tidak sama.` | [TERVERIFIKASI-BROWSER] `evidence/01-password-mismatch.png`; [DARI-KODE-SAJA] `updatePasswordSchema` |
| Update Auth gagal | — | `Password belum dapat diperbarui. Silakan coba lagi.` | [DARI-KODE-SAJA] `auth.ts:75` |

## Efek samping

- Cookie brand diset saat login (`BRAND_COOKIE`) sesuai role switcher / brand asal (`auth.ts:45-51`).
- Ganti password menulis `AuditEvent` `PASSWORD_CHANGED`.
- Logout membersihkan sesi lokal Supabase.

## Temuan / keanehan

1. Label di DOM tampil sebagai `Email* (wajib)` / `Password* (wajib)` (komponen FieldLabel menambahkan teks wajib). [TERVERIFIKASI-BROWSER]
2. Pesan validasi kosong mengikuti bahasa browser (`Please fill out this field.`), bukan copy Indonesia app. [TERVERIFIKASI-BROWSER]
3. `BOOTSTRAP_OWNER_EMAIL` / `BOOTSTRAP_OWNER_PASSWORD` di `.env` **tidak** berhasil `signInWithPassword` ke Auth lokal. [TERVERIFIKASI-BROWSER via API client]
4. Magic link `action_link` Supabase tidak menyelesaikan sesi browser ke app (kembali ke `/login`); token `hashed_token` + `verifyOtp` + cookie SSR berhasil (dipakai sebelum password Owner diketahui). [TERVERIFIKASI-BROWSER]
5. User menyatakan Owner dapat mengakses semua fitur; selaras dengan `hasRole` yang selalu meloloskan `OWNER`. [DARI-KODE-SAJA] `permissions.ts:63-65`; cakupan menu Owner [TERVERIFIKASI-BROWSER] crawl sebelumnya

## Pertanyaan terbuka

- Apakah password produksi/staging memakai pola yang sama? [BELUM-TERVERIFIKASI]
