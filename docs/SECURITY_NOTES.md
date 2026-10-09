# Catatan Keamanan

## Perbaikan advisory (9 Oktober 2026)

- Gate CI yang sempat gagal: `npm audit --omit=dev --audit-level=high` di `.github/workflows/deploy.yml`
  (exit 1 karena 2 vuln high) sehingga job build/migrate/deploy VPS tidak jalan.
- Yang diperbaiki:
  - `sharp 0.35.4` → `0.35.5` (HIGH, CVE-2026-96889, librsvg). Wajib edit pin di `package.json`
    karena versi tambalan berada di luar range pin lama. Patch bump, risiko rendah.
  - `source-map-js 1.2.1` (HIGH, GHSA-68fv-2mgg-jv7q, via `next` → `postcss`) — sembuh lewat `npm audit fix`.
  - `music-metadata 11.15.0` (moderate, via `@whiskeysockets/baileys`) — sembuh lewat `npm audit fix`;
    level moderate tidak menggagalkan gate ini.
- Tanpa `--force`, sesuai kebijakan repo. Verifikasi: audit gate exit 0, `tsc` bersih,
  `eslint` 0 error, `next build` (standalone) lolos dan 21 slug `/produk` terprerender SSG.
- Sisa: 9 vuln high hanya di dependency dev (`shadcn`/`ts-morph` chain dkk), dikecualikan
  `--omit=dev` sehingga tidak memblokir deploy. Pantau dan bereskan terpisah bila advisory menyentuh runtime.

## Advisory dependency tertunda

- Tanggal audit: 27 Agustus 2026
- Review berikutnya: 27 September 2026
- Advisory: `GHSA-ggr8-5vv4-36mx` pada `deepmerge-ts < 8.0.0`
- Jalur dependency: `prisma` (development CLI) → `@prisma/config` → `deepmerge-ts@7.1.5`
- Reachability: tidak masuk runtime aplikasi. Pemakaian hanya ketika Prisma CLI membaca `prisma.config.ts` yang berasal dari repository, bukan input pengguna.
- Alasan ditunda: perbaikan yang disarankan `npm audit` memaksa downgrade lintas-major ke Prisma 6.12.0 dan berisiko merusak schema/client Prisma 7.10.0.
- Tindakan: pantau rilis Prisma yang membawa `deepmerge-ts >= 8`; jangan menjalankan `npm audit fix --force`.
