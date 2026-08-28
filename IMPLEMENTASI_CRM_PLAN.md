# Rencana Implementasi CRM ERM Askonveksi

Status: **Rencana siap dieksekusi — belum ada implementasi kode**  
Sumber kebutuhan: `ASUMSI_CRM.md`, `PRODUCT.md`, `DESIGN.md`

## Tujuan

Membangun CRM v1 sebagai pusat pipeline sales dan data customer, dengan alur:

`Lead → Follow Up → Penawaran → Deal` atau `Batal`

Deal yang sudah dikonfirmasi harus membuat Sales Order secara atomik. Data aplikasi disimpan melalui Prisma, sedangkan Supabase hanya menangani autentikasi dan sesi.

## Keputusan Produk

- Peran aplikasi: **Owner**, **Admin**, dan **Sales**.
- Ketiga peran dapat melihat dan mengedit data CRM.
- Owner/Admin dapat mengarsipkan customer dan membatalkan/reverse Deal.
- Hanya Owner yang dapat membuat, menonaktifkan, dan mengatur pengguna aplikasi.
- Satu customer dapat memiliki banyak opportunity/order (termasuk repeat order).
- Customer wajib memiliki nama dan minimal satu kontak: WhatsApp, email, atau username Instagram.
- Penghapusan customer bersifat archive-only.
- Stage `Follow Up` wajib memiliki tanggal follow-up.
- Stage `Batal` wajib memiliki alasan.
- Perpindahan ke `Deal` dilakukan melalui aksi **Diterima & Deal** setelah quotation diterima.
- Aksi tersebut mengunci quotation, membuat Sales Order immutable, dan memindahkan opportunity ke `Deal` dalam satu transaksi.
- Negosiasi setelah quotation terbit dibuat sebagai revisi quotation baru.
- Tax/invoice, PDF, upload, integrasi WhatsApp, barcode/portal customer, dan production board berada di luar scope CRM v1.

## Arsitektur Teknis

### Auth dan otorisasi

1. `proxy.ts` menyegarkan cookie Supabase dan melakukan redirect ringan untuk route privat.
2. DAL/server action memanggil `supabase.auth.getClaims()` untuk memverifikasi identitas.
3. Profil pengguna dicari di tabel `AppUser` berdasarkan `authUserId`.
4. Setiap action memeriksa ulang `isActive`, role, dan validasi input; redirect/proxy bukan boundary keamanan.
5. Password sementara wajib diganti pada login pertama (`mustChangePassword`).
6. Pembuatan user oleh Owner menggunakan Supabase Admin API server-only; jika pembuatan `AppUser` gagal, user Auth dihapus sebagai kompensasi.

### Data dan keamanan database

- Prisma menjadi satu-satunya jalur akses data aplikasi.
- Tabel publik di Supabase diberi RLS dan tidak membuka akses anon/authenticated secara langsung.
- Query mengembalikan DTO minimal, tidak membocorkan token atau password.
- Input Server Action divalidasi dengan Zod dari `FormData`.
- Audit log mencatat actor, entity, action, timestamp, dan metadata perubahan tanpa menduplikasi PII sensitif.
- Operasi update memakai `updatedAt`/`version` untuk optimistic concurrency.

## Model Data Prisma

Model dan enum minimum:

- `AppUser`: `authUserId`, email, nama, role, `isActive`, `mustChangePassword`.
- `Customer`: nomor customer, nama, perusahaan, WhatsApp/email/Instagram, alamat, `archivedAt`, version.
- `Opportunity`: nomor opportunity, customer, judul, stage, estimasi jumlah/nilai, deadline, `followUpAt`, `cancelReason`.
- `CRMNote`: catatan append-only per opportunity/customer.
- `Quotation`: nomor, opportunity, revision, status (`DRAFT`, `ISSUED`, `ACCEPTED`, `SUPERSEDED`), snapshot customer/contact/alamat, diskon, total, waktu dan referensi penerimaan.
- `QuotationItem`: deskripsi, quantity, unit price, subtotal.
- `SalesOrder`: nomor, opportunity, quotation unik, snapshot quotation/customer, total, status (`ACTIVE`, `CANCELLED`), alasan pembatalan.
- `SalesOrderItem`: salinan item quotation.
- `AuditEvent`: actor, entity, action, metadata, timestamp.
- `SequenceCounter`: generator nomor aman dalam transaksi.

Constraint/index penting:

- Nomor customer/opportunity/quotation/SO unik.
- `Quotation(opportunityId, revision)` unik.
- `SalesOrder.quotationId` unik.
- Index untuk foreign key, stage, status, `followUpAt`, `archivedAt`, dan timestamp.
- Tidak ada hard delete untuk customer, quotation yang sudah issued, note, atau Sales Order.

## Rencana Pengerjaan Bertahap

### Tahap 1 — Fondasi dan skema

- Perbarui `prisma/schema.prisma` dengan model, enum, relation, index, dan timestamp.
- Buat migration SQL; sertakan RLS/revoke untuk tabel aplikasi.
- Tambahkan generator nomor berbasis `SequenceCounter`.
- Perbarui `.env.example` dengan `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, dan `DATABASE_URL`.

### Tahap 2 — Auth, session, dan permission

- Tambahkan `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/auth/session.ts`, dan `lib/auth/permissions.ts`.
- Migrasikan client browser ke publishable key (dengan fallback kompatibilitas bila diperlukan).
- Tambahkan `proxy.ts` untuk refresh session dan proteksi navigasi dasar.
- Implementasikan login, logout, ganti password pertama kali, dan guard `AppUser.isActive`.

### Tahap 3 — DAL dan Server Actions CRM

- Tambahkan konstanta stage/status dan skema Zod terpusat.
- DAL read: ringkasan pipeline, daftar customer, detail customer, detail opportunity, quotation, dan SO.
- Action customer: create, update, archive dengan pemeriksaan open opportunity dan active SO.
- Action opportunity: create/link customer, update field, pindah stage, tambah note.
- Action quotation: buat draft, edit draft, issue, buat revisi, dan catat penerimaan manual.
- Action **Diterima & Deal**: validasi quotation accepted, lock quotation, create SO + item snapshot, update opportunity, audit dalam satu transaction.
- Action reverse SO: Owner/Admin saja, wajib alasan, cancel SO dan kembalikan opportunity ke `Penawaran` secara atomik.
- Gunakan revalidation setelah mutasi dan error yang aman untuk pengguna.

### Tahap 4 — Antarmuka aplikasi

Route minimum:

- `/login`
- `/account/password`
- `/crm` — kanban utama dan ringkasan pipeline.
- `/crm/pelanggan` — pencarian/filter customer.
- `/crm/pelanggan/[id]` — profil, opportunity, riwayat order, catatan.
- `/crm/peluang/[id]` — detail pipeline, quotation, aktivitas, aksi stage.
- `/sales-orders/[id]` — detail SO immutable dan reverse (Owner/Admin).
- `/admin/users` — manajemen user Owner.

Ketentuan UX/accessibility:

- Bahasa Indonesia, kontras WCAG AA, state loading/error/empty yang jelas.
- Kanban mendukung drag-and-drop HTML5 dan fallback menu status yang keyboard-accessible.
- Perpindahan ke `Follow Up`, `Batal`, atau `Deal` menampilkan form/konfirmasi untuk field wajib.
- Status badge dan aksi memakai komponen UI yang konsisten dengan token shadcn yang sudah ada.
- Customer diarsipkan, bukan dihapus permanen; tampilkan alasan bila aksi ditolak.

### Tahap 5 — Verifikasi

Jalankan setelah implementasi selesai:

```bash
rtk npm run db:validate
rtk npm run db:generate
rtk npm run lint
rtk npm run build
```

Uji perilaku minimum:

1. Pengguna nonaktif tidak dapat membaca atau mengubah CRM meskipun token masih valid.
2. Sales tidak dapat membuat user atau reverse Sales Order.
3. Customer tanpa nama/kontak ditolak.
4. Stage `Follow Up` tanpa tanggal dan `Batal` tanpa alasan ditolak.
5. Deal gagal seluruhnya bila pembuatan quotation/SO gagal (transaction rollback).
6. Quotation issued/accepted dan SO tidak dapat diedit langsung.
7. Archive customer ditolak bila masih memiliki opportunity terbuka atau SO aktif.
8. Reverse SO wajib alasan dan mengubah SO + opportunity + audit secara atomik.
9. Dua request bersamaan tidak menghasilkan nomor duplikat atau double SO.

## Risiko dan Mitigasi

- **Kontrak Supabase key berubah**: gunakan publishable key dan dokumentasikan secret server-only.
- **JWT masih valid setelah user dinonaktifkan**: cek `AppUser.isActive` di setiap DAL/action.
- **Double submit Deal**: unique `quotationId` pada SO, optimistic concurrency, dan transaction.
- **Data historis berubah**: snapshot quotation/SO dan status immutable setelah issue/accept.
- **RLS menghambat Prisma**: gunakan koneksi server yang tepat dan migration eksplisit; verifikasi di environment staging.
- **DnD sulit di perangkat keyboard/touch**: status-menu fallback menjadi jalur utama yang selalu tersedia.

## Batas Rencana

Dokumen ini hanya mendefinisikan pekerjaan dan kriteria penerimaan. Tidak ada migration, generate Prisma, perubahan Auth, atau perubahan UI yang dijalankan sampai implementasi diminta secara eksplisit.
