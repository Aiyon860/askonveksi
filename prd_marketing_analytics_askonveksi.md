# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Modul Dashboard & Analitik Marketing ERP Askonveksi (Owner-Centric)

| Metadata Dokumen | Deskripsi |
| :--- | :--- |
| **Proyek** | Askonveksi ERP (Production Branch) |
| **Target Pengguna** | Owner / Direksi Bisnis (Fokus Pengambilan Keputusan Marketing & Penjualan) |
| **Scope Halaman** | 1. Dashboard Utama, 2. Analytics (Ringkasan), 3. Analytics (Kanal Akuisisi) |
| **Basis Database** | Supabase PostgreSQL & Prisma ORM (`askonveksi/prisma/schema.prisma`) |
| **Status Dokumen** | Final Production Specification |

---

## 1. Latar Belakang & Masalah yang Diselesaikan

### 1.1 Permasalahan AI Sebelumnya
Pada implementasi sebelumnya, penyajian data di dashboard dan analitik membingungkan Owner karena:
1. **Asal-usul data gelap (Black Box):** Angka yang muncul tidak jelas diambil dari tabel mana (apakah dari penawaran, invoice, atau pembayaran riil).
2. **Definisi metrik ambigu:** Istilah seperti "Omzet", "Conversion", dan "Lead" dicampuradukkan tanpa rumus matematis yang konsisten.
3. **Minim visualisasi perbandingan:** Data hanya disajikan dalam bentuk angka polos tanpa grafik visual yang memperlihatkan proporsi "tinggi vs pendek" atau "lebar vs tipis" untuk perbandingan langsung.

### 1.2 Prinsip Penyajian Data dalam PRD Ini
1. **100% Berbasis Skema Database Supabase Askonveksi:** Setiap metrik, angka, dan grafik dipetakan langsung ke tabel (`Customer`, `Opportunity`, `PurchaseOrder`, `PurchaseOrderItem`, `Invoice`, `PaymentTransaction`, `Expense`).
2. **Transparansi Sumber Data (Data Lineage Tooltip):** Setiap widget dan grafik wajib memiliki ikon bantuan `(i)` yang menampilkan formula dan asal tabelnya.
3. **Visual-First (Owner Loves Graphs):** Memprioritaskan perbandingan grafis yang kontras (Grouped Column, Stacked Bar, Combo Bar-Line, Funnel, Treemap, dan Bubble Chart) agar Owner dapat membaca performa dalam waktu < 5 detik.

---

## 2. Standar Desain UI/UX & Kontrol Global

### 2.1 Filter Bar Global (Terpasang di Bagian Atas Ketiga Halaman)
Semua halaman analitik harus merespons filter global berikut secara serentak:
* **Rentang Waktu (Date Range Picker):** Hari Ini, 7 Hari Terakhir, Bulan Ini (Default), 30 Hari Terakhir, Kuartal Ini, Tahun Ini, Custom Range.
* **Kategori Garment:** Semua Kategori, `JERSEY`, `NON_JERSEY`, `AKSESORI`.
* **Kanal Pemasaran (Source):** Semua Kanal, Meta Ads, TikTok Ads, Google Search, WhatsApp Inbound, Referral / Rekomendasi, Offline/Walk-in.
* **Sales Representative:** Semua Sales, atau pilih nama personil tim sales.

### 2.2 Taksonomi Visualisasi Grafik
* **Tinggi vs Pendek (Perbandingan Volume / Nominal):** *Grouped Column Chart* dan *Horizontal Bar Chart*. Menunjukkan saluran/sales mana yang paling unggul.
* **Lebar vs Tipis (Proporsi & Pangsa Pasar):** *Donut Chart* dan *Treemap*. Menunjukkan dominasi kategori produk atau kanal akuisisi.
* **Tren Waktu (Dinamika Naik-Turun):** *Smooth Area Line Chart*. Membandingkan periode berjalan dengan periode sebelumnya.
* **Tahapan & Kebocoran (Conversion Funnel):** *Stepped Funnel Chart*. Mengukur penurunan dari Lead awal hingga Lunas.

---

## 3. Spesifikasi Halaman 1: Dashboard Utama (Executive Marketing Overview)

### 3.1 Tujuan Halaman
Memberikan pandangan helikopter (*helicopter view*) kepada Owner tentang kesehatan pipeline penjualan, efektivitas biaya promosi, dan arus kas masuk secara *real-time*.

### 3.2 Wireframe Layout Grid

```text
+--------------------------------------------------------------------------------------------------+
| [Filter Bar]: [ Rentang Waktu: Bulan Ini v ] [ Kanal: Semua v ] [ Garment: Semua v ] [ Reset ]   |
+--------------------------------------------------------------------------------------------------+
| [ KPI 1: Total Omzet Deal ] [ KPI 2: Kas Masuk Riil ] [ KPI 3: Biaya Iklan ] [ KPI 4: ROAS ]    |
+----------------------------------------------------+---------------------------------------------+
| GRAFIK 1.1: Tren Omzet vs Belanja Iklan vs ROAS    | GRAFIK 1.2: Sales Funnel & Win-Rate         |
| (Combo Chart: Kolom Omzet/Biaya + Garis ROAS)      | (Funnel Bar: Lead -> Deal -> Lunas)         |
+----------------------------------------------------+---------------------------------------------+
| GRAFIK 1.3: Komposisi Produk (Jersey vs Non-Jersey)| GRAFIK 1.4: Realisasi Target per Sales Rep  |
| (Donut & Stacked Bar: Pcs & Nominal)               | (Grouped Bar: Target vs Realisasi Deal)     |
+----------------------------------------------------+---------------------------------------------+
| TABEL: 5 Deal Terkini (PO Number, Customer, Nilai, Status Produksi, Status Pembayaran)           |
+--------------------------------------------------------------------------------------------------+
```

### 3.3 Rincian Kartu Metrik (KPI Top Cards)

| Kartu Metrik | Definisi & Penjelasan Bisnis | Formula Perhitungan | Asal Sumber Data (Tabel & Field) |
| :--- | :--- | :--- | :--- |
| **Total Omzet Deal (PO)** | Total nilai pesanan resmi yang disepakati pelanggan dalam periode terpilih. | `SUM(PurchaseOrder.totalAmount)` | Tabel `PurchaseOrder`<br>Filter: `status != 'CANCELLED'` dan tanggal `createdAt` sesuai filter. |
| **Kas Masuk Riil (Collected)** | Uang tunai yang benar-benar sudah masuk ke rekening dari DP / Pelunasan (bukan piutang). | `SUM(PaymentTransaction.amount)` | Tabel `PaymentTransaction`<br>Filter: `status = 'ACTIVE'` dan `paymentDate` sesuai filter. |
| **Biaya Marketing & Ads** | Total dana promosi yang keluar untuk mendatangkan pesanan. | `SUM(Expense.amount)` | Tabel `Expense`<br>Filter: `category = 'ADS'` (atau tag marketing) dan `date` sesuai filter. |
| **ROAS (Return on Ad Spend)** | Berapa kali lipat omzet yang dihasilkan dari setiap Rp 1 biaya iklan. | `Total Omzet Deal / Biaya Marketing` | Rasio pembagian dari KPI 1 dibagi KPI 3. |

### 3.4 Spesifikasi Komponen Grafik

#### Grafik 1.1: Tren Omzet vs Belanja Iklan vs ROAS
* **Tipe Grafik:** *Combo Dual-Axis Chart* (Kolom Bertumpuk + Garis).
* **Sumbu X:** Periode waktu (Harian atau Mingguan dalam rentang bulan berjalan).
* **Sumbu Y Kiri (Mata Uang Rp):**
  * Batang Biru: Nilai Omzet PO (`PurchaseOrder.totalAmount`).
  * Batang Merah: Biaya Iklan (`Expense.amount` kategori `ADS`).
* **Sumbu Y Kanan (Kelipatan `x`):**
  * Garis Hijau: Nilai ROAS harian/mingguan.
* **Perbandingan Visual (Tinggi/Pendek):** Owner dapat langsung melihat korelasi: ketika batang biaya iklan dinaikkan (merah lebih tinggi), apakah batang omzet (biru) ikut melesat tinggi, atau justru ROAS (garis hijau) merosot rendah.

#### Grafik 1.2: Funnel Konversi Prospek ke Pembayaran
* **Tipe Grafik:** *Horizontal Funnel Chart*.
* **Tahapan Data:**
  1. *Total Leads*: Hitung baris `Opportunity` yang dibuat di periode tersebut (`stage: LEAD_BARU`).
  2. *Follow Up*: `Opportunity` yang bergeser ke `stage: FOLLOW_UP`.
  3. *Negosiasi / Quotation*: `Opportunity` di `stage: NEGOSIASI` atau PO status `DRAFT`.
  4. *Deal / Won (PO Terbit)*: `PurchaseOrder` resmi berstatus `AGREED` / `ISSUED`.
  5. *Lunas*: `Invoice` dengan sisa tagihan 0 (`PaymentKind = LUNAS`).
* **Perbandingan Visual:** Bentuk corong yang menyempit memperlihatkan di tahap mana prospek paling banyak "bocor" (drop-off).

#### Grafik 1.3: Distribusi Kategori Produk (Jersey vs Non-Jersey)
* **Tipe Grafik:** *Donut Chart* ganda (atau Tab toggle: Berdasarkan Pcs vs Berdasarkan Nilai Rp).
* **Irisan Data:** Diambil dari tabel `PurchaseOrderItem.garmentType` (`JERSEY`, `NON_JERSEY`, `AKSESORI`).
* **Perbandingan Visual (Lebar/Tipis):** Menunjukkan porsi dominasi jenis pesanan. Jika irisan `JERSEY` tebal (misal 70%), Owner paham bahwa konveksi sedang didorong oleh musiman event olahraga.

#### Grafik 1.4: Realisasi Target per Sales Representative
* **Tipe Grafik:** *Grouped Column Chart* berdampingan.
* **Sumbu X:** Nama Sales Representative (`User.name`).
* **Batang 1 (Abu-abu):** Target Penjualan Bulanan (dari tabel kuota / target).
* **Batang 2 (Biru/Hijau):** Realisasi Nilai Deal PO yang berhasil ditutup (`PurchaseOrder.totalAmount`).
* **Perbandingan Visual (Tinggi/Pendek):** Terlihat jelas sales mana yang melampaui target (batang hijau lebih tinggi dari target) dan mana yang tertinggal.

---

## 4. Spesifikasi Halaman 2: Analytics - Ringkasan (Marketing & Sales Performance)

### 4.1 Tujuan Halaman
Menganalisis efisiensi biaya akuisisi, keuntungan bersih setelah dipotong HPP (COGS), retensi pelanggan (repeat order), serta alasan hilangnya potensi penjualan (*Lost Opportunity*).

### 4.2 Wireframe Layout Grid

```text
+--------------------------------------------------------------------------------------------------+
| [ KPI: CAC ] [ KPI: Rasio LTV : CAC ] [ KPI: Win-Rate % ] [ KPI: Rata-rata Durasi Deal (Hari) ]  |
+----------------------------------------------------+---------------------------------------------+
| GRAFIK 2.1: Waterfall Laba Kontribusi Marketing    | GRAFIK 2.2: Tren Pelanggan Baru vs Repeat   |
| (Omzet -> HPP Garmen -> Iklan -> Margin Bersih)    | (Stacked Area: New Customer vs Returning)   |
+----------------------------------------------------+---------------------------------------------+
| GRAFIK 2.3: Matriks Kecepatan & Nilai Deal Sales   | GRAFIK 2.4: Pareto Alasan Deal Kalah (Lost) |
| (Scatter Plot: Durasi Hari vs Nilai PO)            | (Horizontal Bar: Harga, Waktu, Desain)      |
+----------------------------------------------------+---------------------------------------------+
| TABEL ANALITIK: Matriks Konversi per Rentang Nilai Order (<10jt, 10-50jt, >50jt)                 |
+--------------------------------------------------------------------------------------------------+
```

### 4.3 Rincian Kartu Metrik (KPI Performance Cards)

| Metrik | Definisi Bisnis | Formula Matematis | Sumber Data Supabase |
| :--- | :--- | :--- | :--- |
| **CAC (Customer Acquisition Cost)** | Biaya rata-rata untuk mendapatkan 1 pelanggan baru yang membayar. | `Total Biaya Iklan / Jumlah Pelanggan Baru yang PO` | Biaya: `SUM(Expense.amount)` kategori `ADS`<br>Pelanggan: `COUNT(DISTINCT Customer.id)` yang baru pertama kali membuat PO di periode ini. |
| **LTV : CAC Ratio** | Kelipatan nilai seumur hidup pelanggan dibanding biaya mendapatkannya (Skor ideal > 3x). | `LTV Rata-rata / CAC` | LTV: Total riwayat belanja pelanggan dibagi total pelanggan unik. |
| **Win-Rate Pipeline** | Persentase peluang yang berhasil menjadi pesanan nyata. | `(Jumlah Deal Won / Total Peluang Selesai) * 100%` | `COUNT(Opportunity.stage='DEAL') / COUNT(Opportunity.stage IN ('DEAL', 'LOST')) * 100` |
| **Sales Cycle Velocity** | Rata-rata durasi waktu dari pertama kali kontak masuk hingga PO ditandatangani. | `AVG(PO.createdAt - Opportunity.createdAt)` (dalam hari) | Selisih tanggal antara tabel `Opportunity` dan `PurchaseOrder`. |

### 4.4 Spesifikasi Komponen Grafik

#### Grafik 2.1: Waterfall Laba Kontribusi Marketing
* **Tipe Grafik:** *Waterfall Chart* (Jembatan Nilai Keuangan).
* **Elemen Batang Bertingkat:**
  1. *Gross Revenue (+)*: Total Omzet dari `PurchaseOrder.totalAmount`.
  2. *HPP / Biaya Produksi (-)*: Akumulasi nilai modal HPP dari `PurchaseOrderItem.hpp * quantity`.
  3. *Gross Profit (=)*: Laba Kotor Konveksi.
  4. *Biaya Pemasaran (-)*: Total dari `Expense` kategori `ADS`.
  5. *Net Marketing Contribution (=)*: Sisa laba bersih yang dihasilkan langsung oleh kegiatan pemasaran.
* **Perbandingan Visual:** Owner melihat seberapa tebal margin yang tersisa setelah omzet dikurangi modal kain/jahit dan biaya iklan.

#### Grafik 2.2: Tren Pelanggan Baru vs Pelanggan Lama (Repeat Order)
* **Tipe Grafik:** *Stacked Area Chart* (100% atau Nominal Rp).
* **Lapisan Bawah (Hijau):** Omzet dari Pelanggan Baru (*First-time buyers*).
* **Lapisan Atas (Biru Tua):** Omzet dari Pelanggan Lama (*Repeat buyers* yang sudah punya PO sebelumnya).
* **Perbandingan Visual (Lebar Pita):** Jika pita biru makin lama makin lebar, artinya bisnis konveksi memiliki loyalitas tinggi dan tidak melulu bergantung pada bakar uang iklan baru.

#### Grafik 2.3: Matriks Kecepatan Penjualan per Sales (Velocity Matrix)
* **Tipe Grafik:** *Scatter Plot* dengan 4 Kuadran.
* **Sumbu X:** Durasi Penutupan Deal (Hari).
* **Sumbu Y:** Nilai Rata-rata Order / AOV (Rp).
* **Setiap Titik (Dot):** Merepresentasikan satu Sales Representative (ukuran titik = total omzet yang dihasilkan).
* **Interpretasi Kuadran:**
  * Kiri-Atas (Bintang): Deal bernilai besar dan ditutup dengan cepat.
  * Kanan-Bawah (Perhatian): Deal bernilai kecil namun memakan waktu lama.

#### Grafik 2.4: Analisis Alasan Deal Kalah (Lost Reasons Pareto)
* **Tipe Grafik:** *Horizontal Bar Chart* diurutkan dari terbesar ke terkecil.
* **Kategori Alasan:** Diambil dari kolom `Opportunity.lostReason` (misalnya: "Harga Kemahalan", "Deadline Jahit Tidak Cukup", "Desain Ditolak", "Vendor Lain Lebih Murah", "Tidak Ada Balasan").
* **Perbandingan Visual (Panjang/Pendek Bar):** Memberi masukan langsung ke tim marketing dan produksi mengapa calon pelanggan batal order.

---

## 5. Spesifikasi Halaman 3: Analytics - Kanal Akuisisi (Acquisition Channels)

### 5.1 Tujuan Halaman
Menjawab pertanyaan strategis Owner: *"Di saluran mana uang iklan harus difokuskan, dan saluran mana yang mendatangkan pesanan paling menguntungkan?"*

### 5.2 Wireframe Layout Grid

```text
+--------------------------------------------------------------------------------------------------+
| [ Filter Saluran ] [ Urutkan Berdasarkan: ROAS Tertinggi v ] [ Download Laporan Saluran (Excel) ]|
+--------------------------------------------------------------------------------------------------+
| GRAFIK 3.1: Multi-Metrik Perbandingan Antar Saluran (Tinggi vs Pendek)                           |
| (Grouped Column: Total Leads vs Deal Won vs Nilai Omzet per Saluran Pemasaran)                   |
+----------------------------------------------------+---------------------------------------------+
| GRAFIK 3.2: Pangsa Pasar Pendapatan per Kanal      | GRAFIK 3.3: Kuadran Efisiensi Biaya (CPA)   |
| (Treemap / Donut: Luas Area = Kontribusi Omzet)    | (Bubble Chart: Biaya per PO vs Win-Rate)    |
+----------------------------------------------------+---------------------------------------------+
| GRAFIK 3.4: Distribusi Konversi Pipeline per Kanal (100% Stacked Horizontal Bar)                |
| (Menunjukkan di tahap mana prospek tiap saluran gugur)                                           |
+--------------------------------------------------------------------------------------------------+
| TABEL RINCIAN PER KANAL: Kanal | Leads | Deals | WinRate | Biaya Ads | Omzet | CAC | ROAS        |
+--------------------------------------------------------------------------------------------------+
```

### 5.3 Spesifikasi Komponen Grafik

#### Grafik 3.1: Perbandingan Multi-Metrik Antar Kanal (Tinggi vs Pendek)
* **Tipe Grafik:** *Grouped Column Chart* (3 Batang Berdampingan per Saluran).
* **Kategori Saluran (Sumbu X):** Meta Ads (IG/FB), TikTok Ads, Google Search, WhatsApp Inbound Organik, Referral/Mitra, Kunjungan Toko / Offline.
* **Batang 1 (Kuning):** Total Leads Masuk (`COUNT(Opportunity)`).
* **Batang 2 (Biru):** Total Deal Berhasil (`COUNT(PurchaseOrder)`).
* **Batang 3 (Hijau):** Skala Relatif Omzet dalam Puluhan Juta.
* **Perbandingan Visual:** Terlihat jelas perbedaan fisik: Saluran TikTok mungkin memiliki batang Leads (Kuning) yang sangat tinggi menjulang, namun batang Deal (Biru) sangat pendek (banyak spam). Sebaliknya, Referral batangnya pendek di Leads namun hampir seluruhnya menjadi Deal bernilai tinggi.

#### Grafik 3.2: Pangsa Pasar Omzet per Kanal (Lebar vs Tipis)
* **Tipe Grafik:** *Treemap* (Hierarchical Area Map) atau *Donut Chart* Bertingkat.
* **Dimensi Kotak (Luas Persegi):** Proporsional terhadap `SUM(PurchaseOrder.totalAmount)` dari masing-masing kanal.
* **Warna:** Gradasi warna berdasarkan tingkat profitabilitas (Margin Bersih).
* **Perbandingan Visual:** Owner langsung menangkap channel mana yang menjadi "tulang punggung" kas masuk konveksi hanya dari ukuran kotak yang paling lebar.

#### Grafik 3.3: Kuadran Efisiensi Biaya Saluran (Efficiency Matrix)
* **Tipe Grafik:** *Bubble Chart* (Diagram Gelembung 4 Kuadran).
* **Sumbu X:** CPA / Biaya Iklan per Order Jadi (Rp). Semakin ke kiri semakin hemat.
* **Sumbu Y:** Tingkat Kemenangan / Win Rate (%). Semakin ke atas semakin tinggi peluang closing.
* **Ukuran Gelembung (Bubble Size):** Total Omzet Rupiah yang disumbangkan saluran tersebut.
* **Interpretasi Kuadran:**
  * *Kuadran Emas (Kiri-Atas):* CPA rendah dan Win Rate tinggi (Wajib ditingkatkan anggarannya).
  * *Kuadran Bahaya (Kanan-Bawah):* CPA mahal dan Win Rate rendah (Evaluasi atau hentikan materi iklannya).

#### Grafik 3.4: Kebocoran Pipeline per Saluran (Pipeline Attrition)
* **Tipe Grafik:** *100% Stacked Horizontal Bar Chart*.
* **Sumbu Y:** Daftar Saluran Pemasaran.
* **Sumbu X (100%):** Distribusi status akhir prospek:
  * Biru Tua: Menjadi `DEAL` (PO Sah).
  * Biru Muda: Masih aktif berjalan (`LEAD_BARU`, `FOLLOW_UP`, `NEGOSIASI`).
  * Abu-abu: Gugur / Batal (`LOST`).
* **Perbandingan Visual:** Terlihat saluran mana yang menghasilkan persentase batal (abu-abu) paling tebal, sehingga tim marketing dapat memperbaiki target audiens iklan tersebut.

---

## 6. Kamus Data & Pemetaan Query Database Supabase (Prisma)

Untuk memastikan pengembang tidak salah mengambil sumber data, berikut acuan query resmi:

### 6.1 Pemetaan Tabel & Relasi

```
+--------------------+            +---------------------+            +-----------------------+
|      Customer      | 1        N |     Opportunity     | 1        1 |     PurchaseOrder     |
|--------------------|------------|---------------------|------------|-----------------------|
| id (PK)            |            | id (PK)             |            | id (PK)               |
| name               |            | customerId (FK)     |            | opportunityId (FK)    |
| source (Channel)   |            | userId (Sales FK)   |            | customerId (FK)       |
| createdAt          |            | stage (Enum)        |            | totalAmount           |
+--------------------+            | lostReason          |            | status (Enum)         |
                                  | createdAt           |            | createdAt             |
                                  +---------------------+            +-----------------------+
                                                                                 | 1
                                                                                 | N
+--------------------+            +---------------------+            +-----------------------+
|      Expense       |            | PaymentTransaction  | N        1 |   PurchaseOrderItem   |
|--------------------|            |---------------------|------------|-----------------------|
| id (PK)            |            | id (PK)             |            | id (PK)               |
| category (Enum)    |            | invoiceId (FK)      |            | purchaseOrderId (FK)  |
| amount             |            | amount              |            | garmentType (Enum)    |
| date               |            | paymentKind (Enum)  |            | quantity              |
| description        |            | status (ACTIVE/VOID)|            | hpp                   |
+--------------------+            | paymentDate         |            | unitPrice             |
                                  +---------------------+            +-----------------------+
```

### 6.2 Contoh Implementasi Prisma Service Query

#### A. Agregasi Pendapatan vs Biaya Iklan (Untuk Dashboard Utama)
```typescript
// Mengambil Total Omzet PO yang Sah dalam rentang tanggal
const poSummary = await prisma.purchaseOrder.aggregate({
  where: {
    createdAt: { gte: startDate, lte: endDate },
    status: { in: ['AGREED', 'ISSUED'] },
  },
  _sum: {
    totalAmount: true,
  },
  _count: {
    id: true,
  },
});

// Mengambil Total Biaya Iklan Marketing
const adsExpense = await prisma.expense.aggregate({
  where: {
    category: 'ADS',
    date: { gte: startDate, lte: endDate },
  },
  _sum: {
    amount: true,
  },
});

const revenue = poSummary._sum.totalAmount || 0;
const spend = adsExpense._sum.amount || 0;
const roas = spend > 0 ? (revenue / spend).toFixed(2) : 0;
```

#### B. Agregasi Metrik per Kanal Akuisisi (Untuk Halaman Saluran)
```typescript
// Agregasi performa per saluran akuisisi
const channelStats = await prisma.opportunity.groupBy({
  by: ['source'],
  where: {
    createdAt: { gte: startDate, lte: endDate },
  },
  _count: {
    id: true, // Total Leads
  },
});

// Relasi ke Purchase Order untuk menghitung Nilai Deal per Saluran
const dealsByChannel = await prisma.purchaseOrder.findMany({
  where: {
    createdAt: { gte: startDate, lte: endDate },
    status: { in: ['AGREED', 'ISSUED'] },
  },
  select: {
    totalAmount: true,
    opportunity: {
      select: {
        source: true,
      },
    },
  },
});
```

---

## 7. Rekomendasi Peningkatan Skema Supabase (Database Improvements)

Berdasarkan analisis file migrasi dan `schema.prisma` Askonveksi, untuk mendukung laporan analitik yang 100% presisi dan otomatis, disarankan penambahan minor berikut pada migrasi mendatang:

1. **Enum Terstandarisasi untuk Kanal (`AcquisitionChannel`):**
   * Saat ini kolom sumber di `Customer` atau `Opportunity` berpotensi berupa string bebas. Disarankan membuat Enum PostgreSQL:
     ```sql
     CREATE TYPE "AcquisitionChannel" AS ENUM (
       'META_ADS',
       'TIKTOK_ADS',
       'GOOGLE_SEARCH',
       'WHATSAPP_INBOUND',
       'REFERRAL',
       'WALK_IN_OFFLINE',
       'REPEAT_ORDER'
     );
     ```
2. **Atribusi ID Iklan / Kampanye di Opportunity:**
   * Menambahkan field opsional `utmCampaign` dan `utmSource` (string) di tabel `Opportunity` untuk melacak performa materi iklan spesifik (misal: "Promo Jersey Futsal November").
3. **Penyimpanan Alasan Kalah (`lostReasonCatalog`):**
   * Menggunakan enum atau master data alasan penolakan (`PRICE_HIGH`, `DEADLINE_TIGHT`, `DESIGN_REJECTED`, `NO_RESPONSE`) agar grafik Pareto alasan kalah selalu terkumpul secara konsisten tanpa kesalahan ketik manual.

---

## 8. Panduan Eksekusi Teknis ke Frontend UI

| Halaman | Library UI Rekomendasi | Komponen Chart |
| :--- | :--- | :--- |
| **Dashboard** | Recharts / Tremor / Chart.js | `<BarChart>`, `<LineChart>`, `<FunnelChart>`, `<DonutChart>` |
| **Analytics (Ringkasan)** | Recharts / Tremor | `<AreaChart>`, `<BarChart layout="vertical">`, `<ScatterChart>` |
| **Analytics (Kanal)** | Recharts / Tremor | `<BarChart>`, `<Treemap>`, `<ScatterChart>` (Bubble Mode) |

Dengan struktur di atas:
* Owner akan langsung mendapatkan visualisasi perbandingan yang sangat kaya (*tinggi vs pendek*, *lebar vs tipis*).
* Seluruh data dapat dipertanggungjawabkan asalnya dari tabel Supabase.
* Tidak ada lagi metrik "bodoh" atau tidak jelas definisinya karena setiap elemen memiliki landasan matematis dan model database yang konkret.