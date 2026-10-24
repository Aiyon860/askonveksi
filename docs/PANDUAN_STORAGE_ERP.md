# Panduan Storage ERP di VPS

Dokumen ini menjelaskan cara kerja penyimpanan biner ERP: **gambar dan PDF di disk VPS**, sedangkan **teks, metadata, dan path relatif tetap di Supabase Postgres**.

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
ERP_STORAGE_DRIVER=hybrid
ERP_STORAGE_DIR=/home/<user>/askonveksi-storage
```

Contoh produksi di `$DEPLOY_PATH/shared/.env`:

```dotenv
ERP_STORAGE_DRIVER=hybrid
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
| `local` | VPS saja | VPS saja | Setelah backfill dan grace period. |

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

```bash
sudo install -d -o askonveksi -g askonveksi -m 0750 /var/lib/askonveksi/storage
sudo install -d -o askonveksi -g askonveksi -m 0750 /var/backups/askonveksi
```

Pastikan user PM2 dapat menulis:

```bash
sudo -u askonveksi test -w /var/lib/askonveksi/storage && echo OK
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

Script membaca bucket `crm-po-designs`, `business-assets`, `payment-proofs`, dan `whatsapp-media`, lalu menulis dengan `putFile(..., { upsert: true })`. File dengan ukuran sama dilewati sehingga aman dijalankan ulang.

Jalankan sebagai user aplikasi, bukan root:

```bash
sudo -u askonveksi -H bash -lc '
  set -euo pipefail
  cd /path/ke/repo
  set -a; . "$DEPLOY_PATH/shared/.env"; set +a
  node scripts/migrate-storage-to-vps.mjs --dry-run
  node scripts/migrate-storage-to-vps.mjs
  node scripts/migrate-storage-to-vps.mjs --verify
'
```

Jika terpaksa root, perbaiki ownership sebelum restart:

```bash
sudo chown -R askonveksi:askonveksi /var/lib/askonveksi/storage
sudo find /var/lib/askonveksi/storage -type f -exec chmod 0640 {} +
```

## 7. Backup dan restore

### Backup harian

```bash
npm run storage:backup
```

Script membuat `$ERP_STORAGE_BACKUP_DIR/erp-storage-<STAMP>.tar.gz`, mode `0600`, dan menyimpan 14 arsip terbaru (ubah dengan `ERP_STORAGE_BACKUP_KEEP`).

Cron user aplikasi:

```cron
15 2 * * * /path/ke/repo/scripts/backup-erp-storage.sh >> /var/log/erp-storage-backup.log 2>&1
```

Aktifkan salinan offsite, misalnya:

```cron
0 4 * * * rclone copy /var/backups/askonveksi remote:askonveksi-backups --min-age 1h
```

### Restore

```bash
pm2 stop <pm2-app> <pm2-wa>
tar -C /var/lib/askonveksi -xzf /var/backups/askonveksi/erp-storage-<STAMP>.tar.gz
sudo chown -R askonveksi:askonveksi /var/lib/askonveksi/storage
pm2 start <pm2-app> <pm2-wa>
npm run storage:verify
```

Restore database Supabase dan file VPS harus dari waktu yang berdekatan. Path di database menunjuk ke file; file yang hilang menghasilkan 404, bukan crash.

## 8. Rollback

| Kondisi | Tindakan |
|---|---|
| Bug saat hybrid | Set `ERP_STORAGE_DRIVER=supabase`, restart app + worker. Upload baru kembali ke Supabase; file yang sudah hybrid ada di kedua tempat. |
| File VPS rusak/hilang | Restore tar terbaru, perbaiki ownership, jalankan `npm run storage:verify`. |
| Worker `ERR_MODULE_NOT_FOUND` | Pastikan `lib/storage/local-store.mjs` ada di release dan tarball (deploy workflow sudah memverifikasi). |
| Semua gambar 404 setelah pindah driver | Cek `ERP_STORAGE_DIR`, ownership `askonveksi`, dan hasil `storage:verify`; jangan arahkan ke folder release. |

## 9. Troubleshooting

- **`ERP_STORAGE_DIR wajib diset`** — driver bukan `supabase` tetapi env kosong.
- **`ERP_STORAGE_DIR wajib berupa path absolut`** — gunakan `/var/lib/...`, bukan `./data/...`, di produksi.
- **`Path penyimpanan tidak valid`** — path dari database mengandung `..`, backslash, NUL, atau segmen tersembunyi. Periksa data, jangan melemahkan validasi.
- **`File sudah ada`** — upload `upsert: false` ke path yang sudah terisi. Gunakan path unik atau `upsert: true` bila memang menimpa.
- **`hybrid-put-rollback`** — tulis Supabase gagal; periksa kredensial/bucket. File VPS sudah dibersihkan.
- **`fallback-supabase` sering muncul** — backfill belum selesai; jalankan `storage:verify` lalu migrasi.

## 10. Checklist presentasi lokal

1. Isi `.env`: `ERP_STORAGE_DRIVER=hybrid` dan `ERP_STORAGE_DIR` absolut.
2. Pastikan `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, dan `DATABASE_URL` masih terisi.
3. Jalankan `npm run dev` (atau `npm run build && npm start`).
4. Upload desain/logo/bukti bayar, lalu cek file muncul di `$ERP_STORAGE_DIR/<bucket>/...`.
5. Ganti gambar, pastikan pratinjau berubah dan file lama terhapus.
6. Hapus gambar, pastikan route mengembalikan 404 dan file VPS hilang.
7. Kirim pesan WhatsApp berlampiran bila worker aktif, lalu cek media di `whatsapp-media/`.
