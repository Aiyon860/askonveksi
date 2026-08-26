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
3. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` jika fitur Supabase SDK digunakan.

Untuk deployment serverless, gunakan connection pooler Supabase yang sesuai. Jangan commit `.env.local` atau connection string ke repository.

## File penting

- `prisma/schema.prisma` — definisi model Prisma.
- `prisma.config.ts` — lokasi schema dan sumber `DATABASE_URL`.
- `lib/prisma.ts` — singleton Prisma Client dengan PostgreSQL adapter.
- `lib/data/` — fungsi data access server-side.
- `app/api/test/route.ts` — contoh Route Handler yang memanggil data layer.
- `lib/supabase/client.ts` — client Supabase untuk fitur non-database.

## Perintah umum

```bash
npm install
npm run db:validate
npm run db:generate
```

Jika database Supabase sudah memiliki tabel, introspeksi schema terlebih dahulu:

```bash
npx prisma db pull
npm run db:generate
```

Setelah model tersedia, gunakan query typed seperti `prisma.user.findMany()` di `lib/data/`. Query raw pada `lib/data/test.ts` hanya untuk connection check sementara karena schema aplikasi belum didefinisikan.

## Aturan keamanan

- Prisma hanya boleh diimpor dari kode server; jangan import ke Client Component.
- Validasi autentikasi dan otorisasi sebelum query sensitif.
- Jangan mengirim record database mentah jika UI hanya membutuhkan beberapa field.
- Jika memakai role database yang dapat melewati RLS, enforce authorization di server.
