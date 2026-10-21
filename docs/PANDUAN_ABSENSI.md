# Panduan Absensi Pegawai

Modul absensi mencatat kehadiran harian pegawai dengan **foto langsung dari kamera** dan **lokasi sebagai bukti pendukung**. Owner mengelola pengaturan, hari libur, laporan, koreksi, dan pencatatan manual. Tidak ada absen keluar (check-out), payroll, radius kantor, atau unggah foto dari galeri.

## 1. Akses per role

| Role | Absen masuk | Riwayat sendiri | Laporan & koreksi | Pengaturan & hari libur |
| --- | --- | --- | --- | --- |
| Pegawai (semua role selain `OWNER`/`DEVELOPER`) | Ya | Ya | Tidak | Tidak |
| `OWNER` | Tidak | Tidak | Ya | Ya |
| `DEVELOPER` | Tidak | Tidak | Ya | Ya |

Developer tetap dapat mengakses seluruh fitur baru: laporan, koreksi, catat manual, pengaturan absensi, dan kalender hari libur. `OWNER` dan `DEVELOPER` bukan pegawai, sehingga tidak muncul di daftar pegawai dan tidak dihitung Alpha.

Menu baru **Absensi** muncul di sidebar:

- Pegawai melihat **Absen** (`/absensi`).
- Owner/Developer melihat **Laporan absensi** (`/absensi/laporan`).
- Pengaturan ada di **Pengaturan → Pengaturan absensi** (`/settings#absensi`).

## 2. Alur pegawai

1. Buka menu **Absensi → Absen**.
2. Tekan **Absen sekarang**.
3. Izinkan kamera. Dialog menampilkan pratinjau kamera langsung; **tidak ada tombol unggah file/galeri**.
4. Tekan **Ambil foto**, periksa hasil, lalu **Kirim absensi**.
5. Hasil langsung menampilkan **Hadir** atau **Terlambat** beserta jam absen.

Aturan status:

- **Hadir** bila waktu absen masih di dalam jam masuk + toleransi. Contoh: jam masuk `08:00`, toleransi `15` menit → pukul `08:15` masih Hadir; `08:16` sudah Terlambat.
- **Terlambat** bila melewati batas toleransi.
- Satu pegawai hanya boleh punya satu record per tanggal. Percobaan absen kedua ditolak.
- Absen di hari libur atau hari non-kerja tetap diperbolehkan bila pegawai masuk; record eksplisit selalu menang.
- Tidak ada absen keluar.

### Lokasi

- Browser meminta izin lokasi saat dialog dibuka.
- Bila GPS tersedia, koordinat, akurasi, dan waktu pencatatan disimpan sebagai bukti.
- Bila GPS ditolak/tidak tersedia/timeout, absensi **tetap boleh dikirim** dan ditandai **“Lokasi tidak tersedia”**.
- Tidak ada validasi radius atau geofence.

### Riwayat pegawai

- Di bawah kartu absen ada **Riwayat absensi**.
- Pilih bulan lewat pemilih bulan; tombol panah membuka bulan sebelumnya/berikutnya.
- Setiap baris menampilkan tanggal, status, jam masuk, keterangan, foto, dan lokasi bila ada.
- **Belum absen** hanya muncul untuk hari ini. Hari kerja yang sudah lewat tanpa record tampil sebagai **Alpha**.
- Hari libur dan hari non-kerja tidak dihitung Alpha.
- Hari sebelum **Mulai berlaku absensi** tidak dihitung Alpha. Record eksplisit yang sudah ada tetap ditampilkan.

## 3. Laporan Owner/Developer

Halaman **Laporan absensi** menampilkan:

- Ringkasan Hadir, Terlambat, Izin, Alpha, Belum absen, dan tingkat kehadiran.
- Filter rentang tanggal, pegawai, status, dan jumlah baris per halaman.
- Tanpa filter tanggal eksplisit, laporan dimulai dari **Mulai berlaku absensi** (tetapi tidak lebih awal dari awal bulan berjalan).
- Tabel lengkap: tanggal, pegawai, status, jam masuk, keterangan, sumber, bukti foto/lokasi, dan aksi.
- Tombol **Export Excel** mengikuti filter aktif dan mengekspor semua baris (bukan hanya halaman yang terlihat).
- Halaman memakai lebar penuh area kerja; tabel dapat digeser horizontal di layar kecil.

### Catat manual

Gunakan **Catat manual** untuk pegawai yang lupa absen atau izin yang disetujui.

- **Hadir/Terlambat** wajib mengisi jam masuk.
- **Izin** wajib mengisi keterangan dan hanya untuk satu tanggal. Izin beberapa hari dicatat satu per satu.
- **Alpha** tidak memakai jam masuk.
- Tanggal tidak boleh melewati hari ini atau sebelum akun pegawai dibuat.
- Record manual tidak dapat dibuat bila tanggal tersebut sudah punya record; gunakan **Koreksi**.

### Koreksi

- Owner/Developer dapat mengoreksi status, jam masuk, dan keterangan kapan saja, termasuk mengubah record mandiri.
- Setiap koreksi tercatat di **Log aktivitas** (sebelum/sesudah status dan jam; isi keterangan tidak disalin ke log).
- Foto absensi mandiri tetap tersimpan walaupun statusnya dikoreksi menjadi Izin atau Alpha.
- Koreksi memakai optimistic lock; bila record berubah lebih dulu, simpan ditolak dan halaman perlu dimuat ulang.

### Hapus

- Hanya record dengan sumber **Owner** (manual) yang dapat dihapus.
- Record mandiri tidak dapat dihapus; gunakan koreksi.
- Setelah record manual dihapus, tanggal tersebut kembali mengikuti aturan otomatis: **Alpha** bila hari kerja sudah lewat dan tidak ada record, atau **Belum absen** bila hari ini.

## 4. Pengaturan dan hari libur

Buka **Pengaturan → Pengaturan absensi**. Hanya Owner/Developer yang melihat kartu ini.

- **Mulai berlaku absensi** — tanggal pertama perhitungan Alpha. Tidak boleh melewati hari ini. Hari kerja sebelum tanggal ini tidak dihitung Alpha, sehingga data bisa dimulai dari nol tanpa menghapus akun pegawai.
- **Jam masuk** — waktu WIB, format `HH:mm`.
- **Toleransi keterlambatan** — 0–180 menit.
- **Hari kerja** — Senin–Sabtu default; Minggu dapat diaktifkan.
- **Hari libur absensi** — tambah tanggal + nama, atau hapus. Tanggal libur tidak dihitung Alpha; record eksplisit tetap tampil.

Perubahan pengaturan memakai optimistic lock `BusinessProfile.version`. Bila pengaturan diubah pengguna lain lebih dulu, simpan ditolak dan perlu muat ulang.

## 5. Penyimpanan foto di VPS

Foto **tidak** disimpan di Supabase Storage. Alurnya:

1. Kamera menghasilkan gambar di browser.
2. Server memvalidasi ukuran (maksimal 5 MB) dan isi gambar dengan `sharp`.
3. Server melakukan re-encode ke **WebP** (maksimal sisi 1280 px, kualitas 82). Metadata EXIF, termasuk GPS dari kamera, hilang.
4. File ditulis ke `ATTENDANCE_UPLOAD_DIR` dengan struktur `userId/tahun/bulan/uuid.webp`.
5. Database hanya menyimpan **path relatif** (`photoPath`), MIME, dan ukuran.
6. Foto disajikan lewat route terautentikasi `/api/absensi/[id]/foto`; pegawai hanya bisa membuka fotonya sendiri, Owner/Developer dapat membuka semua.

Path divalidasi terhadap root, menolak path traversal, path absolut, backslash, segmen tersembunyi, dan ekstensi selain `.webp`.

### Konfigurasi produksi

Tambahkan di environment produksi:

```env
ATTENDANCE_UPLOAD_DIR=/var/lib/askonveksi/attendance
```

Default lokal adalah `./data/attendance` (masuk `.gitignore`). Di produksi **jangan** memakai folder di dalam direktori release/build, karena release baru dapat menghapusnya.

```bash
sudo install -d -o askonveksi -g askonveksi -m 0750 /var/lib/askonveksi/attendance
sudo chown -R askonveksi:askonveksi /var/lib/askonveksi/attendance
```

Pastikan proses aplikasi dapat menulis ke folder tersebut. Folder harus persisten dan ikut backup.

### HTTPS dan header browser

Kamera (`getUserMedia`) dan lokasi (`navigator.geolocation`) hanya berjalan di **secure context**. Produksi wajib HTTPS; `http://localhost` tetap boleh untuk development.

`next.config.ts` sudah mengatur header khusus `/absensi` dan `/absensi/*`:

```text
Permissions-Policy: camera=(self), microphone=(), geolocation=(self)
```

Jangan menimpa header ini di reverse proxy dengan nilai yang memblokir kamera/lokasi. Bila memakai Nginx, pastikan batas body cukup untuk foto (contoh `client_max_body_size 28m`) dan jangan mengaktifkan halaman pembungkus/iframe yang berbeda origin.

### Migrasi database

Migration baru:

- `prisma/migrations/20261022010000_attendance/migration.sql` — enum, tabel, pengaturan, index, FK, check constraint, RLS.
- `prisma/migrations/20261022020000_attendance_start_date/migration.sql` — kolom `BusinessProfile.attendanceStartDate` dengan default tanggal Jakarta saat migrasi.

```bash
# DIRECT_URL harus mengarah ke direct connection / session pooler
npx prisma migrate deploy
npx prisma generate
```

Migration membuat enum `AttendanceStatus`/`AttendanceSource`, tabel `Attendance` dan `AttendanceHoliday`, kolom pengaturan di `BusinessProfile`, index, foreign key, check constraint, RLS, dan mencabut akses `anon`/`authenticated`.

**Catatan repo:** migrasi ditulis manual dan diterapkan dengan `prisma migrate deploy`; `prisma migrate dev` tidak dipakai karena migrasi lama menyentuh skema `storage` Supabase yang tidak tersedia di shadow database.

### Backup dan restore

Backup database dan folder foto pada waktu yang berdekatan agar path di database tetap cocok dengan file.

```bash
# contoh backup harian
STAMP=$(date +%F)
tar -C /var/lib/askonveksi -czf /var/backups/askonveksi/attendance-$STAMP.tar.gz attendance
pg_dump "$DIRECT_URL" > /var/backups/askonveksi/db-$STAMP.sql
```

Simpan di luar server atau object storage dengan retensi sesuai kebijakan. Untuk restore:

1. Hentikan aplikasi agar tidak ada absensi baru.
2. Restore database.
3. Ekstrak folder `attendance` ke `ATTENDANCE_UPLOAD_DIR`.
4. Perbaiki owner/permission (`askonveksi:askonveksi`, folder `0750`, file `0640`).
5. Jalankan aplikasi dan uji buka satu foto.

### Perkiraan ruang disk

Satu foto WebP biasanya puluhan sampai ratusan KB. Puluhan pegawai × 26 hari kerja dapat memakai puluhan MB per bulan. Pantau kapasitas disk; folder foto tidak boleh penuh karena absensi akan gagal disimpan.

## 6. Keamanan dan privasi

- Semua Server Action memeriksa sesi dan role; laporan/pengaturan/koreksi hanya Owner/Developer (Developer selalu lolos).
- Pegawai hanya dapat clock-in untuk dirinya sendiri; foto hanya dapat dibuka pemilik atau Owner/Developer.
- Foto di-reencode sehingga EXIF/GPS kamera tidak ikut tersimpan.
- Koordinat hanya bukti pendukung; tidak ada klaim validasi lokasi.
- Path file divalidasi dan route foto memakai `Cache-Control: private, no-store`.
- Tabel absensi mengaktifkan RLS dan mencabut akses langsung `anon`/`authenticated`.
- Log aktivitas mencatat clock-in, catat manual, koreksi, hapus manual, perubahan pengaturan, dan perubahan hari libur.

## 7. Troubleshooting

### Kamera tidak dapat dibuka

1. Pastikan alamat memakai **HTTPS** (bukan HTTP biasa, kecuali `localhost`).
2. Periksa izin kamera di pengaturan browser untuk situs ini.
3. Tutup aplikasi lain yang sedang memakai kamera.
4. Pastikan reverse proxy tidak menimpa `Permissions-Policy`.
5. Coba browser terbaru (Chrome/Edge/Safari/Firefox modern).

### Lokasi tidak tersedia

Ini bukan blocker. Absensi tetap tersimpan tanpa koordinat dan ditandai “Lokasi tidak tersedia”. Periksa izin lokasi dan GPS perangkat bila ingin bukti lokasi.

### Absensi ditolak “sudah tercatat”

Satu tanggal hanya boleh satu record. Bila record salah, Owner/Developer harus memakai **Koreksi**. Bila record manual salah tanggal, hapus record manual lalu catat ulang.

### Foto gagal disimpan

Periksa:

- `ATTENDANCE_UPLOAD_DIR` ada dan dapat ditulis proses aplikasi.
- Disk tidak penuh.
- Path bukan folder read-only di dalam release.
- Ukuran foto tidak melebihi 5 MB (browser sudah mengecilkan, tetapi server tetap memeriksa).

### Alpha muncul padahal seharusnya libur

Tambahkan tanggal tersebut ke **Hari libur absensi** di Pengaturan. Alpha dihitung ulang saat halaman laporan dibuka. Record eksplisit yang sudah ada tidak berubah.

### Alpha lama masih muncul setelah simulasi direset

Periksa **Pengaturan → Pengaturan absensi → Mulai berlaku absensi**. Alpha hanya diturunkan sejak tanggal tersebut. Record eksplisit sebelum tanggal mulai tetap ditampilkan; hapus record manual atau koreksi bila record itu memang bagian dari data lama.

## 8. Batasan yang disengaja

- Tidak ada check-out.
- Tidak ada payroll, lembur, shift, atau multi-lokasi.
- Tidak ada radius/geofence.
- Tidak ada liveness detection atau anti-titip.
- Tidak ada pengajuan izin oleh pegawai; izin dicatat Owner.
- Izin hanya satu tanggal per record.
- Tidak ada mode offline.
- Tidak ada notifikasi otomatis.
