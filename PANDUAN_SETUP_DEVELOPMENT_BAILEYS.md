# Panduan Setup dan Development WhatsApp Baileys

Panduan ini menjelaskan cara mengembangkan fitur WhatsApp ASKonveksi dengan dua developer. Dokumen ini dibuat untuk kebutuhan development sehari-hari. Rancangan teknis dan daftar pekerjaan lengkap tetap berada di [WHATSAPP_BAILEYS_INTEGRATION_PLAN.md](WHATSAPP_BAILEYS_INTEGRATION_PLAN.md).

## Jawaban Singkat

Baileys tidak perlu di-hosting sebelum development dimulai. Pada tahap awal, Next.js dan worker Baileys dapat dijalankan di komputer developer.

Worker baru perlu di-hosting ketika fitur dasar sudah berjalan dan tim mulai menguji hal-hal yang membutuhkan proses hidup terus-menerus, seperti:

- koneksi WhatsApp selama 24 jam;
- reconnect setelah koneksi terputus;
- cron dan follow-up otomatis;
- persistent auth setelah server restart;
- retry pesan gagal;
- pengujian bersama dari dua komputer.

Karena Next.js ASKonveksi berada di Vercel, Baileys nantinya tetap harus di-hosting sebagai worker terpisah. Vercel tidak cocok untuk mempertahankan koneksi WebSocket Baileys dalam waktu lama.

## Gambaran Cara Kerjanya

Next.js dan Baileys memiliki tugas yang berbeda:

```text
Next.js di Vercel
  menerima perintah dari user dan menyimpan pesan ke antrean database
                         |
                         v
                 Supabase Postgres
                         |
                         v
Baileys worker
  mengambil antrean, mengirim pesan, dan menerima balasan WhatsApp
```

Next.js tidak mengirim pesan langsung ke WhatsApp. Next.js hanya membuat data antrean. Worker Baileys membaca antrean tersebut, mengirim pesannya, lalu memperbarui status menjadi sent, delivered, read, atau failed.

Pemisahan ini membuat aplikasi Vercel tetap sederhana dan mencegah pesan hilang ketika request Next.js selesai.

## Istilah yang Perlu Dipahami

**Worker** adalah program Node.js yang terus berjalan di background. Worker inilah yang menjaga koneksi Baileys tetap aktif.

**Auth state** adalah kumpulan credential dan Signal key milik sesi WhatsApp. Anggap data ini seperti password. Siapa pun yang memilikinya berpotensi mengambil alih sesi WhatsApp.

**Nomor staging** adalah nomor WhatsApp khusus pengujian. Jangan langsung memakai nomor utama bisnis ketika fitur masih dikembangkan.

**Outbox atau antrean** adalah tabel database berisi pesan yang menunggu dikirim oleh worker.

## Kondisi Repository Saat Ini

Repository sudah menyediakan dependency Baileys, schema dan migration WhatsApp, entrypoint worker, script development, inbox, pengaturan account/template, monitoring job, serta integrasi customer, follow-up, dan invoice. Migration database, bucket Storage, environment, dan pairing nomor tetap perlu dilakukan pada masing-masing environment sebelum worker dijalankan.

## Yang Perlu Disiapkan

### Untuk Setiap Developer

- Node.js 20 atau lebih baru.
- Repository ASKonveksi yang sudah dapat dijalankan.
- File environment lokal yang terhubung ke database development.
- Hak akses ke project Supabase development.
- Branch Git masing-masing.

### Untuk Tim

- Satu nomor WhatsApp khusus staging.
- Satu database Supabase development atau staging.
- Bucket private `whatsapp-media` setelah migration fitur dibuat.
- Satu developer yang bertanggung jawab menjalankan koneksi Baileys.
- Managed container untuk tahap integration testing, misalnya Railway, Render, atau Fly.io.

Nomor staging sebaiknya bukan nomor pribadi dan bukan nomor utama yang sedang digunakan untuk operasional customer.

## Aturan Terpenting untuk Dua Developer

Jangan menjalankan nomor WhatsApp dan auth state yang sama pada dua komputer secara bersamaan.

Contoh yang harus dihindari:

```text
Laptop Developer 1 -> nomor staging 62812xxxx
Laptop Developer 2 -> nomor staging 62812xxxx
```

Dua koneksi terhadap sesi yang sama dapat menyebabkan session conflict, disconnect, logout, atau status pesan yang tidak konsisten.

Gunakan pola berikut:

```text
Developer 1
  menjalankan worker dan memegang sesi nomor staging

Developer 2
  menjalankan Next.js dan mengembangkan UI dengan database development
  tidak menjalankan socket untuk nomor staging yang sama
```

Developer 2 tetap dapat mengerjakan inbox, template, halaman account, dan status pesan dengan data seed atau job dummy. Worker hanya dibutuhkan ketika ingin menguji komunikasi WhatsApp sungguhan.

## Pembagian Kerja yang Disarankan

### Developer 1: Database dan Worker

Fokus pekerjaan:

- Prisma schema dan migration;
- tabel account, conversation, message, dan automation job;
- normalisasi nomor;
- queue dan idempotency;
- koneksi dan reconnect Baileys;
- pairing code;
- pengiriman dan penerimaan pesan;
- cron, retry, receipt, dan media handling.

### Developer 2: Next.js dan UI

Fokus pekerjaan:

- inbox WhatsApp;
- composer chat;
- halaman account, template, dan monitoring job;
- integrasi customer dan opportunity;
- integrasi halaman follow-up;
- pengiriman invoice;
- badge unread dan navigasi;
- responsive UI serta accessibility.

Sebelum bekerja paralel, merge kontrak Prisma dan type status terlebih dahulu. Setelah itu kedua developer memakai bentuk data yang sama dan tidak perlu menebak field milik bagian lain.

Hindari kedua developer mengubah file migration atau lifecycle worker yang sama secara bersamaan.

## Setup Development Lokal

### 1. Jalankan Aplikasi Existing

Ikuti setup utama pada [README.md](README.md). Pastikan login, database, Prisma, dan Supabase sudah bekerja sebelum menambahkan Baileys.

Secara umum aplikasi dijalankan dengan:

```bash
npm run dev
```

### 2. Install Dependency Baileys

Langkah ini dilakukan sekali oleh developer yang mengimplementasikan worker, lalu perubahan `package.json` dan lockfile di-commit.

Project ini memakai Baileys `7.0.0-rc14` secara exact. Setelah menarik branch fitur, setiap developer cukup menjalankan:

```bash
npm install
```

Jangan mengambil dependency langsung dari branch GitHub `master` dan jangan mengubah versinya hanya pada satu laptop.

Baileys dan peer dependency yang dipakai harus di-install melalui npm agar `package-lock.json` ikut diperbarui.

### 3. Siapkan Environment Worker

Tambahkan konfigurasi berikut ke environment lokal. Nilai sebenarnya tidak boleh masuk Git.

```dotenv
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
WHATSAPP_AUTH_PATH=.data/baileys-auth
WHATSAPP_TIMEZONE=Asia/Jakarta
WHATSAPP_WORKER_ID=developer-1
WHATSAPP_WORKER_SECRET=ganti-dengan-random-secret-minimal-32-karakter
WHATSAPP_HEALTH_PORT=3001
WHATSAPP_MEDIA_BUCKET=whatsapp-media
```

`WHATSAPP_WORKER_ID` harus berbeda untuk setiap komputer. Nilai ini membantu mendeteksi worker mana yang sedang memegang job atau koneksi.

### 4. Lindungi Auth State Lokal

Ketika implementasi worker dimulai, tambahkan `.data/` ke `.gitignore`.

Struktur lokal yang disarankan:

```text
.data/
  baileys-auth/
    <whatsapp-account-id>/
```

Jangan pernah:

- melakukan commit folder tersebut;
- mengunggahnya ke cloud drive;
- mengirimkannya melalui WhatsApp atau chat tim;
- memasukkannya ke screenshot;
- menyalinnya ke laptop developer lain;
- mencetak isinya ke log.

Jika developer lain perlu mengambil alih nomor staging, logout atau hentikan worker lama lalu lakukan pairing ulang dari komputer atau worker baru.

### 5. Terapkan Migration dan Storage

Setelah schema WhatsApp selesai dibuat:

```bash
npx prisma migrate deploy
npm run db:generate
```

Buat bucket Supabase private bernama `whatsapp-media` melalui script setup:

```bash
npm run crm:setup-storage
```

Jangan membuat bucket public karena isinya dapat berupa dokumen invoice dan media customer.

### 6. Jalankan Next.js dan Worker

Setelah script worker tersedia, buka dua terminal.

Terminal pertama:

```bash
npm run dev
```

Terminal kedua:

```bash
npm run whatsapp:worker:dev
```

Worker menyediakan health check di `http://localhost:3001/health`. Status akan menjadi `ok` setelah siklus worker pertama selesai.

### 7. Hubungkan Nomor Staging

Setelah halaman account WhatsApp selesai dibuat:

1. Login sebagai OWNER atau ADMIN.
2. Buka halaman Data Master WhatsApp Account.
3. Tambahkan nomor staging dalam format kode negara, misalnya `6281234567890`.
4. Minta pairing code.
5. Masukkan pairing code melalui aplikasi WhatsApp pada ponsel.
6. Tunggu status berubah menjadi `CONNECTED`.
7. Aktifkan nomor tersebut sebagai nomor pengirim.

Jangan menggunakan format `+62`, spasi, tanda kurung, atau tanda hubung saat meminta pairing code.

## Cara Kerja Sehari-hari

### Ketika Developer 1 Menjalankan Worker

1. Pastikan tidak ada worker staging yang sedang hidup di hosting.
2. Jalankan Next.js bila perlu.
3. Jalankan worker lokal.
4. Periksa bahwa account berubah menjadi `CONNECTED`.
5. Uji dengan nomor penerima yang memang disiapkan untuk testing.
6. Hentikan worker dengan graceful shutdown setelah selesai.

### Ketika Developer 2 Mengerjakan UI

Developer 2 tidak perlu menjalankan Baileys untuk sebagian besar pekerjaan UI. Gunakan data database untuk mensimulasikan:

- conversation kosong dan berisi;
- inbound dan outbound message;
- status queued, sent, delivered, read, dan failed;
- nomor asing;
- account offline;
- customer opt-out;
- attachment gambar dan dokumen.

Jangan membuat tombol yang diam-diam mengirim WhatsApp sungguhan hanya untuk melihat state UI.

### Ketika Keduanya Perlu Integration Testing

Gunakan worker staging yang sudah di-hosting. Kedua developer dapat membuka deployment Vercel preview atau aplikasi lokal yang menggunakan database staging, sedangkan hanya hosted worker yang memegang sesi WhatsApp.

```text
Developer 1 ----\
                 -> database staging -> satu hosted Baileys worker
Developer 2 ----/
```

## Kapan Worker Harus Mulai Di-hosting?

Worker tidak perlu di-hosting pada hari pertama. Deploy staging dilakukan setelah kemampuan berikut bekerja secara lokal:

- pairing nomor;
- menyimpan auth state;
- mengirim teks;
- menerima teks;
- menyimpan message ID;
- memproses job tanpa duplikasi;
- reconnect dasar.

Setelah itu, pengujian berikut harus dilakukan di hosted staging:

- worker hidup dalam waktu lama;
- restart container tidak meminta pairing ulang;
- cron berjalan tanpa laptop developer;
- job tertunda dikirim pada pukul 09.00-17.00 WIB;
- retry tidak menghasilkan pesan ganda;
- koneksi pulih setelah gangguan jaringan;
- media dan PDF invoice dapat dikirim;
- status delivered/read masuk kembali ke ERM.

## Setup Hosted Staging

Siapkan satu service worker pada provider managed container dengan konfigurasi:

- satu replica;
- Node.js 20 atau lebih baru;
- persistent encrypted volume;
- always-on process;
- restart otomatis;
- health check;
- environment staging;
- akses ke Supabase staging.

Mount persistent volume ke:

```text
/data/baileys-auth
```

Gunakan environment:

```dotenv
WHATSAPP_AUTH_PATH=/data/baileys-auth
WHATSAPP_WORKER_ID=staging-worker-1
WHATSAPP_TIMEZONE=Asia/Jakarta
WHATSAPP_HEALTH_PORT=3001
```

Setelah hosted worker berhasil start:

1. Hentikan worker lokal yang memakai nomor staging.
2. Lakukan pairing ulang nomor staging pada hosted worker.
3. Jangan menjalankan worker lokal untuk nomor tersebut lagi.
4. Gunakan hosted worker sebagai satu-satunya koneksi selama integration testing.

## Setup Production

Production memakai service dan volume yang terpisah dari staging. Jangan menyalin auth state staging ke production.

Urutan rollout:

1. Deploy migration database.
2. Deploy UI dalam kondisi pengiriman dinonaktifkan.
3. Deploy production worker dengan satu replica.
4. Pair satu nomor bisnis.
5. Uji satu chat manual ke nomor internal.
6. Uji satu dokumen atau invoice.
7. Aktifkan pengiriman manual.
8. Aktifkan template otomatis satu per satu.
9. Pantau failed job, retry, disconnect, dan unread backlog.
10. Pair nomor cadangan tanpa mengaktifkannya sebagai pengirim.

Nomor cadangan hanya diaktifkan manual oleh OWNER/ADMIN setelah nomor lama dinonaktifkan.

## Checklist Sebelum Mulai Development

- [ ] Aplikasi existing berhasil dijalankan secara lokal.
- [ ] Kedua developer memiliki akses database development.
- [ ] Tim memiliki satu nomor khusus staging.
- [ ] Developer 1 ditetapkan sebagai pemilik worker lokal.
- [ ] Developer 2 memahami bahwa worker staging tidak boleh dijalankan dari laptop kedua.
- [ ] Kontrak schema dan status message/job sudah disepakati.
- [ ] Baileys `7.x` dan peer dependency sudah dipin.
- [ ] `.data/` sudah masuk `.gitignore` sebelum pairing pertama.
- [ ] Environment worker tersedia tanpa masuk Git.
- [ ] Database migration dan bucket private sudah siap.

## Checklist Sebelum Deploy Staging

- [ ] Pairing, send, receive, reconnect, dan idempotency lulus secara lokal.
- [ ] Managed container mendukung persistent encrypted volume.
- [ ] Service dikonfigurasi hanya satu replica.
- [ ] Worker lokal nomor staging sudah dihentikan.
- [ ] Secrets staging sudah dipasang pada provider.
- [ ] Auth directory tidak terdapat pada repository atau image.
- [ ] Kill switch account sudah berfungsi.

## Masalah yang Sering Terjadi

### Nomor Tiba-tiba Logout

- Periksa apakah nomor yang sama dijalankan di tempat lain.
- Periksa disconnect reason yang tersimpan.
- Jangan langsung menghapus auth state sebelum memastikan statusnya benar-benar logged out.
- Jika memang logout permanen, lakukan pairing ulang.

### Pesan Terkirim Dua Kali

- Periksa apakah dua worker sedang aktif.
- Periksa unique idempotency key pada job.
- Periksa apakah job lama di-retry setelah message ID sebenarnya sudah tersimpan.
- Jangan mengirim langsung dari Server Action dan worker sekaligus.

### Worker Lokal Terhubung, tetapi Hosted Worker Tidak

- Pastikan provider mengizinkan outbound WebSocket.
- Pastikan volume dapat ditulis dan tetap ada setelah restart.
- Pastikan hanya satu replica yang berjalan.
- Lakukan pairing dari hosted worker, bukan dengan menyalin auth directory melalui Git.

### UI Tidak Mendapat Pesan Baru

- Pastikan inbound event sudah masuk tabel message.
- Pastikan conversation sudah terhubung ke customer yang benar.
- Pastikan user SALES memang menjadi PIC customer tersebut.
- Periksa cache/revalidation atau polling inbox, bukan hanya status socket.

## Verifikasi Minimum

Sebelum perubahan digabungkan:

```bash
npm test
npm run db:validate
npm run db:generate
npm run lint
npm run build -- --webpack
```

Untuk worker, tambahkan pemeriksaan khusus yang membuktikan:

- satu job hanya diklaim satu kali;
- satu event inbound hanya membuat satu message;
- opt-out menghentikan pengiriman;
- job di luar jam operasional menunggu jadwal berikutnya;
- restart tidak menggandakan pesan;
- SALES tidak dapat membaca conversation milik PIC lain.

## Ringkasan Praktis

- Mulai development dengan Baileys lokal.
- Hanya satu developer yang menjalankan nomor staging.
- Developer lain tetap dapat mengerjakan UI menggunakan data development.
- Deploy worker staging setelah send/receive dan queue dasar stabil.
- Setelah staging aktif, hentikan worker lokal untuk nomor yang sama.
- Gunakan hosted worker untuk pengujian cron, reconnect, retry, dan kerja bersama.
- Pair nomor produksi hanya menjelang rollout.
