# 🔥 SKEMA CRM ASKONVEKSI — V1

![Skema 1](media/image1.jpeg)

![Skema 2](media/image2.jpeg)

![Skema 3](media/image3.jpeg)

## Alur Utama

```
LEAD MASUK
    │
    ┌─────────────┼─────────────┐
    ↓             ↓             ↓
WhatsApp      Instagram    Landing Page
    │             │             │
    └─────────────┼─────────────┘
                  ↓
           DATABASE LEAD
                  ↓
           KUALIFIKASI LEAD
                  ↓
        ┌──────────┴──────────┐
        ↓                     ↓
     HOT 🔥              WARM / COLD
        ↓                     ↓
   PRIORITAS 1            FOLLOW-UP
        │                     │
        └──────────┬──────────┘
                    ↓
             SALES PIPELINE
                    ↓
     ┌─────────────────────────────┐
     │ 1. LEAD BARU                │
     │ 2. DIHUBUNGI                │
     │ 3. KEBUTUHAN TERGALI        │
     │ 4. PENAWARAN                │
     │ 5. FOLLOW-UP                │
     │ 6. NEGOSIASI                │
     │ 7. DEAL                     │
     │ 8. LOST                     │
     └──────────────┬──────────────┘
                    ↓
                  DEAL
                    ↓
              SALES ORDER
                    ↓
              INVOICE + DP
                    ↓
                PRODUKSI
                    ↓
                 SELESAI
                    ↓
              REPEAT ORDER
                    ↑
                    │
            CUSTOMER DATABASE
```

## 1. Lead Masuk

Semua calon customer harus masuk ke **satu database**.

### Sumber Lead

- WhatsApp
- Instagram
- Facebook
- Meta Ads
- Landing Page
- Canvassing
- Referral
- Event
- Customer lama

### Setiap Lead Otomatis/Manual Memiliki

| Data | Contoh |
|---|---|
| Nama | Budi |
| WhatsApp | 08xxx |
| Produk | Jersey |
| Qty | 100 pcs |
| Kota | Semarang |
| Deadline | 15 Sept |
| Sumber | Meta Ads |
| PIC | Andi |

**Tujuan:** tidak ada lead yang tercecer di WhatsApp pribadi, Excel, atau catatan admin.

## 2. Kualifikasi Lead

Ini bagian yang **sangat penting untuk Askonveksi**.

Jangan langsung menawarkan harga. CRM harus membantu sales menggali:

### 5 Pertanyaan Utama

1. **Produk apa?** — Jersey / PDH / kaos / jaket / lainnya.
2. **Berapa jumlahnya?**
3. **Kapan dibutuhkan?**
4. **Untuk kebutuhan apa?** — Event / perusahaan / komunitas / sekolah / pribadi.
5. **Sudah memiliki desain atau belum?**

### Lead Score

- 🔥 **HOT** = 80–100
- 🟡 **WARM** = 50–79
- ⚪ **COLD** = 0–49

## 3. Sales Pipeline

Disarankan **jangan terlalu banyak status**. Gunakan 8 tahap:

**① LEAD BARU**
Customer baru masuk.

↓

**② DIHUBUNGI**
Sales sudah melakukan opening.

↓

**③ KEBUTUHAN TERGALI**
Sales sudah mengetahui:
- Produk
- Qty
- Deadline
- Budget
- Spesifikasi

↓

**④ PENAWARAN**
Quotation/pricelist sudah dikirim.

↓

**⑤ FOLLOW-UP**
Customer belum closing.

↓

**⑥ NEGOSIASI**
Ada pembahasan:
- Harga
- Bahan
- Qty
- Deadline
- Spesifikasi

↓

**⑦ DEAL 🔥**
Customer setuju.

↓

**⑧ LOST**
Tidak jadi order.

## 4. Fitur Paling Penting: Next Action

Ini **wajib ada di setiap lead**.

### Contoh — Customer: Budi

| Field | Nilai |
|---|---|
| Status | Penawaran |
| Terakhir dihubungi | 28 Agustus |
| Next Action | Follow-up harga |
| Follow-up | 30 Agustus 10:00 |
| PIC | Andi |

Pada tanggal tersebut CRM memberikan notifikasi:

> 🔔 **FOLLOW-UP BUDI HARI INI**

Dengan begitu sales tidak perlu mengandalkan ingatan.

## 5. Follow-up Center

Buat satu halaman khusus:

**FOLLOW-UP HARI INI**

| Status | Jumlah |
|---|---|
| 🔴 Terlambat | 7 customer |
| 🟠 Hari ini | 12 customer |
| 🟡 Besok | 8 customer |

Sales tinggal klik customer, kemudian muncul opsi:
- **Buka WhatsApp**, atau
- **Catat hasil follow-up**

## 6. Riwayat Komunikasi

Setiap customer memiliki timeline.

### Contoh

| Tanggal | Aktivitas |
|---|---|
| 28 Aug | 📱 Customer meminta harga Jersey 100 pcs |
| 28 Aug | 📄 Penawaran dikirim |
| 29 Aug | 📱 Customer menanyakan bahan |
| 29 Aug | 💬 Sales menjelaskan bahan |
| 30 Aug | 🔔 Follow-up |

Tujuannya: kalau customer berpindah dari admin A ke admin B, **admin B tetap tahu sejarah percakapannya**.

## 7. Customer Database

Setelah lead menjadi customer, datanya tidak hilang. CRM berubah menjadi profil customer.

### Contoh — Customer Profile: PT ABC

| Field | Nilai |
|---|---|
| Total Order | 15 |
| Total Transaksi | Rp125.500.000 |
| Order Aktif | 2 |
| Order Terakhir | 20 Agustus 2026 |
| Produk Favorit | PDH |
| PIC | Andi |

## 8. Repeat Order Engine

Salah satu fitur yang **paling berpotensi menghasilkan omzet tambahan**.

CRM membaca **tanggal order terakhir**. Misalnya, PT ABC terakhir order 6 bulan lalu, maka CRM memberikan notifikasi:

### 🔔 Potensi Repeat Order — PT ABC

| Field | Nilai |
|---|---|
| Last Order | 20 Feb 2026 |
| Produk | PDH |
| Qty | 100 |
| Nilai | Rp8.500.000 |
| Rekomendasi | Follow-up repeat order |

Sales tinggal menghubungi.

## 9. Reactivation Customer

Buat segmentasi: **customer tidak order selama 3–6 bulan**.

### Contoh — Customer Tidak Aktif

- PT ABC
- CV Maju
- Komunitas Runner
- PT Sejahtera
- Sekolah XYZ

Kemudian dibuat campaign khusus:

> "Sudah waktunya produksi seragam/event lagi?"

## 10. Dashboard Owner

Owner tidak perlu melihat semua percakapan, cukup lihat ringkasan:

```
┌───────────────────────────────────┐
│           ASKONVEKSI CRM           │
├───────────────────────────────────┤
│                                     │
│  LEAD               125            │
│  FOLLOW UP           42            │
│  PENAWARAN           31            │
│  NEGOSIASI           18            │
│  DEAL                14            │
│  LOST                20            │
│                                     │
│  POTENSI OMZET                     │
│  Rp 85.500.000                     │
│                                     │
│  OMZET DEAL                        │
│  Rp 42.500.000                     │
│                                     │
│  CONVERSION RATE                   │
│  11,2%                             │
└───────────────────────────────────┘
```

## 11. Sales Performance

Owner juga harus bisa melihat performa tiap sales — evaluasi berdasarkan **hasil**, bukan sekadar jumlah chat.

| Sales | Lead | Follow-up | Quotation | Deal | Omzet |
|---|---|---|---|---|---|
| Andi | 80 | 70 | 35 | 12 | Rp35 jt |
| Budi | 65 | 40 | 20 | 5 | Rp15 jt |

## 12. Sumber Lead → Omzet

Wajib ada kalau Askonveksi menjalankan Meta Ads. CRM harus bisa menjawab:

> "Uang kita paling banyak datang dari mana?"

| Sumber | Lead | Deal | Omzet |
|---|---|---|---|
| Meta Ads | 100 | 12 | Rp35 juta |
| Instagram | 50 | 8 | Rp20 juta |
| Referral | 20 | 10 | Rp30 juta |
| Canvassing | 30 | 5 | Rp12 juta |

Dengan begitu marketing bisa mengetahui channel yang benar-benar menghasilkan **revenue**, bukan hanya chat.

## ⭐ Struktur CRM yang Direkomendasikan

Kalau dibuat sebagai menu aplikasi:

```
ASKONVEKSI CRM
│
├── 🏠 Dashboard
│
├── 👥 Leads
│   ├── Semua Lead
│   ├── Lead Baru
│   ├── Hot Lead
│   └── Lost Lead
│
├── 🔄 Sales Pipeline
│   ├── Lead Baru
│   ├── Dihubungi
│   ├── Kebutuhan Tergali
│   ├── Penawaran
│   ├── Follow-up
│   ├── Negosiasi
│   ├── Deal
│   └── Lost
│
├── 📅 Follow-up
│   ├── Hari Ini
│   ├── Terlambat
│   └── Mendatang
│
├── 👤 Customer
│   ├── Semua Customer
│   ├── VIP
│   ├── Customer Aktif
│   ├── Customer Tidak Aktif
│   └── Potensi Repeat Order
│
├── 📄 Quotation
│
├── 🛒 Sales Order
│
├── 📊 Analytics
│   ├── Sales Funnel
│   ├── Sales Performance
│   ├── Lead Source
│   ├── Conversion
│   └── Omzet
│
└── ⚙️ Settings
```

## 🚨 Kalau Budget IT Terbatas

Tidak disarankan semua fitur di atas dibuat sekaligus. Bangun bertahap:

### CRM V1 — Wajib

1. Lead database
2. Customer database
3. Sales pipeline
4. Lead source
5. Lead scoring sederhana
6. Next action
7. Follow-up reminder
8. Riwayat order
9. Quotation
10. Dashboard sales

### CRM V2 — Setelah V1 Stabil

11. WhatsApp integration
12. Repeat order reminder
13. Customer reactivation
14. Sales performance
15. Funnel analytics

### CRM V3

16. Automation
17. Broadcast segmentation
18. Meta Ads integration
19. AI lead scoring
20. Prediksi repeat order

## 🎯 Inti CRM Askonveksi

Kalau disederhanakan menjadi **1 alur**, minta tim IT membangun ini:

**LEAD MASUK → KUALIFIKASI → ASSIGN SALES → FOLLOW-UP → PENAWARAN → REMINDER → NEGOSIASI → DEAL → SALES ORDER → INVOICE → PRODUKSI → SELESAI → REPEAT ORDER**

Dan ada **3 mesin yang terus bekerja di belakangnya**:

- **🔥 Mesin 1 — Closing**: Lead → Follow-up → Deal
- **💰 Mesin 2 — Revenue**: Deal → Order → Omzet
- **🔄 Mesin 3 — Repeat Order**: Customer lama → Reminder → Order kembali

Kalau tiga mesin ini berjalan, CRM Askonveksi benar-benar menjadi **alat untuk menaikkan penjualan**, bukan hanya database customer.
