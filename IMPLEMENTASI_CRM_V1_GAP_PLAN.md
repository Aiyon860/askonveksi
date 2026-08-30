# Rencana Penyelesaian Gap CRM V1 Askonveksi

Status: terimplementasi; migrasi database dan secret environment perlu diterapkan saat deployment  
Sumber utama: `SKEMA_CRM_ASKONVEKSI.md`  
Konteks teknis: implementasi CRM saat ini, `PRODUCT.md`, dan `ASUMSI_CRM.md`

## 1. Tujuan dan Batas Scope

Melengkapi CRM V1 agar alur berikut berjalan memakai data nyata:

`Lead masuk -> Kualifikasi -> Assign sales -> Next action -> Follow-up -> Penawaran -> Negosiasi -> Deal -> Sales Order`

Pekerjaan ini mencakup:

1. kualifikasi dan lead scoring sederhana;
2. pipeline delapan tahap;
3. sumber lead dan PIC per opportunity;
4. next action dan pencatatan kontak terakhir;
5. Follow-up Center berbasis database;
6. input lead satu langkah, termasuk formulir landing page;
7. dashboard sales berbasis data CRM nyata.

Pekerjaan ini tidak mencakup WhatsApp API, sinkronisasi percakapan, repeat-order reminder, reactivation campaign, sales performance, funnel analytics lanjutan, Meta Ads API, broadcast, automation, AI scoring, invoice, produksi, atau modul keuangan.

## 2. Keputusan Produk

### 2.1 Opportunity menjadi unit kerja lead

- `Customer` tetap menjadi profil identitas dan riwayat order.
- `Opportunity` menjadi sumber data untuk kebutuhan, sumber lead, PIC, skor, stage, dan next action.
- `Customer.leadSourceId` tetap dipertahankan sebagai sumber akuisisi awal customer.
- `Customer.salesPicId` tetap dipertahankan sebagai account owner/default PIC.
- Opportunity baru menyalin nilai awal sumber dan PIC dari Customer, tetapi setelah dibuat nilainya berdiri sendiri.
- Dashboard dan Follow-up Center memakai PIC dan sumber pada Opportunity, bukan Customer.

### 2.2 Pipeline resmi

Urutan stage menjadi:

1. `LEAD_BARU`
2. `DIHUBUNGI`
3. `KEBUTUHAN_TERGALI`
4. `PENAWARAN`
5. `FOLLOW_UP`
6. `NEGOSIASI`
7. `DEAL`
8. `LOST`

Aturan stage:

- `DEAL` hanya tercapai melalui penerimaan quotation dan pembentukan Sales Order yang sudah ada.
- `LOST` wajib memiliki alasan.
- Jadwal next action tidak bergantung pada stage. Lead pada stage apa pun selain `DEAL` dan `LOST` dapat memiliki jadwal follow-up.
- Opportunity yang masuk `DEAL` atau `LOST` menutup next action aktif.
- Negosiasi quotation tetap memakai mekanisme revisi quotation yang sudah ada.

### 2.3 Lead scoring sederhana

- Skor berupa bilangan bulat 0 sampai 100 dan disimpan pada Opportunity.
- Klasifikasi tidak disimpan terpisah, tetapi diturunkan dari skor: `HOT` 80-100, `WARM` 50-79, `COLD` 0-49.
- V1 memakai skor manual oleh sales. Formula otomatis belum dibuat karena dokumen sumber belum menetapkan bobot penilaian.
- Perubahan skor dicatat dalam audit log.

### 2.4 Follow-up dan notifikasi

- Reminder V1 dihitung langsung dari `nextActionAt`; tidak perlu tabel Notification baru.
- Status follow-up dihitung dengan zona waktu `Asia/Jakarta`: terlambat, hari ini, besok, dan mendatang.
- Tombol WhatsApp hanya berupa deep link `https://wa.me/<nomor>` dan bukan integrasi WhatsApp API.
- Status sudah dibaca tidak disimpan pada V1. Angka di navigasi menunjukkan jumlah next action yang terlambat dan jatuh tempo hari ini.

## 3. Perubahan Model Data dan Migrasi

### 3.1 Enum dan field

Ubah `OpportunityStage` sesuai delapan stage resmi. Tambahkan field berikut pada `Opportunity`:

| Field | Tipe | Aturan |
|---|---|---|
| `leadSourceId` | `String?` | Relasi ke `LeadSource`, `onDelete: SetNull` |
| `salesPicId` | `String?` | Relasi ke `AppUser`, hanya user aktif dengan role Sales saat assignment |
| `productName` | `String?` | Maksimal 120 karakter |
| `needPurpose` | `String?` | Maksimal 500 karakter |
| `designStatus` | enum nullable | `SUDAH_ADA`, `BELUM_ADA`, atau `PERLU_DIBANTU` |
| `specification` | `String?` | Maksimal 2.000 karakter |
| `customerBudget` | `Decimal?` | Non-negatif, terpisah dari estimasi nilai |
| `leadScore` | `Int` | Default 0, rentang 0-100 |
| `lastContactedAt` | `DateTime?` | Waktu kontak aktual |
| `nextAction` | `String?` | Maksimal 500 karakter |
| `nextActionAt` | `DateTime?` | Jadwal tindakan berikutnya |
| `publicSubmissionKey` | `String?` | UUID unik untuk idempotensi form publik |

Tambahkan index untuk:

- `(stage, updatedAt)`;
- `(salesPicId, stage)`;
- `(salesPicId, nextActionAt)`;
- `(leadSourceId, createdAt)`;
- `(leadScore, stage)`.

Tambahkan model `PublicRateLimitBucket` berisi key HMAC, awal window, jumlah request, dan waktu pembaruan. Model ini hanya menyimpan fingerprint, tidak menyimpan IP atau user-agent mentah. Record berumur lebih dari 24 jam dibersihkan secara oportunistik saat request publik berikutnya diproses.

Constraint database:

- `leadScore` harus berada pada rentang 0-100;
- `customerBudget` tidak boleh negatif;
- `nextAction` dan `nextActionAt` harus terisi berpasangan;
- `publicSubmissionKey` unik ketika terisi;
- `LOST` wajib memiliki `cancelReason`;
- `DEAL` tetap hanya valid ketika memiliki Sales Order aktif melalui aturan transaksi aplikasi yang sudah ada.

### 3.2 Migrasi data lama

Gunakan mapping berikut:

| Stage lama | Stage baru |
|---|---|
| `LEAD` | `LEAD_BARU` |
| `FOLLOW_UP` | `FOLLOW_UP` |
| `PENAWARAN` | `PENAWARAN` |
| `DEAL` | `DEAL` |
| `BATAL` | `LOST` |

Untuk setiap Opportunity lama:

- salin `Customer.leadSourceId` ke `Opportunity.leadSourceId`;
- salin `Customer.salesPicId` ke `Opportunity.salesPicId`;
- pindahkan `followUpAt` menjadi `nextActionAt`;
- isi `nextAction` dengan `Follow-up customer` hanya ketika `followUpAt` lama terisi;
- isi `leadScore` dengan 0;
- biarkan field kualifikasi baru kosong agar data historis tidak difabrikasi.

Migrasi harus mempertahankan quotation, Sales Order, audit log, nomor dokumen, dan seluruh foreign key yang sudah ada.

## 4. Server, Validasi, dan Data Flow

### 4.1 Validasi

Perbarui Zod schema untuk:

- input lead satu langkah;
- pembuatan dan perubahan Opportunity;
- perpindahan stage delapan tahap;
- skor 0-100;
- budget non-negatif;
- pasangan next action dan jadwal;
- pencatatan hasil follow-up;
- nomor WhatsApp yang dinormalisasi untuk deep link tanpa mengubah nilai kontak asli.

### 4.2 Server actions

Tambahkan atau ubah action berikut:

1. `createLeadAction`
   - menerima customer baru atau `customerId` yang sudah ada;
   - membuat Customer dan Opportunity dalam satu transaksi bila customer baru;
   - menyimpan sumber, PIC, kualifikasi, skor, dan next action;
   - mencegah customer baru tanpa minimal satu kontak;
   - mencatat audit Customer dan Opportunity.

2. `updateOpportunityAction`
   - mengubah detail kebutuhan, sumber, PIC, skor, budget, spesifikasi, dan data kualifikasi;
   - tetap memakai optimistic concurrency melalui `version`.

3. `moveOpportunityStageAction`
   - menerima semua stage baru kecuali `DEAL`;
   - mewajibkan alasan untuk `LOST`;
   - tidak menghapus next action hanya karena pindah stage;
   - menutup next action ketika masuk `LOST`.

4. `recordFollowUpResultAction`
   - menambahkan catatan append-only ke `CRMNote`;
   - mengisi `lastContactedAt`;
   - mewajibkan next action baru beserta jadwal untuk opportunity terbuka, atau stage penutup `LOST`;
   - memperbarui stage bila dipilih pengguna;
   - menjalankan seluruh perubahan dalam satu transaksi dan satu audit event yang dapat ditelusuri.

5. `acceptQuotationAndDealAction`
   - mempertahankan transaksi quotation ke Sales Order yang sudah ada;
   - mengosongkan next action aktif ketika opportunity menjadi `DEAL`.

6. service `createPublicLead`
   - hanya menerima field publik minimum: nama, WhatsApp, produk/kebutuhan, quantity, deadline, kota;
   - menetapkan sumber `Landing Page` secara server-side;
   - membuat Customer dan Opportunity `LEAD_BARU` secara atomik;
   - tidak menerima PIC, score, stage, atau estimated value dari browser publik;
   - menerima UUID idempotensi dan mengembalikan hasil sukses yang sama ketika UUID dikirim ulang;
   - selalu membuat Customer baru untuk submission baru agar nomor bersama tidak salah digabungkan ke profil lama;
   - tidak mengembalikan ID internal.

Expose service tersebut melalui `POST /api/public/leads`, bukan Server Action, agar boundary HTTP, ukuran payload, origin, dan alamat request dapat diverifikasi secara eksplisit.

### 4.3 Query dan akses

- Pipeline mengambil delapan stage, kualifikasi ringkas, skor, PIC, dan next action.
- Follow-up Center memfilter opportunity terbuka berdasarkan `nextActionAt`, dengan filter PIC untuk tampilan personal.
- Dashboard memakai agregasi database, bukan menghitung seluruh dataset di browser.
- Owner/Admin dapat melihat seluruh data. Sesuai kebijakan CRM saat ini, Sales tetap dapat melihat dan mengedit seluruh data, tetapi tampilan Follow-up Center secara default difilter ke PIC yang sedang login.
- Semua query menggunakan `select` minimum dan pagination atau limit yang jelas.

## 5. Perubahan Antarmuka

### 5.1 Input lead

- Ganti dialog `New Lead` menjadi alur satu langkah dengan pilihan `Customer baru` atau `Customer tersimpan`.
- Customer baru meminta nama, minimal satu kontak, kota, sumber, dan PIC.
- Opportunity meminta produk/kebutuhan, quantity, deadline, tujuan kebutuhan, status desain, budget, spesifikasi, lead score, next action, dan jadwal.
- Customer tersimpan mengisi default sumber dan PIC dari profil, tetapi pengguna dapat mengubahnya untuk opportunity tersebut.

### 5.2 Pipeline dan detail opportunity

- Kanban menampilkan delapan kolom dengan fallback pemilih status yang tetap bisa dipakai keyboard.
- Kartu menampilkan nama customer, kebutuhan, skor/klasifikasi, PIC, nilai estimasi, dan next action terdekat.
- Detail opportunity memisahkan bagian Kualifikasi, Pipeline, Next Action, Penawaran, dan Catatan.
- `DEAL` tetap tidak dapat dipilih manual.
- `LOST` selalu meminta alasan.

### 5.3 Follow-up Center

Tambahkan route `/crm/follow-up` dengan:

- ringkasan jumlah Terlambat, Hari Ini, Besok, dan Mendatang;
- daftar terurut berdasarkan jadwal tertua;
- filter PIC dan status waktu;
- tautan ke detail opportunity;
- tombol Buka WhatsApp jika nomor tersedia;
- dialog Catat hasil follow-up;
- empty, loading, dan error state.

Navigasi `Notifikasi` yang masih berisi data contoh diganti menjadi `Follow-up`. Badge memakai jumlah overdue dan hari ini dari database.

### 5.4 Dashboard sales

Ganti widget dummy CRM dengan data nyata:

- jumlah opportunity per delapan stage;
- jumlah follow-up terlambat dan hari ini;
- total potensi omzet dari `estimatedValue` pada opportunity terbuka;
- omzet deal dari Sales Order aktif berdasarkan `acceptedAt` pada periode berjalan;
- daftar ringkas Hot Lead yang masih terbuka;
- daftar next action paling mendesak.

Widget piutang, hutang, produksi, pengeluaran, dan grafik keuangan dummy dihapus dari dashboard sampai modul sumber datanya tersedia. Sales performance per pengguna dan funnel analytics tetap ditunda ke V2.

### 5.5 Landing page

- Tambahkan formulir lead dengan field publik minimum.
- Setelah sukses, tampilkan konfirmasi tanpa mengekspos ID internal.
- Pertahankan WhatsApp sebagai alternatif kontak, bukan sebagai integrasi otomatis.
- Sediakan state submitting, sukses, validation error, rate limited, dan server error.

## 6. Keamanan Form Lead Publik

Trust boundary berada pada `POST /api/public/leads`. Aset yang dilindungi adalah data kontak customer, integritas pipeline, kapasitas database, dan detail internal CRM.

Kontrol wajib:

- terima hanya `application/json` dengan ukuran maksimum 16 KB;
- cocokkan header `Origin` dengan origin aplikasi dan tolak cross-origin request;
- validasi seluruh field dengan Zod serta trim dan batasi panjang string;
- gunakan React escaping biasa dan jangan pernah merender input sebagai HTML;
- sertakan honeypot tersembunyi; request dengan honeypot terisi menerima respons generik tanpa membuat lead;
- buat UUID idempotensi di browser dan simpan sebagai `Opportunity.publicSubmissionKey` yang unik;
- rate limit berdasarkan HMAC-SHA256 dari IP dengan secret `PUBLIC_LEAD_RATE_LIMIT_SECRET`, maksimal 5 request per 15 menit;
- lakukan increment rate-limit secara atomik di PostgreSQL sebelum membuat Customer/Opportunity;
- jangan menyimpan atau menulis IP, nomor WhatsApp, nama, maupun isi kebutuhan ke log aplikasi;
- gunakan pesan sukses generik dan error publik tanpa stack trace atau ID internal;
- tambahkan teks persetujuan bahwa data dipakai untuk menghubungi calon customer terkait kebutuhan penawaran;
- simpan data lead yang berhasil sebagai record bisnis mengikuti mekanisme archive Customer yang ada; fingerprint rate-limit dihapus setelah 24 jam;
- seed/upsert sumber `Landing Page` lewat migration, lalu resolve ID sumber hanya di server.

Abuse cases yang wajib diuji: payload terlalu besar, cross-origin submit, field tambahan untuk memaksa stage/PIC/score, spam dari fingerprint sama, UUID yang dikirim ulang, honeypot terisi, dan percobaan memasukkan markup/script.

## 7. Urutan Implementasi

1. **Migrasi fondasi**: enum, field Opportunity, relasi, index, constraint, dan backfill data lama.
2. **Domain dan validasi**: constants, label, klasifikasi skor, Zod schema, dan timezone helper.
3. **Server actions dan DAL**: lead satu langkah, update qualification, stage, follow-up result, dashboard aggregation, dan public lead.
4. **Pipeline dan detail**: delapan stage, kartu ringkas, form kualifikasi, dan next action.
5. **Follow-up Center**: query waktu, filter, WhatsApp deep link, pencatatan hasil, dan badge navigasi.
6. **Dashboard nyata**: hapus data dummy dan sambungkan agregasi CRM.
7. **Landing lead capture**: route handler, idempotensi, rate-limit database, form publik, dan alur sukses/error.
8. **Hardening dan verifikasi**: permission, audit, concurrency, accessibility, responsive behavior, serta regression quotation/Sales Order.

Setiap tahap harus lulus test dan build sebelum tahap berikutnya dianggap selesai. Migration diterapkan terlebih dahulu di environment staging dan harus memiliki backup database yang terverifikasi sebelum production deploy.

## 8. Test Plan dan Acceptance Criteria

### 8.1 Database dan migrasi

- Semua stage lama termigrasi sesuai mapping tanpa kehilangan Opportunity.
- `followUpAt` lama berpindah menjadi pasangan next action yang valid.
- Sumber dan PIC lama tersalin dari Customer ke Opportunity.
- Constraint menolak score di luar 0-100, budget negatif, pasangan next action tidak lengkap, dan `LOST` tanpa alasan.
- Quotation dan Sales Order lama tetap dapat dibuka.

### 8.2 Lead dan kualifikasi

- Lead dapat dibuat bersama customer baru dalam satu submit.
- Lead dapat dibuat untuk customer tersimpan tanpa membuat duplikat Customer.
- Sumber dan PIC Opportunity dapat berbeda dari default Customer.
- Klasifikasi Hot/Warm/Cold selalu mengikuti batas skor yang ditentukan.
- Konflik `version` menolak update stale dengan pesan aman.

### 8.3 Pipeline

- Delapan stage tampil dalam urutan yang benar.
- Semua perpindahan non-Deal dapat dilakukan melalui keyboard maupun drag-and-drop.
- `DEAL` hanya terbentuk melalui quotation diterima dan Sales Order.
- `LOST` tanpa alasan ditolak.
- Next action tidak hilang ketika berpindah antar-stage terbuka.

### 8.4 Follow-up

- Batas Terlambat, Hari Ini, dan Besok benar pada zona waktu Asia/Jakarta, termasuk pergantian bulan/tahun.
- Hanya opportunity terbuka dengan next action yang muncul.
- Catat hasil follow-up memperbarui note, kontak terakhir, next action, version, dan audit secara atomik.
- Deep link WhatsApp hanya tampil jika nomor dapat dinormalisasi.
- Badge navigasi sesuai jumlah overdue dan hari ini.

### 8.5 Dashboard

- Semua angka berasal dari database dan berubah setelah data CRM berubah.
- Potensi omzet mengecualikan `DEAL` dan `LOST`.
- Omzet deal memakai Sales Order aktif dan periode yang dipilih.
- Dashboard kosong tetap tampil baik tanpa angka buatan.

### 8.6 Landing page dan keamanan

- Payload publik tidak dapat menentukan PIC, stage, score, atau nilai transaksi.
- Input invalid, origin asing, spam di atas 5 request per 15 menit, dan request di atas 16 KB ditolak.
- Error tidak membocorkan stack trace, query, ID internal, atau keberadaan customer.
- Pengiriman ulang UUID idempotensi yang sama tidak membuat Customer atau Opportunity kedua.
- Log dan tabel rate-limit tidak menyimpan IP atau data kontak mentah.
- Fingerprint rate-limit yang berumur lebih dari 24 jam dibersihkan.

### 8.7 Regression

- Pembuatan, penerbitan, revisi, dan penerimaan quotation tetap bekerja.
- Penerimaan quotation tetap membuat satu Sales Order secara atomik.
- Reverse Sales Order tetap mengembalikan opportunity ke `PENAWARAN` dan membuka ruang untuk next action baru.
- Archive Customer tetap ditolak ketika mempunyai opportunity terbuka atau Sales Order aktif.
- Jalankan `npm test`, `npm run db:validate`, `npm run db:generate`, `npm run lint`, dan `npm run build -- --webpack`.

## 9. Definition of Done

CRM V1 dianggap selesai ketika:

- tidak ada data contoh pada Follow-up Center dan bagian CRM dashboard;
- lead dapat masuk dari internal dan landing page ke Customer serta Opportunity yang sama;
- setiap opportunity mempunyai stage, sumber, PIC, score, dan next action yang dapat dikelola;
- follow-up jatuh tempo terlihat dan dapat ditindaklanjuti tanpa mengandalkan ingatan sales;
- quotation, Deal, dan Sales Order lama tetap aman;
- migrasi, test, lint, dan build lulus;
- fitur V2/V3 yang disebut pada batas scope tidak ikut diimplementasikan.
