# Broadcast follow-up

## Tujuan

Kirim broadcast WhatsApp follow-up terjadwal dengan filter customer dan template variabel.

## Prasyarat

- `/crm/follow-up` — `CRM_OPERATOR_ROLES` + bypass.

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/crm/follow-up` | `app/(app)/crm/follow-up/page.tsx` |
| Settings pola | redirect `/crm/follow-up/settings` → `/settings` |
| Actions | `app/actions/broadcast.ts` |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Broadcast` | UI broadcast | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-crm__follow-up.png` |
| 2 | Filter | `Tanggal dari`, `Tanggal ke`, `Kategori Customer`, `Kategori Order`, `Baris per halaman` | Filter penerima | [TERVERIFIKASI-BROWSER] `labels` |
| 3 | Susun pesan | `Pesan`; placeholder variabel `{{customer_name}}`, dll. | Template WA | [TERVERIFIKASI-BROWSER] `buttons` |
| 4 | `Import Tanggal Excel` | Tombol | Import jadwal | [TERVERIFIKASI-BROWSER] |
| 5 | Lampiran | `Pilih gambar`; label `Gambar pamflet/poster (opsional)` | Media opsional | [TERVERIFIKASI-BROWSER] |
| 6 | `Kirim Pesan` | Tombol | Enqueue WA jobs | [TERVERIFIKASI-BROWSER] — sukses tidak diuji |

## Field form

| Field | Label | Wajib? | Bukti |
| --- | --- | --- | --- |
| Pesan | `Pesan` | ya | [TERVERIFIKASI-BROWSER] |
| Gambar | opsional | tidak | [TERVERIFIKASI-BROWSER] |
| Filter tanggal/kategori | lihat atas | tidak | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Tanpa customer terpilih + `Kirim Pesan` | Dialog/flash `Periksa kembali` + `Pilih minimal satu customer sebelum menekan Follow Up Hari Ini.` | [TERVERIFIKASI-BROWSER] `evidence/21-follow-up-kirim.png`, `continue-gapfill9.json` `follow` |

## Efek samping

- Jobs di `/whatsapp/jobs`.

## Temuan / keanehan

- Tombol variabel template sebagai button chips di manifest.

## Pertanyaan terbuka

- — (`Kirim Pesan` tanpa penerima → validasi `Periksa kembali`, bukan modal konfirmasi kirim sukses)
