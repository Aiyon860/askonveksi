# Akun & koneksi WA

## Tujuan

Menambah akun WA Business, pairing QR, aktifkan/nonaktifkan, logout, hapus.

## Prasyarat

- `/master-data/whatsapp/accounts` — CRM roles + bypass.

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/master-data/whatsapp/accounts` | `app/(app)/master-data/whatsapp/accounts/page.tsx` |
| Actions | `app/actions/whatsapp.ts` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Akun & Koneksi WhatsApp` | Daftar akun | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-master-data__whatsapp__accounts.png` |
| 2 | `Tambah` | Tombol | Form akun | [TERVERIFIKASI-BROWSER] |
| 3 | `Pairing` | Tombol | QR / pairing flow | [TERVERIFIKASI-BROWSER] — sukses [DARI-KODE-SAJA] |
| 4 | `Jadikan aktif` / `Logout` / `Hapus` | Tombol | Status koneksi | [TERVERIFIKASI-BROWSER] |

## Field form

| Field | Label | Bukti |
| --- | --- | --- |
| Label | `Label` | [TERVERIFIKASI-BROWSER] |
| Nomor | `Nomor` | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Pairing / akun tidak ditemukan | `Account WhatsApp tidak ditemukan.` dll. | [DARI-KODE-SAJA] `whatsapp.ts` |

## Efek samping

- Akun aktif memengaruhi inbox broadcast.

## Temuan / keanehan

- Contoh akun `Test` / `6285943467111`: badge `LOGGED_OUT`, teks error `Intentional Logout`; aksi `Pairing`, `Jadikan aktif`, `Logout`, `Hapus`; hint `Kode pairing berlaku 60 detik…`. [TERVERIFIKASI-BROWSER] `evidence/25-wa-accounts.png`

## Pertanyaan terbuka

- —
