# Panduan Singkat: Mengubah Isi Website

Panduan ini untuk pemilik website (Owner). Tidak perlu pengetahuan teknis.

## Masuk ke studio website

1. Masuk seperti biasa ke aplikasi.
2. Di menu kiri, buka grup **Website** lalu pilih **Kelola Website**.
3. Halaman **Kelola Website** menampilkan semua halaman yang bisa diedit.

Studio website memakai tampilan sendiri. Tombol **Kembali ke Aplikasi** ada di kiri bawah.

## Empat langkah mengubah isi

1. **Pilih halaman** yang ingin diubah (Beranda, Produk, Portofolio, Size Chart, Katalog Kain, Kontak, atau Pengaturan Website).
2. **Ganti foto** — tekan **Ganti gambar**, pilih file, isi **teks alternatif** (penjelasan singkat gambar untuk Google dan pembaca layar).
3. **Ganti teks** — tulis langsung di kolom. Pakai tombol di editor untuk **tebal, miring, garis bawah, daftar, dan tautan**.
4. **Tekan Simpan & Tayangkan** (atau `Ctrl/Cmd + S`). Perubahan langsung tampil di website.

Pratinjau di sisi kanan selalu memakai tulisan terbaru Anda, termasuk yang belum disimpan.

## Mengatur urutan dan menyembunyikan bagian

- Buka bagian **Urutan & bagian yang tampil** di halaman editor.
- Tombol **naik/turun** memindahkan bagian, ikon **mata** menyembunyikan atau menampilkan.
- Minimal satu bagian harus tetap tampil.
- Perubahan langsung terlihat di pratinjau.

## Menambah dan menghapus produk

1. Buka **Produk** → **Tambah produk**: isi nama, slug halaman (mis. `kaos-panjang`), dan induk bila produk itu bagian dari produk lain.
2. Produk baru **belum tayang**. Buka **Edit**, lengkapi isi, lalu nyalakan **Tampilkan halaman produk**.
3. Bila galeri masih kosong, halaman produk menampilkan overlay **Segera Hadir**.
4. Hapus produk dari daftar produk. Produk yang masih punya sub-produk tidak bisa dihapus sebelum sub-produknya dipindahkan.

Slug produk tidak bisa diubah setelah dibuat karena alamat halaman mengikutinya.

## Kalau salah edit

- Tekan **Batalkan** untuk kembali ke versi terakhir yang tersimpan (belum disimpan).
- Untuk mengembalikan versi lama: buka **Riwayat Perubahan**, tekan **Lihat** untuk memeriksa isinya, lalu **Pulihkan**. Riwayat tidak pernah terhapus.

## Catatan penting

- Perubahan di studio **langsung tayang** ke pengunjung setelah disimpan.
- Draft yang belum disimpan disimpan sementara di peramban Anda. Bila tab tertutup, Anda akan ditawari **Lanjutkan perubahan**.
- Satu halaman sebaiknya diedit oleh satu orang pada satu waktu. Bila ada yang menyimpan lebih dahulu, penyimpanan Anda akan ditolak dengan pesan agar memuat ulang.
- Nomor WhatsApp dipakai semua tombol WhatsApp di website. Ubah di **Pengaturan Website**.

## Untuk tim teknis

- Lokasi konten: `CMS_DATA_DIR/content.json` (default `./data/cms`), cadangan otomatis di `versions/`.
- Gambar: `CMS_UPLOAD_DIR` (default `./data/uploads`), disajikan lewat `/media/...`.
- Perintah: `npm run cms:setup`, `npm run cms:validate`, `npm run cms:backup`, `npm run cms:clean-orphans`.
- Semua akses studio hanya untuk role `OWNER` dan `DEVELOPER`; role lain mendapat 404.
