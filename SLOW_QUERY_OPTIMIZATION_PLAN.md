# Rencana Optimasi Slow Query Supabase

## Tujuan dan batasan

Tujuan rencana ini adalah menurunkan waktu tunggu yang benar-benar dirasakan pengguna, tanpa mengubah isi, urutan, jumlah, atau aturan akses data yang ditampilkan website. CSV dijadikan inventaris lengkap untuk investigasi, bukan bukti bahwa setiap baris menyebabkan website lambat.

- **Cakupan inventaris:** seluruh 80 baris data pada `slow-query-report-supabase.csv`, dikelompokkan menurut baris data CSV (header tidak dihitung).
- **Tidak ada optimasi produksi langsung berdasarkan CSV saja.** Nilai `index_advisor_result` adalah `null` pada 80/80 baris; belum ada rekomendasi index dari kolom tersebut.
- **Tidak menjanjikan semua query dapat dipercepat.** Sebagian query milik Supabase/Postgres, operasi backup, introspeksi, migrasi, atau `pg_sleep`; tindakan yang benar bisa berupa mengukur, mengurangi pemanggilan yang tidak perlu, mengatasi lock, atau tidak mengubah query.
- Jangan menambah index sebelum memeriksa plan, ukuran dan distribusi data, indeks yang sudah ada, beban tulis, serta biaya penyimpanan. Jangan membuat index duplikat.
- Tidak mengubah schema atau data bisnis, semantik worker/queue, hasil query, autentikasi, RLS, izin, atau role. Jika suatu perubahan diperlukan kelak, uji dahulu dan pertahankan akses role `DEVELOPER`.
- Jangan menjalankan `EXPLAIN ANALYZE` untuk statement yang mengubah data/schema di database produksi. DDL/UPDATE/INSERT diuji di staging atau database uji terisolasi.

## Ringkasan temuan awal

| Indikator | Hasil dari file |
| --- | ---: |
| Baris query | 80 |
| Kolom | 11 |
| Baris rusak saat parsing CSV | 0 |
| Total `total_time` yang terdaftar | 990,247.903 ms (sekitar 16.50 menit akumulasi) |
| `index_advisor_result` bernilai null/kosong | 80/80 |
| Query aplikasi yang dipetakan untuk penelusuran kode | 38 |
| Query katalog/operasional internal Supabase atau Postgres | 36 |
| DDL, advisory lock, sleep, atau operasi Prisma migrate yang perlu verifikasi pemilik | 6 |

**Peringatan interpretasi:** periode pengumpulan/reset statistik tidak dicantumkan di CSV. Karena itu, `total_time` adalah akumulasi pada jendela statistik yang tidak diketahui—bukan durasi satu halaman, bukan otomatis durasi satu request HTTP, dan tidak membuktikan penyebab lambat yang dirasakan client. Lima nilai `total_time` tertinggi menyumbang sekitar 57.07% dari total terdaftar, tetapi mayoritasnya tidak otomatis berasal dari jalur request website.

Baris aplikasi yang paling layak ditelusuri lebih dahulu berdasarkan kombinasi frekuensi dan waktu/risiko:

1. **#4 claim `WhatsAppAutomationJob`:** 1,145,584 panggilan; mean 0.067 ms; total 76,760.666 ms; max 69.327 ms. Total tinggi terutama karena frekuensi, sementara mean rendah. Jangan menilai sebagai bottleneck halaman tanpa bukti korelasi.
2. **#7 pembacaan seluruh `WhatsAppAccount`:** 1,039,483 panggilan; mean 0.022 ms; total 23,387.583 ms. Kode worker memanggil `findMany()` tanpa `select`; tinjau apakah semua field benar-benar dibutuhkan dan seberapa sering refresh diperlukan.
3. **#9 upsert `WhatsAppConversation`:** 121 panggilan; mean 169.712 ms; max 6,622.376 ms; ada latensi ekor ekstrem meski unique index `(accountId, remoteJid)` sudah ada. Periksa lock/konflik dan transaksi, bukan menambah unique index duplikat.
4. **#14 heartbeat account:** 68,770 update; mean 0.195 ms. Periksa kebutuhan frekuensi dan efek mengubah `updatedAt`; jangan mengubah arti heartbeat/status yang dilihat sistem.
5. **#16 job join message:** 127,090 panggilan; 819,082 rows_read; mean 0.098 ms. `WhatsAppMessage.automationJobId` sudah unique-indexed; verifikasi arti `rows_read` serta plan sebelum mengubah join.
6. **#18/#19/#27/#35/#72/#75 jalur job:** pembacaan job, perubahan status, update idempotent, hitung, dan polling berulang. Tinjau bersama agar tidak merusak lease, retry, urutan, idempotency, atau `SKIP LOCKED`.
7. **#21–23/#31/#61 invoice:** beberapa bentuk query invoice dengan relasi bertingkat. #22 dan #23 memiliki query SQL yang sama setelah normalisasi parameter, jadi evaluasi bersama, tetapi tetap simpan kedua baris metrik.
8. **#29/#53/#64 campaign:** polling dan transisi status berulang; indeks `(status, scheduledAt)` sudah ada. Ukur frekuensi dan plan sebelum mengubahnya.
9. **#30/#77 BusinessProfile:** pembacaan berulang per key unik yang sangat cepat satu kali; telusuri pemanggil dan peluang menghindari round-trip berulang dalam satu siklus, tanpa cache lintas-request yang basi.

### Indeks yang sudah tercatat di `prisma/schema.prisma`

Inventaris awal schema menunjukkan index/unique yang sudah ada untuk sejumlah jalur di CSV. Ini bukan bukti index pasti digunakan, tetapi harus diperiksa sebelum mengusulkan yang baru:

- `WhatsAppAutomationJob`: unique `idempotencyKey`, unique `(campaignId, customerId)`, index `(status, scheduledAt)`, `(status, leaseExpiresAt)`, `(customerId, status, scheduledAt)`, `(invoiceId, type, scheduledAt)`, `(opportunityId, type, scheduledAt)`, dan `(campaignId, status, scheduledAt)`.
- `WhatsAppConversation`: unique `(accountId, remoteJid)` serta index untuk customer dan waktu pesan/status inbox.
- `WhatsAppMessage`: unique `automationJobId`, index `(conversationId, occurredAt, id)`, `(status, createdAt)`, dan `(sentById, createdAt)`.
- `WhatsAppCampaign`: index `(status, scheduledAt)`.
- `WhatsAppAccount`: index `(sendEnabled, status)` dan `(heartbeatAt)`.
- `Opportunity`, `Invoice`, dan `CustomerReminder`: beberapa index filter/relasi sudah tersedia; periksa definisi model untuk query konkret.

Indeks aktual produksi dapat berbeda dari schema repository jika migrasi belum diterapkan atau drift terjadi. Cocokkan schema, migration history, dan database target sebelum tindakan.

## Tahapan kerja — todo

### Tahap 0 — Pengamanan sebelum menyentuh query

- [ ] Konfirmasi file laporan berasal dari project/database yang benar, serta tanggal dan rentang statistiknya. Ambil ulang laporan dengan periode yang diketahui bila memungkinkan.
- [ ] Buat titik baseline dan pastikan backup/restore path database tersedia sesuai prosedur client. Jangan menjalankan migrasi atau DDL di produksi saat investigasi.
- [ ] Identifikasi deployment/worker yang aktif, versi aplikasi, region compute dan Supabase, mode pooler, serta periode keluhan client.
- [ ] Tandai setiap query yang berpotensi memengaruhi pengiriman WhatsApp, lease/retry, invoice, campaign, atau transaksi keuangan sebagai jalur kritis bisnis.
- [ ] Pertahankan kontrol akses dan hasil data. Tidak ada perubahan role/RLS; akses `DEVELOPER` tetap tersedia bila pekerjaan lanjutan menambah atau menyembunyikan fitur.

**Selesai jika:** perubahan apa pun bisa diuji dan dipulihkan tanpa eksperimen langsung pada data client.

### Tahap 1 — Validasi sumber kelambatan dan baseline terukur

- [ ] Ambil statistik `pg_stat_statements`/Supabase dengan awal-akhir waktu jelas; catat apakah statistik di-reset, database/role, jumlah panggilan, mean, p95/max bila tersedia, total, rows, cache hit, dan proporsi.
- [ ] Cocokkan request lambat dari browser/server trace dengan query dan waktu eksekusi. Catat endpoint/halaman, waktu aplikasi, jumlah round-trip, pool wait, DB execution, serialisasi, dan waktu layanan eksternal secara terpisah.
- [ ] Rekam p50/p95/p99 endpoint yang dikeluhkan pada kondisi representatif, cold dan warm, termasuk payload, concurrency, dan penggunaan CPU/IO/koneksi. Jangan menyamakan total akumulasi query dengan waktu respons website.
- [ ] Ambil `EXPLAIN (ANALYZE, BUFFERS, SETTINGS)` untuk SELECT representatif di staging dengan parameter dan volume data menyerupai produksi. Gunakan role/peran setara dan perhatikan RLS bila jalurnya melalui Data API.
- [ ] Untuk INSERT/UPDATE/DDL, lakukan pengukuran eksekusi aktual hanya di staging terisolasi; `EXPLAIN` tanpa `ANALYZE` di produksi hanya bila aman dan disetujui. Waspadai trigger, sequence, lock, dan efek samping yang tidak selalu dibatalkan oleh rollback.
- [ ] Periksa slow query log, wait events, `pg_stat_activity`, blockers/`pg_locks`, koneksi aktif/menunggu, pool saturation, dan compute saturation pada rentang yang sama.
- [ ] Pastikan setiap perubahan nanti dibandingkan pada dataset dan parameter yang sama; simpan hasil output sebelum/sesudah sebagai bukti kesetaraan.

**Selesai jika:** ada daftar penyebab terukur yang menghubungkan kelambatan client ke request, query, lock, koneksi, atau faktor non-database; bukan asumsi dari ranking CSV saja.

### Tahap 2 — Pemilik query dan pemetaan ke kode

- [ ] Telusuri 38 baris aplikasi di tabel inventaris menuju pemanggil, halaman/API/worker, pola pemanggilan, dan kebutuhan setiap field.
- [ ] Tandai 36 baris sistem/internal untuk ditangani lewat metrik/konfigurasi/dukungan Supabase, bukan perubahan SQL aplikasi tanpa dasar.
- [ ] Cari pemilik enam operasi DDL/lock/sleep/migrate. Jangan menganggap semuanya bagian request client; identifikasi deploy, migration, tooling, atau pengujian yang memicunya.
- [ ] Pertahankan nomor baris CSV pada tiket, commit, hasil benchmark, dan migrasi agar tidak ada query yang hilang saat pengelompokan.

**Selesai jika:** semua 80/80 nomor baris sudah memiliki pemilik/tindakan atau alasan eksplisit mengapa tidak diubah.

### Tahap 3 — Prioritas optimasi aplikasi: volume tinggi dan queue WhatsApp

Baris utama: **#4, #7, #9, #14, #16, #18, #19, #27, #35, #41, #48, #53, #63, #64, #72, #75, #77**.

- [ ] **Claim job (#4):** ukur plan dan wait; cek selektivitas kondisi `status`, batas `scheduledAt`, `COALESCE(nextAttemptAt, scheduledAt)`, lease kedaluwarsa, urutan `scheduledAt,id`, serta efek `OR` terhadap rencana akses. Cocokkan dengan index yang sudah ada. Pertahankan `FOR UPDATE SKIP LOCKED`, batas batch, sifat atomik claim, fairness/urutan, dan pencegahan double-send. Bandingkan kandidat bentuk/index hanya di staging.
- [ ] **Account read/heartbeat (#7, #14, #28, #36):** telusuri `reloadAccounts()` dan pemanggil aplikasi. Uji proyeksi kolom minimum hanya setelah memastikan fungsi koneksi/health memakai field yang sama. Ukur frekuensi `findMany` dan heartbeat; jika mengurangi polling, buktikan tidak mengubah deteksi offline, status, atau ketepatan health. Jangan menghapus update `updatedAt` sebelum memastikan arti dan konsumen nilainya.
- [ ] **Conversation upsert (#9, #41):** ukur contention pada key `(accountId, remoteJid)`, durasi transaksi, duplicate concurrent calls, dan lock wait. Unique constraint sudah ada; jangan membuat duplikat. Uji penanganan konflik/transaction scope tanpa mengubah linking customer, unread count, preview, lastMessageAt, atau aturan idempotency.
- [ ] **Job read/join/update (#16, #18, #19, #27, #35, #72, #75):** verifikasi plan/index aktual; pertimbangkan proyeksi field minimum untuk worker hanya jika seluruh validasi/send flow tetap memperoleh field yang diperlukan. Ukur apakah poll/count/read menjadi beban nyata. Jaga status transition, lease owner/expiry, attempts, retry schedule, cancellation, message state, idempotency, dan serialization behavior.
- [ ] **Template/settings reads (#30, #48, #77):** telusuri apakah query dilakukan berulang dalam siklus yang sama. Uji pemuatan sekali per siklus/tick atau deduplikasi request lokal terlebih dahulu; jangan membuat cache global yang bisa menampilkan template atau pengaturan lama. `BusinessProfile.id` dan `WhatsAppTemplate.name` sudah key unik; pembacaan point lookup tidak otomatis membutuhkan index baru.
- [ ] **Campaign polling/status (#29, #53, #64):** periksa rencana `OR`, `ORDER BY scheduledAt,id`, dua kondisi status, serta status update massal. Index `(status, scheduledAt)` sudah tercatat. Ukur apakah polling interval dan row count menciptakan beban; pertahankan transisi PAUSED/SKIPPED/PROCESSING, cursor, snapshot dan idempotency penerima.
- [ ] **Counts/status list (#35, #58, #65, #76):** periksa apakah caller memerlukan count exact dan frekuensi query. Jangan mengganti hasil count, pagination, filter customer archived, atau stage tanpa bukti dan uji parity.
- [ ] **AuditEvent insert (#59, #69):** cek trigger/foreign key, throughput, transaksi asal dan latency tail. Jangan menghilangkan audit event, mengurangi detail, atau memindahkannya keluar transaksi bila itu mengubah jaminan audit.

**Selesai jika:** tiap kandidat sudah memiliki plan sebelum/sesudah, dampak p50/p95 aplikasi, bukti semantik identik, dan pengujian regression worker/CRM.

### Tahap 4 — Query invoice dan relasi CRM

Baris utama: **#21, #22, #23, #25, #31, #47, #58, #61, #63, #65, #66, #71, #76, #78, #80**.

- [ ] Kelompokkan query invoice berdasarkan pola dan caller: pencarian/daftar invoice, validasi consent/customer, invoice reminder worker, dan pemuatan relasi payment. #22 dan #23 adalah bentuk SQL sama dengan statistik berbeda; simpan metriknya terpisah tetapi evaluasi SQL bersama.
- [ ] Untuk #21/#31 (select invoice dengan relasi status, payment, sales order), ukur ukuran fan-out dan manfaat setiap relasi/kolom. Pastikan relasi yang diambil diperlukan untuk hasil dan worker; kurangi proyeksi hanya jika nilai yang dikonsumsi tetap sama.
- [ ] Untuk #22/#23/#61 (invoice dengan Opportunity/Customer, PendingDealPayment, SalesOrder/DealPayment/PaymentTerm/PaymentTransaction), lihat actual rows, loops, buffer reads, sort, join type, serta index FK yang benar-benar tersedia. Jangan menukar bentuk join Prisma atau memecah query menjadi banyak round trip tanpa benchmark end-to-end.
- [ ] Tinjau worker `scheduleAutomations()` yang memindai invoice `ISSUED` tiap lima menit dengan relasi pembayaran. CSV tidak cukup membuktikan seluruh pemindaian dapat dibatasi dengan aman. Jika membuat incremental scan atau pagination, definisikan cursor yang tidak melewatkan invoice baru/berubah, menangani due-date/template/config change, dan mempertahankan idempotency key/offset.
- [ ] Untuk #25/#47/#71/#78/#80 dan hitung Opportunity #58/#65, ukur filter stage, `nextActionAt`, customer aktif/WhatsApp consent, ordering, pagination, serta relasi purchase order. Periksa index existing sebelum kandidat baru; hasil, stage filter, dan akses per role harus identik.
- [ ] Untuk #63 (CustomerReminder), validasi filter due/resolved/type, consent/archived, order reminder, `NOT EXISTS` opportunity aktif, dan relasi customer. Index reminder dasar sudah ada; analisis join/anti-join aktual sebelum usulan tambahan.
- [ ] Untuk #66 (Customer list), bedakan biaya SQL dari transfer/serialisasi 153,773 rows_read agregat. Pastikan pagination dan filter archived/lifecycle tidak berubah; jangan menambahkan index teks/trigram kecuali plan dan jalur pencarian membuktikannya.
- [ ] Bandingkan hasil lama-baru: set ID, total count, field nested, urutan stabil, nilai null, batas page, dan izin Sales/Admin/Developer.

**Selesai jika:** hasil query setara persis pada fixture/clone staging dan p95 jalur CRM/reminder turun tanpa kehilangan atau duplikasi jadwal pesan.

### Tahap 5 — Kandidat index, hanya berbasis bukti

- [ ] Cocokkan indeks live database dengan `schema.prisma` dan seluruh migration yang sudah diterapkan.
- [ ] Untuk masing-masing kandidat, lampirkan plan lama/baru, estimasi penurunan buffer/latency, jumlah row terpilih, ukuran indeks, biaya pada insert/update, lock dan waktu build.
- [ ] Gunakan HypoPG/index advisor hanya untuk penyaringan kandidat bila tersedia; jangan menganggap `index_advisor_result=null` sebagai rekomendasi atau bukti tidak perlu index.
- [ ] Uji satu index pada satu waktu di staging/clone; periksa apakah planner menggunakannya dan apakah p95 endpoint membaik. Index yang tidak digunakan atau memperburuk write/plan tidak diteruskan.
- [ ] Untuk produksi, susun migration yang dapat direview, rencana `CREATE INDEX CONCURRENTLY` bila cocok dan didukung alur migration project, batas lock, monitoring, serta prosedur rollback. Jangan menjalankan migration berulang atau membuat index manual tanpa mencatat drift.
- [ ] Pertimbangkan partial/composite/functional index hanya jika predikat query dan statistik mendukung, serta urutan kolom sesuai filter/order. Hindari menggandakan index unik/FK/composite yang sudah tersedia.

**Selesai jika:** setiap index punya bukti, tujuan query, keuntungan terukur, trade-off, migration review, serta rollback; kandidat tanpa bukti tidak dibuat.

### Tahap 6 — Investigasi sistem Supabase/Postgres dan pengaruh eksternal

Baris internal: **#1, #2, #3, #6, #8, #10, #12, #13, #15, #17, #26, #32, #33, #34, #37, #38, #39, #40, #42, #43, #44, #45, #46, #49, #50, #51, #52, #55, #56, #60, #67, #68, #70, #73, #74, #79**.

- [ ] **Pooler/auth (#1, #15, #32, #34, #39, #43, #49, #52, #55):** cocokkan dengan koneksi, auth workload, pool wait, dan role Supabase. `pgbouncer.get_auth` sangat sering tetapi mean-nya rendah (0.573 ms); jangan mengubah internal pooler/Auth. Untuk Auth, gunakan metrik service/dukungan Supabase bila latency layanan tinggi.
- [ ] **Katalog, timezone, introspeksi, metadata (#2, #3, #6, #8, #10, #13, #17, #33, #42, #44, #50, #56, #60, #67, #68, #73, #79):** query menggunakan katalog dan beberapa komentar `source: dashboard`; tentukan apakah berasal dari Supabase Studio/CLI/introspeksi atau aplikasi. Hentikan/kurangi hanya tooling introspeksi yang terbukti berjalan pada jam sibuk; jangan mengedit SQL Supabase internal/frozen path.
- [ ] **Backup/Storage/maintenance (#12, #26, #38, #40, #45, #46, #51, #70):** korelasikan dengan window backup, upload/search Storage, dan maintenance. Untuk kelambatan runtime, bandingkan waktu layanan eksternal/IO dan jadwalkan investigasi dengan pemilik service; jangan mengubah schema internal `storage` atau Supabase system schemas sebagai solusi spekulatif.
- [ ] **Pool/session maintenance (#74 `DISCARD ALL`, #37 `SHOW transaction_read_only`):** tentukan hubungan dengan connection checkout/reset dan frekuensi. Jangan menghapus reset session atau konfigurasi keselamatan pooler tanpa uji kebocoran session state.
- [ ] Laporkan query internal yang bukan bagian request website secara terpisah dari temuan optimasi kode. Eskalasi ke Supabase hanya dengan timestamp, project ref melalui saluran aman, region, query role, wait event, dan trace yang relevan; jangan memasukkan token/secret ke laporan.

**Selesai jika:** aktivitas platform dipisahkan dari SQL aplikasi dan ada tindakan owner/eskalasi atau kesimpulan “tidak terkait dengan jalur website” untuk tiap nomor.

### Tahap 7 — DDL, migration lock, dan operasi non-runtime

Baris: **#5, #11, #20, #54, #57, #62**.

- [ ] **#5 `ALTER TABLE Invoice RENAME COLUMN`:** satu eksekusi memakan 75,321.838 ms dan rows_read=0. Perlakukan sebagai dugaan menunggu lock, bukan bukti rename mahal. Cari blocker/long transaction/deployment bersamaan pada waktu yang sama. Jangan jalankan ulang DDL di produksi; verifikasi migration history dan schema aktual. Untuk migrasi berikutnya, tetapkan lock timeout yang aman, rencana deploy/backfill bila diperlukan, dan strategi expand/contract yang sesuai perubahan sebenarnya.
- [ ] **#11 `pg_advisory_lock`:** mean 142.877 ms, max 18,673.930 ms. Identifikasi pemilik dan lock key dari `pg_stat_activity`/logs. Kode worker yang terlihat menggunakan `pg_try_advisory_lock`, sehingga jangan menyimpulkan bahwa baris ini berasal dari worker tersebut tanpa trace. Cari migration/deploy lain yang mengambil lock; jangan menghapus lock protektif.
- [ ] **#20 `pg_sleep`:** verifikasi apakah query diagnostik/test atau fitur; fungsi ini sengaja menunggu. Kecualikan dari optimasi runtime kecuali terbukti dipanggil oleh user flow, lalu hapus hanya dari jalur non-produksi yang benar.
- [ ] **#54/#57/#62 `CREATE DATABASE prisma_migrate_shadow_db_*`:** tiga operasi Prisma migrate sekitar 1.46–1.76 detik satu kali masing-masing. Hubungkan ke deploy/migrate. Jangan menjalankan Prisma migrate shadow database pada request website; cek pipeline/deploy concurrency, koneksi dan lock; tidak perlu optimasi untuk latensi halaman bila hanya terjadi saat deployment.

**Selesai jika:** setiap kejadian punya sumber, lock/owner, dan penanganan deploy yang jelas serta tidak ada DDL berisiko tanpa review.

### Tahap 8 — Rollout, verifikasi, dan rollback

- [ ] Jalankan unit/integration/regression test terkait dan uji endpoint melalui cara penggunaan normal di staging.
- [ ] Uji output sebelum/sesudah: field, nilai, total, urutan, status, jumlah record, permission, dan perilaku null sama. Untuk job, uji proses paralel, lock skip, expiry lease, crash/restart, retry, duplicate enqueue, dan campaign cursor.
- [ ] Benchmark sekurang-kurangnya tiga kali dengan concurrency/dataset sebanding; laporkan median dan rentang p50/p95 (serta p99 jika cukup sampel), query count, round-trip, buffer/IO, pool wait, CPU dan error rate.
- [ ] Tetapkan canary terbatas dan ambang rollback sebelum deploy. Pantau error/timeout, p95, koneksi, CPU/IO, backlog job, pesan dobel/terlewat, dan perubahan status selama rollout.
- [ ] Terapkan satu kelompok perubahan per deploy/migration agar sebab-akibat dan rollback dapat diketahui.
- [ ] Rollback kode dengan deploy versi sebelumnya; rollback index/migration hanya melalui prosedur yang sudah direview. Jangan menghapus/mereset data client untuk membatalkan optimasi.
- [ ] Setelah deploy, ambil ulang statistik pada window yang sama dan validasi bersama client pada halaman yang sebelumnya lambat.

**Selesai jika:** target p95 yang disepakati tercapai atau faktor bottleneck telah dilokalisasi; tidak ada perubahan data/output/permission, error, atau backlog abnormal; dan rollback siap.

## Pemetaan lengkap seluruh baris CSV

`#` adalah nomor **baris data** mulai dari 1 setelah header. `mean` dan `total` dalam ms; `calls` sesuai CSV. Ringkasan query hanya label identifikasi agar query panjang katalog mudah dipetakan kembali ke CSV asli.

| # | Pemilik awal | Query / objek utama | Calls | Mean ms | Total ms | Jalur rencana |
|---:|---|---|---:|---:|---:|---|
| 1 | Internal | `pgbouncer.get_auth` | 338,781 | 0.573 | 194,031.494 | Tahap 6: pooler; ukur volume dan mean, jangan edit internal. |
| 2 | Internal | daftar `pg_timezone_names` | 267 | 440.266 | 117,551.081 | Tahap 6: identifikasi caller/layanan, korelasi waits. |
| 3 | Internal | `pg_available_extensions` + extension/schema catalog | 213 | 476.210 | 101,432.638 | Tahap 6: katalog/introspeksi; bukan SQL aplikasi tanpa bukti. |
| 4 | Aplikasi | claim/update `WhatsAppAutomationJob`, `FOR UPDATE SKIP LOCKED` | 1,145,584 | 0.067 | 76,760.666 | Tahap 3: worker, plan/status/OR/COALESCE/poll volume. |
| 5 | Operasi | `ALTER TABLE Invoice RENAME COLUMN totalTax TO totalProfit` | 1 | 75,321.838 | 75,321.838 | Tahap 7: cari lock blocker dan migration; jangan rerun di prod. |
| 6 | Internal | introspeksi PostgreSQL `pg_proc`/function metadata (`with f as...`) | 81 | 702.377 | 56,892.532 | Tahap 6: identifikasi dashboard/CLI dan waktu eksekusi. |
| 7 | Aplikasi | select seluruh `WhatsAppAccount` | 1,039,483 | 0.022 | 23,387.583 | Tahap 3: cek `reloadAccounts()`, fields, frekuensi. |
| 8 | Internal | scoped pgMeta table/column/relationship introspection | 15 | 1,430.685 | 21,460.268 | Tahap 6: dashboard/introspeksi; jangan ubah query internal. |
| 9 | Aplikasi | upsert `WhatsAppConversation` pada `(accountId, remoteJid)` | 121 | 169.712 | 20,535.100 | Tahap 3: lock/contention, transaksi; unique index sudah ada. |
| 10 | Internal | katalog `pg_class`/`pg_namespace` untuk table/column list | 81 | 249.935 | 20,244.733 | Tahap 6: dashboard/schema discovery. |
| 11 | Operasi/unknown | `pg_advisory_lock` | 131 | 142.877 | 18,716.838 | Tahap 7: identifikasi lock owner/key; jangan buang lock. |
| 12 | Internal | `pg_backup_start` / WAL file/LSN | 64 | 260.962 | 16,701.555 | Tahap 6: korelasi backup window. |
| 13 | Internal | authenticator catalog introspection untuk relation/column metadata | 268 | 52.116 | 13,966.976 | Tahap 6: identifikasi pemanggil Data API/metadata. |
| 14 | Aplikasi | update `WhatsAppAccount.heartbeatAt` dan `updatedAt` | 68,770 | 0.195 | 13,433.377 | Tahap 3: heartbeat cadence dan efek timestamp. |
| 15 | Internal | type metadata (`pg_type`, `pg_attribute`, `pg_range`) | 269 | 47.484 | 12,773.301 | Tahap 6: pooler/type introspection. |
| 16 | Aplikasi | `WhatsAppAutomationJob` LEFT JOIN `WhatsAppMessage` | 127,090 | 0.098 | 12,396.181 | Tahap 3: cek row metrics dan unique index automationJobId. |
| 17 | Internal | authenticator function/return-type catalog introspection | 208 | 59.572 | 12,390.950 | Tahap 6: metadata/role; cari korelasi runtime. |
| 18 | Aplikasi | load job detail + customer/message/conversation relations | 43,267 | 0.280 | 12,122.054 | Tahap 3: proyeksi worker dengan parity check. |
| 19 | Aplikasi | update status/attempts `WhatsAppAutomationJob` by id | 43,195 | 0.203 | 8,759.154 | Tahap 3: worker transition; validasi retry/lease. |
| 20 | Operasi/unknown | `pg_sleep` | 23 | 356.947 | 8,209.783 | Tahap 7: tentukan test/diagnostic; sleep bukan query tuning. |
| 21 | Aplikasi | Invoice select status + opportunity/pending payment/sales order | 32,173 | 0.214 | 6,889.963 | Tahap 4: cocokkan caller dan kebutuhan relasi. |
| 22 | Aplikasi | Invoice + Opportunity/Customer + payment relations, query bentuk A | 2,508 | 2.588 | 6,489.575 | Tahap 4: execution plan dan fan-out; kelompokkan dengan #23. |
| 23 | Aplikasi | Invoice + Opportunity/Customer + payment relations, query bentuk sama | 5,415 | 1.178 | 6,378.080 | Tahap 4: query SQL sama dengan #22; metrik tetap terpisah. |
| 24 | Aplikasi | `AppUser` lookup by `authUserId` | 181,129 | 0.035 | 6,370.781 | Tahap 2/4: trace auth/user lookup; unique key sudah ada. |
| 25 | Aplikasi | Opportunity follow-up due + Customer/SalesPic | 37,241 | 0.159 | 5,905.764 | Tahap 4: filter stage/nextActionAt/consent dan plan. |
| 26 | Internal | `pg_backup_stop` | 64 | 91.820 | 5,876.474 | Tahap 6: korelasi backup/maintenance. |
| 27 | Aplikasi | update job oleh `idempotencyKey`, status QUEUED/RETRY | 49,601 | 0.109 | 5,413.104 | Tahap 3: unique idempotency key ada; inspect caller/round-trip. |
| 28 | Aplikasi | WhatsApp account list ordering `sendEnabled`, `updatedAt` | 127,126 | 0.038 | 4,837.768 | Tahap 3: endpoint/frequency; cek index dan output list. |
| 29 | Aplikasi | campaign due / PROCESSING snapshot query | 36,370 | 0.129 | 4,709.650 | Tahap 3: polling, OR/order; index status/scheduledAt sudah ada. |
| 30 | Aplikasi | `BusinessProfile` id lookup (name + reminder offsets) | 37,186 | 0.119 | 4,436.071 | Tahap 3: deduplikasi dalam tick; jangan cache lintas request. |
| 31 | Aplikasi | Invoice by id + payment relations, query bentuk lain | 11,070 | 0.380 | 4,202.876 | Tahap 4: identifikasi caller dan pastikan status/payment semantics. |
| 32 | Internal | Supabase Auth insert `refresh_tokens` | 698 | 5.600 | 3,908.619 | Tahap 6: Auth workload; service-level investigation. |
| 33 | Internal | pgMeta frozen legacy table introspection | 134 | 27.762 | 3,720.118 | Tahap 6: frozen legacy path, jangan diedit. |
| 34 | Internal | Supabase Auth update/revoke `refresh_tokens` | 500 | 7.106 | 3,552.776 | Tahap 6: Auth workload. |
| 35 | Aplikasi | count `WhatsAppAutomationJob` by status | 126,539 | 0.027 | 3,363.707 | Tahap 3: exact count requirement/frequency. |
| 36 | Aplikasi | WhatsApp account listing, fields exclude pairing fields | 68,540 | 0.049 | 3,337.720 | Tahap 3: telusuri endpoint/UI dan kebutuhan projection. |
| 37 | Internal | `SHOW transaction_read_only` | 18,116 | 0.181 | 3,281.699 | Tahap 6: koneksi/pooler config observation. |
| 38 | Internal | insert `storage.objects` | 183 | 15.239 | 2,788.699 | Tahap 6: Storage upload latency, jangan edit internal schema. |
| 39 | Internal | Supabase Auth lookup `refresh_tokens` by token | 2,624 | 0.971 | 2,547.770 | Tahap 6: Auth workload; correlate with login/session traces. |
| 40 | Internal | Supabase large-object/table-size report | 19 | 133.209 | 2,530.962 | Tahap 6: admin reporting/maintenance. |
| 41 | Aplikasi | second `WhatsAppConversation` upsert shape | 66 | 36.801 | 2,428.844 | Tahap 3: inspect conflict rate and caller, group with #9. |
| 42 | Internal | pgMeta tables/columns/relationships introspection (legacy) | 1 | 2,380.651 | 2,380.651 | Tahap 6: Studio/schema tooling, not app SQL assumption. |
| 43 | Internal | Supabase Auth session lookup by id | 4,041 | 0.568 | 2,296.158 | Tahap 6: Auth/session service metrics. |
| 44 | Internal | authenticator routine/type catalog query | 59 | 38.224 | 2,255.221 | Tahap 6: metadata introspection. |
| 45 | Internal | Supabase `pgmq` extension table ownership DO block | 51 | 43.718 | 2,229.623 | Tahap 6: extension maintenance. |
| 46 | Internal | Supabase foreign-key catalog listing | 64 | 33.184 | 2,123.790 | Tahap 6: metadata/maintenance query. |
| 47 | Aplikasi | Customer list with customer type/lead source/SalesPic | 3 | 677.737 | 2,033.212 | Tahap 4: small sample; profile actual request and plan. |
| 48 | Aplikasi | active WhatsApp template select | 38,170 | 0.051 | 1,964.830 | Tahap 3: measure template lookup; inspect active/type index fit. |
| 49 | Internal | Supabase Auth update `users.last_sign_in_at` | 698 | 2.733 | 1,907.953 | Tahap 6: Auth request path. |
| 50 | Internal | Supabase type catalog list | 188 | 10.077 | 1,894.549 | Tahap 6: metadata introspection. |
| 51 | Internal | Storage `storage.search` | 897 | 2.026 | 1,817.325 | Tahap 6: Storage search/service metrics. |
| 52 | Internal | Supabase Auth insert `sessions` | 198 | 9.050 | 1,791.830 | Tahap 6: Auth session creation. |
| 53 | Aplikasi | update PAUSED `WhatsAppCampaign` to SKIPPED when due | 36,931 | 0.048 | 1,774.089 | Tahap 3: polling and update; retain campaign transition behavior. |
| 54 | Operasi | Prisma `CREATE DATABASE prisma_migrate_shadow_db_*` (instance A) | 1 | 1,763.977 | 1,763.977 | Tahap 7: deployment/migration only. |
| 55 | Internal | Supabase Auth user lookup by instance and id | 2,845 | 0.611 | 1,738.887 | Tahap 6: Auth request path. |
| 56 | Internal | authenticator recursive view key/dependency introspection | 268 | 6.003 | 1,608.894 | Tahap 6: catalog query; do not alter platform SQL. |
| 57 | Operasi | Prisma `CREATE DATABASE prisma_migrate_shadow_db_*` (instance B) | 1 | 1,601.365 | 1,601.365 | Tahap 7: deployment/migration only. |
| 58 | Aplikasi | Opportunity count grouped by stage and Customer archived filter | 2,432 | 0.641 | 1,558.929 | Tahap 4: dashboard count/filter/permissions parity. |
| 59 | Aplikasi | insert public `AuditEvent` | 363 | 4.202 | 1,525.492 | Tahap 3: preserve audit event and transaction semantics. |
| 60 | Internal | pgMeta schema/owner introspection | 240 | 6.295 | 1,510.858 | Tahap 6: dashboard metadata query. |
| 61 | Aplikasi | Invoice list with nested payment and opportunity relations | 420 | 3.555 | 1,492.995 | Tahap 4: query plan, relation fan-out and output parity. |
| 62 | Operasi | Prisma `CREATE DATABASE prisma_migrate_shadow_db_*` (instance C) | 1 | 1,464.847 | 1,464.847 | Tahap 7: deployment/migration only. |
| 63 | Aplikasi | `CustomerReminder` due query with customer/opportunity `NOT EXISTS` | 37,185 | 0.039 | 1,461.584 | Tahap 4: worker query, anti-join and reminder correctness. |
| 64 | Aplikasi | campaign ids in PROCESSING with completed snapshot | 36,947 | 0.039 | 1,438.772 | Tahap 3: polling/count completion; campaign lifecycle parity. |
| 65 | Aplikasi | Opportunity count with joined Customer filter | 19,530 | 0.070 | 1,364.733 | Tahap 4: exact count, filter and call frequency. |
| 66 | Aplikasi | Customer list with archived/lifecycle filters | 392 | 3.275 | 1,283.852 | Tahap 4: distinguish DB time from large aggregate rows/transfer. |
| 67 | Internal | pgMeta scoped tables/columns metadata query | 12 | 106.426 | 1,277.113 | Tahap 6: introspection; identify source and time. |
| 68 | Internal | authenticator constraint/index metadata introspection | 268 | 4.757 | 1,274.831 | Tahap 6: metadata request. |
| 69 | Aplikasi | insert public `AuditEvent` (same family, separate normalized entry) | 338 | 3.737 | 1,263.061 | Tahap 3: combine diagnosis with #59, retain separate counts. |
| 70 | Internal | `set_config` for service-role JWT/session context | 4,777 | 0.264 | 1,258.942 | Tahap 6: Data API/service-role request overhead. |
| 71 | Aplikasi | Opportunity detail/list with PO/product relations | 601 | 2.060 | 1,237.792 | Tahap 4: caller, select shape, actual join plan. |
| 72 | Aplikasi | WhatsAppAutomationJob select by idempotency/relations | 23,623 | 0.051 | 1,199.940 | Tahap 3: worker/job read and idempotency path. |
| 73 | Internal | catalog/information_schema column metadata | 12 | 96.301 | 1,155.606 | Tahap 6: introspection and source. |
| 74 | Internal | `DISCARD ALL` | 688 | 1.603 | 1,103.116 | Tahap 6: inspect pool session reset; preserve isolation. |
| 75 | Aplikasi | WhatsAppAutomationJob select by idempotency key and relations | 23,662 | 0.046 | 1,083.162 | Tahap 3: group with #72; inspect duplicate calls/round-trips. |
| 76 | Aplikasi | Customer count by `createdAt` range | 1,105 | 0.950 | 1,049.259 | Tahap 4: count selectivity and page endpoint; validate exact count. |
| 77 | Aplikasi | BusinessProfile id lookup for name | 37,164 | 0.028 | 1,025.377 | Tahap 3: repeated per-tick/call; key lookup already indexed. |
| 78 | Aplikasi | Opportunity with PO/Invoice/payment relations, query shape A | 248 | 4.121 | 1,022.076 | Tahap 4: relation fan-out and projection. |
| 79 | Internal | authenticator role/session settings catalog query | 208 | 4.706 | 978.870 | Tahap 6: metadata/role configuration introspection. |
| 80 | Aplikasi | Opportunity with PO/Invoice/payment relations, query shape B | 174 | 5.605 | 975.240 | Tahap 4: compare with #78; preserve result and access behavior. |

## Status pelaksanaan lokal (28 Oktober 2026)

Status ini membedakan pekerjaan kode lokal dari audit database/deployment. Checklist tahapan di atas tetap terbuka bila memerlukan bukti atau akses lingkungan yang belum tersedia; lulus build lokal bukan bukti query produksi sudah lebih cepat.

**Selesai secara lokal (belum mengukur dampak latency produksi):**

- [x] Inventaris 80 baris tetap dipetakan ke owner/tindakan pada tabel; baris internal/operasional tidak dianggap sebagai SQL yang dapat diperbaiki di aplikasi.
- [x] Worker `reloadAccounts()` dan `getWhatsAppAccounts()` kini hanya mengambil field yang dibutuhkan UI/worker; proyeksi halaman admin tetap memuat semua field yang dirender dan role check tetap dipertahankan.
- [x] Daftar customer, ekspor, popup, dan halaman detail membatasi reminder ke satu jadwal terdekat; query detail tetap memuat histori opportunity yang dipakai untuk form komunikasi dan status aktivitas.
- [x] Worker hanya mengambil field template aktif, account pengirim, job, dan relasi pesan yang dikonsumsi. Update/upsert yang hanya memerlukan keberhasilan kini memilih `id` (atau `sentById` saat dipakai), bukan mengembalikan seluruh row.
- [x] Validasi sumber `INVOICE_ISSUED` sekarang tidak mengambil relasi payment bertingkat yang hanya dibutuhkan oleh pengingat invoice jatuh tempo; pemeriksaan status invoice, customer archived, dan consent tetap sama.
- [x] Campaign worker mengganti `count` penerima yang hanya dipakai untuk tes kosong dengan `findFirst` satu kolom; pengecekan status selesai mengelompokkan job pending untuk maksimal 50 campaign dalam satu query, bukan satu `count` per campaign. Status pending tetap mencakup QUEUED/PROCESSING/RETRY.
- [x] Worker inbound/egress memilih hasil minimal `id`/`sentById` dari conversation, message, dan job query terkait tanpa mengubah nilai tersimpan atau status transisi.
- [x] Menambahkan regression test untuk query shape/proyeksi dan validasi yang tetap wajib.

**Belum dapat diselesaikan secara lokal (tidak diklaim optimal/cepat):**

- [ ] CSV tidak memberikan source map lengkap untuk semua query aplikasi (mis. beberapa Invoice/Opportunity/Customer, AppUser, dan AuditEvent), execution plans, parameter, wait events, indeks aktual atau rentang waktu statistik. Optimasi bentuk query/data path yang aman memerlukan pencocokan satu per satu dengan trace dan `EXPLAIN (ANALYZE, BUFFERS)` di staging representatif.
- [ ] Claim job (#4), contention conversation (#9/#41), invoice scan penuh, halaman CRM/customer/Opportunity/Invoice lain, Auth, dan audit insert belum diubah selain proyeksi kolom pada jalur yang terbukti.
- [ ] Pengurangan heartbeat dari setiap tick ke interval 10 detik belum diverifikasi melawan timeout health 30 detik di kondisi worker terlambat; tinjau sebelum rollout agar status offline tidak false positive.
- [ ] Tidak ada indeks atau migrasi ditambahkan berdasarkan dugaan. Schema Prisma hanya bukti repository; indeks terpasang di database live perlu dicek.
- [ ] Query internal Supabase/Postgres, Auth, Storage, backup, metadata, advisory lock, DDL, sleep dan Prisma migrate tidak bisa dioptimalkan dari aplikasi ini; pemilik platform/operasi perlu mengorelasikan waktu/lock/service trace.
- [ ] Tidak tersedia baseline p95 request/trace dan akses staging yang dapat dipakai untuk menguji parity serta actual plan. Tidak ada query atau perubahan database produksi, canary, deploy, atau pengukuran sesudah perubahan.

Perubahan lokal mengurangi byte hasil yang dikirim database untuk beberapa jalur worker, menurunkan round-trip hitung per campaign, membatasi pembacaan reminder/opportunity yang tidak diperlukan di customer detail, dan menghindari pembacaan relasi invoice pada validasi invoice terbit. Hal itu belum membuktikan website bebas slow query atau query tersebut menjadi cepat; klaim tersebut baru sah setelah benchmark staging/produksi yang terkontrol dan pengukuran request end-to-end.

## Kriteria penerimaan akhir

- [x] Seluruh **80 baris** tetap tercatat satu per satu dan diarahkan ke owner/tahap; item internal/operasional tidak keliru dianggap SQL aplikasi.
- [ ] Query aplikasi yang benar-benar diubah telah diverifikasi terhadap actual plan dan index aktual; tidak ada index spekulatif atau duplikat. (Belum tersedia plan live/staging pada sesi ini.)
- [ ] Perubahan query tidak mengubah data, hasil tampilan/count, hak akses, urutan, atau logika bisnis; proyeksi lokal mengunci field yang digunakan lewat regression test, tetapi perlu parity test dengan fixture/staging.
- [ ] Jalur worker tidak melewatkan/menggandakan pekerjaan, reminder, pesan, atau campaign; status worker perlu diuji di database staging paralel/crash/retry sebelum rollout.
- [ ] Benchmark kondisi setara tersedia, menampilkan median/rentang dan p95 request, serta memisahkan DB execution dari pool/network/application overhead.
- [ ] Deploy memiliki canary, monitoring, serta rollback yang diuji; client dapat mengonfirmasi halaman yang dikeluhkan lebih responsif.
- [x] Query internal Supabase/Postgres dan operasi deploy ditandai terpisah dari query aplikasi dan tidak diubah dengan spekulasi.

## Rujukan

- Supabase: [Debugging performance issues](https://supabase.com/docs/guides/database/debugging-performance) — gunakan execution planner; `EXPLAIN` untuk memahami rencana, dan batasi penggunaan plan endpoint karena dapat mengungkap struktur database.
- Supabase: [Query Optimization](https://supabase.com/docs/guides/database/query-optimization) — gunakan plan untuk memutuskan index, pahami partial/composite index, dan hindari over-indexing karena index menambah biaya tulis.
- Repository: `prisma/schema.prisma` — sumber awal pemetaan model/index; harus dicocokkan dengan migrasi dan database yang benar.
- Repository: `worker/whatsapp.mjs`, `lib/whatsapp/data.ts`, `lib/whatsapp/jobs.ts` — titik awal penelusuran query WhatsApp yang ditemukan.
- Repository: `PERFORMANCE_OPTIMIZATION_PLAN.md` — rencana performa navigasi yang sudah ada. Rencana ini berdiri sendiri untuk slow query database dan tidak menggantikan atau mengubah scope dokumen tersebut.
