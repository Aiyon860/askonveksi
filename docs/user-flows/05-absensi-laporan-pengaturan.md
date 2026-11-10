# Laporan & pengaturan absensi

## Tujuan

Owner mengawasi absensi tim, mengekspor laporan, mencatat manual, mengoreksi, dan mengatur kebijakan absensi (jam kerja, libur) lewat `/settings`.

## Prasyarat

- `/absensi/laporan`: role `ATTENDANCE_ADMIN_ROLES` (+ bypass). [DARI-KODE-SAJA] `page-access.ts:40`
- Pengaturan absensi: `/settings` `OWNER_ACTION_ROLES` (+ bypass).

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/absensi/laporan` | `app/(app)/absensi/laporan/page.tsx` |
| `/settings` (bagian absensi) | `app/(app)/settings/page.tsx`, `app/actions/attendance.ts` |
| Export | `lib/export/datasets/hr.ts` (dataset `absensi`) |

## Alur utama

| No | Aksi | Elemen | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Buka `/absensi/laporan` | Heading `Laporan absensi` | Tabel laporan | [TERVERIFIKASI-BROWSER] manifest; `evidence/crawl-owner-absensi__laporan.png` |
| 2 | Filter rentang | Label `Dari tanggal`, `Sampai tanggal`, `Pegawai`, `Status`, `Baris per halaman` | Filter tabel | [TERVERIFIKASI-BROWSER] manifest `labels` |
| 3 | `Terapkan` | Tombol `Terapkan` | Reload data filter | [TERVERIFIKASI-BROWSER] manifest `buttons` |
| 4 | `Export Excel` | Tombol `Export Excel` | Export dataset absensi | [TERVERIFIKASI-BROWSER] manifest |
| 5 | `Catat manual` / baris `Catat` | Tombol `Catat manual`, `Catat`; dialog `Catat absensi manual` | Form catat manual | [TERVERIFIKASI-BROWSER] `evidence/05-absensi-catat-manual.png`, `continue-gapfill.json` `absensiManual` — submit tidak dijalankan |
| 6 | `Koreksi` / `Lihat lokasi` | Tombol per baris | Dialog koreksi/lokasi | [TERVERIFIKASI-BROWSER] manifest |
| 7 | Pengaturan di `/settings` | `Simpan pengaturan absensi`, hari kerja, libur | Simpan policy | [TERVERIFIKASI-BROWSER] manifest `/settings` `buttons`/`labels` |

## Field form

### Laporan

| Field | Tipe | Wajib? | Bukti |
| --- | --- | --- | --- |
| `from` / `to` | date | tidak | [TERVERIFIKASI-BROWSER] manifest `inputs` id `attendance-report-from/to` |
| `userId` | select pegawai | tidak | [TERVERIFIKASI-BROWSER] |
| `status` | select | tidak | [TERVERIFIKASI-BROWSER] |
| `pageSize` | select | tidak | [TERVERIFIKASI-BROWSER] |

### Pengaturan (`/settings`)

| Field | Label manifest | Wajib? | Bukti |
| --- | --- | --- | --- |
| Mulai berlaku | `Mulai berlaku absensi* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Jam masuk | `Jam masuk* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Toleransi | `Toleransi keterlambatan* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Hari kerja | checkbox `Senin`…`Minggu` | ya | [TERVERIFIKASI-BROWSER] |
| Hari libur | `Tanggal*`, `Nama hari libur*` | ya | [TERVERIFIKASI-BROWSER] |

### Catat manual (dialog)

| Field | Label | Wajib? | Bukti |
| --- | --- | --- | --- |
| Pegawai | `Pegawai* (wajib)` | ya | [TERVERIFIKASI-BROWSER] `evidence/05-absensi-catat-manual.png` |
| Tanggal | `Tanggal* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Status | `Status* (wajib)` opsi `Hadir` / `Terlambat` / `Izin` / `Alpha` | ya | [TERVERIFIKASI-BROWSER] |
| Jam masuk | `Jam masuk (WIB)* (wajib)` | ya | [TERVERIFIKASI-BROWSER] |
| Keterangan | `Keterangan` | tidak | [TERVERIFIKASI-BROWSER] |
| Aksi | `Batal`, `Simpan absensi`, `Tutup` | — | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan | Bukti |
| --- | --- | --- |
| Aksi tanpa sesi | Pesan session attendance actions | [DARI-KODE-SAJA] `attendance.ts` |
| Validasi form settings | lihat `36-pengaturan-app.md` (`attendanceSettingsSchema` + flash `Pengaturan absensi disimpan.`) | [DARI-KODE-SAJA] |

## Efek samping

- Koreksi/catat manual menulis audit.
- Alpha otomatis dihitung untuk hari kerja tanpa catatan.

## Temuan / keanehan

- `/absensi` dan `/absensi/laporan` crawl Owner sama-sama menampilkan laporan (redirect). [TERVERIFIKASI-BROWSER]

## Pertanyaan terbuka

- —
