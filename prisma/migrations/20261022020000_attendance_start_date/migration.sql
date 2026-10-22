-- Batas awal perhitungan absensi. Hari kerja sebelum tanggal ini tidak
-- diturunkan menjadi Alpha, sehingga modul bisa dimulai dari nol tanpa
-- menghapus tanggal pembuatan akun pegawai.
--
-- Idempotent dan tanpa BEGIN/COMMIT sendiri: Prisma sudah membungkus migrasi
-- dalam satu transaksi, dan ADD COLUMN IF NOT EXISTS membuat file ini aman
-- dijalankan ulang bila kolom sudah terlanjur dibuat manual.

ALTER TABLE "BusinessProfile"
  ADD COLUMN IF NOT EXISTS "attendanceStartDate" DATE NOT NULL
    DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date);

UPDATE "BusinessProfile"
SET "attendanceStartDate" = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date
WHERE "attendanceStartDate" IS NULL;
