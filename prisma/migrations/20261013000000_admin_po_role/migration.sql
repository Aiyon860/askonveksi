-- Sprint 3 D1: rename peran Admin Produksi menjadi Admin PO.
-- 1) Tambah nilai 'ADMIN_PO' pada enum "AppRole" (idempoten).
-- 2) Backfill akun 'ADMIN_PRODUCTION' lama menjadi 'ADMIN_PO' (idempoten).
-- Nilai enum lama sengaja tidak dihapus agar riwayat audit tetap valid.

ALTER TYPE "AppRole" ADD VALUE IF NOT EXISTS 'ADMIN_PO';

UPDATE "AppUser"
SET "role" = 'ADMIN_PO', "updatedAt" = CURRENT_TIMESTAMP
WHERE "role" = 'ADMIN_PRODUCTION';
