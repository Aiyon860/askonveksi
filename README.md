# ERM Askonveksi

Aplikasi operasional internal berbasis Next.js 16, Prisma, PostgreSQL Supabase, dan Supabase Auth. Implementasi saat ini mencakup CRM pipeline, customer, quotation revision, Sales Order immutable, RBAC, serta audit log.

## Menjalankan secara lokal

1. Salin `.env.example` menjadi `.env` dan isi seluruh konfigurasi Supabase/database.
2. Terapkan migration dan buat Prisma Client.
3. Buat Owner pertama satu kali.
4. Jalankan development server.

```bash
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
- Quotation final dan Sales Order disimpan sebagai snapshot immutable.

## Verifikasi

```bash
rtk npm test
rtk npm run db:validate
rtk npm run db:generate
rtk npm run lint
rtk npm run build -- --webpack
```

Build webpack disediakan sebagai jalur verifikasi bila Turbopack tidak diizinkan membuka port proses oleh environment sandbox.

Dokumentasi database lebih lanjut tersedia di [docs/PRISMA_SETUP.md](docs/PRISMA_SETUP.md). Rencana dan acceptance criteria CRM tersedia di [IMPLEMENTASI_CRM_PLAN.md](IMPLEMENTASI_CRM_PLAN.md).
