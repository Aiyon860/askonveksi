# Rencana Optimasi Performa Navigasi

## Tujuan

Mempercepat perpindahan halaman, tab, filter, dan pagination tanpa mengurangi pemeriksaan autentikasi atau sekadar mengganti bentuk skeleton.

## Dasar Temuan

Audit dilakukan tiga kali pada jalur database dan query relasional.

| Pemeriksaan | Baseline |
| --- | ---: |
| Koneksi pertama ke Supabase | Median 2.452 ms |
| Query hangat `SELECT 1` | Median 385 ms |
| Query relasional Sales Order | 11 SQL, median 3.328 ms |
| Eksekusi SQL di PostgreSQL | Umumnya 0,08 sampai 0,50 ms |

Dataset masih kecil. Hambatan utama bukan eksekusi PostgreSQL, melainkan jarak compute ke database dan banyaknya perjalanan jaringan yang dibuat oleh query relasional.

## Prioritas Implementasi

### 1. Fondasi build

- Hapus `experimental.useCache` yang sudah tidak kompatibel dengan Next.js 16.
- Pastikan instalasi lockfile, Prisma Client, unit test, validasi schema, dan production build berhasil.
- Migrasi penuh ke Cache Components tidak dilakukan bersama perbaikan ini karena memerlukan audit perilaku cache tersendiri.

### 2. Region dan koneksi

- Atur Vercel Function region ke `syd1`, sama dengan region Supabase `ap-southeast-2`.
- Pertahankan Shared Transaction Pooler pada port `6543` untuk runtime serverless.
- Batasi application pool Prisma menjadi lima koneksi per instance, gunakan idle timeout 30 detik dan connection timeout 10 detik.
- Perubahan region dilakukan melalui Vercel Project Settings setelah commit tersedia di branch `dev`.

### 3. Prisma dan data server

- Aktifkan `relationJoins` dan gunakan strategi `join` hanya pada query relasional berat yang terukur.
- Dedup pemanggilan `getOpportunityDetail()` dalam satu render request menggunakan React `cache()`.
- Gunakan pilihan field minimum dan jangan memuat relasi yang tidak digunakan UI.
- Pertahankan autentikasi di luar cache lintas-request. Session, token, cookie, dan data yang berbeda per scope pengguna tidak boleh masuk cache bersama.
- Optimasi agregat Dashboard dan pemisahan data per tab dilakukan setelah trace deployment menunjukkan target awal masih belum tercapai.

### 4. Navigasi dan revalidasi browser

- Gunakan perilaku prefetch bawaan Next.js pada sidebar, bukan `prefetch={true}` untuk semua tujuan.
- Hapus Speculation Rules manual sampai hit rate dan biaya server dapat diukur.
- Data SSR yang diberikan sebagai `fallbackData` tidak langsung diambil ulang saat mount atau browser kembali fokus.
- Revalidasi reconnect dan interval refresh yang sudah menjadi perilaku bisnis tetap dipertahankan.

### 5. Loading UI

- Pertahankan shell halaman dan batasi fallback pada panel yang berubah.
- Untuk filter dan tab server, tampilkan status pending lokal dan hindari mengganti seluruh halaman dengan skeleton.
- Muat data tab aktif terlebih dahulu. Prefetch data tab lain hanya setelah halaman interaktif dan jika trace membuktikan manfaatnya.

## Verifikasi

Setiap pengukuran performa dilakukan tiga kali dan dilaporkan sebagai median serta rentang.

- `npm test`, `npm run db:validate`, dan `npm run build` harus lulus.
- Query relasional yang diubah harus mengembalikan bentuk data yang sama.
- Query relasional Sales Order ditargetkan turun dari 11 SQL menjadi satu SQL.
- Tidak ada render penuh untuk semua link sidebar saat halaman diam.
- Dashboard dan Pipeline tidak melakukan fetch kedua segera setelah hydration.
- Akses tanpa izin tetap ditolak dan data tidak bocor melalui cache.
- Setelah deployment `dev`, ukur navigasi cold dan warm pada Dashboard, Pipeline, detail Peluang, Produksi, serta filter tabel.

## Di Luar Perubahan Ini

- Memindahkan region Supabase.
- Menghapus atau melemahkan pemeriksaan auth.
- Menambahkan index tanpa bukti slow query.
- Mengaktifkan Cache Components tanpa migrasi terpisah.
- Membeli Dedicated Pooler sebelum region dan jumlah round trip diperbaiki.
