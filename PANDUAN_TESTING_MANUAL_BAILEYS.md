# Panduan Testing Manual WhatsApp Baileys

Dokumen ini dipakai untuk menguji integrasi WhatsApp di ASKonveksi dari awal sampai akhir. Jalankan pada database development/staging dan gunakan nomor WhatsApp khusus testing. Jangan memakai nomor utama bisnis.

## 0. Persiapan

- [ ] Pastikan Node.js dan dependency sudah terpasang: `npm install`.
- [ ] Pastikan `.env` berisi `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `WHATSAPP_AUTH_PATH`, `WHATSAPP_WORKER_ID`, `WHATSAPP_WORKER_SECRET`, `WHATSAPP_HEALTH_PORT`, dan konfigurasi Supabase Storage.
- [ ] Pastikan migration sudah diterapkan dan client sudah dibuat:

  ```bash
  npx prisma migrate status
  npm run db:generate
  ```

- [ ] Pastikan bucket private `whatsapp-media` tersedia.
- [ ] Siapkan dua akun WhatsApp: nomor bisnis staging sebagai pengirim dan nomor pribadi tester sebagai penerima.
- [ ] Isi customer testing dengan nomor penerima dalam format `628...`, nama, dan perusahaan.
- [ ] Catat ID customer, invoice, opportunity, account WhatsApp, dan job yang dibuat selama pengujian.
- [ ] Hanya satu worker yang boleh memakai database dan nomor staging pada satu waktu. Dua developer tidak boleh menjalankan sesi Baileys yang sama.

## 1. Menjalankan aplikasi

Buka dua terminal dari root repository.

Terminal aplikasi:

```bash
npm run dev
```

Terminal worker:

```bash
npm run whatsapp:worker:dev
```

Checklist:

- [ ] Next.js berjalan di `http://localhost:3000`.
- [ ] Worker tidak menampilkan error koneksi database, lock, atau konfigurasi.
- [ ] `curl -i http://localhost:3001/health` mengembalikan HTTP `200` dan JSON `{"status":"ok"}` setelah maksimal satu menit.
- [ ] Jika worker kedua dijalankan, worker kedua gagal mengambil advisory lock. Hentikan worker kedua dan lanjutkan dengan satu worker saja.

## 2. Membuat dan pairing account

1. Login sebagai `OWNER` atau `ADMIN`.
2. Buka **Master Data > WhatsApp > Account**.
3. Tambahkan account baru dengan label, misalnya `Staging`, dan nomor pengirim tanpa tanda `+`.
4. Klik **Pairing**.
5. Tunggu worker mengambil permintaan pairing.
6. Di WhatsApp pada ponsel pengirim, buka **Perangkat tertaut > Tautkan perangkat**, lalu masukkan pairing code yang tampil di halaman.

Hasil yang diharapkan:

- [ ] Account berubah dari `DISCONNECTED/PAIRING` menjadi `CONNECTED`.
- [ ] Pairing code hilang setelah koneksi terbuka atau setelah kedaluwarsa.
- [ ] `heartbeatAt` pada halaman account terus diperbarui.
- [ ] Folder auth lokal terbentuk di `WHATSAPP_AUTH_PATH/<account-id>` dan tidak masuk Git.
- [ ] Refresh halaman tidak menghilangkan status koneksi.

Uji reconnect:

- [ ] Matikan koneksi internet ponsel sementara, lalu hidupkan kembali.
- [ ] Worker mengubah status sementara menjadi `DISCONNECTED` lalu kembali `CONNECTED` tanpa pairing ulang.
- [ ] Hentikan dan jalankan worker kembali. Sesi tetap terhubung karena auth state tersimpan.

Uji logout:

- [ ] Klik **Logout** pada account.
- [ ] Status menjadi `LOGGED_OUT`, `sendEnabled` menjadi nonaktif, dan sesi tidak otomatis tersambung lagi.
- [ ] Untuk memakai kembali nomor tersebut, lakukan pairing ulang.

## 3. Mengaktifkan nomor pengirim

- [ ] Pada account yang `CONNECTED`, klik **Jadikan aktif**.
- [ ] Pastikan hanya satu account yang memiliki `sendEnabled` aktif.
- [ ] Account yang belum `CONNECTED` tidak dapat diaktifkan.
- [ ] Jika tidak ada account aktif, pengiriman dari UI menampilkan pesan bahwa belum ada nomor pengirim.

## 4. Membuat dan menguji template

1. Buka **Master Data > WhatsApp > Template**.
2. Buat template dengan trigger `MANUAL`, misalnya:

   ```text
   Halo {{customer_name}}, ini pesan dari {{business_name}}.
   ```

3. Simpan template dan gunakan dari inbox.

Checklist:

- [ ] Template tampil pada daftar dan dapat diedit.
- [ ] Template nonaktif tidak muncul sebagai pilihan pengiriman.
- [ ] Variabel yang didukung dirender menjadi nilai sebenarnya, bukan teks `{{...}}`.
- [ ] Variabel yang tidak dikenal ditolak dengan pesan error yang jelas.
- [ ] Template kosong atau melebihi batas input ditolak.
- [ ] Buat juga template untuk `NEXT_ACTION`, `REPEAT_ORDER`, `REACTIVATION`, `INVOICE_ISSUED`, dan `INVOICE_DUE` untuk pengujian automasi.

## 5. Menguji pesan manual dari inbox

1. Pastikan customer memiliki nomor WhatsApp yang valid.
2. Buka **WhatsApp** dari navigasi atau tombol WhatsApp pada detail customer.
3. Jika percakapan belum ada, gunakan **Buka inbox** untuk membuat percakapan.
4. Kirim pesan teks biasa.
5. Pilih template lalu kirim pesan lain.

Periksa tiga tempat berikut:

- [ ] Ponsel penerima menerima pesan satu kali.
- [ ] Inbox menampilkan pesan outbound dan status awal `SENT`.
- [ ] **Antrean WhatsApp** menampilkan job `COMPLETED` setelah worker memprosesnya.
- [ ] Status dapat berubah menjadi `DELIVERED` atau `READ` setelah penerima membuka pesan.
- [ ] Communication activity customer mencatat pesan outbound.
- [ ] Mengklik kirim dua kali tidak menghasilkan dua job yang sama untuk satu submit.

Uji validasi:

- [ ] Nomor kosong atau format tidak valid ditolak.
- [ ] Pesan kosong tanpa lampiran ditolak.
- [ ] Customer archived ditolak.
- [ ] Sales tidak dapat melihat atau mengirim ke customer sales lain.
- [ ] Role yang tidak berhak tidak dapat membuka action pengiriman dengan memanggil request secara langsung.

## 6. Menguji lampiran gambar dan dokumen

- [ ] Dari inbox, kirim satu PDF kecil.
- [ ] Kirim satu gambar JPG/PNG/WEBP kecil.
- [ ] Pastikan penerima menerima file dan caption.
- [ ] Pastikan nama file, tipe MIME, ukuran, dan status tersimpan.
- [ ] Buka lampiran inbound dari inbox; route media hanya memberi akses kepada user yang berhak.
- [ ] Coba file tipe yang tidak diizinkan dan file lebih besar dari batas; sistem harus menolak sebelum membuat job.
- [ ] Pastikan file tersimpan di bucket private, bukan URL publik.

## 7. Menguji pengiriman invoice

1. Pastikan ada invoice berstatus `ISSUED` untuk customer testing.
2. Buka **CRM > Invoice**.
3. Klik tombol kirim WhatsApp pada invoice.
4. Tunggu worker memproses job.

Hasil yang diharapkan:

- [ ] Job menyimpan `invoiceId` dan payload attachment bertipe invoice.
- [ ] Worker mengambil PDF melalui endpoint invoice dengan secret worker.
- [ ] Penerima menerima satu dokumen PDF dengan nama invoice dan caption template.
- [ ] Job menjadi `COMPLETED`; pesan menjadi `SENT`/`DELIVERED`/`READ`.
- [ ] Invoice yang bukan `ISSUED` tidak dapat dikirim.
- [ ] Customer tanpa nomor atau archived ditolak.
- [ ] Secret worker tidak terlihat di URL, HTML, atau log browser.

## 8. Menguji cron dan follow-up otomatis

Gunakan data testing dengan waktu jadwal yang sudah lewat atau jadwalkan beberapa menit ke depan. Jangan mengubah data customer produksi.

### Next action opportunity

- [ ] Buat opportunity pada stage yang mendukung follow-up dan isi `nextActionAt`.
- [ ] Pastikan template `NEXT_ACTION` aktif.
- [ ] Setelah satu siklus worker, job `NEXT_ACTION` dibuat.
- [ ] Job memakai idempotency key yang sama saat worker dijalankan ulang.
- [ ] Tidak ada job duplikat untuk opportunity dan waktu yang sama.

### Reminder customer

- [ ] Buat reminder yang sudah jatuh tempo.
- [ ] Pastikan template sesuai jenis reminder aktif.
- [ ] Worker membuat job reminder dan mengirimkannya.
- [ ] Ubah jadwal atau generation reminder, lalu pastikan job lama dibatalkan dan job baru dibuat.

### Invoice issued dan invoice due

- [ ] Terbitkan invoice dan aktifkan template `INVOICE_ISSUED`; satu job invoice issued dibuat.
- [ ] Siapkan invoice belum lunas dengan due date yang sudah memenuhi aturan; job `INVOICE_DUE` dibuat untuk offset yang sesuai.
- [ ] Invoice lunas tidak menghasilkan reminder jatuh tempo.
- [ ] Jalankan worker beberapa kali; idempotency tetap mencegah pesan ganda.

## 9. Menguji retry dan kegagalan

1. Matikan worker atau putuskan koneksi nomor pengirim.
2. Buat kiriman manual.
3. Buka **WhatsApp > Antrean WhatsApp**.

Checklist:

- [ ] Job tidak hilang; status menjadi `RETRY` ketika kegagalan masih dapat dicoba ulang.
- [ ] `attempts`, `nextAttemptAt`, dan `lastError` terisi.
- [ ] Setelah worker/connection pulih, job terkirim dan menjadi `COMPLETED`.
- [ ] Klik **Ulangi** pada job `FAILED`/`CANCELLED` membuat job dapat diproses kembali tanpa menghapus riwayat.
- [ ] Error permanen seperti nomor invalid, opt-out, atau konfigurasi tidak masuk retry tanpa batas.
- [ ] Jika proses berhenti saat status `SENDING`, worker berikutnya tidak membuat pesan ganda secara diam-diam; status ambigu harus terlihat sebagai error untuk ditindaklanjuti.

## 10. Menguji pesan masuk

1. Dari nomor tester, balas ke nomor staging.
2. Tunggu worker menerima event inbound.

Hasil yang diharapkan:

- [ ] Percakapan baru muncul di inbox dengan unread count bertambah.
- [ ] Pesan inbound tersimpan satu kali meskipun event diterima ulang.
- [ ] Customer otomatis terhubung jika nomor cocok.
- [ ] Pesan inbound tercatat di communication activity.
- [ ] Pesan gambar/dokumen tersimpan ke Storage private dan dapat dibuka dari inbox.
- [ ] Klik **Tandai dibaca** mengurangi unread count sesuai perilaku halaman.
- [ ] Klik **Selesaikan** menandai percakapan resolved; pesan baru membukanya kembali.

## 11. Menguji role dan keamanan

Ulangi smoke test dengan akun berikut:

- [ ] `OWNER`: dapat mengatur account/template, inbox, job, dan pengiriman.
- [ ] `ADMIN`: dapat mengatur fitur sesuai permission aplikasi.
- [ ] `ADMIN_CUSTOMER`: dapat memakai CRM, customer, invoice, dan WhatsApp yang diizinkan.
- [ ] `ADMIN_PRODUCTION`: diarahkan ke produksi dan tidak memperoleh akses CRM/WhatsApp yang tidak diizinkan.
- [ ] `SALES`: hanya melihat customer dan percakapan yang menjadi tanggung jawabnya.
- [ ] `PRODUCTION`, `QC`, dan `DESIGNER`: tidak dapat menjalankan action WhatsApp yang tidak diberikan.

Untuk setiap role, uji akses langsung ke URL dan server action, bukan hanya visibilitas tombol. Hasil yang diharapkan adalah redirect atau error permission, tanpa perubahan database.

## 12. Bukti hasil testing

Untuk setiap tahap yang lulus, simpan:

- waktu dan environment;
- role tester;
- account ID dan nomor staging (boleh disamarkan);
- customer/invoice/job ID;
- screenshot halaman yang relevan;
- potongan log worker tanpa auth state, token, secret, atau isi pesan sensitif;
- status akhir job dan pesan.

Jangan mengunggah folder `.data/baileys-auth`, QR/pairing credential, `SUPABASE_SECRET_KEY`, `WHATSAPP_WORKER_SECRET`, atau isi database customer ke issue tracker.

## 13. Smoke test sebelum merge/deploy

- [ ] `npm test`
- [ ] `npx prisma validate`
- [ ] `npx prisma generate`
- [ ] `npx tsc --noEmit`
- [ ] Pairing nomor staging berhasil.
- [ ] Pesan teks dan invoice PDF berhasil.
- [ ] Pesan inbound muncul di inbox.
- [ ] Satu automasi follow-up menghasilkan satu job dan satu pesan.
- [ ] Opt-out memblokir semua pengiriman.
- [ ] Retry setelah worker offline berhasil.
- [ ] Tidak ada secret atau auth state masuk Git.

Jika semua checklist selesai, catat hasilnya di pull request. Untuk pengujian production, ulangi smoke test dengan nomor bisnis yang sudah mendapat persetujuan dan jadwal pengiriman yang disepakati.
