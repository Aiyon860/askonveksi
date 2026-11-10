# Template pesan WA

## Tujuan

CRUD template pesan WhatsApp untuk kampanye/inbox.

## Prasyarat

- `/master-data/whatsapp/templates` — `CRM_ROLES` + bypass. [DARI-KODE-SAJA] `page-access.ts:57`

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/master-data/whatsapp/templates` | `app/(app)/master-data/whatsapp/templates/page.tsx` |
| Actions | save/delete/toggle di `whatsapp.ts` atau master |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Template Pesan WhatsApp` | Daftar template | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-master-data__whatsapp__templates.png` |
| 2 | `Filter` | Tombol | Filter | [TERVERIFIKASI-BROWSER] |
| 3 | `Tambah template` | Dialog `Tambah template` | Form template | [TERVERIFIKASI-BROWSER] `evidence/24-template-create.png` — submit tidak dijalankan |

## Field form

| Field | Label | Wajib? | Bukti |
| --- | --- | --- | --- |
| Nama | `Nama* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Pemicu | `Pemicu* (wajib)` | ya | opsi: Chat manual, Tindak lanjut peluang, Reminder repeat order, Invoice diterbitkan, Pengingat pembayaran [TERVERIFIKASI-BROWSER] |
| Isi pesan | `Isi pesan* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Aktif | `Aktif` | tidak | [TERVERIFIKASI-BROWSER] |
| Aksi | `Simpan template` / `Tutup` | — | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Field kosong | HTML5 `:invalid` | [TERVERIFIKASI-BROWSER] |
| Template invalid / bentrok versi | `Template tidak valid.` / `Template sudah berubah. Muat ulang lalu coba lagi.` | [DARI-KODE-SAJA] `whatsapp.ts` |

## Efek samping

- Dipakai broadcast & automation.

## Temuan / keanehan

- —

## Pertanyaan terbuka

- —
