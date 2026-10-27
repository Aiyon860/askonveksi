# Panduan Storage ERP di VPS

Dokumen ini menjelaskan cara kerja penyimpanan biner ERP: **gambar dan PDF di disk VPS**, sedangkan **teks, metadata, dan path relatif tetap di Supabase Postgres**.

## 0. Status produksi (2026-10-27)

| Aspek | Kondisi saat ini |
|---|---|
| Driver produksi | **`local`** (sejak 2026-10-27 22:34 WIB) — baca & tulis **hanya** ke disk VPS, tanpa fallback Supabase |
| `ERP_STORAGE_DIR` | `/var/lib/askonveksi/storage` (di luar release, owner `askonveksipedurungan`, dir `0750`, file `0640`) |
| Backfill | **Selesai**: 118 objek / 36 MB dari 4 bucket; `--verify` bersih (missing=0, mismatched=0, extra=0); checksum SHA-256 sampel 19/19 cocok |
| Audit database | **74/74 path unik** yang dirujuk database ada di disk VPS |
| Backup | Cron harian 02:15 WIB + monitor disk mingguan; arsip `0600`, rotasi 14 file; uji restore non-destruktif lulus |
| Offsite | **Belum aktif** (ditunda) — arsip backup masih di disk yang sama dengan data |
| Baca file lama | Tidak lagi memicu `[erp-storage] fallback-supabase` sejak backfill |
| Supabase Storage | **Masih menyimpan salinan** 118 objek sebagai cold copy, tetapi **tidak lagi ditulis**. Jangan dihapus sampai sistem stabil ±1 bulan |
| Sisa | UAT fungsional penuh oleh OWNER/DEVELOPER, pengosongan bucket Supabase (T6.3), dan offsite backup |

**Rollback ke `hybrid`:** ubah `ERP_STORAGE_DRIVER=hybrid` di `shared/.env`, restart PM2. File yang lahir selama mode `local` hanya ada di VPS — jangan rollback ke `supabase` murni.

## 1. Prinsip

- Database tidak pernah menyimpan URL atau prefix `vps/`. Nilai kolom tetap seperti sebelumnya, misalnya `design/<taskId>/<uuid>.png`.
- Lokasi fisik file diturunkan dari `ERP_STORAGE_DIR` + nama bucket + path database:

```text
/var/lib/askonveksi/storage/          # ERP_STORAGE_DIR
├── crm-po-designs/design/...         # desain PO, revisi, desain penjahit
├── business-assets/business/...      # logo dan tanda tangan
├── payment-proofs/<owner>/...        # bukti bayar dan bukti pengeluaran
└── whatsapp-media/<account>/...      # media masuk/keluar WhatsApp
```

- Tidak ada signed URL atau akses publik langsung. Semua pembacaan melewati route yang sudah memeriksa autentikasi/role.
- Path divalidasi sebelum menyentuh filesystem: menolak `..`, path absolut, backslash, NUL, segmen tersembunyi, dan bucket tidak valid.
- Penulisan atomik: file ditulis ke file sementara lalu `rename` (upsert) atau `link` (tanpa upsert), sehingga pembaca tidak pernah melihat file setengah jadi.
- Role DEVELOPER tetap memiliki akses penuh ke seluruh fitur, termasuk fitur baru yang memakai storage ini.

## 2. Variabel environment

| Variabel | Wajib | Keterangan |
|---|---|---|
| `ERP_STORAGE_DIR` | Saat driver ≠ `supabase` | Folder akar biner. Produksi: path absolut di luar release, mis. `/var/lib/askonveksi/storage`. |
| `ERP_STORAGE_DRIVER` | Tidak | `supabase` (default), `hybrid`, atau `local`. |
| `WHATSAPP_MEDIA_BUCKET` | Tidak | Default `whatsapp-media`. |
| `ERP_STORAGE_BACKUP_DIR` | Tidak | Default `/var/backups/askonveksi` untuk `npm run storage:backup`. |

Contoh `.env` lokal untuk presentasi (path absolut agar tetap aman saat `npm start`):

```dotenv
ERP_STORAGE_DRIVER=local
ERP_STORAGE_DIR=/home/<user>/askonveksi-storage
```

Contoh produksi di `$DEPLOY_PATH/shared/.env` (kondisi saat ini):

```dotenv
ERP_STORAGE_DRIVER=local
ERP_STORAGE_DIR=/var/lib/askonveksi/storage
```

Aturan validasi (`lib/storage/local-store.mjs`):

- Driver tidak dikenal → error, bukan diam-diam memakai Supabase.
- Produksi + driver ≠ `supabase`: `ERP_STORAGE_DIR` wajib diset dan absolut.
- Path di dalam folder aplikasi hanya diberi peringatan agar `npm start` lokal tetap bisa dipakai; di VPS tetap gunakan volume di luar release.

## 3. Mode driver

| Driver | Tulis | Baca | Dipakai kapan |
|---|---|---|---|
| `supabase` | Supabase Storage | Supabase Storage | Default; perilaku lama, tanpa perubahan. |
| `hybrid` | VPS **dan** Supabase (fail-hard) | VPS dulu, fallback Supabase | Masa transisi/backfill. File lama tetap tampil, upload baru masuk VPS. |
| `local` | VPS saja | VPS saja | Kondisi produksi sejak 2026-10-27. Tidak ada fallback: file yang hilang dari disk = 404. |

### Hybrid fail-hard

1. Tulis ke VPS.
2. Tulis ke Supabase.
3. Jika Supabase gagal, salinan VPS dihapus dan operasi dianggap gagal.

Dengan begitu, rollback ke driver `supabase` tidak kehilangan file yang baru diunggah. Kegagalan rollback dicatat sebagai `[erp-storage] hybrid-put-rollback`.

## 4. Alur fitur

### Upload gambar/PDF

1. Server Action memvalidasi tipe dan ukuran.
2. `erpStorage(bucket).upload(path, bytes, { contentType, upsert })` menulis ke VPS.
3. Database menyimpan path relatif yang sama seperti sebelumnya.

Titik upload: desain PO (`app/actions/design.ts`), revisi/penjahit (`app/actions/production.ts`, `app/actions/crm.ts`), logo/tanda tangan (`app/actions/master-data.ts`), bukti bayar (`lib/payment-proof.ts`), lampiran WhatsApp (`app/actions/whatsapp.ts`), dan worker WhatsApp.

### Edit/ganti gambar

- File baru ditulis dengan path baru, lalu database diarahkan ke path baru.
- File lama dihapus setelah operasi database berhasil, sama seperti perilaku Supabase sebelumnya.
- `upsert: true` dipakai hanya saat menimpa path yang sama (mis. penyimpanan versi desain).

### Hapus gambar

- `erpStorage(bucket).remove([...])` menghapus di VPS.
- Pada `hybrid`, penghapusan juga dilakukan di Supabase.
- File yang sudah hilang tidak membuat operasi gagal.

### Membaca gambar

- Route memakai `erpStorage(bucket).download(path)` dan mengembalikan `Response` dengan header yang sama seperti sebelumnya.
- Pada `hybrid`, jika file belum ada di VPS, route membaca Supabase dan mencatat `[erp-storage] fallback-supabase` (dibatasi 10 menit per path).

## 5. Menyiapkan VPS

Nilai aktual produksi: user/group `askonveksipedurungan`, `DEPLOY_PATH=/var/www/askonveksi`, proses PM2 `askonveksi-web` dan `askonveksi-web-wa`.

```bash
sudo install -d -o askonveksipedurungan -g askonveksipedurungan -m 0750 /var/lib/askonveksi/storage
sudo install -d -o askonveksipedurungan -g askonveksipedurungan -m 0750 /var/backups/askonveksi
```

Pastikan user PM2 dapat menulis:

```bash
test -w /var/lib/askonveksi/storage && echo OK      # jalankan sebagai user aplikasi
```

Tambahkan env ke `$DEPLOY_PATH/shared/.env`, lalu deploy/restart. Deploy workflow memverifikasi bahwa `ERP_STORAGE_DIR` ada, absolut, di luar `DEPLOY_PATH`, dan writable saat driver bukan `supabase`.

## 6. Migrasi file lama (backfill)

Script: `scripts/migrate-storage-to-vps.mjs`.

```bash
# pratinjau jumlah/byte
npm run storage:migrate -- --dry-run

# salin file yang belum ada / ukurannya berbeda (idempoten)
npm run storage:migrate

# bandingkan remote vs lokal; exit != 0 bila ada selisih
npm run storage:verify
```

Script membaca bucket `crm-po-designs`, `business-assets`, `payment-proofs`, dan `whatsapp-media`, lalu menulis dengan `putFile(..., { upsert: true })`. File dengan ukuran sama dilewati sehingga aman dijalankan ulang. Backfill produksi 2026-10-27 memerlukan ±5 menit untuk 118 objek / 36 MB.

### Menjalankan di VPS (cara yang dipakai produksi)

Repo bersifat privat dan VPS tidak memiliki kunci GitHub, jadi **jangan** mengandalkan `git clone`. Script sudah ikut ter-deploy di release:

```bash
cd /var/www/askonveksi/current
node scripts/migrate-storage-to-vps.mjs --dry-run
nohup node scripts/migrate-storage-to-vps.mjs > /tmp/storage-migrate.log 2>&1 &
node scripts/migrate-storage-to-vps.mjs --verify
```

`current/.env` adalah symlink ke `shared/.env`, dan `node_modules` (dotenv + `@supabase/supabase-js`) sudah ada, sehingga `npm ci` tidak diperlukan. Gunakan `nohup` agar proses tidak terputus saat sesi SSH ditutup.

Catatan penting:

- Jalankan sebagai user aplikasi, bukan `root`. Bila terpaksa root, perbaiki ownership sebelum restart:
  ```bash
  sudo chown -R askonveksipedurungan:askonveksipedurungan /var/lib/askonveksi/storage
  sudo find /var/lib/askonveksi/storage -type f -exec chmod 0640 {} +
  ```
- `--verify` hanya membandingkan bucket ↔ disk. Untuk memastikan **path yang benar-benar dipakai aplikasi** ada, jalankan audit database → filesystem (lihat `FILE_TO_VPS.md` §7.1).
- Selama `hybrid`, file lama yang belum di-backfill tetap tampil lewat fallback Supabase, tetapi memicu log `[erp-storage] fallback-supabase`.

## 7. Backup dan restore

### Backup harian

```bash
npm run storage:backup
```

Script membuat `$ERP_STORAGE_BACKUP_DIR/erp-storage-<STAMP>.tar.gz`, mode `0600`, dan menyimpan 14 arsip terbaru (ubah dengan `ERP_STORAGE_BACKUP_KEEP`). Script membaca `ERP_STORAGE_DIR`/`ERP_STORAGE_BACKUP_DIR` dari `.env` di root repo/release, jadi aman dipanggil dari cron tanpa env tambahan.

Cron yang **sudah terpasang** di produksi (user `askonveksipedurungan`):

```cron
# Backup harian biner ERP (Supabase Storage -> disk VPS). Simpan 14 arsip.
15 2 * * * /var/www/askonveksi/current/scripts/backup-erp-storage.sh >> /var/log/erp-storage-backup.log 2>&1

# Monitor kapasitas disk storage ERP; tulis peringatan bila pemakaian >= 80 persen.
0 6 * * 1 USE=$(df -P /var/lib/askonveksi/storage | awk "NR==2 {print \$5}" | tr -dc "0-9"); if [ -n "$USE" ] && [ "$USE" -ge 80 ]; then echo "[storage-disk] $(date -Is) WARNING pemakaian ${USE} persen" >> /var/log/erp-storage-backup.log; fi
```

Detail: log `/var/log/erp-storage-backup.log` (milik user aplikasi, `0640`); pemanggilan lewat `current/scripts` agar mengikuti release terbaru; hindari karakter `%` mentah di baris cron (karena itu monitor disk memakai `awk` + `tr`, bukan `gsub(/%/,…)`).

Offsite **belum aktif** (2026-10-27, ditunda). Bila diaktifkan nanti:

```bash
sudo apt-get install -y rclone   # atau installer resmi rclone.org
rclone config                    # buat remote, mis. B2/S3/Drive
```

```cron
0 4 * * * rclone copy /var/backups/askonveksi remote:askonveksi-backups --min-age 1h
```

### Restore

Uji 2026-10-27 (non-destruktif, ekstrak ke `/tmp`): 118/118 file, SHA-256 8/8 sampel cocok, permission `0640`/`0750` utuh.

Drill penuh saat downtime terjadwal:

```bash
pm2 stop askonveksi-web askonveksi-web-wa
tar -C /var/lib/askonveksi -xzf /var/backups/askonveksi/erp-storage-<STAMP>.tar.gz
chown -R askonveksipedurungan:askonveksipedurungan /var/lib/askonveksi/storage   # bila diekstrak sebagai root
pm2 start askonveksi-web askonveksi-web-wa
cd /var/www/askonveksi/current && node scripts/migrate-storage-to-vps.mjs --verify
```

Restore database Supabase dan file VPS harus dari waktu yang berdekatan. Path di database menunjuk ke file; file yang hilang menghasilkan 404, bukan crash.

## 8. Rollback

| Kondisi | Tindakan |
|---|---|
| Bug saat `local` | Set `ERP_STORAGE_DRIVER=hybrid` (bukan `supabase`), restart app + worker. File yang lahir selama `local` hanya ada di VPS, jadi `hybrid` tetap bisa membacanya. |
| Bug saat hybrid | Set `ERP_STORAGE_DRIVER=supabase`, restart app + worker. Upload baru kembali ke Supabase; file yang sudah hybrid ada di kedua tempat. |
| File VPS rusak/hilang | Restore tar terbaru, perbaiki ownership, jalankan `npm run storage:verify`. |
| Worker `ERR_MODULE_NOT_FOUND` | Pastikan `lib/storage/local-store.mjs` ada di release dan tarball (deploy workflow sudah memverifikasi). |
| Semua gambar 404 setelah pindah driver | Cek `ERP_STORAGE_DIR`, ownership `askonveksipedurungan`, dan hasil `storage:verify`; jangan arahkan ke folder release. |

## 9. Troubleshooting

- **`ERP_STORAGE_DIR wajib diset`** — driver bukan `supabase` tetapi env kosong.
- **`ERP_STORAGE_DIR wajib berupa path absolut`** — gunakan `/var/lib/...`, bukan `./data/...`, di produksi.
- **`Path penyimpanan tidak valid`** — path dari database mengandung `..`, backslash, NUL, atau segmen tersembunyi. Periksa data, jangan melemahkan validasi.
- **`File sudah ada`** — upload `upsert: false` ke path yang sudah terisi. Gunakan path unik atau `upsert: true` bila memang menimpa.
- **`hybrid-put-rollback`** — tulis Supabase gagal; periksa kredensial/bucket. File VPS sudah dibersihkan.
- **`fallback-supabase` sering muncul** — hanya relevan pada driver `hybrid`: backfill belum selesai, jalankan `storage:verify` lalu migrasi. Produksi sekarang `local`, jadi baris ini tidak akan muncul; bila muncul, berarti env driver belum ter-restart.
- **Gambar 404 padahal file ada di Supabase** — produksi `local` tidak membaca Supabase. Jalankan `--verify`/audit DB→disk, atau sementara ubah ke `hybrid` lalu restart.

## 10. Checklist presentasi lokal

1. Isi `.env`: `ERP_STORAGE_DRIVER=local` dan `ERP_STORAGE_DIR` absolut (folder lokal, jangan arahkan ke `/var/lib/askonveksi` milik VPS).
2. Pastikan `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, dan `DATABASE_URL` masih terisi.
3. Jalankan `npm run dev` (atau `npm run build && npm start`).
4. Upload desain/logo/bukti bayar, lalu cek file muncul di `$ERP_STORAGE_DIR/<bucket>/...`.
5. Ganti gambar, pastikan pratinjau berubah dan file lama terhapus.
6. Hapus gambar, pastikan route mengembalikan 404 dan file VPS hilang.
7. Kirim pesan WhatsApp berlampiran bila worker aktif, lalu cek media di `whatsapp-media/`.
