# ERM Askonveksi

Aplikasi operasional internal berbasis Next.js 16, Prisma, PostgreSQL Supabase, dan Supabase Auth. Implementasi saat ini mencakup CRM pipeline, customer, revisi Purchase Order dan invoice, pencatatan DP/lunas, Sales Order immutable, RBAC, serta audit log.

## Menjalankan secara lokal

1. Salin `.env.example` menjadi `.env` dan isi seluruh konfigurasi Supabase/database.
2. Untuk migration reset CRM 2026-09-02, siapkan storage melalui Storage API, lalu terapkan migration dan buat Prisma Client. Perintah storage mengosongkan serta menghapus bucket bukti persetujuan lama secara permanen.
3. Buat Owner pertama satu kali.
4. Jalankan development server.

```bash
rtk npm run crm:reset-storage
rtk npx prisma migrate deploy
rtk npm run db:generate
rtk npm run bootstrap:owner
rtk npm run dev
```

Setelah Owner berhasil login dan mengganti password sementara, hapus `BOOTSTRAP_OWNER_PASSWORD` dari environment.

## Kontrak akses data

- Supabase SDK hanya menangani Auth dan cookie session.
- Prisma menangani seluruh data aplikasi melalui server.
- Role, status aktif, dan kewajiban ganti password berasal dari `AppUser`, bukan metadata JWT.
- Setiap Server Action memvalidasi input, autentikasi, dan role kembali.
- Tabel aplikasi mengaktifkan RLS serta mencabut akses langsung role `anon`/`authenticated`.
- PO Disepakati, invoice Terbit, dan Sales Order disimpan sebagai dokumen historis yang tidak diedit langsung.
- Lampiran desain PO berada di bucket privat dan hanya diunduh melalui route yang terautentikasi.

## Verifikasi

```bash
rtk npm test
rtk npm run db:validate
rtk npm run db:generate
rtk npm run lint
rtk npm run build -- --webpack
```

Build webpack disediakan sebagai jalur verifikasi bila Turbopack tidak diizinkan membuka port proses oleh environment sandbox.

Dokumentasi database lebih lanjut tersedia di [docs/PRISMA_SETUP.md](docs/PRISMA_SETUP.md). Keputusan terbaru pipeline CRM tersedia di [PipelineCRM_Baru.md](PipelineCRM_Baru.md).
