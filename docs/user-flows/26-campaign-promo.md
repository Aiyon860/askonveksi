# Campaign promo

## Tujuan

Menjadwalkan kampanye promo WA ke subset customer dengan media.

## Prasyarat

- `/campaigns` — `CRM_ROLES` + bypass. [DARI-KODE-SAJA] `page-access.ts:49`

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/campaigns` | `app/(app)/campaigns/page.tsx` |
| Actions | `app/actions/campaigns.ts` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Campaign promo` | Daftar campaign | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-campaigns.png` |
| 2 | `Filter` | Tombol | Filter | [TERVERIFIKASI-BROWSER] |
| 3 | `Pilih Customer` / `Hapus` | Tombol penerima | Kelola audiens | [TERVERIFIKASI-BROWSER] |
| 4 | `Pilih gambar` | Tombol | Media | [TERVERIFIKASI-BROWSER] |
| 5 | `Jadwalkan campaign` | Tombol | Schedule send | [TERVERIFIKASI-BROWSER] — sukses tidak diuji |

## Field form (`Campaign baru`)

| Field | Label | Bukti |
| --- | --- | --- |
| Nama | `Nama campaign` | [TERVERIFIKASI-BROWSER] `evidence/26-campaign-form.png` |
| Jadwal | `Mulai kirim (WIB)` | [TERVERIFIKASI-BROWSER] |
| Pesan | `Pesan WhatsApp` + hint variabel `{{customer_name}}`, `{{company_name}}`, `{{business_name}}` | [TERVERIFIKASI-BROWSER] |
| Gambar | `Gambar pamflet/poster (opsional)` / `Pilih gambar` / `Max 10 MB.` | [TERVERIFIKASI-BROWSER] |
| Submit | `Jadwalkan campaign` | [TERVERIFIKASI-BROWSER] |
| Penerima (baris existing) | `Pilih Customer` | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Jadwal lampau | `Jadwal campaign harus di masa depan.` | [DARI-KODE-SAJA] `campaigns.ts` |
| Sudah mulai kirim | `Campaign sudah mulai dikirim sehingga gambar tidak dapat diubah.` / `Penerima hanya bisa diubah sebelum campaign mulai dikirim.` | [DARI-KODE-SAJA] |
| Race / tidak ditemukan | `Campaign sudah berubah. Muat ulang halaman.` / `Campaign tidak ditemukan.` | [DARI-KODE-SAJA] |
| Sukses | `Campaign dijadwalkan.` / `Campaign diperbarui.` / `Campaign dihapus.` | [DARI-KODE-SAJA] |

## Efek samping

- Jobs WA (fitur 23).

## Temuan / keanehan

- —

## Pertanyaan terbuka

- —
