# Catatan Keamanan

## Advisory dependency tertunda

- Tanggal audit: 27 Agustus 2026
- Review berikutnya: 27 September 2026
- Advisory: `GHSA-ggr8-5vv4-36mx` pada `deepmerge-ts < 8.0.0`
- Jalur dependency: `prisma` (development CLI) → `@prisma/config` → `deepmerge-ts@7.1.5`
- Reachability: tidak masuk runtime aplikasi. Pemakaian hanya ketika Prisma CLI membaca `prisma.config.ts` yang berasal dari repository, bukan input pengguna.
- Alasan ditunda: perbaikan yang disarankan `npm audit` memaksa downgrade lintas-major ke Prisma 6.12.0 dan berisiko merusak schema/client Prisma 7.10.0.
- Tindakan: pantau rilis Prisma yang membawa `deepmerge-ts >= 8`; jangan menjalankan `npm audit fix --force`.
