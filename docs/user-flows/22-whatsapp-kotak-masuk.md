# WhatsApp kotak masuk

## Tujuan

Membaca dan membalas percakapan WA, tautkan ke customer, unggah media.

## Prasyarat

- `/whatsapp` — `WHATSAPP_INBOX_ROLES` / CRM + SALES + bypass. [DARI-KODE-SAJA] `page-access.ts:48`

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/whatsapp` | `app/(app)/whatsapp/page.tsx` |
| Actions/API | `app/actions/whatsapp.ts`, `app/api/**/conversations` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Kotak Masuk WhatsApp` | Inbox split view | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-whatsapp.png` |
| 2 | `Cek pesan` | Tombol | Poll/sync pesan | [TERVERIFIKASI-BROWSER] |
| 3 | `Tandai dibaca` | Tombol | Update status baca | [TERVERIFIKASI-BROWSER] |
| 4 | `Tautkan` / `Tambah customer baru` | Tombol | Link kontak CRM | [TERVERIFIKASI-BROWSER] |
| 5 | Kirim | `Pilih file`, `Kirim` | Outbound message | [TERVERIFIKASI-BROWSER] — sukses tidak diuji |

## Field form

| Field | Label / teks | Bukti |
| --- | --- | --- |
| Cari percakapan | placeholder `Cari nama atau nomor` | [TERVERIFIKASI-BROWSER] |
| Tautkan customer | `Tautkan ke customer`, search `Cari nama, nomor customer, atau WhatsApp` | [TERVERIFIKASI-BROWSER] |
| Pesan | label `Pesan`, input `message-text` | [TERVERIFIKASI-BROWSER] |
| Lampiran | `Lampiran` / `Pilih file`; hint `PDF, JPG, PNG, atau WebP. Maksimal 10 MB.` | [TERVERIFIKASI-BROWSER] `evidence/22-wa-inbox.png` |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Lampiran terlalu besar / tipe salah | `Lampiran maksimal 10 MB.` / `Lampiran harus berupa PDF, JPG, PNG, atau WebP yang valid.` | [DARI-KODE-SAJA] `whatsapp.ts` |
| Pesan kosong | `Isi pesan, pilih template, atau pilih lampiran.` | [DARI-KODE-SAJA] `whatsapp.ts` |

## Efek samping

- Aktivitas CRM tercatat jika ditautkan.

## Temuan / keanehan

- Nav menampilkan `Disconnect` di crawl body (status koneksi).

## Pertanyaan terbuka

- —
