# Prompt Matang — Daftar Revisi Fitur (Penyempurnaan dari `PromptMentah.md`)

Dokumen ini adalah versi disempurnakan dari `PromptMentah.md`. Seluruh isi dan maksud tetap sama persis — hanya tata bahasa, istilah, dan penyesuaian terminologi yang disesuaikan dengan sistem saat ini (Next.js App Router, Prisma, shadcn). Ikuti urutan butir di bawah ini saat implementasi.

**Catatan terminologi sistem:**
- Menu sidebar: Dashboard, Keuangan (Pemasukan, Pengeluaran, Laporan), CRM (Pipeline, Follow-up, Purchase Order, Invoice, Sales Order), Prospek, Customer, WhatsApp, Campaign promo, Produksi, Detail Desain, Upload Desain, Analytics, Data Master, Pengaturan.
- "Produksi > Jersey/Non-Jersey" adalah toggle `JERSEY` / `NON_JERSEY` di halaman `/produksi`, bukan submenu sidebar.
- Referensi gambar: `Revisi1/Referensi1.png` dan `Revisi1/Referensi2.png`.
- Sesuai aturan proyek: setiap peran atau penyembunyian fitur tidak boleh memblokir role **DEVELOPER** (dan OWNER) — Developer selalu tetap bisa mengaksesnya.

---

## 1. Tabel Prospek — Kolom Status 2 Nilai + Kolom Baru "Tahap Pipeline"

Di halaman tabel prospek (menu **Prospek**, `/crm/prospek`):

- Kolom **Status** hanya boleh menampilkan 2 nilai:
  - **Prospek** — untuk semua record dengan stage apa pun selain Lost.
  - **Lost** — hanya untuk record yang stage-nya Lost.
- Tambahkan kolom baru **Tahap Pipeline** setelah kolom Status, berupa **teks biasa** (bukan badge/warna), yang menampilkan nama stage pipeline yang sebenarnya (Prospek, Follow Up, Negosiasi, Deal) berdasarkan data pipeline tiap record.

## 2. Semua Data Master — Tambah Aksi Hapus

Di seluruh halaman **Data Master** (Jenis customer, Sumber lead, Ukuran pakaian, Metode pembayaran, dan data master lainnya), tambahkan aksi **Hapus (Delete)** untuk tiap item.

- Item yang masih dipakai oleh data lain (customer, transaksi, dsb.) **tidak bisa dihapus** dan menampilkan pesan bahwa data masih digunakan.
- Role DEVELOPER (dan OWNER) tetap selalu bisa mengakses fitur ini.

## 3. Deadline PO — Tambah Opsi Bebas/Custom

Di form Purchase Order, dropdown **Deadline** ditambahkan opsi **bebas/custom** selain preset yang sudah ada (1 minggu, 2 minggu, 3 minggu, 1 bulan) — yaitu pilihan tanggal manual (date picker) sehingga deadline bisa diisi semaunya.

## 4. PO dan Invoice — Pembatalan Saat Status Draft

- **Purchase Order** dan **Invoice** yang berstatus **Draft** bisa dibatalkan menjadi status **Dibatalkan**.
- Pembatalan **hanya oleh Owner** (DEVELOPER tetap bisa mengakses).
- Setiap pembatalan wajib **menyimpan history/riwayat** (siapa yang membatalkan, kapan, dan alasannya), mengikuti pola pembatalan yang sudah ada di Sales Order.

## 5. Sidebar — Selalu Terbuka dan Tidak Bisa Ditutup

Semua grup/menu di sidebar yang saat ini bisa dilipat (collapsible), dibuat:

- **Default terbuka** saat halaman dimuat.
- **Dipaksa terbuka terus-menerus** — chevron/panah lipatan disembunyikan dan grup **tidak bisa ditutup** oleh user.

## 6. Keuangan > Pemasukan — Logo Persen di Margin

Di halaman **Keuangan > Pemasukan**, kolom **Margin** ditambahkan logo/simbol **% (persen)** di samping nilainya.

## 7. Form Keuangan — Label "Rp" di Samping Kotak Angka

Semua form yang berhubungan dengan keuangan (Nominal pengeluaran, komponen HPP, harga item invoice, pembayaran DP/Lunas, koreksi pembayaran, dll.) menambahkan label **Rp** di samping kotak input angka.

## 8. Keuangan > Laporan — Penamaan Total

Di halaman **Keuangan > Laporan**, penamaan angka menjadi:

- **Total Pemasukan Keseluruhan** — total seluruh pemasukan sepanjang waktu (tanpa batas tanggal).
- **Total Pengeluaran Keseluruhan** — total seluruh pengeluaran sepanjang waktu.
- **Total Pendapatan dari (tanggal) ke (tanggal)** — total pendapatan sesuai filter rentang tanggal.
- **Total Pengeluaran dari (tanggal) ke (tanggal)** — total pengeluaran sesuai filter rentang tanggal.

## 9. Keuangan > Pemasukan — Total di Footer Tabel

Di halaman **Keuangan > Pemasukan**, tambahkan **baris total keseluruhan di footer tabel** untuk masing-masing kolom angka, mulai dari **QTY hingga Lunas** (QTY, tiap komponen HPP, Total HPP, Diskon, Total Invoice, Laba Bersih, Margin, DP, Lunas).

## 10. Detail Desain > Edit Desain — Tombol "Upload Desain" (Menimpa)

Di halaman **Detail Desain > Edit Desain**:

- Tambahkan tombol baru **Upload Desain** yang sejajar dengan tombol Undo, Redo, dll.
- Upload yang baru **menimpa (overwrite) dan menghapus desain yang ada saat ini**, termasuk menghapus file lama di storage, agar tidak memenuhi storage.

## 11. Detail Desain > Edit Desain — Interaksi Garis/Panah Mirip Canva

Di editor **Edit Desain**:

- **Klik satu kali** di kanvas → muncul **garis**; ketika ditarik, garis tersebut **membentuk panah** (panah dengan kepala panah).
- Panah menampilkan **2 titik di masing-masing ujung garis/panah** yang bisa digeser untuk mengubah posisi ujungnya (mirip Canva).
- **Double klik** pada elemennya → muncul/muncul kembali **teks**-nya untuk diedit.

## 12. Produksi > Jersey/Non-Jersey — Kendala Selalu Tampil Saat Pindah Proses

Di papan **Produksi > Jersey/Non-Jersey**:

- Field **Kendala selalu tampil untuk semua perpindahan proses** — baik saat pindah **urut** maupun skip. Saat ini yang ada hanya field "Alasan" yang muncul ketika skip 1 proses; sekarang Kendala berlaku dan tersedia pada setiap pindah proses (diakses lewat Text Area Kendala di card kanban, lihat butir 13, dan tetap tampil pada pop-up verifikasi saat mundur), sementara "Alasan" lama di dialog dihapus.
- **Kendala bersifat Opsional** (tidak wajib diisi).

## 13. Produksi — Card Kanban: Kendala, Hapus "Perbarui Tahap", Aturan Verifikasi Pindah

Di card kanban papan produksi:

- Tambahkan bagian **Kendala** di bawah **PIC**, berupa **Text Area dalam kondisi freeze** (terkunci/hanya-baca), disertai tombol baru **Tambahkan Kendala**.
- Saat **Tambahkan Kendala** diklik → Text Area Kendala terbuka untuk diedit dan tombolnya **ditimpa oleh tombol Simpan**.
- Saat **Simpan** ditekan → kembali menjadi Text Area freeze dan tombolnya menjadi **Edit Kendala**.
- Kendala bersifat **Opsional**.
- Tombol **Perbarui Tahap di card dihapus**.
- Ketika memindahkan kanban **maju**: **hapus verifikasi "Simpan Progress"** — kartu langsung pindah tanpa pop-up konfirmasi.
- Ketika memindahkan kanban **mundur**: tetap **memunculkan pop-up verifikasi**.

## 14. CRM > Pipeline — Verifikasi Saat Pindah Status

Di papan **CRM > Pipeline**:

- Memindahkan kanban **maju (ke depan)**: **hapus verifikasi "Konfirmasi pindah status"** — langsung pindah tanpa pop-up.
- Memindahkan kanban **mundur (ke belakang)**: biarkan saja pop-up konfirmasinya tetap muncul.

## 15. CRM > Follow Up — Ganti Menjadi Tabel "Broadcast"

- Ganti UI halaman **CRM > Follow Up** menjadi **Tabel saja** (bukan daftar kartu seperti sekarang), dan **ganti nama "Follow Up" menjadi "Broadcast"** (termasuk nama menu di sidebar).
- Isi tabel: **No, Nama Customer, Kategori Customer, Pilih**.
- Kolom **Pilih** berupa **Checkbox** untuk masing-masing customer, karena digunakan untuk memilih siapa saja yang akan menerima **broadcast manual**.
- Inti fitur ini: memilih customer yang akan mendapat **broadcast Repeat Order** ketika **Admin Customer menekan tombol "Follow Up Hari Ini"** (customer yang dicentang = penerima broadcast).
- Untuk **semua customer di sistem**, default **Repeat Order diubah menjadi Off** — baik customer yang sudah ada maupun customer baru (data existing ikut diubah sekaligus).

## 16. Campaign Promo — Aksi "Pilih Customer" dan Seleksi Penerima

Di halaman **Campaign Promo**, tombol aksi per campaign isinya menjadi: **Pilih Customer, Edit, Hapus**.

- **Pilih Customer** membuka dialog/modal mengikuti pola gambar **Referensi1.png**, dengan:
  - Judul + deskripsi singkat, kolom **pencarian (search)**, dan **filter** di atas tabel: **Tanggal dari–ke, Kategori Customer, Kategori Order**.
  - Kolom tabel: **No, Nama Customer, Kategori Customer, Tanggal Terakhir Order (atau ketika membayar DP sesuatu), Pilih** (Checkbox per customer), mengikuti tampilan **Referensi2.png**.
  - Footer dialog menampilkan jumlah customer terpilih serta tombol Batal/Terapkan (seperti referensi).
- Hasil pilihan tersebut adalah **satu-satunya penerima campaign**: pesan hanya dikirim ke customer yang dicentang (bukan ke semua customer seperti saat ini). Jika belum ada yang dipilih, campaign tidak dikirim dan menampilkan peringatan.
