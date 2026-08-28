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
- `DATABASE_URL` adalah secret server dan tidak boleh memakai prefix `NEXT_PUBLIC_`.

## Konfigurasi lokal

1. Salin `.env.example` menjadi `.env.local`.
2. Isi `DATABASE_URL` dengan connection string PostgreSQL dari Supabase.
3. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` untuk Supabase Auth.
4. Isi `SUPABASE_SECRET_KEY` hanya pada server untuk administrasi user Auth.

Untuk deployment serverless, gunakan connection pooler Supabase yang sesuai. Jangan commit `.env.local` atau connection string ke repository.

## File penting

- `prisma/schema.prisma` — definisi model Prisma.
- `prisma.config.ts` — lokasi schema dan sumber `DATABASE_URL`.
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
npm run db:validate
npm run db:generate
```

Migration sengaja menggunakan jalur Prisma server-side dan tidak membuka policy Data API untuk role browser. Pastikan `DATABASE_URL` memakai direct connection atau Supavisor session mode yang dapat menjalankan migration; transaction pooler tidak cocok untuk migration.

Untuk instalasi baru, isi variabel `BOOTSTRAP_OWNER_*`, lalu jalankan `npm run bootstrap:owner` tepat satu kali. Script berhenti jika `AppUser` sudah berisi data dan tidak pernah mencetak password.

## Aturan keamanan

- Prisma hanya boleh diimpor dari kode server; jangan import ke Client Component.
- Validasi autentikasi dan otorisasi sebelum query sensitif.
- Jangan mengirim record database mentah jika UI hanya membutuhkan beberapa field.
- Jika memakai role database yang dapat melewati RLS, enforce authorization di server.
