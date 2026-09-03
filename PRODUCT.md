# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Owner, yang membutuhkan ringkasan kondisi bisnis dan visibilitas lintas divisi tanpa harus meminta laporan satu per satu.
- Admin/CS, yang mengelola customer, lead, dokumen pesanan, pembayaran awal, dan Deal.
- Sales/Marketing, yang mengelola lead, follow-up, PO customer, invoice konveksi, dan progres negosiasi.
- Finance, yang nantinya mengelola invoice, pembayaran, serta transaksi keuangan.
- Purchasing, yang nantinya mengelola supplier, purchase request, purchase order, dan penerimaan barang.
- Produksi, yang nantinya mengelola work order dan progres produksi.
- QC, yang nantinya mencatat pemeriksaan kualitas.
- Gudang, yang nantinya mengelola stok dan barang masuk.
- HR/Admin, yang nantinya mengelola data karyawan dan absensi.

Pengguna utama versi pertama adalah Owner dan Admin/CS. Struktur peran lengkap di atas tetap menjadi konteks produk untuk pengembangan bertahap. Setiap pengguna hanya boleh melihat atau mengubah data sesuai kewenangannya; misalnya, Admin tidak boleh mengubah transaksi keuangan yang sudah final.

## Product Purpose

ERM Askonveksi adalah pusat data operasional terpadu untuk perusahaan konveksi. Produk ini menghubungkan perjalanan customer dan order dari CRM hingga penjualan, produksi, pengiriman, dan keuangan dalam satu sumber data.

Produk bertujuan mengurangi pencatatan manual dan kesalahan input, mencegah order terlewat, memperlihatkan posisi setiap order, serta membantu Owner memahami kondisi bisnis secara cepat. Keberhasilan berarti tim dapat menjalankan pekerjaan dari data yang sama dan Owner dapat memantau bisnis tanpa meminta pembaruan manual dari setiap divisi.

## Positioning

ERM Askonveksi bukan kumpulan aplikasi divisi yang berdiri sendiri. Mekanisme utamanya adalah satu database terintegrasi: customer yang sama mengalir dari CRM ke Sales Order dan modul lanjutan, sementara setiap perubahan status atau transaksi dapat menjadi masukan otomatis bagi proses berikutnya.

Produk dirancang khusus mengikuti alur kerja bisnis konveksi, termasuk detail pesanan custom, desain dan persetujuan customer, kebutuhan bahan, tahapan produksi, QC, packing, dan pengiriman.

## Operating Context

- Lead berasal dari input internal maupun formulir landing page, kemudian masuk ke CRM sebagai Lead Baru.
- Satu kartu CRM mewakili satu peluang dengan alur Lead Baru, Follow Up, Negosiasi, Deal, atau Lost.
- PO customer mulai dicatat saat Negosiasi dan memuat satu bahan, desain, ukuran, serta jumlah per ukuran.
- Invoice konveksi mengikuti ukuran dan jumlah PO Disepakati, lalu menambahkan harga per ukuran.
- Admin memindahkan peluang ke Deal setelah pembayaran Lunas atau DP dicatat. DP memiliki jadwal termin sisa yang totalnya harus sama dengan nilai invoice.
- Sales Order dibentuk sebagai snapshot immutable dari PO, invoice, dan pembayaran saat Deal.
- Owner menggunakan dashboard sebagai halaman pertama setelah login untuk memantau metrik bisnis, sales, order aktif, serta kondisi produksi.
- Sistem digunakan oleh beberapa divisi dengan tanggung jawab dan tingkat akses berbeda.
- Bahasa antarmuka dan konten produk adalah Bahasa Indonesia.

## Capabilities and Constraints

Fokus pengerjaan saat ini:

- Halaman login.
- Dashboard.
- CRM dan data customer.
- Landing page pengumpulan lead yang otomatis masuk ke CRM.

Scope Phase 1 juga mencakup Sales Order setelah fokus halaman di atas.

Persyaratan fondasi produk:

- Role-based access sesuai struktur pengguna.
- Audit log untuk mencatat siapa melakukan apa dan kapan.

Kemampuan CRM mencakup pencarian dan filter customer, reminder follow-up, riwayat komunikasi, revisi PO dan invoice, pencatatan pembayaran Deal, riwayat order beserta tanggal, total transaksi, order aktif, dan tanggal order terakhir.

Fase lanjutan mencakup pelunasan termin aktual, piutang, purchasing internal, produksi, QC, packing, pengiriman, keuangan, HR, absensi, notifikasi, dan laporan otomatis. Purchase Order pada CRM saat ini berarti permintaan pesanan dari customer, bukan PO ke supplier. Payroll tidak termasuk versi pertama.

Workflow produksi nantinya harus dapat dikonfigurasi. Data dan status antar-modul harus tetap terhubung dalam satu sumber data. Akses dan perubahan data sensitif harus dibatasi berdasarkan peran, dan transaksi yang sudah final tidak boleh bebas diubah.

Integrasi WhatsApp belum direncanakan untuk tahap development saat ini.

## Brand Commitments

- Nama produk: ERM Askonveksi.
- Bahasa produk: Bahasa Indonesia.
- Logo resmi AS Konveksi tersedia pada `public/brand/askonveksi-logo.png` dengan turunan simbol pada `public/brand/askonveksi-mark.png`.
- Warna asli logo dipertahankan sebagai identitas merek; warna tersebut tidak otomatis menjadi aksen dekoratif pada antarmuka produk yang tetap mengikuti sistem monokrom.

## Evidence on Hand

- Blueprint produk utama: `BLUEPRINT_ERM_ASKONVEKSI.md`.
- Blueprint memuat contoh alur end-to-end, struktur peran, metrik dashboard, pipeline CRM, struktur Sales Order, prioritas fase pembangunan, dan relasi antar-modul.
- Logo resmi tersedia pada `public/brand/`; belum ada testimonial, studi kasus, benchmark, atau klaim eksternal terverifikasi yang boleh difabrikasi.
- Implementasi saat ini masih berupa scaffold Next.js dengan halaman pengujian koneksi data; belum menjadi bukti rancangan produk final.

## Product Principles

1. Satu sumber data untuk seluruh perjalanan customer dan order.
2. Status pekerjaan harus terlihat tanpa bergantung pada pembaruan manual antar-divisi.
3. Setiap peran hanya memperoleh akses yang diperlukan untuk menjalankan tanggung jawabnya.
4. Perubahan penting harus dapat ditelusuri melalui audit log.
5. Pembangunan dilakukan bertahap tanpa memutus keterhubungan data antar-modul.

## Accessibility & Inclusion

Antarmuka harus memenuhi WCAG Level AA. Produk menggunakan Bahasa Indonesia dan harus tetap dapat dipahami oleh pengguna lintas divisi dengan tingkat kemampuan teknis yang beragam.
