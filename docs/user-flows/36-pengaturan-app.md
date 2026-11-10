# Pengaturan app

## Tujuan

Kebijakan absensi, hari libur, pengingat repeat-order/follow-up (bagian non-CMS).

## Prasyarat

- `/settings` — `OWNER_ACTION_ROLES` + bypass. [DARI-KODE-SAJA] `page-access.ts:55`

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/settings` | `app/(app)/settings/page.tsx` |
| Actions | attendance settings, repeat-order di actions terkait |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka halaman | Heading `Pengaturan` | Form multi-bagian | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-settings.png` |
| 2 | Absensi | `Simpan pengaturan absensi` | Simpan jam kerja | [TERVERIFIKASI-BROWSER] |
| 3 | Hari libur | `Tambah` | Entry libur | [TERVERIFIKASI-BROWSER] |
| 4 | Repeat order | `Tambah jeda`, `Simpan pola`, `Simpan pengingat` | Konfigurasi pengingat | [TERVERIFIKASI-BROWSER] `buttons` |

## Field form

| Field | Label (manifest) | Wajib? | Bukti |
| --- | --- | --- | --- |
| Absensi policy | `Mulai berlaku absensi* (wajib)`, `Jam masuk* (wajib)`, `Toleransi keterlambatan* (wajib)`, `Hari kerja* (wajib)` + hari | ya | [TERVERIFIKASI-BROWSER] |
| Libur | `Tanggal* (wajib)`, `Nama hari libur* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Jeda repeat | `Jeda 1 (bulan)`, `Jeda 2 (bulan)` | — | [TERVERIFIKASI-BROWSER] |
| Pengingat | `Pengingat 1`, `Pengingat 2`, `Pengingat 3` | — | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Validasi settings | `Jam tidak valid. Gunakan format HH:mm.` / `Toleransi minimal 0 menit.` / `Toleransi maksimal 180 menit.` / `Pilih minimal satu hari kerja.` / `Tanggal mulai absensi tidak boleh melewati hari ini.` / `Pengaturan sudah berubah. Muat ulang halaman.` | [DARI-KODE-SAJA] `attendanceSettingsSchema` + `attendance.ts` |
| Sukses | `Pengaturan absensi disimpan.` | [DARI-KODE-SAJA] |

## Efek samping

- Memengaruhi alpha absensi dan notifikasi CRM.

## Temuan / keanehan

- Overlap dokumentasi dengan fitur 05 (absensi settings).

## Pertanyaan terbuka

- —
