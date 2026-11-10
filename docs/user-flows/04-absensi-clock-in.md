# Absensi clock-in

## Tujuan

Pegawai non-Owner/Developer mencatat kehadiran harian (foto + lokasi) dan melihat riwayat bulanan.

## Prasyarat

- Role attendance-employee (`isAttendanceEmployee`: semua kecuali OWNER/DEVELOPER). [DARI-KODE-SAJA] `permissions.ts:27-28`
- OWNER/DEVELOPER yang membuka `/absensi` di-redirect ke `/absensi/laporan`. [DARI-KODE-SAJA] `absensi/page.tsx:62`; [TERVERIFIKASI-BROWSER] crawl Owner
- Contoh akun: `desainer@mail.com` (DESIGNER).

## Route & file kode terkait

| Route | File |
| --- | --- |
| `/absensi` | `app/(app)/absensi/page.tsx` |
| Actions | `app/actions/attendance.ts` |

## Alur utama

| No | Aksi | Elemen (label/teks persis) | Hasil | Bukti |
| --- | --- | --- | --- | --- |
| 1 | Login Desainer → `/absensi` | Heading `Absensi`; status `Belum absen hari ini`; section `Ketentuan hari ini`, `Riwayat absensi` | Halaman clock-in | [TERVERIFIKASI-BROWSER] `evidence/04-absensi-designer.png`, `deep-findings.json` |
| 2 | Lihat ketentuan | Teks contoh: `Batas toleransi sudah lewat. Absen sekarang akan tercatat Terlambat.`; `Jam masuk` / `Toleransi` / `Status hari` | Info hari | [TERVERIFIKASI-BROWSER] snippet body desainer |
| 3 | Klik `Absen sekarang` | Tombol `Absen sekarang`; juga nav `Absen` | Alur foto/lokasi | [TERVERIFIKASI-BROWSER] tombol terlihat; alur kamera sukses [BELUM-TERVERIFIKASI] (tidak dipaksa agar tidak menulis absensi nyata) |
| 4 | Filter riwayat | Label `Bulan riwayat absensi`; tombol `Lihat lokasi` pada baris | Riwayat | [TERVERIFIKASI-BROWSER] |
| 5 | Desainer buka `/dashboard` | — | Redirect kembali ke `/absensi` | [TERVERIFIKASI-BROWSER] `deep-findings.json` `designer-dash` |
| 6 | Owner buka `/absensi` | — | Redirect `/absensi/laporan` | [TERVERIFIKASI-BROWSER] crawl Owner |

## Field form

| Field | Tipe | Wajib? | Aturan | Bukti |
| --- | --- | --- | --- | --- |
| Foto absensi | capture | ya saat submit | `Ambil foto terlebih dahulu.` | [DARI-KODE-SAJA] `attendance.ts:105` |
| Lokasi GPS | koordinat | ya | validasi lokasi | [DARI-KODE-SAJA] `attendance.ts:113` |
| Bulan riwayat | select/query | tidak | Label `Bulan riwayat absensi` | [TERVERIFIKASI-BROWSER] |

## Skenario gagal

| Skenario | Pesan persis | Bukti |
| --- | --- | --- |
| Sesi habis | `Sesi Anda berakhir. Masuk kembali lalu coba lagi.` | [DARI-KODE-SAJA] `attendance.ts:97` |
| Owner/Developer clock-in | `Akun Owner/Developer tidak memiliki absensi pegawai.` | [DARI-KODE-SAJA] `attendance.ts:100` |
| Sudah absen | `Anda sudah tercatat ... hari ini.` | [DARI-KODE-SAJA] `attendance.ts:128` |
| Tanpa foto | `Ambil foto terlebih dahulu.` | [DARI-KODE-SAJA] `attendance.ts:105` |

## Efek samping

- Menulis baris absensi + status HADIR/TERLAMBAT; audit.

## Temuan / keanehan

- Saat uji (10 Nov 2026), UI sudah menyatakan toleransi lewat → absen akan `Terlambat`. [TERVERIFIKASI-BROWSER]
- Nav desainer hanya grup Absensi (`Absen`) + `Keluar`. [TERVERIFIKASI-BROWSER]

## Pesan kamera (kode UI)

| Kondisi | Pesan | Bukti |
| --- | --- | --- |
| Tidak ada MediaDevices | `Browser ini tidak menyediakan akses kamera…` | [DARI-KODE-SAJA] `attendance-clock-card.tsx` |
| Izin ditolak | `Izin kamera ditolak. Buka pengaturan izin situs…` | [DARI-KODE-SAJA] |
| Kamera tidak ada | `Kamera tidak ditemukan…` | [DARI-KODE-SAJA] |
| Gagal buka umum | `Kamera tidak dapat dibuka. Pastikan situs diakses lewat HTTPS atau localhost…` | [DARI-KODE-SAJA] |
| GPS | `Lokasi dicatat sebagai bukti pendukung. Jika GPS tidak tersedia, absen tetap dapat dikirim.` | [TERVERIFIKASI-BROWSER] halaman absensi |

## Pertanyaan terbuka

- UI preview kamera live di headless CDP tidak terbuka stabil saat klik `Absen sekarang` (tidak dieksekusi absen nyata). [BELUM-TERVERIFIKASI-BROWSER]
