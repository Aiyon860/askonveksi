# Setup Prisma + Supabase (Hybrid)

Dokumen ini menjelaskan pola akses data yang digunakan di project Askonveksi.

## Arsitektur

```text
Client Browser
  -> Next.js Route Handler / Server Action
    -> Prisma Client
      -> Supabase PostgreSQL
```

- **Prisma** dipakai untuk seluruh query database (server-side).
- **Supabase SDK** tetap tersedia untuk Auth, Storage, dan Realtime.
- `DATABASE_URL` adalah secret server untuk runtime aplikasi dan boleh memakai pooler transaksi.
- `DIRECT_DATABASE_URL` adalah secret untuk Prisma CLI. Gunakan direct connection atau Supavisor session mode.

## Konfigurasi lokal

1. Salin `.env.example` menjadi `.env.local`.
2. Isi `DATABASE_URL` dengan connection string runtime PostgreSQL dari Supabase.
3. Isi `DIRECT_DATABASE_URL` dengan direct connection atau Supavisor session mode port 5432 untuk migration.
4. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` untuk Supabase Auth.
5. Isi `SUPABASE_SECRET_KEY` hanya pada server untuk administrasi user Auth dan Storage.

Untuk deployment serverless, gunakan connection pooler Supabase yang sesuai. Jangan commit `.env.local` atau connection string ke repository.

## File penting

- `prisma/schema.prisma` — definisi model Prisma.
- `prisma.config.ts` — lokasi schema dan pemilihan `DIRECT_DATABASE_URL` untuk CLI dengan fallback ke `DATABASE_URL`.
- `lib/prisma.ts` — singleton Prisma Client dengan PostgreSQL adapter.
- `lib/crm/data.ts` — DAL read-only dengan query Prisma terpilih.
- `app/actions/` — mutation boundary dengan validasi, Auth, dan RBAC.
- `lib/supabase/server.ts` — client SSR berbasis cookie.
- `lib/supabase/admin.ts` — client Admin server-only untuk manajemen user.
- `prisma/migrations/` — migration schema, constraint bisnis, RLS, dan revoke Data API.

## Perintah umum

```bash
npm install
npx prisma migrate deploy
npm run crm:setup-storage
npm run db:validate
npm run db:generate
```

Migration sengaja menggunakan jalur Prisma server-side dan tidak membuka policy Data API untuk role browser. Transaction pooler port 6543 tidak cocok untuk migration.

Jika migration `20260902000000_crm_purchase_order_invoice` sebelumnya gagal dengan P3018 karena proteksi tabel Storage, pastikan transaksinya sudah rollback, siapkan Storage melalui API, lalu tandai percobaan tersebut sebagai rollback sebelum menjalankan ulang:

```bash
npm run crm:reset-storage
npx prisma migrate resolve --rolled-back 20260902000000_crm_purchase_order_invoice
npx prisma migrate deploy
npm run crm:setup-storage
```

Jangan menghapus isi schema `storage` melalui SQL. Kedua script storage menggunakan Supabase Storage API.

Untuk instalasi baru, isi variabel `BOOTSTRAP_OWNER_*`, lalu jalankan `npm run bootstrap:owner` tepat satu kali. Script berhenti jika `AppUser` sudah berisi data dan tidak pernah mencetak password.

## Aturan keamanan

- Prisma hanya boleh diimpor dari kode server; jangan import ke Client Component.
- Validasi autentikasi dan otorisasi sebelum query sensitif.
- Jangan mengirim record database mentah jika UI hanya membutuhkan beberapa field.
- Jika memakai role database yang dapat melewati RLS, enforce authorization di server.
