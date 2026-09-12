# Panduan Testing Manual WhatsApp Baileys

Gunakan database development atau staging, nomor WhatsApp khusus testing, dan data customer nonproduksi. Jangan pernah menyalin auth state, token, secret, atau isi pesan customer ke issue tracker.

## 0. Persiapan

- [ ] Dependency sudah terpasang dan `.env` memuat `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `WHATSAPP_AUTH_PATH`, `WHATSAPP_WORKER_ID`, `WHATSAPP_WORKER_SECRET`, `WHATSAPP_HEALTH_PORT`, serta konfigurasi Supabase Storage.
- [ ] Migration sudah diterapkan dan Prisma Client sudah dibuat.
- [ ] Bucket private `whatsapp-media` tersedia.
- [ ] Siapkan nomor bisnis staging, nomor penerima, customer testing, invoice `ISSUED`, dan template untuk semua trigger.
- [ ] Catat role tester serta ID account, customer, conversation, invoice, message, dan job yang dipakai.

```bash
npx prisma migrate status
npm run db:generate
npm run dev
npm run whatsapp:worker:dev
```

Pastikan aplikasi terbuka di `http://localhost:3000` dan `curl -i http://localhost:3001/health` mengembalikan HTTP `200` dengan `{"status":"ok"}`.

## 1. Baseline yang sudah diuji

Sebelum melanjutkan, pastikan pengujian dasar berikut memang sudah lulus pada environment yang sama:

- [ ] Pairing account hingga status `CONNECTED` dan `heartbeatAt` terus berubah.
- [ ] Hanya satu account `CONNECTED` yang aktif sebagai pengirim.
- [ ] Template `MANUAL` merender variabel yang didukung dan menolak variabel asing.
- [ ] Pesan teks biasa dan berbasis template diterima satu kali.
- [ ] Gambar JPG, PNG, atau WebP diterima dan dapat dibuka dari inbox.
- [ ] Dokumen PDF diterima dan dapat diunduh oleh user yang berhak.
- [ ] Media berada di bucket private, bukan URL publik.

## 2. Reliability

### Pairing code kedaluwarsa

1. Klik **Pairing** dan biarkan kode melewati waktu kedaluwarsa.
2. Klik **Pairing** lagi.

- [ ] Kode lama hilang setelah kedaluwarsa.
- [ ] Worker menghasilkan kode baru tanpa harus direstart.
- [ ] Kode baru berbeda dan dapat dipakai untuk pairing.

### Pemulihan sesi setelah restart

1. Pastikan account sudah `CONNECTED`.
2. Hentikan worker, lalu jalankan kembali worker yang sama.

- [ ] Sesi tersambung kembali dari `WHATSAPP_AUTH_PATH` tanpa pairing ulang.
- [ ] Account kembali `CONNECTED` dan heartbeat berjalan lagi.

### Lock worker

1. Biarkan worker pertama berjalan.
2. Jalankan worker kedua dengan database dan account yang sama.

- [ ] Worker kedua ditolak oleh advisory lock.
- [ ] Worker pertama tetap sehat dan tidak ada dua proses yang mengirim job.

### Logout dan pairing ulang

1. Klik **Logout** pada account aktif.
2. Pastikan status menjadi `LOGGED_OUT` dan pengiriman nonaktif.
3. Klik **Pairing**, masukkan kode baru, lalu aktifkan kembali account.

- [ ] Sesi lama tidak tersambung otomatis setelah logout.
- [ ] Pairing ulang menghasilkan sesi baru yang sehat.

## 3. Health dan recovery

1. Hentikan worker dan tunggu heartbeat berumur lebih dari 30 detik.
2. Pastikan banner masalah WhatsApp muncul.
3. Jalankan worker kembali.

- [ ] Banner hilang maksimal sekitar 3 detik setelah endpoint kembali `HEALTHY`.
- [ ] Toast pemulihan muncul tepat satu kali.

Kemudian buat satu job berstatus `FAILED`.

- [ ] Banner tetap terlihat walaupun koneksi sudah `HEALTHY`.
- [ ] Banner menjelaskan adanya job gagal dan menyediakan tautan ke antrean bagi role yang berhak.
- [ ] Setelah job diulang atau dibatalkan, banner hilang otomatis pada polling berikutnya tanpa reload manual.

Buka Network panel, lalu pindahkan tab ke background selama lebih dari 10 detik.

- [ ] Request health berhenti ketika tab tersembunyi.
- [ ] Polling langsung dilanjutkan ketika tab terlihat kembali.
- [ ] Tidak ada request health lama yang tetap berjalan bersamaan.

## 4. Queue dan kegagalan

### Antrean saat worker mati

1. Matikan worker.
2. Kirim satu pesan manual.
3. Jalankan worker kembali.

- [ ] Job tetap tersimpan selama worker mati.
- [ ] Setelah worker hidup, penerima mendapat pesan tepat satu kali.
- [ ] Job berakhir `COMPLETED` dan message berakhir minimal `SENT`.

### Status dan tindakan manual

- [ ] Paksa kegagalan sementara dan pastikan job masuk `RETRY` dengan `attempts`, `nextAttemptAt`, dan alasan gagal.
- [ ] Paksa kegagalan permanen dan pastikan job masuk `FAILED` tanpa retry tanpa batas.
- [ ] Klik **Ulangi** pada job `FAILED`, lalu pastikan job diproses lagi tanpa menghapus riwayat.
- [ ] Batalkan job yang masih dapat dibatalkan dan pastikan status menjadi `CANCELLED`.
- [ ] Alasan gagal tampil di antrean dan bubble pesan yang gagal.

### Worker berhenti saat pemrosesan

1. Kirim pesan dan hentikan worker ketika job `PROCESSING` atau message `SENDING`.
2. Jalankan worker kembali.

- [ ] Status ambigu terlihat sebagai masalah yang perlu ditindaklanjuti.
- [ ] Sistem tidak diam-diam mengirim pesan duplikat.

## 5. Fitur yang belum diuji

### Invoice PDF dan worker secret

- [ ] Kirim invoice `ISSUED` dari UI CRM.
- [ ] Worker mengambil PDF dengan header otorisasi worker secret yang benar.
- [ ] Request tanpa secret atau dengan secret salah ditolak.
- [ ] Secret tidak muncul di URL, HTML, log browser, atau nama file.
- [ ] Penerima mendapat satu PDF dengan nama dan caption yang benar.

### Receipt

- [ ] Pesan outbound berubah dari `SENT` menjadi `DELIVERED` ketika diterima perangkat tujuan.
- [ ] Status berubah menjadi `READ` setelah pesan dibuka bila receipt tersedia.
- [ ] Event receipt berulang tidak membuat message baru.

### Nomor belum dikenal

- [ ] Pesan dari nomor yang tidak cocok dengan customer membuat percakapan tanpa customer.
- [ ] Percakapan dapat ditautkan ke customer existing.
- [ ] Percakapan dapat membuat customer baru dengan nomor terisi otomatis.
- [ ] Pilihan tautkan atau buat customer hilang setelah relasi terbentuk.

### Automasi dan idempotensi

- [ ] Uji trigger `NEXT_ACTION`, `REPEAT_ORDER`, `REACTIVATION`, `INVOICE_ISSUED`, dan `INVOICE_DUE` satu per satu.
- [ ] Pesan automasi di luar jam operasional dijadwalkan ke waktu kirim berikutnya.
- [ ] Pesan manual tetap dapat diproses tanpa aturan jam automasi.
- [ ] Restart worker tidak membuat job atau pesan automasi duplikat untuk idempotency key yang sama.

### Validasi file

- [ ] File yang bukan PDF, JPG, PNG, atau WebP ditolak sebelum job dibuat.
- [ ] File dengan ekstensi atau MIME palsu ditolak berdasarkan isi file.
- [ ] File di atas 10 MB ditolak sebelum upload atau pembuatan job.

### Otorisasi langsung

- [ ] Sales tidak dapat membuka conversation atau media milik Sales lain melalui URL langsung.
- [ ] Sales hanya dapat membuka conversation customer yang menjadi tanggung jawabnya.
- [ ] Role non-CRM tidak dapat membuka inbox, endpoint pesan, endpoint media, atau server action WhatsApp.
- [ ] Respons endpoint pesan tidak memuat remote JID, path storage, payload job, token, secret, atau data auth.

## 6. Performa chat

1. Buka Network panel dan pertahankan tab tetap terlihat.
2. Buka chat A, lalu chat B untuk mengisi cache.
3. Kembali ke chat A.

- [ ] Pesan chat A tampil langsung tanpa blank state atau skeleton.
- [ ] Setelah data cache tampil, hanya satu revalidasi chat A yang berjalan.
- [ ] Pesan chat B tidak pernah terlihat sementara ketika chat A dipilih.
- [ ] Chat yang belum pernah dibuka hanya menampilkan skeleton pada panel timeline, bukan pada seluruh halaman.
- [ ] Hover dan fokus keyboard pada link chat memulai prefetch pesan.
- [ ] Polling pesan aktif berjalan sekitar setiap 3 detik dan berhenti ketika tab tersembunyi.
- [ ] Refresh daftar percakapan berjalan sekitar setiap 10 detik tanpa mengosongkan cache pesan.
- [ ] Back dan forward browser mengembalikan conversation yang sesuai tanpa reload penuh.
- [ ] Navigasi dengan Tab dan Enter bekerja serta fokus terlihat jelas.
- [ ] Layout mobile tidak overflow dan perpindahan chat tetap dapat digunakan.
- [ ] Pesan baru muncul ketika chat aktif tanpa mengubah chat yang dipilih.

## 7. Bukti hasil testing

Untuk setiap skenario, simpan waktu, environment, role tester, ID terkait, screenshot, status akhir, dan potongan log worker yang sudah disamarkan. Jangan simpan nomor lengkap, isi pesan sensitif, `.data/baileys-auth`, pairing credential, `SUPABASE_SECRET_KEY`, atau `WHATSAPP_WORKER_SECRET`.

## 8. Pemeriksaan sebelum merge

- [ ] `npm test`
- [ ] `npx prisma validate`
- [ ] `npm run db:generate`
- [ ] `npx tsc --noEmit`
- [ ] ESLint file WhatsApp yang berubah lulus.
- [ ] `git diff --check`
- [ ] Smoke test desktop dan mobile lulus.

Catat hasil dan bukti yang aman di pull request. Ulangi pengujian production hanya dengan nomor bisnis yang telah disetujui dan jadwal pengiriman yang disepakati.
