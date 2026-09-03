# BLUEPRINT ERM ASKONVEKSI

## 1. Tujuan Utama Sistem

ERM Askonveksi harus menjadi **satu pusat data operasional perusahaan**.

Sistem harus menghubungkan:

**Customer → Sales → Invoice → Purchasing → Produksi → QC → Pengiriman → Keuangan → Laporan**

Dengan tujuan:

1. Mengurangi pencatatan manual.
2. Mengurangi kesalahan input.
3. Menghindari order terlewat.
4. Mengetahui posisi setiap order secara real-time.
5. Mengetahui uang masuk dan keluar.
6. Mengetahui hutang dan piutang.
7. Mengetahui kebutuhan bahan produksi.
8. Mengetahui kinerja karyawan.
9. Owner bisa memantau bisnis tanpa harus bertanya kepada setiap divisi.

## 2. Struktur Pengguna

Sistem sebaiknya memiliki **role/akses berbeda**.

| Role | Akses Utama |
|---|---|
| Owner | Semua modul + laporan |
| Admin/CS | CRM, customer, order |
| Sales/Marketing | CRM, lead, follow-up |
| Finance | Invoice, pembayaran, keuangan |
| Purchasing | Supplier, PR, PO, barang masuk |
| Produksi | Work order, progress produksi |
| QC | Quality control |
| Gudang | Stok & barang masuk |
| HR/Admin | Karyawan & absensi |

**Penting:** setiap user tidak boleh bebas melihat atau mengubah semua data.

Contoh: Admin tidak boleh mengubah transaksi keuangan yang sudah final.

## 3. Dashboard

Dashboard adalah halaman pertama setelah login. Owner harus bisa melihat kondisi bisnis secara cepat.

### Informasi yang Ditampilkan (ASKONVEKSI DASHBOARD)

| Metrik | Nilai |
|---|---|
| Omzet bulan ini | Rp 185.500.000 |
| Piutang | Rp 42.500.000 |
| Hutang | Rp 28.750.000 |
| Pengeluaran | Rp 96.250.000 |
| Order aktif | 37 |
| Produksi | 21 |
| Order terlambat | 4 |
| Lead baru | 32 |

### Dashboard Produksi (Order Produksi)

| Tahap | Jumlah |
|---|---|
| Menunggu desain | 5 |
| Menunggu bahan | 3 |
| Cutting | 4 |
| Printing | 6 |
| Jahit | 8 |
| QC | 5 |
| Packing | 3 |
| Pengiriman | 7 |

### Dashboard Sales

| Metrik | Nilai |
|---|---|
| Lead | 100 |
| Follow up | 45 |
| Negosiasi | 20 |
| Deal | 12 |
| Conversion | 12% |

## 4. CRM (Utama)

CRM adalah pusat data customer.

### Fungsi

Mencatat seluruh perjalanan customer dari:

**Lead Baru → Follow Up → Negosiasi → Deal / Lost → Repeat Order**

### Data Customer

- Customer ID
- Nama
- Nomor WhatsApp
- Email
- Perusahaan/komunitas
- Alamat
- Kota
- Jenis customer
- Sumber lead
- Sales/PIC
- Catatan
- Riwayat order

### Jenis Customer

Contohnya:

- Personal
- Komunitas
- Perusahaan
- Sekolah
- Kampus
- Event organizer
- Pemerintah
- Reseller

### Pipeline

LEAD BARU → FOLLOW UP → NEGOSIASI → DEAL / LOST

Satu kartu kanban mewakili satu peluang. PO customer dan invoice konveksi baru muncul pada Negosiasi. Deal hanya dapat dibuat Admin setelah PO disepakati, invoice diterbitkan, serta pembayaran Lunas atau DP dicatat.

### Fitur Penting

- Search customer
- Filter customer
- ~~Riwayat komunikasi~~ *(fitur ra penting)*
- Reminder follow-up
- Catatan sales
- Riwayat order
- Total transaksi customer
- Customer terakhir order kapan
- Customer repeat order *(maksudnya gimana?)*

### Contoh

Admin membuka halaman customer dan pilih salah satu customer: **PT ABC**

Sistem menampilkan:

- **PT ABC**
- Total Order: 15
- Total Transaksi: Rp125.500.000
- Order Aktif: 2
- Order Terakhir: 20 Agustus 2026
- Riwayat:
  - Jersey 100 pcs *(dan berikan tanggal orderan sebelumnya / riwayat)*
  - PDH 50 pcs
  - Kaos 200 pcs
  - Jaket 75 pcs

## 5. Sales Order / PO

Ini adalah dokumen resmi bahwa customer melakukan pemesanan.

**CRM ≠ Sales Order.**

- CRM mengelola hubungan customer.
- Sales Order mengelola **pesanan yang sudah disepakati**.

### Isi Sales Order

- Nomor SO
- Customer
- PIC
- Produk
- Variasi produk
- Qty
- Harga
- Deadline
- Desain
- Ukuran
- Warna
- Catatan

*(Outputnya rincian produksi dan Desain) + Canva*

### Contoh

**SO-2026-00125**

| Field | Nilai |
|---|---|
| Customer | PT ABC |
| Produk | Jersey Custom |
| Qty | 100 pcs |
| Harga | Rp85.000 |
| Total | Rp8.500.000 |
| Deadline | 10 September 2026 |
| DP | Rp4.250.000 |

## 6. Invoice

Invoice digunakan untuk **menagih customer**.

### Fitur

- Generate invoice otomatis
- Nomor invoice otomatis
- Harga
- Diskon
- Pajak jika diperlukan
- DP
- Pelunasan
- Jatuh tempo
- Status pembayaran
- PDF
- Print
- Kirim invoice

### Status

DRAFT → SENT → DP → PARTIAL → PAID

Jika customer membayar: **Invoice → otomatis tercatat di Finance.**

## 7. Tahapan Produksi

Buat workflow yang bisa dikonfigurasi:

ORDER → DESAIN → ACC CUSTOMER → PERSIAPAN BAHAN → CUTTING → PRINTING → JAHIT → FINISHING → QC → PACKING → PENGIRIMAN → SELESAI

Setiap tahap memiliki:

- PIC
- Status
- Tanggal mulai
- Deadline
- Tanggal selesai
- Jumlah
- Catatan
- Foto
- Kendala

## 8. Progress Produksi

Owner harus bisa melihat: Order SO-00125 sudah sampai mana?

### Contoh — SO-00125

| Tahap | Status |
|---|---|
| Deposit desain | ✅ |
| Desain | ✅ |
| ACC | ✅ |
| Bahan | ✅ |
| Cutting | ✅ |
| Printing/sablon | 🔄 70% |
| Jahit | ⏳ |
| QC | ⏳ |
| Packing | ⏳ |
| Pengiriman | ⏳ |

*Sertakan tanggal order dan deadline.*

## 9. Keuangan

Keuangan menjadi pusat seluruh transaksi.

### Kas Masuk

- DP customer
- Pelunasan
- Penjualan
- Pendapatan lain

### Kas Keluar

- Gaji
- Operasional
- Listrik
- Marketing
- Ekspedisi
- Wifi
- Pengeluaran lain

### Project

- Bahan baku
- Sablon plastisol, bordir, sablon DTF
- Print jersey
- Jahit
- Packing
- Ongkir

## 10. Piutang (dari Total Invoice)

Sistem harus otomatis mengetahui: customer mana yang masih punya hutang?

### Contoh

| Customer | Piutang |
|---|---|
| PT ABC | Rp8.500.000 |
| CV XYZ | Rp3.200.000 |
| Komunitas Runner | Rp1.750.000 |
| **TOTAL** | **Rp13.450.000** |

Ada informasi:

- Nomor invoice
- Total
- Sudah dibayar
- Sisa
- Jatuh tempo
- Umur piutang

## 11. Laporan Keuangan

Owner harus bisa melihat:

**Harian**
- Kas masuk
- Kas keluar

**Bulanan**
- Omzet
- Pengeluaran
- Laba kotor
- Piutang
- Hutang

**Berdasarkan Produk (Contoh: Jersey)**

| Metrik | Nilai |
|---|---|
| Omzet | Rp80 juta |
| HPP | Rp50 juta |
| Laba | Rp30 juta |

Ini nantinya membantu owner mengetahui **produk mana yang paling menguntungkan**.

## 12. Absensi

Modul karyawan.

### Data Karyawan

- ID
- Nama
- Jabatan
- Divisi
- Status
- Tanggal masuk
- Gaji dasar

### Absensi

- Check-in
- Check-out
- Terlambat
- Izin
- Sakit
- Cuti
- Alpha

### Laporan (Contoh: Budi)

| Metrik | Nilai |
|---|---|
| Hadir | 22 hari |
| Terlambat | 2 kali |
| Izin | 1 kali |
| Alpha | 0 |

**Payroll tidak perlu dibuat di versi pertama.**

## 13. Landing Page

Landing page berfungsi mendapatkan lead.

Customer mengisi:

- Nama
- WhatsApp
- Produk
- Jumlah
- Kota
- Deadline

Kemudian: **Landing Page → CRM**

Lead otomatis masuk:

- Nama: Budi
- Produk: Jersey
- Qty: 100
- Deadline: 15 September
- Status: Lead Baru

## 14. Notifikasi

Modul ini sangat disarankan dimasukkan sejak awal desain sistem.

Contoh:

- **Sales** — 🔔 Follow-up PT ABC hari ini.
- **Finance** — 🔔 Invoice INV-00125 jatuh tempo besok.
- **Purchasing** — 🔔 PO-0045 belum diterima.
- **Produksi** — 🔔 WO-00125 deadline 2 hari lagi.
- **Owner** — 🔴 4 order terlambat.

## 15. Audit Log

Ini **wajib** untuk ERP/ERM.

Sistem harus mencatat: siapa melakukan apa dan kapan.

### Contoh

| Waktu | User | Aksi | Detail |
|---|---|---|---|
| 25/08 09:20 | Admin Andi | Mengubah harga SO-00125 | Rp80.000 → Rp85.000 |
| 25/08 10:15 | Finance Budi | Mencatat pembayaran | Rp4.250.000 |

Jadi kalau ada kesalahan, owner bisa mengetahui sumbernya.

## 16. Relasi Antar-Modul

Ini bagian yang paling penting untuk disampaikan ke IT.

```
CUSTOMER
   ↓
  CRM
   ↓
SALES ORDER
   ├────────→ INVOICE
   │              ↓
   │         PEMBAYARAN
   │              ↓
   │          KEUANGAN
   ↓
WORK ORDER
   ↓
KEBUTUHAN BAHAN
   ↓
PURCHASE REQUEST
   ↓
PURCHASE ORDER
   ↓
SUPPLIER
   ↓
BARANG MASUK
   ↓
PRODUKSI
   ↓
  QC
   ↓
PACKING
   ↓
PENGIRIMAN
   ↓
SELESAI
```

## 17. Contoh Satu Order dari Awal Sampai Selesai

Misalnya: **PT ABC memesan 100 jersey.**

| Step | Modul | Detail |
|---|---|---|
| 1 | CRM | Customer masuk sebagai lead. |
| 2 | Sales Order | Customer deal: 100 × Rp85.000 = **Rp8.500.000** |
| 3 | Invoice | DP: **Rp4.250.000** |
| 4 | Keuangan | Sistem mencatat kas masuk **Rp4.250.000** |
| 5 | Produksi | Cutting → Printing → Jahit → Finishing |
| 6 | QC | 100 pcs lolos QC |
| 7 | Packing | 100 pcs dipacking |
| 8 | Pengiriman | Resi dimasukkan |
| 9 | Pelunasan | Customer membayar **Rp4.250.000** |
| 10 | Keuangan | Invoice menjadi **LUNAS** |
| 11 | Order | **COMPLETED** |

## 18. Prioritas Pembangunan

Kalau saya menjadi **Project Manager IT Askonveksi**, saya akan meminta tim membuatnya dalam tahap berikut:

| Phase | Fokus |
|---|---|
| Phase 1 — Core | CRM + Customer + Sales Order |
| Phase 2 — Money | Invoice + Pembayaran + Piutang |
| Phase 3 — Purchasing | Supplier + PR + PO + Barang Masuk + Hutang |
| Phase 4 — Production | Work Order + Progress + QC + Packing + Pengiriman |
| Phase 5 — Finance | Kas + Pengeluaran + Hutang + Piutang + Laporan |
| Phase 6 — HR | Karyawan + Absensi |
| Phase 7 — Marketing | Landing Page + Lead Otomatis |
| Phase 8 — Automation | WhatsApp + Notifikasi + Reminder + Dashboard + Laporan Otomatis |

## ⭐ Yang Paling Penting untuk IT

Jangan meminta mereka membuat "aplikasi CRM, aplikasi purchasing, aplikasi produksi, aplikasi finance" secara terpisah.

Minta mereka membuat **SATU database terintegrasi**.

Karena contoh sederhananya:

- Customer yang ada di CRM **harus sama** dengan customer di Invoice.
- Invoice yang dibayar **harus otomatis masuk** ke Finance.
- Sales Order yang sudah deal **harus bisa menghasilkan Work Order**.
- Work Order yang membutuhkan bahan **harus bisa menghasilkan Purchase Request**.
- Purchase Order yang barangnya diterima **harus memperbarui stok/barang masuk**.
- PO yang belum dibayar **harus menjadi hutang supplier**.
- Invoice yang belum lunas **harus menjadi piutang customer**.

## 19. Purchasing *(nanti dulu)*

Ini modul yang sangat penting untuk konveksi.

Purchasing mengatur: **apa yang harus dibeli → dari siapa → berapa banyak → berapa harga → kapan datang → sudah dibayar atau belum.**

Modul ini sebaiknya terdiri dari:

### A. Supplier

Data:

- Supplier ID
- Nama supplier
- PIC
- Nomor WhatsApp
- Alamat
- Produk yang dijual
- Harga
- Termin pembayaran
- Rekening
- Riwayat transaksi

## 20. Purchase Request / PR *(nanti dulu)*

PR adalah **permintaan pembelian internal**.

Contoh: produksi membutuhkan kain 100 meter. Produksi tidak langsung membeli — produksi membuat **Purchase Request**.

| Field | Nilai |
|---|---|
| Nomor PR | PR-2026-0050 |
| Item | Kain Jersey |
| Jumlah | 100 meter |
| Alasan | Kebutuhan produksi SO-00125 |
| Deadline | 30 Agustus |

Kemudian purchasing menerima permintaan tersebut.

## 21. Purchase Order / PO

Setelah PR disetujui, purchasing membuat PO ke supplier.

| Field | Nilai |
|---|---|
| Nomor PO | PO-2026-0045 |
| Supplier | PT Textile Indonesia |
| Item | Kain Jersey |
| Jumlah | 100 meter |
| Harga | Rp32.000/m |
| Total | Rp3.200.000 |
| Estimasi datang | 28 Agustus 2026 |

### Status PO

Draft → Approval → Sent → Confirmed → Partial Received → Completed

## 22. Barang Masuk

Ketika supplier mengirim barang, gudang melakukan penerimaan.

Misalnya:

| Field | Nilai |
|---|---|
| PO | 100 meter |
| Yang datang | 95 meter |
| Kurang | 5 meter |

Sistem harus bisa mencatat selisih ini — **jangan otomatis dianggap selesai**. Ini penting untuk menghindari selisih barang.
