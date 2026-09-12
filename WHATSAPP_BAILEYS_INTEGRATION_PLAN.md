# Rencana Integrasi WhatsApp Baileys ASKonveksi

## Status Dokumen

- Status: Planned
- Terakhir diperbarui: 10 September 2026
- Target aplikasi: Next.js di Vercel
- Target worker: managed container always-on dengan persistent volume
- Timezone operasional: `Asia/Jakarta`
- Jam pengiriman otomatis: setiap hari pukul 09.00-17.00 WIB

## Tujuan

Mengintegrasikan WhatsApp ke ERM ASKonveksi agar sistem dapat:

- Mengirim dan menerima chat customer dari dalam ERM.
- Mengirim teks, gambar, dokumen, dan PDF invoice.
- Menjalankan follow-up otomatis berdasarkan `nextActionAt`.
- Menjalankan reminder repeat order dan reactivation yang sudah tersedia.
- Mengirim invoice ketika diterbitkan serta reminder H-3, hari H, dan H+3 jika belum lunas.
- Menyimpan seluruh aktivitas WhatsApp yang relevan pada timeline CRM.
- Mengelola beberapa nomor bisnis dengan satu nomor aktif dan failover manual.
- Menampilkan pesan dari nomor yang belum dikenal agar dapat ditautkan ke customer.

## Keputusan Produk yang Sudah Dikunci

| Area | Keputusan |
| --- | --- |
| Deployment Next.js | Tetap di Vercel |
| Runtime Baileys | Worker Node.js terpisah pada managed container always-on |
| Jumlah nomor | Beberapa nomor bisnis, tidak dibedakan per sales/PIC |
| Nomor pengirim | Hanya satu nomor aktif pada satu waktu |
| Failover | Manual oleh OWNER/ADMIN |
| Inbox | Chat dua arah di dalam ERM |
| Media V1 | Teks, gambar, dokumen, dan PDF invoice |
| Nomor asing | Masuk ke inbox "Belum dikenal" |
| Akses SALES | Hanya customer yang ditugaskan kepadanya |
| Pengelola template | OWNER/ADMIN |
| Pengirim pesan | OWNER/ADMIN/SALES sesuai hak akses customer |
| Follow-up | Otomatis saat jadwal jatuh tempo |
| Invoice | Saat terbit, H-3, hari H, dan H+3 jika belum lunas |
| Balasan inbound | Dicatat tanpa membatalkan jadwal automasi |

## Risiko dan Batasan

Baileys adalah client WhatsApp tidak resmi berbasis WebSocket. WhatsApp dapat membatasi atau memblokir nomor yang menggunakan unofficial client, bulk messaging, atau automasi yang dianggap mengganggu. Nomor cadangan hanya membantu kontinuitas operasional dan tidak menghilangkan risiko tersebut.

Kendali minimum yang wajib diterapkan:

- Tidak menyediakan broadcast massal pada V1.
- Pengiriman otomatis hanya untuk customer yang memiliki relasi bisnis di ERM.
- Membatasi pengiriman otomatis pada jam operasional; pesan manual dikirim segera.
- Menyediakan kill switch per account dan per template.
- Menyembunyikan nomor, JID, isi pesan, pairing code, dan auth state dari log produksi.
- Mem-pin versi Baileys `7.x` yang sudah diuji; jangan menggunakan branch `master`.

Referensi:

- [Baileys documentation](https://baileys.wiki/)
- [Baileys security guidance](https://github.com/WhiskeySockets/Baileys/security)
- [WhatsApp Messaging Guidelines](https://www.whatsapp.com/legal/messaging-guidelines)
- [WhatsApp unauthorized automation notice](https://faq.whatsapp.com/5957850900902049)

## Arsitektur

```text
Browser
  |
  v
Next.js 16 di Vercel
  - UI inbox, account, template, dan job
  - Server Actions dan Route Handlers
  - Validasi role, ownership, payload, dan media
  |
  v
Supabase
  - Postgres: account, conversation, message, dan outbox job
  - Private Storage: media WhatsApp
  ^
  |
Managed container, satu replica
  - Scheduler setiap menit
  - Queue consumer
  - Baileys socket lifecycle
  - Inbound message dan receipt handler
  - Persistent encrypted auth volume
  |
  v
WhatsApp
```

### Batas Tanggung Jawab

**Next.js/Vercel**

- Menyediakan seluruh UI dan server action.
- Memvalidasi user, role, dan ownership.
- Menulis permintaan kirim ke outbox database.
- Tidak membuka atau mempertahankan socket Baileys.
- Tidak mengirim pesan langsung ke WhatsApp.

**WhatsApp worker**

- Menjadi satu-satunya proses yang membuka socket Baileys.
- Menyimpan dan memperbarui auth state serta Signal keys.
- Membuat job otomatis dan mengonsumsi outbox.
- Menyimpan pesan inbound dan delivery/read receipt.
- Mengunduh dan mengunggah media sesuai batas keamanan.
- Tidak menyediakan endpoint pengiriman publik.

**Supabase Postgres**

- Menjadi sumber kebenaran status account, conversation, message, dan job.
- Menjamin idempotensi dan locking ketika job diproses.
- Menyimpan audit trail untuk tindakan administratif dan pengiriman.

## Setup Infrastruktur

### Vercel

Environment yang tetap digunakan:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

Tidak ada auth state Baileys atau socket WhatsApp di Vercel.

### Managed Container

Kebutuhan runtime:

- Node.js 20 atau lebih baru.
- Satu replica aktif.
- Always-on process.
- Persistent volume terenkripsi.
- Restart policy otomatis.
- Health check proses dan status koneksi database.
- Akses outbound WebSocket/HTTPS.

Environment worker:

```dotenv
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SECRET_KEY=
WHATSAPP_AUTH_PATH=/data/baileys-auth
WHATSAPP_AUTH_ENCRYPTION_KEY=
WHATSAPP_TIMEZONE=Asia/Jakarta
WHATSAPP_WORKER_ID=worker-1
WHATSAPP_LOG_LEVEL=warn
```

Ketentuan deployment:

- Mount volume pada nilai `WHATSAPP_AUTH_PATH`.
- Jangan memasukkan auth directory ke Git atau container image.
- Jangan menjalankan dua replica terhadap auth state yang sama.
- Backup volume dalam kondisi terenkripsi.
- Gunakan nomor staging sebelum pairing nomor produksi.

### Supabase Storage

Buat bucket private `whatsapp-media` untuk media inbound dan outbound.

Aturan V1:

- File hanya diakses melalui server dengan pemeriksaan role dan ownership.
- Validasi MIME aktual, ekstensi, ukuran, dan nama file.
- Nama object dibangkitkan server dan tidak memakai nama file mentah sebagai path.
- Default retensi media adalah 12 bulan dan harus dapat diubah kemudian tanpa mengubah schema pesan.

## Perubahan Database

### Enum Baru

- `WhatsAppAccountStatus`: `DISCONNECTED`, `PAIRING`, `CONNECTED`, `LOGGED_OUT`, `ERROR`.
- `WhatsAppMessageDirection`: `INBOUND`, `OUTBOUND`.
- `WhatsAppMessageKind`: `TEXT`, `IMAGE`, `DOCUMENT`.
- `WhatsAppMessageStatus`: `QUEUED`, `SENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`, `CANCELLED`.
- `WhatsAppJobType`: `MANUAL`, `NEXT_ACTION`, `REPEAT_ORDER`, `REACTIVATION`, `INVOICE_ISSUED`, `INVOICE_DUE`.
- `WhatsAppJobStatus`: `QUEUED`, `PROCESSING`, `COMPLETED`, `RETRY`, `FAILED`, `CANCELLED`.
- `WhatsAppConsentStatus`: `UNKNOWN`, `OPTED_IN`, `OPTED_OUT`.

### Model Baru

#### `WhatsAppAccount`

- Identitas/label account dan nomor WhatsApp.
- Status koneksi dan `sendEnabled`.
- Waktu koneksi, disconnect, dan heartbeat terakhir.
- Pesan error terakhir yang sudah disanitasi.
- Pairing request, pairing code sementara, dan expiry.
- Tidak menyimpan credential Baileys mentah.

#### `WhatsAppTemplate`

- Nama unik dan tipe pemicu.
- Body template dan status aktif.
- `createdById`, `updatedById`, dan `version` untuk optimistic locking.
- Satu template aktif per tipe pemicu pada V1.

#### `WhatsAppConversation`

- Account pengirim/penerima dan remote JID.
- `customerId` nullable untuk nomor belum dikenal.
- Waktu pesan terakhir, preview terakhir, unread count, dan status resolved.
- Unique constraint pada `(accountId, remoteJid)`.

#### `WhatsAppMessage`

- Conversation dan ID pesan WhatsApp.
- Arah, jenis, body teks, dan status.
- Metadata media: storage path, MIME, ukuran, dan nama asli.
- `sentById` nullable untuk pesan otomatis/inbound.
- `automationJobId` nullable.
- Timestamp queued, sent, delivered, read, dan failed.
- Unique constraint pada `(accountId, whatsappMessageId)`.

#### `WhatsAppAutomationJob`

- `idempotencyKey` unik.
- Tipe job dan relasi nullable ke customer, opportunity, invoice, atau reminder.
- Snapshot payload/template yang akan dikirim.
- Waktu schedule, lease, attempt, next retry, dan completion.
- Account yang akhirnya digunakan.
- Error terakhir yang sudah disanitasi.

### Perubahan `Customer`

- `whatsappConsentStatus`, default `UNKNOWN`.
- `whatsappOptedInAt` dan `whatsappOptInSource` nullable.
- `whatsappOptedOutAt` dan `whatsappOptOutReason` nullable.

### Index

- Job: `(status, scheduledAt)` dan `(status, leaseExpiresAt)`.
- Message: `(conversationId, createdAt)` serta unique account/message ID.
- Conversation: `(customerId, lastMessageAt)` dan remote JID.
- Account: `(sendEnabled, status)`.
- Template: `(triggerType, isActive)`.

## Aturan Nomor WhatsApp

- Simpan nomor dalam bentuk E.164 tanpa tanda `+`, contoh `6281234567890`.
- Normalisasi `08...` menjadi `628...` di trust boundary.
- Tolak nomor yang tidak dapat dinormalisasi secara deterministik.
- Satu customer hanya menggunakan field WhatsApp existing sebagai tujuan utama pada V1.
- OWNER/ADMIN memilih satu account sebagai `sendEnabled=true`.
- Mengaktifkan account baru menonaktifkan account lama dalam satu transaksi.
- Jika account aktif offline, antrean berhenti dan memberi peringatan; tidak ada failover otomatis.

## Aturan Template

Variabel V1:

- `{{customer_name}}`
- `{{company_name}}`
- `{{sales_pic_name}}`
- `{{opportunity_no}}`
- `{{opportunity_title}}`
- `{{next_action}}`
- `{{invoice_no}}`
- `{{invoice_total}}`
- `{{invoice_due_date}}`
- `{{business_name}}`

Ketentuan:

- Template ditolak jika memakai variabel di luar allowlist.
- Preview menggunakan data contoh yang diberi label sebagai preview.
- Job menyimpan snapshot hasil render sehingga perubahan template tidak mengubah job lama.
- Pemicu tanpa template aktif menghasilkan status skipped/failed yang terlihat, bukan fallback teks tersembunyi.
- Body hasil render tidak boleh kosong.

## Aturan Automasi

### Jam Operasional

- Worker memeriksa antrean setiap 5 detik dan membentuk automasi setiap menit.
- Pengiriman otomatis hanya berlangsung setiap hari pukul 09.00-17.00 WIB; pengiriman manual tidak ditunda.
- Job sebelum pukul 09.00 menunggu pukul 09.00 pada hari yang sama.
- Job pada atau setelah pukul 17.00 menunggu pukul 09.00 hari berikutnya.

### Follow-up Opportunity

- Ketika `nextActionAt` jatuh tempo, buat satu job `NEXT_ACTION`.
- Job memakai template follow-up aktif dan data opportunity terbaru saat job dibuat.
- Idempotency key menggabungkan opportunity, `nextActionAt`, dan tipe job.
- Perubahan `nextActionAt` membatalkan job lama yang belum diproses dan membuat job baru.
- Opportunity `DEAL` atau `LOST` tidak menerima follow-up opportunity baru.

### Repeat Order dan Reactivation

- Gunakan `CustomerReminder` yang sudah ada sebagai sumber schedule.
- Buat job `REPEAT_ORDER` atau `REACTIVATION` saat `dueAt` tercapai.
- Reminder resolved atau generation lama tidak boleh dikirim.
- Jadwal yang di-rearm memakai generation/idempotency key baru.

### Invoice

- Invoice `DRAFT` tidak dikirim otomatis.
- Transisi menjadi `ISSUED` membuat satu job `INVOICE_ISSUED` beserta PDF.
- Invoice belum lunas membuat reminder H-3, hari H, dan H+3.
- Reminder dilewati jika invoice lunas, superseded, dibatalkan, atau tidak lagi valid.
- Perubahan due date membatalkan reminder lama yang masih queued dan membentuk schedule baru.
- Worker menggunakan generator PDF invoice existing agar dokumen ERM dan WhatsApp identik.

### Validasi Customer

- Customer archived, nomor kosong, atau nomor invalid tidak boleh dikirimi.
- Kolom consent lama tetap dipertahankan untuk kompatibilitas database, tetapi tidak digunakan oleh fitur WhatsApp.

## Pemrosesan Antrean

- Claim job memakai transaksi dan `FOR UPDATE SKIP LOCKED` atau bentuk Prisma/raw query minimum yang setara.
- Perubahan `QUEUED/RETRY -> PROCESSING` serta lease disimpan atomik.
- Job selesai hanya setelah Baileys mengembalikan message ID dan message row tersimpan.
- Event receipt mengubah status `SENT -> DELIVERED -> READ` secara monotonic.
- Event yang datang berulang di-upsert dan tidak membuat duplikasi.
- Kegagalan sementara memakai exponential backoff terbatas.
- Logout, opt-out, invalid number, template invalid, dan file invalid adalah kegagalan permanen.
- Job `PROCESSING` dengan lease kedaluwarsa dikembalikan ke `RETRY` setelah restart.
- Retry manual tidak mengubah idempotency key dan tidak membuat message kedua jika message ID sudah tercatat.

## Modul Baru

### `lib/whatsapp/validation.ts`

- Normalisasi nomor.
- Schema template dan payload pengiriman.
- Validasi status customer, MIME, ukuran, dan nama file.

### `lib/whatsapp/templates.ts`

- Allowlist variabel.
- Render dan preview template.
- Validasi variabel yang hilang/tidak dikenal.

### `lib/whatsapp/jobs.ts`

- Enqueue idempoten.
- Pembatalan schedule lama.
- Pemeriksaan jam operasional untuk job otomatis dan kelayakan customer.
- Retry classification yang dapat digunakan worker.

### `lib/whatsapp/data.ts`

- Query inbox, conversation, message, account, template, dan job.
- Filter ownership berdasarkan customer sales PIC.
- Pagination berbasis cursor untuk message timeline.

### `app/actions/whatsapp.ts`

- Kirim pesan manual/template/invoice.
- Upload media.
- Pair, reconnect, logout, dan aktifkan account.
- CRUD template.
- Opt-in/opt-out.
- Link nomor asing ke customer.
- Retry/cancel job.

### `worker/whatsapp/*`

- Lifecycle socket per account.
- Persistent auth state.
- Pairing code handler.
- Scheduler dan queue consumer.
- Inbound message/media handler.
- Delivery/read receipt handler.
- Health check dan graceful shutdown.

## Halaman Baru

### `/whatsapp`

Inbox kerja dua panel pada desktop dan list/detail terpisah pada mobile:

- Filter unread, known/unknown, customer, PIC, account, dan status.
- Timeline teks, gambar, dokumen, status, dan waktu pesan.
- Composer teks dan attachment.
- Pilihan template dan invoice.
- Aksi tandai dibaca dan resolve.
- Aksi tautkan nomor asing ke customer existing atau membuat customer baru.
- Loading, empty, error, upload progress, failed send, offline account, dan opt-out state.

### `/whatsapp/jobs`

Untuk OWNER/ADMIN:

- Filter queued, processing, retry, failed, completed, dan cancelled.
- Detail sumber job, jadwal, account, attempt, serta error teredaksi.
- Retry manual dan cancel.

### `/master-data/whatsapp/accounts`

Untuk OWNER/ADMIN:

- Daftar nomor dan status koneksi.
- Pairing code, reconnect, logout, dan enable sending.
- Last connected, heartbeat, dan error teredaksi.
- Konfirmasi eksplisit untuk logout dan pergantian nomor aktif.

### `/master-data/whatsapp/templates`

Untuk OWNER/ADMIN:

- Daftar template berdasarkan trigger.
- Editor, variabel tersedia, preview, aktif/nonaktif, dan version conflict.

## Halaman Existing yang Terpengaruh

### `/crm/follow-up`

- Aksi utama mengirim template melalui antrean.
- Link `wa.me` tetap tersedia sebagai fallback sekunder.
- Tampilkan queued/sent/failed dan pesan terakhir.

### `/crm/peluang/[id]`

- Tab aktivitas menampilkan pesan WhatsApp inbound/outbound.
- Tambahkan aksi buka conversation dan kirim template.
- Perubahan `nextActionAt` menyinkronkan job follow-up.

### `/crm/pelanggan/[id]` dan `/customers/[id]`

- Tampilkan/edit consent dan opt-out.
- Tampilkan unread, pesan terakhir, dan status conversation.
- Tambahkan aksi buka inbox.

### `/crm/pelanggan` dan `/customers`

- Tambahkan indikator nomor valid, consent, unread, dan pesan terakhir tanpa memuat timeline penuh.

### `/crm/invoices`

- Tambahkan kirim/kirim ulang PDF.
- Tampilkan queued/sent/delivered/read/failed, account, dan error terakhir.

### Invoice Workflow

- Enqueue `INVOICE_ISSUED` hanya setelah transaksi penerbitan berhasil.
- Draft atau revisi yang belum diterbitkan tidak dikirim.

### `/notifications`

- Tampilkan status job repeat/reactivation.
- Pertahankan alur resolve reminder existing.

### Navigasi dan Badge

- Tambahkan menu WhatsApp pada desktop/mobile navigation.
- Tambahkan badge unread WhatsApp.
- Tambahkan account/template ke kelompok Data Master untuk OWNER/ADMIN.
- Perluas badge API/cache tanpa memuat isi conversation.

### `CommunicationActivity`

- Setiap pesan customer yang tertaut dicatat sebagai channel `WHATSAPP`.
- Gunakan direction inbound/outbound existing.
- Metadata hanya menyimpan reference ID ke `WhatsAppMessage`, bukan salinan media atau credential.

## Hak Akses

| Kemampuan | OWNER | ADMIN | SALES |
| --- | --- | --- | --- |
| Lihat seluruh inbox | Ya | Ya | Tidak |
| Lihat customer milik sendiri | Ya | Ya | Ya |
| Kirim pesan | Ya | Ya | Ya, customer milik sendiri |
| Lihat nomor asing | Ya | Ya | Tidak |
| Kelola account/pairing | Ya | Ya | Tidak |
| Kelola template | Ya | Ya | Tidak |
| Lihat/retry/cancel job | Ya | Ya | Tidak |
| Ubah consent | Ya | Ya | Ya, customer milik sendiri |

Semua pembatasan diterapkan pada query dan server action, bukan hanya pada tampilan UI.

## Di Luar Scope V1

- Voice note dan audio.
- Video.
- Lokasi dan kontak.
- Stiker.
- Grup WhatsApp.
- Broadcast/campaign massal.
- Chatbot atau balasan otomatis berbasis AI.
- Routing nomor per sales/PIC.
- Failover otomatis dan round-robin.
- Multi-replica worker.
- Custom database auth adapter Baileys.
- Migrasi ke WhatsApp Business Platform resmi.

## Acceptance Criteria

- Admin dapat pairing beberapa nomor dan memilih tepat satu nomor pengirim aktif.
- Worker tetap terhubung setelah restart tanpa pairing ulang selama sesi masih valid.
- SALES hanya dapat membaca/mengirim conversation customer miliknya.
- Pesan masuk nomor dikenal muncul tepat sekali pada timeline dan communication history.
- Pesan nomor asing muncul pada inbox admin dan dapat ditautkan ke customer.
- Pesan manual mendukung teks, gambar, dokumen, dan PDF invoice.
- Follow-up dan reminder hanya terkirim pukul 09.00-17.00 WIB.
- Invoice issued terkirim sekali dengan PDF yang sama dengan dokumen di ERM.
- Reminder invoice terkirim pada H-3, hari H, dan H+3 hanya jika belum lunas.
- Retry, restart worker, dan event Baileys berulang tidak menghasilkan pesan ganda.
- Opt-out segera memblokir pengiriman dan membatalkan job tertunda.
- Saat account aktif offline, job menunggu dan UI menampilkan masalah tanpa failover otomatis.
- Tidak ada auth state, pairing code aktif, nomor penuh, JID, atau isi pesan dalam log produksi.
- UI inbox berfungsi pada desktop/mobile, keyboard, loading, empty, dan error state.

## TODO Tracking

### Fase 0 - Validasi Teknis dan Operasional

- [ ] Pilih provider managed container dan region terdekat dengan Supabase.
- [ ] Pastikan provider mendukung always-on process dan persistent encrypted volume.
- [ ] Siapkan satu nomor WhatsApp khusus staging.
- [x] Pin versi Baileys `7.x` dan peer dependency yang kompatibel.
- [ ] Jalankan spike pairing, reconnect, send text, inbound, document, dan receipt.
- [ ] Dokumentasikan disconnect reason yang benar-benar muncul pada versi terpilih.
- [x] Tetapkan batas ukuran gambar dan dokumen V1.
- [ ] Konfirmasi kebijakan retensi media 12 bulan.
- [ ] Tetapkan prosedur manual saat nomor dibatasi/diblokir.

### Fase 1 - Database dan Storage

- [x] Tambahkan enum WhatsApp ke Prisma schema.
- [x] Tambahkan model account, template, conversation, message, dan automation job.
- [x] Tambahkan field consent ke `Customer`.
- [x] Tambahkan relasi audit dan relasi user yang diperlukan.
- [x] Tambahkan unique constraint serta index queue/conversation/message.
- [x] Buat migration dengan default consent `UNKNOWN` untuk customer existing.
- [x] Review SQL migration, locking, foreign key, dan delete behavior.
- [ ] Buat bucket private `whatsapp-media`.
- [ ] Buat dan uji policy Storage server-only.
- [ ] Jalankan Prisma validate/generate dan database advisors.

### Fase 2 - Domain Logic

- [x] Implementasikan normalisasi nomor Indonesia/E.164.
- [x] Implementasikan schema validasi account, template, message, dan attachment.
- [x] Implementasikan renderer template dengan allowlist variabel.
- [x] Implementasikan kalkulasi jendela pengiriman 09.00-17.00 WIB.
- [x] Implementasikan enqueue idempoten.
- [x] Implementasikan cancel/reschedule ketika sumber jadwal berubah.
- [x] Implementasikan consent/suppression check terpusat.
- [x] Implementasikan klasifikasi retryable dan permanent failure.
- [x] Implementasikan sanitasi log dan error.

### Fase 3 - Worker Baileys

- [x] Tambahkan entrypoint dan script build/start worker.
- [x] Implementasikan satu instance socket untuk setiap account tersimpan.
- [x] Implementasikan auth state pada persistent volume per account.
- [x] Simpan setiap `creds.update` dan Signal key update.
- [x] Implementasikan pairing code request dan expiry.
- [x] Implementasikan reconnect policy berdasarkan disconnect reason.
- [x] Implementasikan logout dan penghapusan auth state secara aman.
- [x] Implementasikan scheduler setiap menit.
- [x] Implementasikan job claim dengan transaction, lock, dan lease.
- [x] Implementasikan send text, image, document, dan PDF.
- [x] Implementasikan inbound text/image/document handler.
- [x] Implementasikan media download dan upload ke private Storage.
- [x] Implementasikan delivery/read receipt handler.
- [x] Implementasikan stale lease recovery dan bounded retry.
- [x] Implementasikan graceful shutdown dan health check.
- [x] Pastikan worker menolak start sebagai replica kedua untuk volume yang sama.

### Fase 4 - Server Actions dan Data Access

- [x] Tambahkan query account, template, inbox, conversation, message, dan job.
- [x] Terapkan scope SALES berdasarkan `customer.salesPicId`.
- [ ] Tambahkan cursor pagination untuk conversation message.
- [x] Implementasikan kirim manual teks/media/template/invoice.
- [x] Implementasikan pairing, reconnect, logout, dan pergantian account aktif.
- [x] Implementasikan CRUD template dengan optimistic locking.
- [x] Implementasikan link unknown conversation ke customer.
- [x] Implementasikan create customer dari unknown conversation.
- [x] Implementasikan retry/cancel job admin.
- [ ] Tambahkan audit event untuk tindakan sensitif.

### Fase 5 - Pemicu Automasi

- [x] Enqueue/cancel job ketika `nextActionAt` dibuat atau berubah.
- [x] Lewati opportunity `DEAL` dan `LOST`.
- [x] Enqueue repeat order berdasarkan reminder due/generation.
- [x] Enqueue reactivation berdasarkan reminder due/generation.
- [x] Enqueue invoice PDF setelah invoice berhasil menjadi `ISSUED`.
- [x] Buat schedule invoice H-3, hari H, dan H+3.
- [x] Batalkan reminder invoice jika due date berubah.
- [x] Lewati reminder jika invoice sudah lunas/superseded/tidak valid.
- [x] Catat pesan tertaut ke `CommunicationActivity` tanpa duplikasi.

### Fase 6 - UI Admin

- [x] Buat halaman account WhatsApp.
- [x] Buat pairing code, status connection, reconnect, logout, dan enable UI.
- [ ] Buat halaman template dengan editor dan preview.
- [x] Buat halaman monitoring job dengan filter, retry, dan cancel.
- [ ] Tambahkan confirmation dialog untuk logout dan ganti account aktif.
- [ ] Implementasikan loading, empty, error, stale, dan offline state.

### Fase 7 - Inbox WhatsApp

- [x] Buat conversation list dan filter.
- [ ] Buat conversation timeline dengan pagination.
- [x] Buat composer teks.
- [ ] Tambahkan upload gambar/dokumen dan progress state.
- [x] Tambahkan pemilih template.
- [ ] Tambahkan pemilih invoice.
- [x] Tampilkan queued/sent/delivered/read/failed.
- [x] Tambahkan mark read.
- [x] Tambahkan alur unknown sender ke customer existing/new.
- [ ] Buat responsive mobile list/detail navigation.
- [ ] Verifikasi keyboard navigation, focus, label, dan announcement status.

### Fase 8 - Integrasi Halaman Existing

- [x] Integrasikan kirim template pada halaman follow-up.
- [x] Pertahankan `wa.me` sebagai fallback sekunder.
- [ ] Integrasikan conversation pada detail opportunity.
- [x] Tambahkan ringkasan chat pada detail customer.
- [ ] Tambahkan indikator WhatsApp pada daftar customer.
- [ ] Tambahkan kirim/kirim ulang serta status pada invoice.
- [ ] Tambahkan status automasi pada notifications.
- [x] Tambahkan menu dan badge unread pada desktop/mobile navigation.
- [x] Perluas badge count API dan cache invalidation.

### Fase 9 - Pengujian

- [x] Test normalisasi nomor.
- [x] Test validasi dan render template.
- [x] Test batas waktu 09.00 dan 17.00 WIB.
- [ ] Test perhitungan invoice H-3, hari H, dan H+3.
- [ ] Test idempotency dan reschedule.
- [ ] Test opt-out dan archived customer.
- [ ] Test dua consumer tidak mengambil job yang sama.
- [ ] Test stale lease recovery setelah worker restart.
- [ ] Test duplicate inbound event dan receipt.
- [ ] Test invalid number dan permanent failure.
- [ ] Test malformed event, MIME palsu, dan oversized media.
- [ ] Test role serta ownership OWNER/ADMIN/SALES.
- [ ] Test unknown sender dan link customer.
- [ ] Test invoice paid sebelum setiap jadwal reminder.
- [ ] Test reconnect, logged out, dan expired pairing code.
- [ ] Jalankan browser test desktop/mobile untuk seluruh state inbox/admin.
- [ ] Jalankan `npm test`, lint, Prisma validate, dan production build.

### Fase 10 - Deployment dan Rollout

- [ ] Provision managed container dan encrypted persistent volume.
- [ ] Konfigurasi secrets tanpa memasukkannya ke image/log.
- [ ] Konfigurasi satu replica, restart policy, dan health check.
- [ ] Deploy database migration dan Storage policy.
- [ ] Deploy Next.js UI dalam keadaan semua account `sendEnabled=false`.
- [ ] Deploy worker dan pairing nomor staging.
- [ ] Smoke test manual outbound, inbound, media, receipt, dan restart.
- [ ] Aktifkan pengiriman invoice manual pada staging.
- [ ] Aktifkan satu trigger automasi pada staging.
- [ ] Verifikasi tidak ada duplicate send selama retry/restart.
- [ ] Pair nomor produksi dan lakukan smoke test terbatas.
- [ ] Aktifkan automasi secara bertahap per template.
- [ ] Dokumentasikan kill switch dan prosedur incident.
- [ ] Pantau disconnect, failure rate, retry backlog, dan unread backlog.

## Definition of Done

Integrasi dinyatakan selesai ketika seluruh acceptance criteria terpenuhi, seluruh test wajib lulus, worker dapat pulih dari restart tanpa duplikasi, akses SALES tervalidasi di server, kill switch telah diuji, dan rollout nomor produksi berhasil tanpa mengekspos credential atau data chat pada log.
